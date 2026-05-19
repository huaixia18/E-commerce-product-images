"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, RotateCw, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "PENDING" | "RUNNING" | "SUCCEEDED" | "PARTIAL" | "FAILED";
type PanelState = "done" | "running" | "queued" | "failed";

interface JobDetail {
  id: string;
  userEmail: string;
  userCredits: number;
  status: Status;
  creditsCost: number;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  input: {
    title: string;
    highlights: string[];
    style?: string;
    platform?: string;
    specs?: { label: string; value: string }[];
  };
  sources: { id: string; url: string }[];
  panels: { panel: string; state: PanelState; url?: string }[];
  ledger: {
    id: string;
    amount: number;
    type: string;
    note: string | null;
    createdAt: string;
  }[];
}

export function JobDetailDialog({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const router = useRouter();
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, startTransition] = useTransition();
  const [refundAmount, setRefundAmount] = useState("");

  async function reload() {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/jobs/${jobId}`);
      if (!r.ok) throw new Error(String(r.status));
      setDetail(await r.json());
    } catch (e) {
      toast.error("加载失败", { description: e instanceof Error ? e.message : "" });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  function retry() {
    if (!confirm("重新入队所有未完成的 panel？\n不会扣用户积分，状态会改回 RUNNING。")) return;
    startTransition(async () => {
      const r = await fetch(`/api/admin/jobs/${jobId}/retry`, { method: "POST" });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error("重试失败", { description: body.error });
        return;
      }
      toast.success(`已重新入队 ${body.retried?.length ?? 0} 个 panel`);
      await reload();
      router.refresh();
    });
  }

  function refund() {
    const n = refundAmount.trim() ? Number(refundAmount) : null;
    if (n !== null && (!Number.isInteger(n) || n <= 0)) {
      toast.error("退款积分必须是正整数");
      return;
    }
    const msg = n
      ? `给用户退 ${n} 积分（最多 ${detail?.creditsCost}）？`
      : `按任务总成本 ${detail?.creditsCost} 积分全额退款？`;
    if (!confirm(msg)) return;
    startTransition(async () => {
      const r = await fetch(`/api/admin/jobs/${jobId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(n ? { amount: n } : {}),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error("退款失败", { description: body.error });
        return;
      }
      toast.success(`已退 ${body.refunded} 积分`);
      setRefundAmount("");
      await reload();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{detail?.input.title ?? "任务详情"}</DialogTitle>
          <DialogDescription className="font-mono text-xs">{jobId}</DialogDescription>
        </DialogHeader>

        {loading && !detail && (
          <div className="py-12 grid place-items-center text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {detail && (
          <>
            {/* Status row */}
            <div className="grid grid-cols-4 gap-2 text-xs">
              <Stat label="状态" value={detail.status} accent={statusAccent(detail.status)} />
              <Stat label="积分" value={String(detail.creditsCost)} />
              <Stat label="出图" value={String(detail.panels.filter((p) => p.state === "done").length)} />
              <Stat label="用户余额" value={String(detail.userCredits)} />
            </div>

            {/* User + meta */}
            <div className="mt-4 space-y-1 text-xs text-slate-600">
              <div>用户：<span className="font-mono">{detail.userEmail}</span></div>
              <div>风格：{detail.input.style ?? "—"} · 平台：{detail.input.platform ?? "—"}</div>
              <div className="font-mono text-[11px]">
                创建 {fmt(detail.createdAt)}
                {detail.startedAt && ` · 启动 ${fmt(detail.startedAt)}`}
                {detail.finishedAt && ` · 完成 ${fmt(detail.finishedAt)}`}
              </div>
              {detail.errorMessage && (
                <div className="text-red-600 font-mono">错误：{detail.errorMessage}</div>
              )}
            </div>

            {/* Panel grid */}
            <div className="mt-5">
              <div className="text-xs font-semibold text-slate-700 mb-2">面板（{detail.panels.length}）</div>
              <ul className="grid grid-cols-3 gap-2">
                {detail.panels.map((p) => (
                  <li
                    key={p.panel}
                    className={cn(
                      "relative aspect-square rounded-md overflow-hidden border bg-slate-100 grid place-items-center text-[10px] font-mono",
                      p.state === "done" && "border-emerald-200",
                      p.state === "failed" && "border-red-200 bg-red-50",
                      p.state === "queued" && "border-slate-200",
                      p.state === "running" && "border-blue-200 bg-blue-50",
                    )}
                  >
                    {p.state === "done" && p.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center">
                        <div className="font-bold text-slate-700">{p.panel}</div>
                        <div className={`mt-1 ${panelStateColor(p.state)}`}>{panelStateLabel(p.state)}</div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Highlights + specs */}
            {(detail.input.highlights?.length || detail.input.specs?.length) && (
              <div className="mt-5 grid grid-cols-2 gap-4 text-xs">
                {detail.input.highlights?.length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-700 mb-1">卖点</div>
                    <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                      {detail.input.highlights.map((h, i) => <li key={i}>{h}</li>)}
                    </ul>
                  </div>
                )}
                {detail.input.specs && detail.input.specs.length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-700 mb-1">参数</div>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-slate-600">
                      {detail.input.specs.map((s, i) => (
                        <div key={i} className="contents">
                          <dt className="text-slate-400">{s.label}</dt>
                          <dd>{s.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>
            )}

            {/* Ledger */}
            <div className="mt-5">
              <div className="text-xs font-semibold text-slate-700 mb-2">积分流水</div>
              <div className="rounded-md border border-slate-200 overflow-hidden">
                {detail.ledger.length === 0 ? (
                  <div className="px-3 py-4 text-center text-slate-400 text-xs">无</div>
                ) : (
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-slate-100">
                      {detail.ledger.map((e) => (
                        <tr key={e.id}>
                          <td className="px-3 py-2 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                            {fmt(e.createdAt)}
                          </td>
                          <td className="px-3 py-2 text-slate-500">{e.type}</td>
                          <td className="px-3 py-2 text-slate-500 truncate">{e.note ?? "—"}</td>
                          <td
                            className={cn(
                              "px-3 py-2 text-right font-mono font-bold tabular-nums",
                              e.amount > 0 ? "text-emerald-600" : e.amount < 0 ? "text-red-600" : "text-slate-500",
                            )}
                          >
                            {e.amount > 0 ? `+${e.amount}` : e.amount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="text-xs font-semibold">管理员操作</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={retry}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-1.5 rounded bg-white border border-slate-300 hover:bg-slate-100 px-3 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
                  重试未完成 panel
                </button>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    placeholder={`全额 ${detail.creditsCost}`}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="flex-1 px-2 py-1.5 text-xs rounded border border-slate-300 bg-white"
                  />
                  <button
                    onClick={refund}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
                  >
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    退积分
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                重试：把没生成完的 panel 重新入队，不扣积分。<br />
                退积分：给用户加积分（≤ 任务总积分），写入 REFUND 流水，但不动已生成的图片。
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className={cn("text-sm font-bold tabular-nums", accent ?? "text-slate-900")}>{value}</div>
    </div>
  );
}

function statusAccent(s: Status): string {
  if (s === "SUCCEEDED") return "text-emerald-600";
  if (s === "PARTIAL") return "text-amber-600";
  if (s === "FAILED") return "text-red-600";
  if (s === "RUNNING") return "text-blue-600";
  return "text-slate-700";
}
function panelStateLabel(s: PanelState): string {
  return ({ done: "完成", running: "生成中", queued: "排队", failed: "失败" } as const)[s];
}
function panelStateColor(s: PanelState): string {
  return ({ done: "text-emerald-600", running: "text-blue-600", queued: "text-slate-500", failed: "text-red-600" } as const)[s];
}
function fmt(s: string): string {
  return new Date(s).toLocaleString("zh-CN");
}
