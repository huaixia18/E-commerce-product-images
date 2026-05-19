"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LogOut, Loader2 } from "lucide-react";

export function AdminLogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function logout() {
    startTransition(async () => {
      await fetch("/api/admin/logout", { method: "POST" });
      router.push("/admin/login");
      router.refresh();
    });
  }
  return (
    <button
      onClick={logout}
      disabled={pending}
      className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900"
    >
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogOut className="h-3 w-3" />}
      退出
    </button>
  );
}
