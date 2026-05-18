import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "注册 · 电商详情图" };

export default async function RegisterPage() {
  const session = await auth();
  if (session) redirect("/dashboard");
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">创建账号</h1>
          <p className="text-sm text-zinc-500 mt-1">使用邮箱注册，开始生成电商详情图。</p>
        </div>
        <RegisterForm />
        <p className="text-sm text-zinc-500">
          已有账号？{" "}
          <Link href="/login" className="text-zinc-900 dark:text-zinc-100 underline">
            登录
          </Link>
        </p>
      </div>
    </div>
  );
}
