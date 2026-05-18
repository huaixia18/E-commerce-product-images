"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PanelId } from "@/lib/promptTemplate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  Download,
  Loader2,
  Sparkles,
  XCircle,
  AlertTriangle,
  Clock,
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
  initialStatus,
  panels,
  panelLabels,
  panelAspects,
  credits,
}: {
  jobId: string;
  initialStatus: Status;
  panels: PanelId[];
  panelLabels: Record<PanelId, string>;
  panelAspects: Record<PanelId, string>;
  credits: number;
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
  const hasAnyDone = (status?.panels ?? []).some((p) => p.state === "done");
  const cost = panels.length;
  const enoughCredits = credits >= cost;

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium">生成进度</h2>
            <StatusBadge status={current} />
          </div>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {panels.map((p) => {
              const ps = status?.panels.find((x) => x.panel === p);
              return (
                <PanelCard
                  key={p}
                  jobId={jobId}
                  panel={p}
                  label={panelLabels[p]}
                  aspect={panelAspects[p]}
                  state={ps?.state ?? "pending"}
                  url={ps?.url}
                />
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {showStartButton && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="text-sm">
                预计消耗 <span className="font-semibold tabular-nums">{cost}</span> 积分
                <span className="text-muted-foreground"> · 余额 {credits}</span>
              </div>
              {!enoughCredits && (
                <div className="text-xs text-destructive mt-1">
                  积分不足。{" "}
                  <Link href="/pricing" className="underline">立即充值</Link>
                </div>
              )}
            </div>
            <Button onClick={handleStart} disabled={starting || !enoughCredits} size="lg" className="gap-2">
              {starting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  启动中…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  开始生成
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {isTerminal && hasAnyDone && (
        <Card className="border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/70 dark:bg-emerald-950/30">
          <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="text-sm">
              <div className="font-medium text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {current === "SUCCEEDED" ? "全部生成完毕" : "部分生成完毕"}
              </div>
              {current === "PARTIAL" && (
                <div className="text-xs text-emerald-800/70 dark:text-emerald-300/70 mt-0.5">
                  未生成的部分已自动退还积分
                </div>
              )}
            </div>
            <Button asChild className="gap-2 bg-emerald-700 hover:bg-emerald-800">
              <a href={`/api/jobs/${jobId}/download`} download>
                <Download className="h-4 w-4" />
                下载全部 (zip)
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {current === "FAILED" && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-5 text-sm flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            全部生成失败，积分已退还。
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    PENDING: { label: "未开始", cls: "bg-muted text-muted-foreground" },
    RUNNING: { label: "生成中", cls: "bg-primary/10 text-primary border-primary/20" },
    SUCCEEDED: { label: "已完成", cls: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40" },
    PARTIAL: { label: "部分完成", cls: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40" },
    FAILED: { label: "失败", cls: "bg-destructive/10 text-destructive border-destructive/20" },
  };
  const m = map[status];
  return <Badge variant="outline" className={cn("font-medium", m.cls)}>{m.label}</Badge>;
}

function PanelCard({
  jobId,
  panel,
  label,
  aspect,
  state,
  url,
}: {
  jobId: string;
  panel: PanelId;
  label: string;
  aspect: string;
  state: PanelState;
  url?: string;
}) {
  const aspectClass = aspect === "3:2" ? "aspect-[3/2]" : "aspect-square";

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className={`${aspectClass} bg-muted flex items-center justify-center relative overflow-hidden`}>
        {state === "done" && url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={label} className="w-full h-full object-cover" />
            <a
              href={`/api/jobs/${jobId}/panels/${panel}/download`}
              className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-background/95 hover:bg-background text-foreground text-xs px-2.5 py-1 shadow-sm backdrop-blur border border-border/60 transition-colors"
              download
            >
              <Download className="h-3 w-3" />
              下载
            </a>
          </>
        ) : state === "running" ? (
          <div className="flex flex-col items-center gap-2 text-primary">
            <Skeleton className="absolute inset-0" />
            <div className="relative flex flex-col items-center gap-1.5">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-xs font-medium">生成中…</span>
            </div>
          </div>
        ) : state === "pending" ? (
          <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
            <Clock className="h-5 w-5" />
            <span className="text-xs">排队中</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-xs">失败</span>
          </div>
        )}
      </div>
      <div className="px-3 py-2 flex items-center justify-between text-xs border-t border-border/60">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{aspect}</span>
      </div>
    </div>
  );
}
