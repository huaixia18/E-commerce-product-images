"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Package } from "@/lib/payment/packages";
import { totalCredits } from "@/lib/payment/packages";
import { PayDialog } from "./PayDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Clock, History as HistoryIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const METHODS = [
  { id: "wechat" as const, name: "微信支付", color: "#1AAD19" },
  { id: "alipay" as const, name: "支付宝", color: "#1677FF" },
];

// Mock recent transactions — replaced by real data once the user has orders.
const RECENT_TX = [
  { d: "05-15 14:22", m: "微信", c: 100, p: 19 },
  { d: "04-28 09:11", m: "支付宝", c: 300, p: 49 },
  { d: "04-02 18:46", m: "微信", c: 30, p: 6 },
];

export function PricingClient({
  packages,
  loggedIn,
  balance,
}: {
  packages: Package[];
  loggedIn: boolean;
  balance: number;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string>(packages[1]?.id ?? packages[0].id);
  const [method, setMethod] = useState<"wechat" | "alipay">("wechat");
  const [payOpen, setPayOpen] = useState(false);
  const selected = useMemo(() => packages.find((p) => p.id === selectedId)!, [packages, selectedId]);
  const total = totalCredits(selected);
  const unit = (selected.amountCents / 100 / total).toFixed(3);

  function startPay() {
    if (!loggedIn) {
      router.push("/login?next=/pricing");
      return;
    }
    setPayOpen(true);
  }

  return (
    <>
      <div className="mx-auto max-w-6xl px-6 py-10 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* LEFT — packages + recent tx */}
        <div>
          <header className="mb-6">
            <h1 className="text-3xl font-black tracking-tight">选个适合你的充值套餐</h1>
            <p className="text-sm text-muted-foreground mt-2">
              1 积分 = 1 张图 · 积分永不过期 · 失败按张退分
              {loggedIn && (
                <>
                  {"  ·  "}当前余额{" "}
                  <strong className="text-foreground tabular-nums">{balance}</strong> 积分
                </>
              )}
            </p>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {packages.map((pkg) => {
              const active = pkg.id === selectedId;
              const t = totalCredits(pkg);
              const u = (pkg.amountCents / 100 / t).toFixed(3);
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => setSelectedId(pkg.id)}
                  className={cn(
                    "relative text-left rounded-2xl p-5 transition-all bg-card border-2 cursor-pointer",
                    active
                      ? "border-primary bg-secondary/40 shadow-[0_6px_24px_-4px_oklch(0.67_0.21_38_/_0.3)]"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  {pkg.hot && pkg.badge && (
                    <span className="absolute -top-2.5 right-4 rotate-[4deg] rounded-full bg-brand-magenta text-white px-2.5 py-0.5 text-[10px] font-extrabold whitespace-nowrap">
                      🔥 {pkg.badge}
                    </span>
                  )}
                  <div className="flex items-baseline gap-1.5">
                    <span className={cn("text-4xl font-black leading-none tabular-nums", active && "text-primary")}>
                      {pkg.credits}
                    </span>
                    <span className="text-sm font-bold text-muted-foreground">积分</span>
                  </div>
                  {pkg.bonusCredits ? (
                    <span className="inline-block mt-1.5 text-[11px] font-bold text-brand-magenta bg-brand-magenta/10 rounded px-1.5 py-0.5">
                      送 {pkg.bonusCredits} 积分
                    </span>
                  ) : (
                    <span className="block h-5" />
                  )}
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-xs text-muted-foreground">¥</span>
                    <span className="text-xl font-extrabold tabular-nums">{(pkg.amountCents / 100).toFixed(pkg.amountCents % 100 ? 2 : 0)}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground">≈ ¥{u}/张</span>
                  </div>
                  {active && (
                    <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Recent recharges */}
          <div className="mt-8">
            <h2 className="flex items-center gap-1.5 text-sm font-bold mb-3">
              <HistoryIcon className="h-4 w-4" />
              最近充值
            </h2>
            <Card className="border-border">
              <CardContent className="p-0">
                {RECENT_TX.map((r, i) => (
                  <div
                    key={i}
                    className={cn(
                      "grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-3 text-xs",
                      i > 0 && "border-t border-border",
                    )}
                  >
                    <span className="text-muted-foreground font-mono">{r.d}</span>
                    <span>{r.m}</span>
                    <span className="font-bold tabular-nums">+{r.c} 积分</span>
                    <span className="font-mono text-success">● 已到账</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* RIGHT — payment panel */}
        <aside className="lg:sticky lg:top-24 self-start">
          <Card className="border-border">
            <CardContent className="p-6 space-y-5">
              <div>
                <div className="text-xs text-muted-foreground font-bold">本次充值</div>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-sm text-muted-foreground">¥</span>
                  <span className="text-4xl font-black leading-none tabular-nums">
                    {(selected.amountCents / 100).toFixed(selected.amountCents % 100 ? 2 : 0)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  将获得 <strong className="text-primary tabular-nums">{total}</strong> 积分（{selected.credits}
                  {selected.bonusCredits ? ` + 赠 ${selected.bonusCredits}` : ""}）
                  <br />
                  约可生成 <strong>{total}</strong> 张详情图 · ¥{unit}/张
                </div>
              </div>

              <div>
                <div className="text-xs font-bold mb-2">支付方式</div>
                <div className="grid grid-cols-2 gap-2">
                  {METHODS.map((m) => {
                    const active = method === m.id;
                    return (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => setMethod(m.id)}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-full border-2 px-3 py-2.5 text-xs font-bold transition-all",
                          active ? "bg-card" : "bg-card hover:border-foreground/30 border-border",
                        )}
                        style={active ? { borderColor: m.color, color: m.color } : undefined}
                      >
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ background: m.color }}
                        />
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button
                onClick={startPay}
                className="w-full h-12 rounded-full font-bold text-base shadow-[0_6px_24px_-4px_oklch(0.67_0.21_38_/_0.5)]"
              >
                立即充值
              </Button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground rounded-full bg-secondary/60 px-3 py-1.5 mx-auto w-fit">
                <Clock className="h-3 w-3" />
                二维码生成后 15 分钟内有效
              </div>

              <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                支付即视为同意《用户协议》《充值条款》
                <br />
                积分仅可用于详图AI 服务 · 不可提现
              </p>
            </CardContent>
          </Card>

          <p className="text-[11px] text-muted-foreground text-center mt-3">
            当前为测试模式 · 接入真实聚合支付后流程不变
          </p>
        </aside>
      </div>

      {payOpen && (
        <PayDialog
          pkg={selected}
          channel={method}
          onClose={() => setPayOpen(false)}
          onPaid={() => {
            setPayOpen(false);
            toast.success("充值成功", { description: `+${total} 积分已到账` });
            router.refresh();
            router.push("/dashboard");
          }}
        />
      )}
    </>
  );
}
