// Shared webhook handler: verify a payment notification through the given
// provider, then atomically settle the order + grant credits. Idempotent —
// a replayed callback won't double-credit. Returns the NotifyAck the route
// should reply with (each gateway expects its own ACK format).

import { prisma } from "@/lib/prisma";
import { paymentProvider } from "./provider";
import type { PayChannel } from "./packages";
import type { NotifyAck } from "./provider";

export async function handlePaymentNotify(
  channel: PayChannel | "mock",
  req: Request,
): Promise<NotifyAck> {
  // The factory keys on PayChannel; "mock" routes through whichever channel
  // since the mock provider ignores it. We pass "wechat" arbitrarily for mock.
  const provider = paymentProvider(channel === "mock" ? "wechat" : channel);

  let verify;
  try {
    verify = await provider.verifyNotify(req);
  } catch (e) {
    console.error(`[notify:${channel}] verify threw:`, e);
    // Signature failure etc. Use the provider's own fail ACK if we can derive
    // it; default to a generic 400.
    return { status: 400, contentType: "application/json", body: JSON.stringify({ error: "verify failed" }) };
  }

  const { event, ack } = verify;
  // Well-formed but not actionable (e.g. non-success state) — just ACK.
  if (!event) return ack;

  const order = await prisma.order.findUnique({
    where: { id: event.outTradeNo },
    select: { id: true, userId: true, status: true, amountCents: true, credits: true },
  });
  if (!order) {
    console.error(`[notify:${channel}] order not found: ${event.outTradeNo}`);
    // Still ACK so the gateway stops retrying a dead order id.
    return ack;
  }
  if (order.amountCents !== event.amountCents) {
    console.error(
      `[notify:${channel}] amount mismatch: order=${order.amountCents} event=${event.amountCents} (order ${order.id})`,
    );
    // Do NOT credit. Return a non-ACK so we get retried / can investigate.
    return { status: 400, contentType: "application/json", body: JSON.stringify({ error: "amount mismatch" }) };
  }

  await prisma.$transaction(async (tx) => {
    const claim = await tx.order.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: { status: "PAID", paidAt: event.paidAt, providerOrderId: event.providerOrderId },
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
        note: `[purchase] ${order.credits} credits via ${channel} order ${order.id.slice(0, 8)}`,
      },
    });
  });

  return ack;
}
