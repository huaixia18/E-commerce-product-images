import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/adminAuth";
import { AdminLoginForm } from "./LoginForm";

export const metadata = { title: "管理员登录" };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getAdminSession();
  const sp = await searchParams;
  if (session) redirect(sp.next ?? "/admin");

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-slate-50">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900 text-white text-xl font-black mb-3">
            管
          </div>
          <h1 className="text-2xl font-bold text-slate-900">管理员登录</h1>
          <p className="text-sm text-slate-500 mt-1">仅供运营人员访问</p>
        </div>
        <AdminLoginForm next={sp.next ?? "/admin"} />
      </div>
    </main>
  );
}
