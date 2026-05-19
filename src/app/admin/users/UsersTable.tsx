"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Loader2 } from "lucide-react";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  credits: number;
  createdAt: string;
  referralCode: string;
  _count: { jobs: number; orders: number; referralsSent: number };
}

export function UsersTable({ users, initialQuery }: { users: UserRow[]; initialQuery: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(initialQuery);
  const [active, setActive] = useState<UserRow | null>(null);

  function search(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams(sp.toString());
    if (q.trim()) params.set("q", q.trim());
    else params.delete("q");
    router.push(`/admin/users?${params.toString()}`);
  }

  return (
    <>
      <form onSubmit={search} className="mb-4 flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="按邮箱 / 昵称 / ID / 邀请码搜索…"
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
              <th className="px-4 py-2.5 text-left font-medium">邮箱</th>
              <th className="px-4 py-2.5 text-left font-medium">昵称</th>
              <th className="px-4 py-2.5 text-right font-medium">积分</th>
              <th className="px-4 py-2.5 text-right font-medium">任务</th>
              <th className="px-4 py-2.5 text-right font-medium">订单</th>
              <th className="px-4 py-2.5 text-right font-medium">邀请</th>
              <th className="px-4 py-2.5 text-left font-medium">注册时间</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  无匹配用户
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-mono text-xs">{u.email}</td>
                <td className="px-4 py-2.5">{u.name ?? "—"}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{u.credits}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{u._count.jobs}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{u._count.orders}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{u._count.referralsSent}</td>
                <td className="px-4 py-2.5 text-xs text-slate-500 font-mono whitespace-nowrap">
                  {new Date(u.createdAt).toLocaleString("zh-CN")}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => setActive(u)}
                    className="text-xs font-semibold text-slate-700 hover:text-slate-900"
                  >
                    详情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {active && <UserDetailDialog user={active} onClose={() => setActive(null)} />}
    </>
  );
}

function UserDetailDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const router = useRouter();
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function adjust() {
    const n = Number(delta);
    if (!Number.isInteger(n) || n === 0) {
      toast.error("请输入非零整数");
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${user.id}/credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta: n, note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        toast.error("调整失败", { description: b.error });
        return;
      }
      toast.success(`已${n > 0 ? "加" : "扣"} ${Math.abs(n)} 积分`);
      setDelta("");
      setNote("");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{user.email}</DialogTitle>
          <DialogDescription className="font-mono text-xs">{user.id}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 my-2">
          <Field label="昵称" value={user.name ?? "—"} />
          <Field label="积分" value={String(user.credits)} />
          <Field label="任务" value={String(user._count.jobs)} />
          <Field label="已付订单" value={String(user._count.orders)} />
          <Field label="成功邀请" value={String(user._count.referralsSent)} />
          <Field label="注册时间" value={new Date(user.createdAt).toLocaleString("zh-CN")} />
          <Field label="邀请码" value={user.referralCode} mono />
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
          <div className="text-xs font-semibold">手动调整积分</div>
          <div className="flex gap-2">
            <input
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="±N，例如 50 或 -10"
              className="flex-1 px-2 py-1.5 text-sm rounded border border-slate-300 bg-white"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="备注（可选）"
              className="flex-1 px-2 py-1.5 text-sm rounded border border-slate-300 bg-white"
            />
            <button
              onClick={adjust}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              {pending && <Loader2 className="h-3 w-3 animate-spin" />}
              执行
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            操作会写入用户的 CreditEntry 流水，type=ADMIN_ADJUST。
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`text-sm ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
