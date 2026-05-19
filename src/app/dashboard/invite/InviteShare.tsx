"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function InviteShare({
  link,
  code,
  inviterName,
}: {
  link: string;
  code: string;
  inviterName: string;
}) {
  const shareText = `${inviterName} 邀请你来「图作AI」生成电商详情图，注册即送 60 积分（含 50 邀请奖励）：${link}`;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-card to-brand-magenta/5">
      <CardContent className="p-6 space-y-5">
        {/* Invite link */}
        <div>
          <div className="text-xs text-muted-foreground font-bold mb-1.5">邀请链接</div>
          <CopyBox value={link} />
        </div>

        {/* Code + QR */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-5 items-start">
          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground font-bold mb-1.5">邀请码</div>
              <CopyBox value={code} mono />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-bold mb-1.5">分享文案</div>
              <CopyBox value={shareText} multiline />
            </div>
          </div>
          <div className="hidden sm:block">
            <div className="text-xs text-muted-foreground font-bold mb-1.5 text-center">扫码分享</div>
            <div className="rounded-lg border border-border bg-white p-2 w-fit mx-auto">
              <DeterministicQR text={link} size={140} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CopyBox({
  value,
  mono,
  multiline,
}: {
  value: string;
  mono?: boolean;
  multiline?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("已复制");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("复制失败，请手动选择文本");
    }
  }
  return (
    <div className="flex items-stretch gap-2">
      <div
        className={cn(
          "flex-1 rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground break-all",
          mono && "font-mono tracking-wide",
          multiline ? "whitespace-pre-wrap leading-relaxed" : "truncate",
        )}
      >
        {value}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={copy}
        className="rounded-lg shrink-0 self-start"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

/**
 * Deterministic placeholder QR (NOT a real QR encoder — visual only).
 * Same pattern logic as the pay dialog mock so it looks consistent.
 * If you need a real scannable QR, swap in `qrcode` lib later.
 */
function DeterministicQR({ text, size = 140 }: { text: string; size?: number }) {
  const N = 25;
  const cells: boolean[] = new Array(N * N).fill(false);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  for (let i = 0; i < N * N; i++) {
    h = ((h * 1103515245 + 12345) & 0x7fffffff) >>> 0;
    cells[i] = h % 3 === 0;
  }
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
            fill="#111827"
          />
        ) : null,
      )}
    </svg>
  );
}
