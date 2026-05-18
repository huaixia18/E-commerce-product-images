"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Package } from "@/lib/payment/packages";
import { PayDialog } from "./PayDialog";

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
      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {packages.map((pkg) => (
          <li
            key={pkg.id}
            className={`relative rounded-lg border bg-white dark:bg-zinc-900 p-6 flex flex-col ${
              pkg.badge
                ? "border-zinc-900 dark:border-zinc-100 shadow-sm"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            {pkg.badge && (
              <span className="absolute -top-2 left-4 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] px-2 py-0.5">
                {pkg.badge}
              </span>
            )}
            <h3 className="text-lg font-semibold">{pkg.label}</h3>
            <div className="mt-4">
              <span className="text-3xl font-bold">¥{(pkg.amountCents / 100).toFixed(2)}</span>
            </div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              {pkg.credits} 积分 · {pkg.perCredit}
            </div>
            <div className="flex-1" />
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => pick(pkg, "wechat")}
                className="rounded-md border border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950 px-3 py-2 text-sm font-medium"
              >
                微信支付
              </button>
              <button
                type="button"
                onClick={() => pick(pkg, "alipay")}
                className="rounded-md border border-sky-600 text-sky-700 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950 px-3 py-2 text-sm font-medium"
              >
                支付宝
              </button>
            </div>
          </li>
        ))}
      </ul>

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
