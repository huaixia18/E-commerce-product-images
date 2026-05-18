import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { paymentProvider } from "@/lib/payment/mockProvider";

/**
 * POST /api/payments/notify
 * Provider webhook. Treats double-fire as idempotent: only the first call
 * that transitions PENDING → PAID actually grants credits.
 *
 * Production: real providers expect a specific text body in the response
 * ("success" for alipay, XML for wechat). The mock provider doesn't care.
 */
export async function POST(req: Request) {
  const provider = paymentProvider();
  const event = await provider.verifyNotify(req.clone()).catch((e) => {
    console.error("[notify] verify failed:", e);
    return null;
  });
  if (!event) {
    return NextResponse.json({ error: "Invalid notify" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: event.outTradeNo },
    select: { id: true, userId: true, status: true, amountCents: true, credits: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.amountCents !== event.amountCents) {
    console.error(
      `[notify] amount mismatch: order=${order.amountCents} event=${event.amountCents}`,
    );
    return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
  }

  // Atomic state flip + credit grant. Only the row that observes
  // status='PENDING' performs the side effects.
  await prisma.$transaction(async (tx) => {
    const claim = await tx.order.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: { status: "PAID", paidAt: event.paidAt },
    });
    if (claim.count === 0) return; // already settled by an earlier delivery

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
        note: `Purchase ${order.credits} credits via order ${order.id.slice(0, 8)}`,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
