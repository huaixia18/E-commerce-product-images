import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PACKAGES, PACKAGE_ORDER } from "@/lib/payment/packages";
import { PricingClient } from "./PricingClient";

export const metadata = { title: "充值积分 · 电商详情图" };

export default async function PricingPage() {
  const session = await auth();
  const credits = session?.user?.id
    ? (
        await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { credits: true },
        })
      )?.credits ?? 0
    : null;

  return (
    <main className="flex-1 bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-bold">充值积分</h1>
          <p className="text-sm text-zinc-500">
            1 积分 = 1 张电商详情图。{credits !== null && `当前余额 ${credits} 积分。`}
          </p>
        </header>
        <PricingClient
          packages={PACKAGE_ORDER.map((id) => PACKAGES[id])}
          loggedIn={!!session?.user?.id}
        />
        <footer className="text-center text-xs text-zinc-500 pt-8">
          支付测试模式 — 当前使用 Mock Provider，点击付款会立刻成功。
        </footer>
      </div>
    </main>
  );
}
