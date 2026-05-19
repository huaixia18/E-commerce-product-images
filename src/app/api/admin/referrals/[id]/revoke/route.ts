import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";
import { requireSameOrigin } from "@/lib/originCheck";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const originErr = requireSameOrigin(req);
  if (originErr) return originErr;
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const ref = await prisma.referral.findUnique({ where: { id } });
  if (!ref) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ref.status !== "GRANTED") {
    return NextResponse.json({ error: "Already revoked" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    const claim = await tx.referral.updateMany({
      where: { id, status: "GRANTED" },
      data: { status: "REVOKED" },
    });
    if (claim.count === 0) return;

    // Claw back referrer reward (clamped to current balance).
    const referrer = await tx.user.findUnique({
      where: { id: ref.referrerId },
      select: { credits: true },
    });
    if (referrer) {
      const debit = Math.min(referrer.credits, ref.referrerReward);
      if (debit > 0) {
        await tx.user.update({
          where: { id: ref.referrerId },
          data: { credits: { decrement: debit } },
        });
        await tx.creditEntry.create({
          data: {
            userId: ref.referrerId,
            amount: -debit,
            type: "ADMIN_ADJUST",
            note: `Referral revoked by ${admin.email} (ref ${id.slice(0, 8)})`,
          },
        });
      }
    }

    // Claw back invitee reward (also clamped).
    const invitee = await tx.user.findUnique({
      where: { id: ref.inviteeId },
      select: { credits: true },
    });
    if (invitee) {
      const debit = Math.min(invitee.credits, ref.inviteeReward);
      if (debit > 0) {
        await tx.user.update({
          where: { id: ref.inviteeId },
          data: { credits: { decrement: debit } },
        });
        await tx.creditEntry.create({
          data: {
            userId: ref.inviteeId,
            amount: -debit,
            type: "ADMIN_ADJUST",
            note: `Referral revoked by ${admin.email} (ref ${id.slice(0, 8)})`,
          },
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}
