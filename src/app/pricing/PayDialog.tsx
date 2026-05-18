"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Package } from "@/lib/payment/packages";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Loader2 } from "lucide-react";

type Status = "creating" | "waiting" | "paid" | "error";

interface OrderResp {
  id: string;
  amountCents: number;
  credits: number;
  qrContent: string;
  mockCompleteToken?: string;
}

const POLL_MS = 2000;

export function PayDialog({
  pkg,
  channel,
  onClose,
  onPaid,
}: {
  pkg: Package;
  channel: "wechat" | "alipay";
  onClose: () => void;
  onPaid: () => void;
}) {
  const [status, setStatus] = useState<Status>("creating");
  const [order, setOrder] = useState<OrderResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mockConfirming, setMockConfirming] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packageId: pkg.id, channel }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as OrderResp;
        if (cancelled) return;
        setOrder(data);
        setStatus("waiting");
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "下单失败";
        setError(msg);
        setStatus("error");
        toast.error("下单失败", { description: msg });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pkg.id, channel]);

  useEffect(() => {
    if (status !== "waiting" || !order) return;
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch(`/api/orders/${order!.id}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`${res.status}`);
        const d = (await res.json()) as { status: string };
        if (cancelled) return;
        if (d.status === "PAID") {
          setStatus("paid");
          toast.success("支付成功", { description: `+${pkg.credits} 积分已到账` });
          setTimeout(onPaid, 1000);
          return;
        }
        if (d.status === "FAILED") {
          setStatus("error");
          setError("订单失败");
          return;
        }
      } catch {
        /* transient */
      }
      if (!cancelled) pollTimer.current = setTimeout(tick, POLL_MS);
    }
    tick();
    return () => {
      cancelled = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [status, order, onPaid, pkg.credits]);

  async function handleMockConfirm() {
    if (!order?.mockCompleteToken) return;
    setMockConfirming(true);
    try {
      const res = await fetch("/api/payments/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: order.mockCompleteToken }),
      });
      if (!res.ok) {
        toast.error("模拟支付失败");
      }
    } finally {
      setMockConfirming(false);
    }
  }

  const channelLabel = channel === "wechat" ? "微信支付" : "支付宝";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-lg flex items-center gap-2">
            {pkg.label}
            <Badge variant="outline" className="shrink-0 text-xs">
              {channelLabel}
            </Badge>
          </DialogTitle>
          <DialogDescription className="mt-1">
            <span className="text-2xl font-bold text-foreground tabular-nums">
              ¥{(pkg.amountCents / 100).toFixed(2)}
            </span>
            <span className="ml-2 text-muted-foreground">/ {pkg.credits} 积分</span>
          </DialogDescription>
        </DialogHeader>

        <div className="relative rounded-lg border border-dashed border-border bg-muted/30 aspect-square flex items-center justify-center overflow-hidden">
          {status === "creating" && (
            <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
              <Skeleton className="h-44 w-44" />
            </div>
          )}
          {status === "waiting" && order && (
            <>
              <MockQR seed={order.id} />
              <div className="absolute inset-x-0 bottom-2 text-center">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Mock 二维码 · 仅用于演示
                </span>
              </div>
            </>
          )}
          {status === "paid" && (
            <div className="flex flex-col items-center gap-3 text-emerald-600">
              <CheckCircle2 className="h-12 w-12" />
              <div className="text-sm font-medium">支付成功，正在跳转…</div>
            </div>
          )}
          {status === "error" && (
            <div className="px-6 text-center space-y-3">
              <div className="text-sm text-destructive">{error ?? "出错了"}</div>
              <Button variant="outline" size="sm" onClick={onClose}>
                关闭
              </Button>
            </div>
          )}
        </div>

        {status === "waiting" && (
          <div className="space-y-2 text-center">
            <p className="text-sm text-muted-foreground">
              {channel === "wechat" ? "打开微信扫一扫" : "打开支付宝扫一扫"}
            </p>
            {order?.mockCompleteToken && (
              <Button onClick={handleMockConfirm} disabled={mockConfirming} className="w-full">
                {mockConfirming ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    确认中…
                  </>
                ) : (
                  "我已付款（模拟）"
                )}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MockQR({ seed }: { seed: string }) {
  const N = 25;
  const cells: boolean[] = new Array(N * N).fill(false);
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h * 33) ^ seed.charCodeAt(i)) >>> 0;
  for (let i = 0; i < N * N; i++) {
    h = ((h * 1103515245 + 12345) & 0x7fffffff) >>> 0;
    cells[i] = h % 3 === 0;
  }
  // Finder patterns at three corners
  function setFinder(cx: number, cy: number) {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const ring = x === 0 || y === 0 || x === 6 || y === 6;
        const center = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        cells[(cy + y) * N + (cx + x)] = ring || center;
      }
    }
  }
  setFinder(0, 0);
  setFinder(N - 7, 0);
  setFinder(0, N - 7);
  const size = 192;
  const cell = size / N;
  return (
    <div className="rounded-md bg-white p-3 shadow-sm">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <rect width={size} height={size} fill="white" />
        {cells.map((on, i) =>
          on ? (
            <rect
              key={i}
              x={(i % N) * cell}
              y={Math.floor(i / N) * cell}
              width={cell}
              height={cell}
              fill="#111827"
            />
          ) : null,
        )}
      </svg>
    </div>
  );
}
