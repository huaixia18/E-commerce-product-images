import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";

const schema = z.object({
  /**
   * How many credits to give back. Defaults to the *remaining* refund budget
   * (creditsCost minus what's already been refunded). Must be > 0.
   */
  amount: z.number().int().positive().optional(),
  note: z.string().max(200).optional(),
});

/**
 * Manual goodwill refund for a generation task. Idempotent against the
 * job's lifetime refund budget: the total of every REFUND ledger row tied
 * to this job (worker auto-refunds + prior admin refunds) plus this new
 * amount must not exceed the job's original credits cost.
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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  // Everything that matters here — uniqueness checks, ledger inserts, balance
  // update — happens in a single transaction so concurrent refund POSTs
  // can't both pass the budget check.
  try {
    const result = await prisma.$transaction(async (tx) => {
      const job = await tx.job.findUnique({ where: { id } });
      if (!job) throw new Error("NOT_FOUND");

      // Sum all positive REFUND-typed entries tied to this job. amount is
      // positive on refunds, negative on spends, so we only sum positives
      // of type REFUND. (`creditEntries.aggregate` doesn't filter on amount
      // sign cheaply; pull rows and sum in JS — should be <10 rows per job.)
      const refundRows = await tx.creditEntry.findMany({
        where: { jobId: id, type: "REFUND" },
        select: { amount: true },
      });
      const alreadyRefunded = refundRows.reduce(
        (sum, r) => sum + Math.max(0, r.amount),
        0,
      );

      // Refund budget: the lifetime cap is whatever the user originally paid.
      // Note: worker.finalize() currently overwrites creditsCost to `produced`
      // on terminal state. We use the *higher* of {current creditsCost,
      // alreadyRefunded + total spent} as the true cap, derived from SPEND
      // ledger rows so it doesn't drift if finalize was rerun.
      const spendRows = await tx.creditEntry.findMany({
        where: { jobId: id, type: "SPEND" },
        select: { amount: true },
      });
      const totalSpent = spendRows.reduce(
        (sum, r) => sum + Math.max(0, -r.amount),
        0,
      );
      // `creditsCost` shows what the user is currently being held accountable
      // for, but the original max debit comes from the SPEND ledger. Use the
      // larger of the two so the cap can't shrink mid-life.
      const cap = Math.max(job.creditsCost, totalSpent);
      const remaining = Math.max(0, cap - alreadyRefunded);

      const amount = parsed.data.amount ?? remaining;
      if (amount <= 0) {
        throw new Error("NO_BUDGET");
      }
      if (amount > remaining) {
        throw new Error(
          `OVER_BUDGET:${amount}:${remaining}:${cap}:${alreadyRefunded}`,
        );
      }

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
          note:
            parsed.data.note?.trim() ||
            `Manual refund by ${admin.email} (${alreadyRefunded + amount}/${cap})`,
        },
      });
      return { refunded: amount, alreadyRefunded, cap };
    });

    return NextResponse.json({
      ok: true,
      refunded: result.refunded,
      totalRefunded: result.alreadyRefunded + result.refunded,
      cap: result.cap,
    });
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (e.message === "NO_BUDGET") {
        return NextResponse.json(
          { error: "该任务已无可退积分" },
          { status: 400 },
        );
      }
      if (e.message.startsWith("OVER_BUDGET:")) {
        const [, amount, remaining, cap, already] = e.message.split(":");
        return NextResponse.json(
          {
            error: `本次退款超出剩余额度 (申请 ${amount}，剩余 ${remaining}，原始成本 ${cap}，已退 ${already})`,
          },
          { status: 400 },
        );
      }
    }
    throw e;
  }
}
