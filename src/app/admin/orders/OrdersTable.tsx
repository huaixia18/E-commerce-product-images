"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Status = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

interface OrderRow {
  id: string;
  userId: string;
  user: { email: string };
  provider: "WECHAT" | "ALIPAY";
  amountCents: number;
  credits: number;
  status: Status;
  paidAt: string | null;
  providerOrderId: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<Status, string> = {
  PENDING: "未付",
  PAID: "已付",
  FAILED: "失败",
  REFUNDED: "已退款",
};
const STATUS_CLS: Record<Status, string> = {
  PENDING: "bg-slate-200 text-slate-700",
  PAID: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
  REFUNDED: "bg-amber-100 text-amber-700",
};

export function OrdersTable({ orders, statusFilter }: { orders: OrderRow[]; statusFilter?: Status }) {
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChip label="全部" href="/admin/orders" active={!statusFilter} />
        {(["PENDING", "PAID", "FAILED", "REFUNDED"] as Status[]).map((s) => (
          <FilterChip key={s} label={STATUS_LABELS[s]} href={`/admin/orders?status=${s}`} active={statusFilter === s} />
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">订单 ID</th>
              <th className="px-4 py-2.5 text-left font-medium">用户</th>
              <th className="px-4 py-2.5 text-left font-medium">通道</th>
              <th className="px-4 py-2.5 text-right font-medium">金额</th>
              <th className="px-4 py-2.5 text-right font-medium">积分</th>
              <th className="px-4 py-2.5 text-left font-medium">状态</th>
              <th className="px-4 py-2.5 text-left font-medium">创建</th>
              <th className="px-4 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">无订单</td></tr>
            )}
            {orders.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function OrderRow({ order: o }: { order: OrderRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function action(act: "mark_paid" | "refund") {
    if (act === "refund" && !confirm("确定要把订单状态改为 REFUNDED 吗？会从用户余额扣回 " + o.credits + " 积分。")) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/orders/${o.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: act }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        toast.error("操作失败", { description: b.error });
        return;
      }
      toast.success("已更新");
      router.refresh();
    });
  }

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-700">{o.id.slice(0, 12)}…</td>
      <td className="px-4 py-2.5 text-xs">{o.user.email}</td>
      <td className="px-4 py-2.5 text-xs">{o.provider === "WECHAT" ? "微信" : "支付宝"}</td>
      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
        ¥{(o.amountCents / 100).toFixed(2)}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">{o.credits}</td>
      <td className="px-4 py-2.5">
        <span className={`inline-block text-[10px] px-2 py-0.5 rounded font-bold ${STATUS_CLS[o.status]}`}>
          {STATUS_LABELS[o.status]}
        </span>
      </td>
      <td className="px-4 py-2.5 text-[11px] font-mono text-slate-500">
        {new Date(o.createdAt).toLocaleString("zh-CN")}
      </td>
      <td className="px-4 py-2.5 text-right">
        {o.status === "PENDING" && (
          <button onClick={() => action("mark_paid")} disabled={pending} className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 disabled:opacity-50">
            {pending && <Loader2 className="inline h-3 w-3 mr-1 animate-spin" />}
            标已付
          </button>
        )}
        {o.status === "PAID" && (
          <button onClick={() => action("refund")} disabled={pending} className="text-xs font-semibold text-amber-700 hover:text-amber-900 disabled:opacity-50">
            {pending && <Loader2 className="inline h-3 w-3 mr-1 animate-spin" />}
            退款
          </button>
        )}
      </td>
    </tr>
  );
}

function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }) {
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
