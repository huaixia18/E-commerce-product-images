import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";
import { requireSameOrigin } from "@/lib/originCheck";

const schema = z.object({ action: z.enum(["mark_paid", "refund"]) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const originErr = requireSameOrigin(req);
  if (originErr) return originErr;
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.action === "mark_paid") {
    if (order.status !== "PENDING") {
      return NextResponse.json({ error: `Order is ${order.status}, not PENDING` }, { status: 400 });
    }
    await prisma.$transaction(async (tx) => {
      const claim = await tx.order.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "PAID", paidAt: new Date() },
      });
      if (claim.count === 0) return;
      await tx.user.update({
        where: { id: order.userId },
        data: { credits: { increment: order.credits } },
      });
      await tx.creditEntry.create({
        data: {
          userId: order.userId,
          orderId: order.id,
          amount: order.credits,
          type: "PURCHASE",
          note: `Manual mark-paid by ${admin.email}`,
        },
      });
    });
    return NextResponse.json({ ok: true });
  }

  // refund
  if (order.status !== "PAID") {
    return NextResponse.json({ error: `Order is ${order.status}, not PAID` }, { status: 400 });
  }
  // Subtract granted credits from the user; if not enough, take whatever's
  // left (we don't want to leave them in the red, but admins doing refunds
  // should be aware).
  await prisma.$transaction(async (tx) => {
    const claim = await tx.order.updateMany({
      where: { id, status: "PAID" },
      data: { status: "REFUNDED" },
    });
    if (claim.count === 0) return;
    const u = await tx.user.findUnique({ where: { id: order.userId }, select: { credits: true } });
    if (!u) return;
    const debit = Math.min(u.credits, order.credits);
    if (debit > 0) {
      await tx.user.update({
        where: { id: order.userId },
        data: { credits: { decrement: debit } },
      });
    }
    await tx.creditEntry.create({
      data: {
        userId: order.userId,
        orderId: order.id,
        amount: -debit,
        type: "REFUND",
        note: `Manual refund by ${admin.email}${debit < order.credits ? ` (only ${debit} clawed back; user had insufficient balance)` : ""}`,
      },
    });
  });
  return NextResponse.json({ ok: true });
}
