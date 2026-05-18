import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      status: true,
      amountCents: true,
      credits: true,
      paidAt: true,
    },
  });
  if (!order || order.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: order.id,
    status: order.status,
    amountCents: order.amountCents,
    credits: order.credits,
    paidAt: order.paidAt,
  });
}
