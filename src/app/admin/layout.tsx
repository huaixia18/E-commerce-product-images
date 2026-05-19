import Link from "next/link";
import { getAdminSession } from "@/lib/adminAuth";
import { Toaster } from "@/components/ui/sonner";
import { BarChart3, Users, Receipt, Gift } from "lucide-react";
import { AdminLogoutButton } from "./LogoutButton";

export const metadata = { title: "管理后台 · 图作AI" };

const NAV_ITEMS = [
  { href: "/admin", label: "总览", icon: BarChart3 },
  { href: "/admin/users", label: "用户", icon: Users },
  { href: "/admin/orders", label: "订单", icon: Receipt },
  { href: "/admin/referrals", label: "邀请审计", icon: Gift },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();

  // Cover the public layout's Nav/Footer entirely with a fixed full-viewport
  // shell so the admin UI feels like a separate app.

  if (!session) {
    return (
      <div className="fixed inset-0 z-50 overflow-auto bg-slate-50">
        {children}
        <Toaster richColors closeButton position="top-center" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 text-slate-900 grid grid-cols-[220px_1fr]">
      <aside className="border-r border-slate-200 bg-white flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-slate-900 text-white text-xs font-black">
            管
          </span>
          <span className="font-bold text-sm">图作AI 后台</span>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV_ITEMS.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-slate-700 hover:bg-slate-100"
            >
              <it.icon className="h-4 w-4" />
              <span>{it.label}</span>
            </Link>
          ))}
        </nav>
        <div className="px-3 py-3 border-t border-slate-200 text-xs text-slate-500">
          <div className="truncate font-medium text-slate-700 mb-1">{session.email}</div>
          <AdminLogoutButton />
        </div>
      </aside>
      <main className="overflow-y-auto">{children}</main>
      <Toaster richColors closeButton position="top-center" />
    </div>
  );
}
