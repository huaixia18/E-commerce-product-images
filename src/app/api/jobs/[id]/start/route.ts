import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { panelQueue, panelJobId } from "@/lib/queue";
import { PANEL_IDS, type JobInput, type PanelId } from "@/lib/promptTemplate";

const schema = z.object({
  /** Subset of panels to generate. Defaults to all if omitted. */
  panels: z
    .array(z.enum(PANEL_IDS as [PanelId, ...PanelId[]]))
    .min(1)
    .max(PANEL_IDS.length)
    .optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: unknown = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job || job.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (job.status !== "PENDING") {
    return NextResponse.json(
      { error: `Job already ${job.status}` },
      { status: 409 },
    );
  }

  // Dedupe panel selection while preserving the canonical order.
  const requestedSet = new Set(parsed.data.panels ?? PANEL_IDS);
  const panels = PANEL_IDS.filter((p) => requestedSet.has(p));
  const cost = panels.length; // 1 panel = 1 credit

  // Reserve credits + persist the selection into inputJson atomically.
  // SELECT FOR UPDATE semantics are achieved by `update` with a where on
  // credits >= cost — if no row matches, we know the user is short.
  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      const dec = await tx.user.updateMany({
        where: { id: session.user!.id, credits: { gte: cost } },
        data: { credits: { decrement: cost } },
      });
      if (dec.count === 0) throw new Error("INSUFFICIENT_CREDITS");

      const oldInput = job.inputJson as unknown as JobInput;
      const newInput: JobInput = { ...oldInput, panels };

      const j = await tx.job.update({
        where: { id },
        data: {
          status: "RUNNING",
          startedAt: new Date(),
          creditsCost: cost,
          inputJson: newInput as never,
        },
      });
      await tx.creditEntry.create({
        data: {
          userId: session.user!.id,
          jobId: id,
          amount: -cost,
          type: "SPEND",
          note: `Reserve ${cost} credit(s) for ${panels.length} panel(s)`,
        },
      });
      return j;
    });
  } catch (e) {
    if (e instanceof Error && e.message === "INSUFFICIENT_CREDITS") {
      return NextResponse.json({ error: "积分不足" }, { status: 402 });
    }
    throw e;
  }

  // Enqueue one job per panel. 2 retries (3 attempts total) with exponential backoff.
  // If enqueue fails AFTER the credit deduction, refund and roll the Job back
  // to PENDING — the user shouldn't lose credits to our infra hiccup.
  try {
    const queue = panelQueue();
    await Promise.all(
      panels.map((panel) =>
        queue.add(
          panel,
          { jobId: id, panel, userId: session.user!.id },
          {
            jobId: panelJobId(id, panel),
            attempts: 3,
            backoff: { type: "exponential", delay: 4000 },
            removeOnComplete: 1000,
            removeOnFail: 1000,
          },
        ),
      ),
    );
  } catch (e) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: session.user!.id },
        data: { credits: { increment: cost } },
      });
      await tx.creditEntry.create({
        data: {
          userId: session.user!.id,
          jobId: id,
          amount: cost,
          type: "REFUND",
          note: "Enqueue failed, credits refunded",
        },
      });
      await tx.job.update({
        where: { id },
        data: { status: "PENDING", startedAt: null, creditsCost: 0 },
      });
    });
    throw e;
  }

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    panels,
    creditsReserved: cost,
  });
}
