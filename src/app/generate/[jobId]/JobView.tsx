"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PanelId } from "@/lib/promptTemplate";

type Status = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "PARTIAL";
type PanelState = "pending" | "running" | "done" | "failed";
interface PanelStatus {
  panel: PanelId;
  state: PanelState;
  url?: string;
  width?: number | null;
  height?: number | null;
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
  const [startError, setStartError] = useState<string | null>(null);
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
        /* transient — retry */
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
    setStartError(null);
    startTransition(async () => {
      const res = await fetch(`/api/jobs/${jobId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ panels }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setStartError(body.error ?? "启动失败");
        return;
      }
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
    <section className="space-y-4 border-t border-zinc-200 dark:border-zinc-800 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">生成进度</h2>
        <StatusBadge status={current} />
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

      {showStartButton && (
        <div className="rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-4 flex items-center justify-between gap-4">
          <div className="text-sm">
            <div>预计消耗 <strong>{cost}</strong> 积分（剩余 {credits}）</div>
            {!enoughCredits && (
              <div className="text-red-600 text-xs mt-1">
                积分不足，
                <a href="/pricing" className="underline">立即充值</a>。
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleStart}
            disabled={starting || !enoughCredits}
            className="rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {starting ? "启动中…" : "开始生成"}
          </button>
        </div>
      )}
      {startError && <p className="text-sm text-red-600">{startError}</p>}

      {isTerminal && hasAnyDone && (
        <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 px-4 py-4 flex items-center justify-between gap-4">
          <div className="text-sm text-emerald-900 dark:text-emerald-200">
            ✅ 生成完毕。
            {current === "PARTIAL" && " 部分图未生成，已自动退还相应积分。"}
          </div>
          <a
            href={`/api/jobs/${jobId}/download`}
            className="rounded-md bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-medium"
            download
          >
            下载全部 (zip)
          </a>
        </div>
      )}
      {current === "FAILED" && (
        <div className="rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-4 py-3 text-sm text-red-900 dark:text-red-200">
          ❌ 全部失败，积分已退还。
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    PENDING: { label: "未开始", cls: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
    RUNNING: { label: "生成中", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200" },
    SUCCEEDED: { label: "已完成", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
    PARTIAL: { label: "部分完成", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
    FAILED: { label: "失败", cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200" },
  };
  const m = map[status];
  return <span className={`text-xs rounded-full px-2.5 py-0.5 ${m.cls}`}>{m.label}</span>;
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
  const stateMap: Record<PanelState, { text: string; cls: string }> = {
    pending: { text: "排队中", cls: "text-zinc-500" },
    running: { text: "生成中…", cls: "text-blue-600" },
    done: { text: "完成", cls: "text-emerald-600" },
    failed: { text: "失败", cls: "text-red-600" },
  };
  const s = stateMap[state];
  const aspectClass = aspect === "3:2" ? "aspect-[3/2]" : "aspect-square";

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className={`${aspectClass} bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center relative`}>
        {state === "done" && url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={label} className="w-full h-full object-cover" />
            <a
              href={`/api/jobs/${jobId}/panels/${panel}/download`}
              className="absolute bottom-2 right-2 rounded-md bg-black/70 hover:bg-black/85 text-white text-[11px] px-2 py-1 backdrop-blur"
              download
            >
              下载
            </a>
          </>
        ) : state === "running" ? (
          <div className="flex flex-col items-center gap-1.5 text-blue-600">
            <span className="h-3 w-3 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs">生成中…</span>
          </div>
        ) : state === "pending" ? (
          <div className="text-xs text-zinc-400">排队中</div>
        ) : (
          <div className="text-xs text-red-600">✕ 失败</div>
        )}
      </div>
      <div className="px-3 py-2 flex items-center justify-between text-xs border-t border-zinc-100 dark:border-zinc-800">
        <span>{label}</span>
        <span className={s.cls}>{s.text}</span>
      </div>
    </div>
  );
}
