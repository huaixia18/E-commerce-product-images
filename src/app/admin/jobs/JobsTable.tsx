"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { JobDetailDialog } from "./JobDetailDialog";

type Status = "PENDING" | "RUNNING" | "SUCCEEDED" | "PARTIAL" | "FAILED";

interface JobRow {
  id: string;
  userId: string;
  user: { email: string };
  status: Status;
  inputJson: unknown;
  creditsCost: number;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  _count: { images: number };
}

const STATUS_LABEL: Record<Status, string> = {
  PENDING: "未开始",
  RUNNING: "生成中",
  SUCCEEDED: "完成",
  PARTIAL: "部分完成",
  FAILED: "失败",
};
const STATUS_CLS: Record<Status, string> = {
  PENDING: "bg-slate-200 text-slate-700",
  RUNNING: "bg-blue-100 text-blue-700",
  SUCCEEDED: "bg-emerald-100 text-emerald-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  FAILED: "bg-red-100 text-red-700",
};

export function JobsTable({
  jobs,
  statusFilter,
  initialQuery,
}: {
  jobs: JobRow[];
  statusFilter?: Status;
  initialQuery: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(initialQuery);
  const [activeId, setActiveId] = useState<string | null>(null);

  function applyQuery(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams(sp.toString());
    if (q.trim()) params.set("q", q.trim());
    else params.delete("q");
    router.push(`/admin/jobs?${params.toString()}`);
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Chip label="全部" href={qsHref(sp, { status: null })} active={!statusFilter} />
        {(["PENDING", "RUNNING", "SUCCEEDED", "PARTIAL", "FAILED"] as Status[]).map((s) => (
          <Chip
            key={s}
            label={STATUS_LABEL[s]}
            href={qsHref(sp, { status: s })}
            active={statusFilter === s}
          />
        ))}
      </div>

      <form onSubmit={applyQuery} className="mb-4 flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="按用户邮箱 / 昵称搜索…"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-sm font-semibold"
        >
          搜索
        </button>
      </form>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">标题</th>
              <th className="px-4 py-2.5 text-left font-medium">用户</th>
              <th className="px-4 py-2.5 text-left font-medium">状态</th>
              <th className="px-4 py-2.5 text-right font-medium">积分</th>
              <th className="px-4 py-2.5 text-right font-medium">出图</th>
              <th className="px-4 py-2.5 text-left font-medium">创建</th>
              <th className="px-4 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {jobs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                  无匹配任务
                </td>
              </tr>
            )}
            {jobs.map((j) => {
              const title =
                (j.inputJson as { title?: string } | null)?.title ?? "未命名任务";
              return (
                <tr key={j.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 max-w-xs">
                    <div className="font-medium truncate">{title}</div>
                    <div className="text-[10px] text-slate-500 font-mono truncate">{j.id}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs">{j.user.email}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block text-[10px] px-2 py-0.5 rounded font-bold ${STATUS_CLS[j.status]}`}
                    >
                      {STATUS_LABEL[j.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{j.creditsCost}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">
                    {j._count.images}
                  </td>
                  <td className="px-4 py-2.5 text-[11px] font-mono text-slate-500 whitespace-nowrap">
                    {new Date(j.createdAt).toLocaleString("zh-CN")}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => setActiveId(j.id)}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900"
                    >
                      详情
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {activeId && <JobDetailDialog jobId={activeId} onClose={() => setActiveId(null)} />}
    </>
  );
}

function qsHref(sp: URLSearchParams, patch: Record<string, string | null>): string {
  const next = new URLSearchParams(sp.toString());
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) next.delete(k);
    else next.set(k, v);
  }
  const s = next.toString();
  return s ? `/admin/jobs?${s}` : "/admin/jobs";
}

function Chip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-bold"
          : "px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100"
      }
    >
      {label}
    </Link>
  );
}
