"use client";

import { useEffect, useRef, useState } from "react";
import type { Package } from "@/lib/payment/packages";

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

  // Create the order once on mount.
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
        setError(e instanceof Error ? e.message : "下单失败");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pkg.id, channel]);

  // Poll order status while waiting.
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
          setTimeout(onPaid, 800);
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
  }, [status, order, onPaid]);

  async function handleMockConfirm() {
    if (!order?.mockCompleteToken) return;
    setMockConfirming(true);
    try {
      await fetch("/api/payments/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: order.mockCompleteToken }),
      });
      // The poll loop will pick up the PAID status within ~2s.
    } finally {
      setMockConfirming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white dark:bg-zinc-900 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">{pkg.label}</h3>
            <p className="text-sm text-zinc-500 mt-1">
              ¥{(pkg.amountCents / 100).toFixed(2)} · {pkg.credits} 积分
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {channel === "wechat" ? "微信支付" : "支付宝"} 扫码付款
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 text-xl leading-none"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 aspect-square flex items-center justify-center relative">
          {status === "creating" && <div className="text-sm text-zinc-500">正在生成订单…</div>}
          {status === "waiting" && order && (
            <>
              <MockQR seed={order.id} />
              <div className="absolute bottom-2 inset-x-2 text-center">
                <div className="text-[10px] text-zinc-400">Mock 二维码 · 仅用于演示</div>
              </div>
            </>
          )}
          {status === "paid" && (
            <div className="text-sm text-emerald-600 font-medium">✅ 支付成功，正在跳转…</div>
          )}
          {status === "error" && (
            <div className="text-sm text-red-600 text-center px-4">
              {error ?? "出错了"}
              <button
                type="button"
                onClick={onClose}
                className="block mx-auto mt-3 text-xs underline text-zinc-500"
              >
                关闭
              </button>
            </div>
          )}
        </div>

        {status === "waiting" && order?.mockCompleteToken && (
          <button
            type="button"
            onClick={handleMockConfirm}
            disabled={mockConfirming}
            className="w-full rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {mockConfirming ? "确认中…" : "我已付款（模拟）"}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Mock QR — deterministic 21×21 black/white grid from the order id.
 * Just visual filler. Never gets scanned.
 */
function MockQR({ seed }: { seed: string }) {
  const N = 21;
  const cells: boolean[] = [];
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h * 33) ^ seed.charCodeAt(i)) >>> 0;
  for (let i = 0; i < N * N; i++) {
    h = ((h * 1103515245 + 12345) & 0x7fffffff) >>> 0;
    cells.push(h % 2 === 0);
  }
  // Position-detection-pattern corners for the QR look.
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
  const size = 168;
  const cell = size / N;
  return (
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
            fill="black"
          />
        ) : null,
      )}
    </svg>
  );
}
