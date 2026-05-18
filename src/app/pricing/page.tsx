import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PACKAGES, PACKAGE_ORDER } from "@/lib/payment/packages";
import { PricingClient } from "./PricingClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles } from "lucide-react";

export const metadata = { title: "充值积分 · 详图AI" };

const FEATURES = [
  "1 积分 = 1 张电商详情图",
  "支持主图 / 卖点图 / 场景图 / 参数卡",
  "失败自动退款，按张结算",
  "积分永久有效，不过期",
  "支持微信、支付宝",
];

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
    <main className="flex-1">
      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute -top-32 left-1/3 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-32 right-1/3 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        </div>
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <Badge variant="secondary" className="mb-4 rounded-full">
            <Sparkles className="h-3 w-3 mr-1 text-primary" />
            明码标价
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">充值积分</h1>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            1 积分 = 1 张电商详情图。
            {credits !== null && (
              <>
                {" "}当前余额{" "}
                <span className="font-semibold text-foreground">{credits}</span> 积分。
              </>
            )}
          </p>
        </div>
      </section>

      <section className="pb-12">
        <div className="mx-auto max-w-5xl px-6">
          <PricingClient
            packages={PACKAGE_ORDER.map((id) => PACKAGES[id])}
            loggedIn={!!session?.user?.id}
          />
        </div>
      </section>

      <section className="py-12 bg-muted/30 border-y border-border/60">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-xl font-semibold text-center mb-6">所有套餐均包含</h2>
          <Card className="border-border/60">
            <CardContent className="p-6">
              <ul className="space-y-3">
                {FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <Check className="h-5 w-5 flex-none text-primary mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-12">
        <div className="mx-auto max-w-2xl px-6 text-center text-xs text-muted-foreground">
          支付测试模式 · 当前接入 Mock Provider，点击付款会即刻成功。
          上线时切换到真实聚合支付，主流程不变。
        </div>
      </section>
    </main>
  );
}
