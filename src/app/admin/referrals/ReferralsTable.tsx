"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface RefRow {
  id: string;
  referrerId: string;
  referrer: { email: string };
  inviteeId: string;
  invitee: { email: string };
  status: "GRANTED" | "REVOKED";
  referrerReward: number;
  inviteeReward: number;
  inviteeIp: string | null;
  inviteeFp: string | null;
  createdAt: string;
}

export function ReferralsTable({
  referrals,
  showRevoked,
}: {
  referrals: RefRow[];
  showRevoked: boolean;
}) {
  return (
    <>
      <div className="mb-4 flex gap-2">
        <Chip label="GRANTED" href="/admin/referrals" active={!showRevoked} />
        <Chip label="REVOKED" href="/admin/referrals?status=revoked" active={showRevoked} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">时间</th>
              <th className="px-4 py-2.5 text-left font-medium">邀请人</th>
              <th className="px-4 py-2.5 text-left font-medium">被邀人</th>
              <th className="px-4 py-2.5 text-right font-medium">奖励</th>
              <th className="px-4 py-2.5 text-left font-medium">IP</th>
              <th className="px-4 py-2.5 text-left font-medium">设备指纹</th>
              <th className="px-4 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {referrals.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                  无邀请记录
                </td>
              </tr>
            )}
            {referrals.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Row({ r }: { r: RefRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function revoke() {
    if (
      !confirm(
        `作废本笔邀请？\n双方扣回积分：邀请人 -${r.referrerReward}，被邀人 -${r.inviteeReward}（余额不足时只扣到 0）。\n操作不可逆。`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/admin/referrals/${r.id}/revoke`, { method: "POST" });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        toast.error("操作失败", { description: b.error });
        return;
      }
      toast.success("已作废");
      router.refresh();
    });
  }

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-2.5 text-[11px] font-mono text-slate-500 whitespace-nowrap">
        {new Date(r.createdAt).toLocaleString("zh-CN")}
      </td>
      <td className="px-4 py-2.5 text-xs">{r.referrer.email}</td>
      <td className="px-4 py-2.5 text-xs">{r.invitee.email}</td>
      <td className="px-4 py-2.5 text-right tabular-nums text-xs">
        +{r.referrerReward} / +{r.inviteeReward}
      </td>
      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">{r.inviteeIp ?? "—"}</td>
      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">
        {r.inviteeFp ? r.inviteeFp.slice(0, 12) + "…" : "—"}
      </td>
      <td className="px-4 py-2.5 text-right">
        {r.status === "GRANTED" ? (
          <button
            onClick={revoke}
            disabled={pending}
            className="text-xs font-semibold text-red-700 hover:text-red-900 disabled:opacity-50"
          >
            {pending && <Loader2 className="inline h-3 w-3 mr-1 animate-spin" />}
            作废
          </button>
        ) : (
          <span className="text-[11px] text-slate-400">已作废</span>
        )}
      </td>
    </tr>
  );
}

function Chip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-bold font-mono"
          : "px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 font-mono"
      }
    >
      {label}
    </Link>
  );
}
