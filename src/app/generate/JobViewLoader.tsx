"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { JobView } from "./[jobId]/JobView";
import {
  STYLE_LABELS,
  PLATFORM_LABELS,
  ALL_PANEL_IDS,
  type JobSpec,
  type PanelId,
  type StyleId,
  type PlatformId,
} from "@/lib/promptTemplate";

type Status = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "PARTIAL";

interface JobDetail {
  id: string;
  status: Status;
  title: string;
  style: StyleId | null;
  platform: PlatformId | null;
  highlights: string[];
  specs: JobSpec[];
  requestedPanels: PanelId[];
  sources: { id: string; url: string }[];
}

/**
 * Client-side loader for the workbench: fetches a job's display data by id and
 * renders the same JobView used on the standalone /generate/[jobId] page —
 * without a full page navigation.
 */
export function JobViewLoader({ jobId, credits }: { jobId: string; credits: number }) {
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(res.status === 404 ? "项目不存在" : `加载失败 (${res.status})`);
        const data = (await res.json()) as JobDetail;
        if (!cancelled) setDetail(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载失败");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (error) {
    return (
      <div className="flex-1 grid place-items-center text-sm text-destructive">{error}</div>
    );
  }
  if (!detail) {
    return (
      <div className="flex-1 grid place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const panels = (detail.requestedPanels ?? ALL_PANEL_IDS) as PanelId[];

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="px-6 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-bold text-foreground truncate">{detail.title}</span>
          <span>·</span>
          <span>{detail.platform ? PLATFORM_LABELS[detail.platform] : "—"}</span>
          <span>·</span>
          <span>{detail.style ? STYLE_LABELS[detail.style] : "—"}</span>
        </div>
      </div>
      <JobView
        jobId={detail.id}
        title={detail.title}
        initialStatus={detail.status}
        panels={panels}
        credits={credits}
        sources={detail.sources}
        highlights={detail.highlights}
        specs={detail.specs}
      />
    </div>
  );
}
