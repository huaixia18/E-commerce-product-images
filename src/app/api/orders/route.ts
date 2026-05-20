import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPackage, totalCredits } from "@/lib/payment/packages";
import { paymentProvider } from "@/lib/payment/provider";
import { env } from "@/lib/env";

// Per-channel webhook URLs. The mock provider ignores notify_url entirely
// (the dev "我已付款" button posts to /api/payments/notify directly), but
// real gateways need the channel-specific callback endpoint.
const NOTIFY_PATH: Record<"wechat" | "alipay", string> = {
  wechat: "/api/payments/notify/wechat",
  alipay: "/api/payments/notify/alipay",
};

const schema = z.object({
  packageId: z.string().min(1),
  channel: z.enum(["wechat", "alipay"]),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const pkg = getPackage(parsed.data.packageId);
  if (!pkg) {
    return NextResponse.json({ error: "Unknown package" }, { status: 400 });
  }

  // Create the Order row first (PENDING). We need its id as the provider's
  // out_trade_no. credits stored on the order is the grant total (base + bonus).
  const credits = totalCredits(pkg);
  const order = await prisma.order.create({
    data: {
      userId: session.user.id,
      provider: parsed.data.channel === "wechat" ? "WECHAT" : "ALIPAY",
      amountCents: pkg.amountCents,
      credits,
      status: "PENDING",
    },
  });

  const channel = parsed.data.channel;
  const provider = paymentProvider(channel);
  const base = env().AUTH_URL.replace(/\/$/, "");
  const notifyUrl = `${base}${NOTIFY_PATH[channel]}`;

  let result;
  try {
    result = await provider.createOrder({
      outTradeNo: order.id,
      amountCents: pkg.amountCents,
      channel,
      subject: `${pkg.label} · ${credits} 积分`,
      notifyUrl,
    });
  } catch (e) {
    // Provider misconfigured / gateway error. Mark the pending order failed
    // so it doesn't linger, and surface a clean error.
    console.error("[orders] createOrder failed", e);
    await prisma.order
      .update({ where: { id: order.id }, data: { status: "FAILED" } })
      .catch(() => {});
    return NextResponse.json({ error: "支付下单失败，请稍后再试" }, { status: 502 });
  }

  // Attach provider order id for later reconciliation.
  if (result.providerOrderId) {
    await prisma.order.update({
      where: { id: order.id },
      data: { providerOrderId: result.providerOrderId },
    });
  }

  return NextResponse.json(
    {
      id: order.id,
      amountCents: pkg.amountCents,
      credits,
      qrContent: result.qrContent,
      mockCompleteToken: result.mockCompleteToken,
    },
    { status: 201 },
  );
}
