// Abstract payment provider. The app depends only on this interface +
// the paymentProvider(channel) factory — never on a concrete impl.
//
// Implementations:
//   mockProvider   — dev / demo, instant "我已付款" simulation
//   wechatProvider — WeChat Pay Native (QR) + V3 webhook
//   alipayProvider — Alipay 当面付 (precreate QR) + RSA2 webhook
//
// Switch via PAYMENT_PROVIDER env: "mock" (default) or "real".

import type { PayChannel } from "./packages";

export interface CreateOrderInput {
  /** Our own Order.id; the provider sees it as out_trade_no. */
  outTradeNo: string;
  /** RMB cents. */
  amountCents: number;
  channel: PayChannel;
  /** Human-readable product label, surfaced in the wallet payment screen. */
  subject: string;
  /** Webhook URL the provider should POST to after success. */
  notifyUrl: string;
}

export interface CreateOrderResult {
  /** The string the QR encodes — for real providers this is the wechat/alipay deeplink. */
  qrContent: string;
  /** Optional provider-issued order id; we store it on Order.providerOrderId. */
  providerOrderId?: string;
  /**
   * Mock-only: opaque token the dev "我已付款" button hands back to
   * /api/payments/notify. Real providers leave this undefined.
   */
  mockCompleteToken?: string;
}

export interface NotifyEvent {
  /** out_trade_no from the provider notification — our Order.id. */
  outTradeNo: string;
  amountCents: number;
  providerOrderId?: string;
  /** When the provider says the payment cleared. */
  paidAt: Date;
}

/**
 * The body + status a webhook handler must send back to ACK the callback.
 * Different gateways expect different formats:
 *   WeChat V3 → 200 + {"code":"SUCCESS"} (or non-200 to trigger retry)
 *   Alipay    → 200 + plain text "success"
 *   Mock      → 200 + {"ok":true}
 */
export interface NotifyAck {
  status: number;
  contentType: string;
  body: string;
}

export interface VerifyResult {
  /** null = well-formed but not a success we should act on. */
  event: NotifyEvent | null;
  /** What to send back to the gateway. Defaults applied by the route if absent. */
  ack: NotifyAck;
}

export interface PaymentProvider {
  readonly name: string;
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  /**
   * Verify a webhook request (signature, decryption) and normalize it.
   * Throws on a hard verification failure (bad signature). Returns a
   * VerifyResult carrying the event (or null) plus the ACK to reply with.
   */
  verifyNotify(req: Request): Promise<VerifyResult>;
}

// ─── Factory ──────────────────────────────────────────────────────────────
// Lazily instantiate so we don't pull crypto-heavy SDKs into the bundle
// unless the corresponding provider is actually selected.

const _cache = new Map<string, PaymentProvider>();

export function paymentProvider(channel: PayChannel): PaymentProvider {
  const mode = (process.env.PAYMENT_PROVIDER ?? "mock").toLowerCase();
  const key = `${mode}:${channel}`;
  const cached = _cache.get(key);
  if (cached) return cached;

  let provider: PaymentProvider;
  if (mode === "real") {
    if (channel === "wechat") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { wechatProvider } = require("./wechatProvider") as typeof import("./wechatProvider");
      provider = wechatProvider();
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { alipayProvider } = require("./alipayProvider") as typeof import("./alipayProvider");
      provider = alipayProvider();
    }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mockProvider } = require("./mockProvider") as typeof import("./mockProvider");
    provider = mockProvider;
  }
  _cache.set(key, provider);
  return provider;
}

// Convenience ACKs for handlers.
export const ACK = {
  mockOk: { status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) },
  wechatOk: { status: 200, contentType: "application/json", body: JSON.stringify({ code: "SUCCESS", message: "OK" }) },
  wechatFail: { status: 500, contentType: "application/json", body: JSON.stringify({ code: "FAIL", message: "verify failed" }) },
  alipayOk: { status: 200, contentType: "text/plain", body: "success" },
  alipayFail: { status: 200, contentType: "text/plain", body: "failure" },
} satisfies Record<string, NotifyAck>;
