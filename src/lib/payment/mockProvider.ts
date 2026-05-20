// MockProvider — for local dev + smoke tests.
//
// createOrder() returns a non-payable string the UI shows as a fake QR + a
// `mockCompleteToken` the dev confirmation button posts to the notify endpoint.
// verifyNotify() accepts that token (HMAC-signed) and produces a NotifyEvent.
//
// In production we'll replace this with the real aggregator's adapter.

import { createHmac, timingSafeEqual } from "node:crypto";
import {
  ACK,
  type CreateOrderInput,
  type CreateOrderResult,
  type PaymentProvider,
  type VerifyResult,
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

  async verifyNotify(req: Request): Promise<VerifyResult> {
    const body = (await req.json().catch(() => ({}))) as { token?: string };
    if (!body.token || typeof body.token !== "string") {
      return { event: null, ack: ACK.mockOk };
    }
    const [payload, sig] = body.token.split(".");
    if (!payload || !sig || !safeEq(sig, sign(payload))) {
      return { event: null, ack: ACK.mockOk };
    }
    let decoded: { outTradeNo: string; amountCents: number };
    try {
      decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    } catch {
      return { event: null, ack: ACK.mockOk };
    }
    if (typeof decoded.outTradeNo !== "string" || typeof decoded.amountCents !== "number") {
      return { event: null, ack: ACK.mockOk };
    }
    return {
      event: {
        outTradeNo: decoded.outTradeNo,
        amountCents: decoded.amountCents,
        providerOrderId: `MOCK-${decoded.outTradeNo}`,
        paidAt: new Date(),
      },
      ack: ACK.mockOk,
    };
  },
};
