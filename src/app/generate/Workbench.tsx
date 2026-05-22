"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GenerateForm } from "./GenerateForm";
import { JobViewLoader } from "./JobViewLoader";
import { cn } from "@/lib/utils";
import { Plus, Loader2, Sparkles, ImageIcon, GalleryHorizontalEnd } from "lucide-react";

type Status = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "PARTIAL";

interface JobRow {
  id: string;
  title: string;
  platform: string;
  style: string;
  status: Status;
  createdAt: string;
  panelCount: number;
  thumbUrl: string | null;
}

const PLATFORM_LABEL: Record<string, string> = {
  taobao: "淘宝",
  tmall: "天猫",
  jd: "京东",
  amazon: "亚马逊",
  generic: "通用",
};

export function Workbench({ credits, initialJobId }: { credits: number; initialJobId?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  // null = "new project" form; otherwise the selected job id.
  const [selected, setSelected] = useState<string | null>(initialJobId ?? null);

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items: JobRow[] };
      setJobs(data.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Keep ?job= in the URL in sync so the view is shareable / refresh-safe,
  // without a full navigation.
  useEffect(() => {
    const url = selected ? `/generate?job=${selected}` : "/generate";
    if (params.get("job") !== (selected ?? null)) {
      window.history.replaceState(null, "", url);
    }
  }, [selected, params]);

  function selectNew() {
    setSelected(null);
  }
  function selectJob(id: string) {
    setSelected(id);
  }

  function handleCreated(id: string) {
    setSelected(id);
    // Refresh the list so the new project appears in the rail.
    loadJobs();
    router.refresh();
  }

  return (
    <main className="flex-1 bg-background flex min-h-[calc(100vh-4rem)]">
      {/* LEFT RAIL — project list */}
      <aside className="w-60 shrink-0 border-r border-border bg-card flex flex-col">
        <div className="p-3 border-b border-border space-y-2">
          <button
            type="button"
            onClick={selectNew}
            className={cn(
              "w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-full font-extrabold text-sm transition-colors",
              selected === null
                ? "bg-primary text-primary-foreground shadow-[0_6px_20px_-4px_oklch(0.67_0.21_38_/_0.4)]"
                : "bg-secondary text-foreground hover:bg-secondary/70",
            )}
          >
            <Plus className="h-4 w-4" />
            新建项目
          </button>
          <Link
            href="/gallery"
            className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-full text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            <GalleryHorizontalEnd className="h-3.5 w-3.5" />
            历史图库
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="grid place-items-center py-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-8 px-3 leading-relaxed">
              还没有项目
              <br />
              点上方「新建项目」开始
            </p>
          ) : (
            jobs.map((j) => (
              <button
                key={j.id}
                type="button"
                onClick={() => selectJob(j.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-colors",
                  selected === j.id ? "bg-secondary" : "hover:bg-secondary/50",
                )}
              >
                <span className="relative w-11 h-11 rounded-lg overflow-hidden bg-secondary ring-1 ring-border shrink-0 grid place-items-center">
                  {j.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={j.thumbUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold truncate">{j.title}</span>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                    <span className="bg-background rounded px-1 py-0.5 font-semibold">
                      {PLATFORM_LABEL[j.platform] ?? "通用"}
                    </span>
                    <StatusDot status={j.status} />
                    <span className="tabular-nums">{j.panelCount} 张</span>
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* CONTENT — new form OR selected job result */}
      {selected === null ? (
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="px-6 py-3 border-b border-border bg-card flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-bold text-foreground">新建项目</span>
            <span className="ml-auto text-[11px]">余额 <strong className="text-primary tabular-nums">{credits}</strong> 积分</span>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <GenerateForm credits={credits} onCreated={handleCreated} />
          </div>
        </div>
      ) : (
        <JobViewLoader key={selected} jobId={selected} credits={credits} />
      )}
    </main>
  );
}

function StatusDot({ status }: { status: Status }) {
  const map: Record<Status, { c: string; t: string }> = {
    PENDING: { c: "bg-muted-foreground", t: "待开始" },
    RUNNING: { c: "bg-primary animate-pulse", t: "生成中" },
    SUCCEEDED: { c: "bg-success", t: "完成" },
    PARTIAL: { c: "bg-warning", t: "部分" },
    FAILED: { c: "bg-destructive", t: "失败" },
  };
  const s = map[status];
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("w-1.5 h-1.5 rounded-full", s.c)} />
      {s.t}
    </span>
  );
}
