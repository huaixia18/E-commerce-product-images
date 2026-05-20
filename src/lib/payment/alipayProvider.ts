// Alipay 当面付 (Face-to-Face / precreate) — QR order + async notify.
//
// Uses the OpenAPI gateway with RSA2 signing. No SDK — Node crypto only.
// Signing per:
//   https://opendocs.alipay.com/common/02kf5q
//
// Required env (only when PAYMENT_PROVIDER=real):
//   ALIPAY_APP_ID           应用 ID
//   ALIPAY_PRIVATE_KEY      应用私钥（PEM，\n 换行）
//   ALIPAY_PUBLIC_KEY       支付宝公钥（PEM，\n 换行）— 用于回调验签
//   ALIPAY_GATEWAY          可选，默认 https://openapi.alipay.com/gateway.do
//
// The precreate response carries qr_code (a URL string) which we render as
// a QR for the buyer to scan. The async notify POSTs form-encoded params.

import { createSign, createVerify } from "node:crypto";
import {
  ACK,
  type CreateOrderInput,
  type CreateOrderResult,
  type PaymentProvider,
  type VerifyResult,
} from "./provider";

interface AlipayConfig {
  appId: string;
  privateKey: string;
  publicKey: string;
  gateway: string;
}

function loadConfig(): AlipayConfig {
  const cfg = {
    appId: process.env.ALIPAY_APP_ID ?? "",
    privateKey: (process.env.ALIPAY_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    publicKey: (process.env.ALIPAY_PUBLIC_KEY ?? "").replace(/\\n/g, "\n"),
    gateway: process.env.ALIPAY_GATEWAY || "https://openapi.alipay.com/gateway.do",
  };
  const missing = (["appId", "privateKey", "publicKey"] as const).filter((k) => !cfg[k]);
  if (missing.length) {
    throw new Error(
      `Alipay provider not configured. Missing env: ${missing.join(", ")}. ` +
        `Set PAYMENT_PROVIDER=mock for local dev.`,
    );
  }
  return cfg;
}

/** Alipay-style timestamp: yyyy-MM-dd HH:mm:ss in Asia/Shanghai. */
function alipayTimestamp(): string {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000); // shift to UTC+8
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/** Build the sorted, &-joined string to sign (excludes sign + empties). */
function buildSignContent(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((k) => k !== "sign" && params[k] !== "" && params[k] != null)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
}

function signRsa2(content: string, privateKey: string): string {
  return createSign("RSA-SHA256").update(content, "utf8").sign(privateKey, "base64");
}

export function alipayProvider(): PaymentProvider {
  return {
    name: "alipay",

    async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
      const cfg = loadConfig();
      const bizContent = JSON.stringify({
        out_trade_no: input.outTradeNo,
        total_amount: (input.amountCents / 100).toFixed(2),
        subject: input.subject,
      });
      const params: Record<string, string> = {
        app_id: cfg.appId,
        method: "alipay.trade.precreate",
        format: "JSON",
        charset: "utf-8",
        sign_type: "RSA2",
        timestamp: alipayTimestamp(),
        version: "1.0",
        notify_url: input.notifyUrl,
        biz_content: bizContent,
      };
      params.sign = signRsa2(buildSignContent(params), cfg.privateKey);

      const res = await fetch(cfg.gateway, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
        body: new URLSearchParams(params).toString(),
      });
      const json = (await res.json()) as {
        alipay_trade_precreate_response?: { code: string; msg: string; qr_code?: string; sub_msg?: string };
      };
      const r = json.alipay_trade_precreate_response;
      if (!r || r.code !== "10000" || !r.qr_code) {
        throw new Error(`Alipay precreate failed: ${r?.code} ${r?.msg} ${r?.sub_msg ?? ""}`);
      }
      return {
        qrContent: r.qr_code, // https://qr.alipay.com/... — render as QR
        providerOrderId: undefined,
      };
    },

    async verifyNotify(req: Request): Promise<VerifyResult> {
      const cfg = loadConfig();
      // Alipay async notify is form-urlencoded.
      const rawBody = await req.text();
      const params: Record<string, string> = {};
      for (const [k, v] of new URLSearchParams(rawBody)) params[k] = v;

      const sign = params.sign;
      const signType = params.sign_type || "RSA2";
      if (!sign) return { event: null, ack: ACK.alipayFail };

      // Build content to verify: all params except sign + sign_type, sorted.
      const content = Object.keys(params)
        .filter((k) => k !== "sign" && k !== "sign_type" && params[k] !== "")
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join("&");

      const algo = signType === "RSA2" ? "RSA-SHA256" : "RSA-SHA1";
      const ok = createVerify(algo).update(content, "utf8").verify(cfg.publicKey, sign, "base64");
      if (!ok) return { event: null, ack: ACK.alipayFail };

      // Only act on terminal success states.
      const tradeStatus = params.trade_status;
      if (tradeStatus !== "TRADE_SUCCESS" && tradeStatus !== "TRADE_FINISHED") {
        return { event: null, ack: ACK.alipayOk };
      }

      const totalYuan = Number(params.total_amount ?? "0");
      const event = {
        outTradeNo: params.out_trade_no,
        amountCents: Math.round(totalYuan * 100),
        providerOrderId: params.trade_no,
        paidAt: params.gmt_payment ? new Date(params.gmt_payment.replace(" ", "T") + "+08:00") : new Date(),
      };
      return { event, ack: ACK.alipayOk };
    },
  };
}
