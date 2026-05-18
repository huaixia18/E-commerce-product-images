"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { JobSpec, PanelId } from "@/lib/promptTemplate";
import { PuzzleMosaic, type MosaicTile } from "@/components/PuzzleMosaic";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Download,
  Loader2,
  Sparkles,
  XCircle,
  Clock,
  RotateCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "PARTIAL";
type PanelState = "pending" | "running" | "done" | "failed";
interface PanelStatus {
  panel: PanelId;
  state: PanelState;
  url?: string;
}
interface JobStatus {
  id: string;
  status: Status;
  creditsCost: number;
  panels: PanelStatus[];
}

const POLL_MS = 2500;

export function JobView({
  jobId,
  title,
  initialStatus,
  panels,
  credits,
  sources,
  highlights,
  specs,
}: {
  jobId: string;
  title: string;
  initialStatus: Status;
  panels: PanelId[];
  credits: number;
  sources: { id: string; url: string }[];
  highlights: string[];
  specs?: JobSpec[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [starting, startTransition] = useTransition();
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const terminal = (s: Status) => s === "SUCCEEDED" || s === "FAILED" || s === "PARTIAL";
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = (await res.json()) as JobStatus;
        if (cancelled) return;
        setStatus(data);
        if (terminal(data.status)) return;
      } catch {
        /* transient */
      }
      if (!cancelled) pollTimer.current = setTimeout(tick, POLL_MS);
    }
    if (initialStatus !== "PENDING" || status?.status === "RUNNING") tick();
    return () => {
      cancelled = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [jobId, initialStatus, status?.status]);

  function handleStart() {
    startTransition(async () => {
      const res = await fetch(`/api/jobs/${jobId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ panels }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error("启动失败", { description: body.error });
        return;
      }
      toast.success("已开始生成", { description: `预扣 ${panels.length} 积分` });
      setStatus({
        id: jobId,
        status: "RUNNING",
        creditsCost: panels.length,
        panels: panels.map((p) => ({ panel: p, state: "pending" })),
      });
      router.refresh();
    });
  }

  const current = status?.status ?? initialStatus;
  const showStartButton = current === "PENDING";
  const isTerminal = current === "SUCCEEDED" || current === "FAILED" || current === "PARTIAL";
  const cost = panels.length;
  const enoughCredits = credits >= cost;

  // Map panel statuses → mosaic tiles. Each highlight feeds the corresponding feature tile.
  // API uses "pending" for queued tiles; mosaic uses "queued".
  function mapState(s: PanelState | undefined): MosaicTile["state"] {
    if (!s || s === "pending") return "queued";
    return s;
  }
  const tiles: MosaicTile[] = panels.map((p) => {
    const ps = status?.panels.find((x) => x.panel === p);
    const state: MosaicTile["state"] = mapState(ps?.state);
    const featIdx = p === "feature_1" ? 0 : p === "feature_2" ? 1 : p === "feature_3" ? 2 : null;
    const label = featIdx !== null ? highlights[featIdx] ?? "" : p === "hero" ? title : undefined;
    const progress = state === "running" ? 0.45 : undefined;
    return { panel: p, state, label, imageUrl: ps?.url, progress };
  });

  const done = (status?.panels ?? []).filter((x) => x.state === "done").length;
  const failed = (status?.panels ?? []).filter((x) => x.state === "failed").length;
  const running = (status?.panels ?? []).filter((x) => x.state === "running").length;
  const total = panels.length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-0 lg:min-h-[calc(100vh-8rem)]">
      {/* MAIN — mosaic + header */}
      <div className="px-6 py-8 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6">
          <header className="flex items-baseline justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight">
                {current === "RUNNING" ? "AI 正在拼版中…" : current === "PENDING" ? title : current === "FAILED" ? "全部失败" : "拼版完成"}
              </h1>
              {current !== "PENDING" && (
                <p className="text-sm text-muted-foreground mt-1">
                  共 {total} 张 · {done} 完成
                  {running > 0 && ` · ${running} 生成中`}
                  {failed > 0 && ` · ${failed} 失败`}
                </p>
              )}
            </div>
            {!showStartButton && (
              <div className="flex items-center gap-3">
                <div className="text-xs text-muted-foreground tabular-nums">
                  {done} / {total} 完成
                </div>
                <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-brand-magenta transition-[width] duration-500"
                    style={{ width: `${(done / total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </header>

          {/* Mosaic */}
          <PuzzleMosaic
            tiles={tiles}
            rowHeight={72}
            showAllStates
          />

          {/* Source/spec info card under the mosaic */}
          <Card className="border-border">
            <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  商品图（{sources.length}）
                </div>
                <ul className="flex gap-2 flex-wrap">
                  {sources.map((s, i) => (
                    <li key={s.id} className="relative w-14 h-14 rounded-lg overflow-hidden ring-1 ring-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.url} alt="" className="w-full h-full object-cover" />
                      {i === 0 && (
                        <Badge className="absolute top-0.5 left-0.5 text-[8px] px-1 py-0">主</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  卖点
                </div>
                <ul className="text-sm space-y-1">
                  {highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {specs && specs.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    参数
                  </div>
                  <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
                    {specs.map((s, i) => (
                      <div key={i} className="contents">
                        <dt className="text-muted-foreground">{s.label}</dt>
                        <dd className="font-bold">{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* SIDEBAR — task queue + CTAs */}
      <aside className="border-l border-border bg-card flex flex-col">
        <header className="px-5 py-4 border-b border-border">
          <h2 className="text-xs font-extrabold">任务队列</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">BullMQ · 并发 3 · 每张最多重试 2 次</p>
        </header>
        <ul className="flex-1 overflow-y-auto p-3 space-y-2">
          {tiles.map((tile, i) => (
            <QueueRow key={tile.panel} tile={tile} index={i} />
          ))}
        </ul>
        <footer className="p-4 border-t border-border bg-card space-y-2">
          {failed > 0 && (
            <div className="rounded-xl bg-destructive/10 px-3 py-2 text-[11px] text-destructive flex items-center gap-2">
              <RotateCw className="h-3.5 w-3.5" />
              {failed} 张失败已自动退积分
            </div>
          )}
          {showStartButton ? (
            <Button
              type="button"
              onClick={handleStart}
              disabled={starting || !enoughCredits}
              className="w-full h-11 rounded-full font-extrabold text-sm gap-2 shadow-[0_6px_24px_-4px_oklch(0.67_0.21_38_/_0.5)]"
            >
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              开始生成 · 扣 {cost} 积分
            </Button>
          ) : isTerminal && done > 0 ? (
            <Button
              asChild
              className="w-full h-11 rounded-full font-extrabold text-sm gap-2 bg-foreground text-background hover:bg-foreground/90"
            >
              <a href={`/api/jobs/${jobId}/download`} download>
                <Download className="h-4 w-4" />
                下载 zip · {done} 张
              </a>
            </Button>
          ) : current === "FAILED" ? (
            <Button variant="outline" disabled className="w-full h-11 rounded-full font-bold">
              全部失败 · 已退款
            </Button>
          ) : (
            <Button variant="outline" disabled className="w-full h-11 rounded-full font-bold">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              生成中…
            </Button>
          )}
          {!enoughCredits && showStartButton && (
            <Link href="/pricing" className="block text-[11px] text-destructive text-center underline">
              积分不足，立即充值
            </Link>
          )}
        </footer>
      </aside>
    </div>
  );
}

function QueueRow({ tile, index }: { tile: MosaicTile; index: number }) {
  const STATE_MAP: Record<NonNullable<MosaicTile["state"]>, { c: string; label: string; icon: React.ReactNode }> = {
    done:    { c: "text-success",     label: "完成",       icon: <CheckCircle2 className="h-3 w-3" /> },
    running: { c: "text-primary",     label: "生成中",     icon: <Sparkles className="h-3 w-3" /> },
    failed:  { c: "text-destructive", label: "失败 · 已退分", icon: <XCircle className="h-3 w-3" /> },
    queued:  { c: "text-muted-foreground", label: "排队中", icon: <Clock className="h-3 w-3" /> },
    off:     { c: "text-muted-foreground", label: "未选",  icon: <Clock className="h-3 w-3" /> },
  };
  const s = STATE_MAP[tile.state ?? "queued"];
  const COLORS: Record<PanelId, string> = {
    hero: "bg-primary",
    feature_1: "bg-brand-magenta",
    feature_2: "bg-brand-yellow",
    feature_3: "bg-brand-mint",
    lifestyle: "bg-brand-purple",
    spec: "bg-card ring-1 ring-border",
  };
  return (
    <li className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn("w-6 h-6 rounded shrink-0", COLORS[tile.panel])} />
          <div className="min-w-0">
            <div className="text-xs font-bold truncate">{tile.label || tile.panel}</div>
            <div className="text-[10px] text-muted-foreground font-mono truncate">
              {tile.panel}_{index + 1}.png
            </div>
          </div>
        </div>
        <div className={cn("flex items-center gap-1 text-[11px] font-bold whitespace-nowrap", s.c)}>
          {s.icon}
          {s.label}
        </div>
      </div>
      {tile.state === "running" && tile.progress !== undefined && (
        <div className="h-1 bg-secondary rounded-full mt-2 overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${Math.round(tile.progress * 100)}%` }} />
        </div>
      )}
    </li>
  );
}
