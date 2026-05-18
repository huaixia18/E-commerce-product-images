import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPackage } from "@/lib/payment/packages";
import { paymentProvider } from "@/lib/payment/mockProvider";
import { env } from "@/lib/env";

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
  // out_trade_no.
  const order = await prisma.order.create({
    data: {
      userId: session.user.id,
      provider: parsed.data.channel === "wechat" ? "WECHAT" : "ALIPAY",
      amountCents: pkg.amountCents,
      credits: pkg.credits,
      status: "PENDING",
    },
  });

  const provider = paymentProvider();
  const notifyUrl = `${env().AUTH_URL.replace(/\/$/, "")}/api/payments/notify`;
  const result = await provider.createOrder({
    outTradeNo: order.id,
    amountCents: pkg.amountCents,
    channel: parsed.data.channel,
    subject: `${pkg.label} · ${pkg.credits} 积分`,
    notifyUrl,
  });

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
      credits: pkg.credits,
      qrContent: result.qrContent,
      mockCompleteToken: result.mockCompleteToken,
    },
    { status: 201 },
  );
}
