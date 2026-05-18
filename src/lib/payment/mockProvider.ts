// MockProvider — for local dev + smoke tests.
//
// createOrder() returns a non-payable string the UI shows as a fake QR + a
// `mockCompleteToken` the dev confirmation button posts to the notify endpoint.
// verifyNotify() accepts that token (HMAC-signed) and produces a NotifyEvent.
//
// In production we'll replace this with the real aggregator's adapter.

import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  CreateOrderInput,
  CreateOrderResult,
  NotifyEvent,
  PaymentProvider,
} from "./provider";

const MOCK_SECRET = process.env.AUTH_SECRET ?? "mock-payment-dev-secret";

function sign(payload: string): string {
  return createHmac("sha256", MOCK_SECRET).update(payload).digest("hex");
}

function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

export const mockProvider: PaymentProvider = {
  name: "mock",

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    // Token = base64url(JSON{ outTradeNo, amountCents }) . hmacSig
    const payload = Buffer.from(
      JSON.stringify({ outTradeNo: input.outTradeNo, amountCents: input.amountCents }),
    ).toString("base64url");
    const token = `${payload}.${sign(payload)}`;
    // The "QR" content is just a label; UI renders a placeholder pattern.
    const qrContent = `mock://${input.outTradeNo}?amount=${input.amountCents}&channel=${input.channel}`;
    return {
      qrContent,
      providerOrderId: `MOCK-${input.outTradeNo}`,
      mockCompleteToken: token,
    };
  },

  async verifyNotify(req: Request): Promise<NotifyEvent | null> {
    const body = (await req.json()) as { token?: string };
    if (!body.token || typeof body.token !== "string") return null;
    const [payload, sig] = body.token.split(".");
    if (!payload || !sig) return null;
    if (!safeEq(sig, sign(payload))) return null;

    let decoded: { outTradeNo: string; amountCents: number };
    try {
      decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    } catch {
      return null;
    }
    if (typeof decoded.outTradeNo !== "string" || typeof decoded.amountCents !== "number") {
      return null;
    }
    return {
      outTradeNo: decoded.outTradeNo,
      amountCents: decoded.amountCents,
      providerOrderId: `MOCK-${decoded.outTradeNo}`,
      paidAt: new Date(),
    };
  },
};

let _provider: PaymentProvider | null = null;
export function paymentProvider(): PaymentProvider {
  if (_provider) return _provider;
  // Real provider swap would happen here based on env (e.g. PAYMENT_PROVIDER=adapay).
  _provider = mockProvider;
  return _provider;
}
