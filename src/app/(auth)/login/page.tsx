import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "登录 · 电商详情图" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await auth();
  const sp = await searchParams;
  if (session) redirect(sp.next ?? "/dashboard");
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">登录</h1>
          <p className="text-sm text-zinc-500 mt-1">使用你的邮箱和密码继续。</p>
        </div>
        <LoginForm next={sp.next ?? "/dashboard"} />
        <p className="text-sm text-zinc-500">
          还没有账号？{" "}
          <Link href="/register" className="text-zinc-900 dark:text-zinc-100 underline">
            注册
          </Link>
        </p>
      </div>
    </div>
  );
}
