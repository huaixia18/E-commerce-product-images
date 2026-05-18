"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Package } from "@/lib/payment/packages";
import { PayDialog } from "./PayDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function PricingClient({ packages, loggedIn }: { packages: Package[]; loggedIn: boolean }) {
  const router = useRouter();
  const [activePkg, setActivePkg] = useState<Package | null>(null);
  const [channel, setChannel] = useState<"wechat" | "alipay" | null>(null);

  function pick(pkg: Package, ch: "wechat" | "alipay") {
    if (!loggedIn) {
      router.push("/login?next=/pricing");
      return;
    }
    setActivePkg(pkg);
    setChannel(ch);
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {packages.map((pkg) => {
          const featured = !!pkg.badge;
          const yuan = Math.floor(pkg.amountCents / 100);
          const cents = pkg.amountCents % 100;
          return (
            <Card
              key={pkg.id}
              className={
                featured
                  ? "relative border-primary shadow-lg shadow-primary/10 ring-1 ring-primary/20 !overflow-visible"
                  : "border-border/60"
              }
            >
              {featured && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground hover:bg-primary">
                  {pkg.badge}
                </Badge>
              )}
              <CardContent className="p-6 flex flex-col gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">{pkg.label}</div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl text-muted-foreground">¥</span>
                    <span className="text-5xl font-bold tracking-tight tabular-nums">{yuan}</span>
                    {cents !== 0 && (
                      <span className="text-2xl font-bold tracking-tight tabular-nums">
                        .{cents.toString().padStart(2, "0")}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{pkg.credits}</span> 积分 ·{" "}
                    {pkg.perCredit}
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                    onClick={() => pick(pkg, "wechat")}
                  >
                    <WechatIcon className="h-4 w-4 mr-1.5" />
                    微信
                  </Button>
                  <Button
                    variant="outline"
                    className="border-sky-600/40 text-sky-700 hover:bg-sky-50 hover:text-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/40"
                    onClick={() => pick(pkg, "alipay")}
                  >
                    <AlipayIcon className="h-4 w-4 mr-1.5" />
                    支付宝
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {activePkg && channel && (
        <PayDialog
          pkg={activePkg}
          channel={channel}
          onClose={() => {
            setActivePkg(null);
            setChannel(null);
          }}
          onPaid={() => {
            setActivePkg(null);
            setChannel(null);
            router.refresh();
            router.push("/dashboard");
          }}
        />
      )}
    </>
  );
}

function WechatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M9.5 4C5.91 4 3 6.46 3 9.5c0 1.62.83 3.07 2.16 4.05L4.5 16l2.62-1.4c.77.2 1.6.3 2.43.27.21 0 .42-.02.62-.04C9.93 14 9.5 13 9.5 11.92c0-3.04 2.91-5.5 6.5-5.5.34 0 .67.02 1 .07C16.4 4.8 13.18 4 9.5 4zm-2 3.25a.75.75 0 110 1.5.75.75 0 010-1.5zm4 0a.75.75 0 110 1.5.75.75 0 010-1.5zM16 7.92c-3.04 0-5.5 2.02-5.5 4.51 0 2.48 2.46 4.5 5.5 4.5.63 0 1.24-.08 1.81-.23L20 17.92l-.55-1.86C20.79 15.21 21.5 13.93 21.5 12.43c0-2.49-2.46-4.51-5.5-4.51zm-1.5 2.83a.75.75 0 110 1.5.75.75 0 010-1.5zm3 0a.75.75 0 110 1.5.75.75 0 010-1.5z" />
    </svg>
  );
}

function AlipayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.5 3h-13A2.5 2.5 0 003 5.5v9.7c2.85.74 7.13 1.83 10.6 2.6.86-.96 1.7-2.05 2.4-3.27-2.1-.95-4.95-2.04-7.13-2.74.34-.5.7-1.16 1-1.84h5.55v-.85h-3.85V7.5h3.15v-.86h-3.15V5.4h-1.4v1.24H7.4v.86h3.77V9.1H8.2v.85h6.6c-.27.6-.6 1.18-.94 1.71-1.78-.55-3.78-1.07-4.97-1.16-.92-.07-2.36-.05-2.95.96-.31.55-.36 1.4.42 2.13.5.47 1.26.78 2.18.78 1.7 0 3.46-.92 4.78-2.4 2.06.8 5.32 2.34 7.18 3.39A2.5 2.5 0 0021 15.2V5.5A2.5 2.5 0 0018.5 3zM7.86 13.85c-.6 0-1.1-.15-1.4-.43-.46-.43-.32-.97-.13-1.26.43-.7 1.62-.59 2.46-.46 1.04.16 2.27.55 3.7 1.02-1.07 1.04-2.69 1.13-4.63 1.13z" />
    </svg>
  );
}
