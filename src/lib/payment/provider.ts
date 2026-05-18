// Abstract payment provider. Today we only have a mock impl; tomorrow we'll
// add a real aggregator adapter (Adapay / etc) that satisfies this interface.
// Anything outside this file should depend on `paymentProvider()` — not on
// the concrete implementation.

import type { PayChannel } from "./packages";

export interface CreateOrderInput {
  /** Our own Order.id; provider sees it as out_trade_no. */
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
   * Mock-only: opaque token the dev "我已付款" button hands back to /api/payments/notify.
   * Real providers ignore this field.
   */
  mockCompleteToken?: string;
}

export interface NotifyEvent {
  /** Out_trade_no from the provider notification — our Order.id. */
  outTradeNo: string;
  amountCents: number;
  providerOrderId?: string;
  /** When the provider says the payment cleared. */
  paidAt: Date;
}

export interface PaymentProvider {
  readonly name: string;
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  /**
   * Verify a webhook body + headers and turn it into our normalized event.
   * Throws if the signature is invalid. Returns null if the request is well-formed
   * but doesn't describe a successful payment we should act on.
   */
  verifyNotify(req: Request): Promise<NotifyEvent | null>;
}
