import { handlePaymentNotify } from "@/lib/payment/settle";

/**
 * POST /api/payments/notify/alipay — Alipay async notify.
 * Configure this URL as notify_url when PAYMENT_PROVIDER=real.
 */
export async function POST(req: Request) {
  const ack = await handlePaymentNotify("alipay", req);
  return new Response(ack.body, {
    status: ack.status,
    headers: { "Content-Type": ack.contentType },
  });
}
