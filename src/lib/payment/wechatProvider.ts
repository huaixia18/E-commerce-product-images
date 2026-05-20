// WeChat Pay (微信支付) — Native (扫码) order + V3 webhook.
//
// Uses WeChat Pay API v3. No third-party SDK — just Node crypto, so there's
// nothing to break the bundler. Signing per:
//   https://pay.weixin.qq.com/docs/merchant/development/interface-rules/signature-generation.html
//
// Required env (only when PAYMENT_PROVIDER=real):
//   WECHAT_PAY_APP_ID          公众号/小程序/APP 的 appid
//   WECHAT_PAY_MCH_ID          商户号
//   WECHAT_PAY_API_V3_KEY      APIv3 密钥（32 字节）— 用于回调解密
//   WECHAT_PAY_SERIAL_NO       商户 API 证书序列号
//   WECHAT_PAY_PRIVATE_KEY     商户 API 私钥（PEM，含 BEGIN/END，\n 换行）
//   WECHAT_PAY_PLATFORM_CERT   微信支付平台证书公钥（PEM）— 用于回调验签
//
// Notes:
//  - 回调验签理论上应使用「微信支付公钥」或下载的「平台证书」并校验序列号；
//    这里用配置的 WECHAT_PAY_PLATFORM_CERT 做 RSA 验签，生产前请确认证书轮换策略。

import {
  createSign,
  createVerify,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import {
  ACK,
  type CreateOrderInput,
  type CreateOrderResult,
  type PaymentProvider,
  type VerifyResult,
  type NotifyEvent,
} from "./provider";

const API_BASE = "https://api.mch.weixin.qq.com";

interface WxConfig {
  appId: string;
  mchId: string;
  apiV3Key: string;
  serialNo: string;
  privateKey: string;
  platformCert: string;
}

function loadConfig(): WxConfig {
  const cfg = {
    appId: process.env.WECHAT_PAY_APP_ID ?? "",
    mchId: process.env.WECHAT_PAY_MCH_ID ?? "",
    apiV3Key: process.env.WECHAT_PAY_API_V3_KEY ?? "",
    serialNo: process.env.WECHAT_PAY_SERIAL_NO ?? "",
    // env stores PEM with literal \n — restore real newlines.
    privateKey: (process.env.WECHAT_PAY_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    platformCert: (process.env.WECHAT_PAY_PLATFORM_CERT ?? "").replace(/\\n/g, "\n"),
  };
  const missing = Object.entries(cfg)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(
      `WeChat Pay provider not configured. Missing env: ${missing.join(", ")}. ` +
        `Set PAYMENT_PROVIDER=mock for local dev.`,
    );
  }
  return cfg;
}

/** Build the v3 Authorization header for a request. */
function authHeader(
  cfg: WxConfig,
  method: string,
  urlPath: string,
  body: string,
): string {
  const nonce = randomBytes(16).toString("hex").toUpperCase();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`;
  const signature = createSign("RSA-SHA256")
    .update(message)
    .sign(cfg.privateKey, "base64");
  return (
    `WECHATPAY2-SHA256-RSA2048 ` +
    `mchid="${cfg.mchId}",` +
    `nonce_str="${nonce}",` +
    `signature="${signature}",` +
    `timestamp="${timestamp}",` +
    `serial_no="${cfg.serialNo}"`
  );
}

export function wechatProvider(): PaymentProvider {
  return {
    name: "wechat",

    async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
      const cfg = loadConfig();
      const urlPath = "/v3/pay/transactions/native";
      const payload = {
        appid: cfg.appId,
        mchid: cfg.mchId,
        description: input.subject,
        out_trade_no: input.outTradeNo,
        notify_url: input.notifyUrl,
        amount: { total: input.amountCents, currency: "CNY" },
      };
      const body = JSON.stringify(payload);
      const res = await fetch(`${API_BASE}${urlPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: authHeader(cfg, "POST", urlPath, body),
        },
        body,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`WeChat native order failed ${res.status}: ${text}`);
      }
      const json = (await res.json()) as { code_url?: string };
      if (!json.code_url) {
        throw new Error("WeChat native order: no code_url in response");
      }
      return {
        qrContent: json.code_url, // weixin://wxpay/bizpayurl?pr=... — render as QR
        providerOrderId: undefined, // wechat uses our out_trade_no
      };
    },

    async verifyNotify(req: Request): Promise<VerifyResult> {
      const cfg = loadConfig();
      const raw = await req.text();

      // 1. Signature verification using the platform certificate.
      const timestamp = req.headers.get("Wechatpay-Timestamp") ?? "";
      const nonce = req.headers.get("Wechatpay-Nonce") ?? "";
      const signature = req.headers.get("Wechatpay-Signature") ?? "";
      if (!timestamp || !nonce || !signature) {
        return { event: null, ack: ACK.wechatFail };
      }
      const signMessage = `${timestamp}\n${nonce}\n${raw}\n`;
      const verified = createVerify("RSA-SHA256")
        .update(signMessage)
        .verify(cfg.platformCert, signature, "base64");
      if (!verified) {
        return { event: null, ack: ACK.wechatFail };
      }

      // 2. Decrypt the resource (AEAD_AES_256_GCM).
      let notify: { resource?: { ciphertext: string; nonce: string; associated_data?: string }; event_type?: string };
      try {
        notify = JSON.parse(raw);
      } catch {
        return { event: null, ack: ACK.wechatFail };
      }
      if (notify.event_type !== "TRANSACTION.SUCCESS" || !notify.resource) {
        // Well-formed but not a success we act on. ACK so wechat stops retrying.
        return { event: null, ack: ACK.wechatOk };
      }

      const decrypted = decryptAesGcm(
        cfg.apiV3Key,
        notify.resource.nonce,
        notify.resource.associated_data ?? "",
        notify.resource.ciphertext,
      );
      const tx = JSON.parse(decrypted) as {
        out_trade_no: string;
        trade_state: string;
        transaction_id: string;
        amount: { total: number };
        success_time?: string;
      };
      if (tx.trade_state !== "SUCCESS") {
        return { event: null, ack: ACK.wechatOk };
      }

      const event: NotifyEvent = {
        outTradeNo: tx.out_trade_no,
        amountCents: tx.amount.total,
        providerOrderId: tx.transaction_id,
        paidAt: tx.success_time ? new Date(tx.success_time) : new Date(),
      };
      return { event, ack: ACK.wechatOk };
    },
  };
}

/** AEAD_AES_256_GCM decryption used by WeChat Pay v3 callbacks. */
function decryptAesGcm(
  key: string,
  nonce: string,
  associatedData: string,
  ciphertextB64: string,
): string {
  const data = Buffer.from(ciphertextB64, "base64");
  // Last 16 bytes are the auth tag.
  const authTag = data.subarray(data.length - 16);
  const encrypted = data.subarray(0, data.length - 16);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key, "utf8"),
    Buffer.from(nonce, "utf8"),
  );
  decipher.setAuthTag(authTag);
  if (associatedData) decipher.setAAD(Buffer.from(associatedData, "utf8"));
  return decipher.update(encrypted, undefined, "utf8") + decipher.final("utf8");
}
