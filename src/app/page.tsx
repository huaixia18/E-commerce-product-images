import Link from "next/link";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();
  return (
    <main className="flex-1 bg-zinc-50 dark:bg-zinc-950 px-6 py-24 flex flex-col items-center">
      <div className="max-w-2xl w-full space-y-8">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">电商详情图生成器</h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            上传商品图，填写产品亮点，AI 自动生成一整套电商详情图。
          </p>
        </div>
        <div className="flex gap-3">
          {session?.user ? (
            <Link
              href="/dashboard"
              className="rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 text-sm font-medium"
            >
              进入控制台
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 text-sm font-medium"
              >
                免费注册
              </Link>
              <Link
                href="/login"
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-5 py-2.5 text-sm font-medium"
              >
                登录
              </Link>
            </>
          )}
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-900">
          <h2 className="font-semibold mb-2">开发进度</h2>
          <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1 list-disc pl-5">
            <li>✅ Phase 0 — 项目骨架</li>
            <li>✅ Phase 1 — 用户注册 / 登录 / 控制台</li>
            <li>⏳ Phase 2 — 上传商品图 + 卖点表单</li>
            <li>⏳ Phase 3 — GPT-Image-2 生成核心</li>
            <li>⏳ Phase 4 — 结果排版与 zip 下载</li>
            <li>⏳ Phase 5 — 微信 / 支付宝 充值</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
