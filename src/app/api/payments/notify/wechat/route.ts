import { handlePaymentNotify } from "@/lib/payment/settle";

/**
 * POST /api/payments/notify/wechat — WeChat Pay v3 async callback.
 * Configure this URL as notify_url when PAYMENT_PROVIDER=real.
 */
export async function POST(req: Request) {
  const ack = await handlePaymentNotify("wechat", req);
  return new Response(ack.body, {
    status: ack.status,
    headers: { "Content-Type": ack.contentType },
  });
}
