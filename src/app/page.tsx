export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-6 py-24 flex flex-col items-center">
      <div className="max-w-2xl w-full space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">电商详情图生成器</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          上传商品图，填写产品亮点，AI 自动生成一整套电商详情图。
        </p>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-900">
          <h2 className="font-semibold mb-2">Phase 0 — 骨架就绪</h2>
          <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1 list-disc pl-5">
            <li>Next.js 16 + TypeScript + Tailwind</li>
            <li>Prisma + PostgreSQL schema 已就绪</li>
            <li>Redis + BullMQ 队列依赖已安装</li>
            <li>BananaRouter / 阿里云 OSS client 占位已建</li>
          </ul>
          <p className="text-sm text-zinc-500 mt-4">下一步：Phase 1 认证与用户系统。</p>
        </div>
      </div>
    </main>
  );
}
