// Standalone BullMQ worker. Run with `pnpm worker`.
//
// Responsibilities:
//   1. For each panel job, expand the prompt + fetch reference image URLs
//   2. Call gpt-image-2 (or stub) and persist the resulting bytes to OSS
//   3. Write a GENERATED Image row
//   4. After every job, check whether the parent Job is fully decided —
//      if so, mark it SUCCEEDED/PARTIAL/FAILED and refund unspent credits.
//
// Retry policy: BullMQ retries each panel job up to 2 times (3 attempts total)
// with exponential backoff. Final failure is recorded; refunds happen at the
// Job-aggregation step below.

import { Worker } from "bullmq";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  PANEL_QUEUE,
  redisConnection,
  type PanelJobData,
} from "./lib/queue";
import { prisma } from "./lib/prisma";
import { putObject, signedGetUrl } from "./lib/oss";
import { generateImage } from "./lib/imageClient";
import { expandPrompt, type JobInput, type PanelId, ALL_PANEL_IDS } from "./lib/promptTemplate";

const STUB = process.env.STUB_IMAGE_MODEL === "1";

const CONCURRENCY = 3;

async function processPanel(data: PanelJobData) {
  const { jobId, panel } = data;
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { images: { where: { kind: "SOURCE" }, orderBy: { createdAt: "asc" } } },
  });
  if (!job) throw new Error(`Job ${jobId} not found`);

  const input = job.inputJson as unknown as JobInput;
  const { prompt, size } = expandPrompt(input, panel);

  // Sign the source images so gpt-image-2 can fetch them. Stub mode skips
  // OSS entirely (placeholder keys in dev don't resolve).
  const referenceUrls = STUB ? [] : job.images.map((img) => signedGetUrl(img.ossKey, 900));

  const result = await generateImage({
    prompt,
    size,
    quality: "high",
    referenceUrls,
  });

  const ext = result.mimeType === "image/jpeg" ? "jpg" : result.mimeType === "image/webp" ? "webp" : "png";
  const ossKey = `generated/${jobId}/${panel}-${randomUUID()}.${ext}`;

  let url: string | undefined;
  if (STUB) {
    // Write to disk so caller can eyeball it, and embed the PNG as data URL
    // on the Image row so polling can render without OSS.
    const localPath = path.join(process.cwd(), "tmp", ossKey);
    await mkdir(path.dirname(localPath), { recursive: true });
    await writeFile(localPath, result.buffer);
    url = `data:${result.mimeType};base64,${result.buffer.toString("base64")}`;
    console.log(`[worker] (stub) wrote ${localPath}`);
  } else {
    await putObject(ossKey, result.buffer, result.mimeType);
  }

  await prisma.image.create({
    data: {
      jobId,
      kind: "GENERATED",
      panel,
      ossKey,
      url,
      bytes: result.buffer.length,
      mimeType: result.mimeType,
    },
  });
}

/**
 * After any panel finishes (succeeded or permanently failed), check whether
 * the whole Job is done. Mark final status + refund credits for panels that
 * never produced an output.
 */
async function finalizeIfDone(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true, status: true, inputJson: true, userId: true, creditsCost: true },
  });
  if (!job) return;
  if (job.status === "SUCCEEDED" || job.status === "FAILED" || job.status === "PARTIAL") return;

  const input = job.inputJson as unknown as JobInput;
  const requested = (input.panels ?? ALL_PANEL_IDS) as PanelId[];

  // Look at the queue + DB to determine completion. The queue knows about
  // still-pending or in-flight jobs; the DB knows about produced images.
  const queueMod = await import("./lib/queue");
  const queue = queueMod.panelQueue();
  const counts = await Promise.all(
    requested.map(async (panel) => {
      const j = await queue.getJob(queueMod.panelJobId(jobId, panel));
      const state = j ? await j.getState() : "completed";
      const img = await prisma.image.findFirst({
        where: { jobId, kind: "GENERATED", panel },
        select: { id: true },
      });
      return { panel, state, hasImage: !!img };
    }),
  );

  const stillPending = counts.some(
    (c) => c.state === "waiting" || c.state === "active" || c.state === "delayed",
  );
  if (stillPending) return;

  const produced = counts.filter((c) => c.hasImage).length;
  const total = requested.length;
  let status: "SUCCEEDED" | "PARTIAL" | "FAILED";
  if (produced === total) status = "SUCCEEDED";
  else if (produced === 0) status = "FAILED";
  else status = "PARTIAL";

  // Compute how much we still owe the user back. Refund cap is the original
  // amount they paid (sum of SPEND entries on this job — survives even if
  // creditsCost was tampered with). Anything we've already refunded for this
  // job (worker auto-refund or admin goodwill) counts toward the cap.
  //
  // Important: this is what enables admin "retry" of a previously-finalized
  // PARTIAL/FAILED job to work safely. After the first finalize refunded
  // N missing panels, retrying and producing them must NOT also be paid for
  // by the user — but neither should we double-refund. The math here keeps
  // the user's net debit equal to `produced` regardless of how many times
  // finalize runs.
  const [spendRows, refundRows] = await Promise.all([
    prisma.creditEntry.findMany({
      where: { jobId, type: "SPEND" },
      select: { amount: true },
    }),
    prisma.creditEntry.findMany({
      where: { jobId, type: "REFUND" },
      select: { amount: true },
    }),
  ]);
  const totalSpent = spendRows.reduce((s, r) => s + Math.max(0, -r.amount), 0);
  const alreadyRefunded = refundRows.reduce(
    (s, r) => s + Math.max(0, r.amount),
    0,
  );
  // Target net debit = produced panels. Refund whatever balances that out.
  const targetRefund = Math.max(0, totalSpent - produced - alreadyRefunded);

  // Atomic state transition: only the first finalize call wins for a given
  // RUNNING window. (Retry resets status to RUNNING which intentionally
  // re-opens this guard — the refund computation above is idempotent so a
  // second finalize either adds nothing or tops up to the correct cap.)
  await prisma.$transaction(async (tx) => {
    const claim = await tx.job.updateMany({
      where: { id: jobId, status: "RUNNING" },
      data: {
        status,
        finishedAt: new Date(),
        // creditsCost is intentionally NOT overwritten here. It stays equal
        // to whatever /start charged (or 0 if never started). Admin tools
        // and the dashboard rely on this being a stable historical value;
        // they should read produced count from the Image table, not this.
      },
    });
    if (claim.count === 0) return;
    if (targetRefund > 0) {
      await tx.user.update({
        where: { id: job.userId },
        data: { credits: { increment: targetRefund } },
      });
      await tx.creditEntry.create({
        data: {
          userId: job.userId,
          jobId,
          amount: targetRefund,
          type: "REFUND",
          note:
            alreadyRefunded > 0
              ? `Top-up refund after retry: ${targetRefund} (net debit now ${produced}/${totalSpent})`
              : `Refund ${targetRefund} unproduced panel(s)`,
        },
      });
    }
  });
}

const worker = new Worker<PanelJobData>(
  PANEL_QUEUE,
  async (job) => {
    await processPanel(job.data);
  },
  {
    connection: redisConnection(),
    concurrency: CONCURRENCY,
  },
);

worker.on("completed", async (job) => {
  console.log(`[worker] completed ${job.id}`);
  await finalizeIfDone(job.data.jobId).catch((e) =>
    console.error(`finalize after completed ${job.id}:`, e),
  );
});

worker.on("failed", async (job, err) => {
  console.error(`[worker] failed ${job?.id} (attempt ${job?.attemptsMade}/${job?.opts.attempts}): ${err.message}`);
  // Final failure (all attempts exhausted) — finalize will refund this panel.
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    await finalizeIfDone(job.data.jobId).catch((e) =>
      console.error(`finalize after failed ${job?.id}:`, e),
    );
  }
});

worker.on("error", (err) => {
  console.error("[worker] error:", err);
});

console.log(`[worker] started, concurrency=${CONCURRENCY}, queue=${PANEL_QUEUE}`);
