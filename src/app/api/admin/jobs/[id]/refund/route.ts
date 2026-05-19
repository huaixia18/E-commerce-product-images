import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";

const schema = z.object({
  /**
   * How many credits to give back. Defaults to `creditsCost` (full refund)
   * when omitted. Must be > 0 and ≤ creditsCost.
   */
  amount: z.number().int().positive().optional(),
  note: z.string().max(200).optional(),
});

/**
 * Manual goodwill refund for a generation task. Adds credits back to the
 * user and writes a REFUND ledger row tied to this job. Does NOT change
 * the job status — the produced images stay on OSS and remain downloadable
 * (this is "we paid for the AI output, here's some credits to compensate").
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  let json: unknown = {};
  try {
    const text = await req.text();
    if (text) json = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const max = job.creditsCost;
  const amount = parsed.data.amount ?? max;
  if (amount <= 0) {
    return NextResponse.json({ error: "Amount must be > 0" }, { status: 400 });
  }
  if (amount > max) {
    return NextResponse.json(
      { error: `Refund exceeds job cost (${amount} > ${max})` },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: job.userId },
      data: { credits: { increment: amount } },
    });
    await tx.creditEntry.create({
      data: {
        userId: job.userId,
        jobId: job.id,
        amount,
        type: "REFUND",
        note: parsed.data.note?.trim() || `Manual refund by ${admin.email}`,
      },
    });
  });

  return NextResponse.json({ ok: true, refunded: amount });
}
