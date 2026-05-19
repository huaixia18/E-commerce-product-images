import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";
import { panelQueue, panelJobId } from "@/lib/queue";
import { ALL_PANEL_IDS, type JobInput, type PanelId } from "@/lib/promptTemplate";
import { requireSameOrigin } from "@/lib/originCheck";

/**
 * Re-enqueue panels that don't have a GENERATED image yet. Common case:
 * the job finalized as PARTIAL or FAILED, credits were already refunded
 * to the user, but the user complains and admin wants to give them one
 * more shot — without re-charging.
 *
 * Important: this does NOT debit credits and does NOT touch the parent
 * Job status (the worker's finalize step will re-mark it when it sees
 * the queue is fully drained again). Job is bumped back to RUNNING so
 * the polling UI on /generate/[id] picks it up.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const originErr = requireSameOrigin(req);
  if (originErr) return originErr;
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const job = await prisma.job.findUnique({
    where: { id },
    include: { images: { where: { kind: "GENERATED" } } },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const input = job.inputJson as unknown as JobInput;
  const requested = (input.panels ?? ALL_PANEL_IDS) as PanelId[];
  const done = new Set(job.images.map((i) => i.panel).filter(Boolean) as PanelId[]);
  const missing = requested.filter((p) => !done.has(p));

  if (missing.length === 0) {
    return NextResponse.json({ error: "No failed panels to retry" }, { status: 400 });
  }

  // Remember the prior status so we can roll back if enqueue fails.
  const priorStatus = job.status;
  const priorFinishedAt = job.finishedAt;
  const priorError = job.errorMessage;

  // Reset job to RUNNING so the worker's finalize step considers it open
  // again. finishedAt is cleared; startedAt left intact for audit.
  await prisma.job.update({
    where: { id },
    data: { status: "RUNNING", finishedAt: null, errorMessage: null },
  });

  // Enqueue panel jobs. Re-use the canonical id so BullMQ dedupes — if
  // for some reason a job with the same id is still lingering, we delete
  // it first. If anything throws here, the status reset above would leave
  // the job stuck in RUNNING, so we roll back.
  try {
    const queue = panelQueue();
    await Promise.all(
      missing.map(async (panel) => {
        const jid = panelJobId(job.id, panel);
        const existing = await queue.getJob(jid).catch(() => null);
        if (existing) {
          await existing.remove().catch(() => {});
        }
        await queue.add(
          panel,
          { jobId: job.id, panel, userId: job.userId },
          {
            jobId: jid,
            attempts: 3,
            backoff: { type: "exponential", delay: 4000 },
            removeOnComplete: 1000,
            removeOnFail: 1000,
          },
        );
      }),
    );
  } catch (e) {
    console.error(`[admin/retry] enqueue failed for job ${id}, rolling back`, e);
    await prisma.job
      .update({
        where: { id },
        data: { status: priorStatus, finishedAt: priorFinishedAt, errorMessage: priorError },
      })
      .catch((rollbackErr) => {
        console.error(`[admin/retry] ROLLBACK FAILED for job ${id}`, rollbackErr);
      });
    return NextResponse.json(
      { error: "重试入队失败，已回滚" },
      { status: 502 },
    );
  }

  // Audit log so the user's ledger explains why nothing changed (admin
  // freebie). amount=0 since we're not moving any credits.
  await prisma.creditEntry.create({
    data: {
      userId: job.userId,
      jobId: job.id,
      amount: 0,
      type: "ADMIN_ADJUST",
      note: `[admin_retry] Admin ${admin.email} retried ${missing.length} panel(s) (no charge)`,
    },
  });

  return NextResponse.json({ ok: true, retried: missing });
}
