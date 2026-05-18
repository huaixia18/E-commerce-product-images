import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "控制台 · 电商详情图" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, recentJobs, recentEntries] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, name: true, credits: true },
    }),
    prisma.job.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, status: true, createdAt: true, creditsCost: true, inputJson: true },
    }),
    prisma.creditEntry.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, amount: true, type: true, note: true, createdAt: true },
    }),
  ]);

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        <header className="flex items-baseline justify-between">
          <div>
            <h1 className="text-3xl font-bold">控制台</h1>
            <p className="text-sm text-zinc-500 mt-1">{user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/pricing"
              className="rounded-md border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              充值
            </Link>
            <Link
              href="/generate"
              className="rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium"
            >
              开始生成
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Stat label="剩余积分" value={user.credits.toString()} />
          <Stat label="历史任务" value={recentJobs.length === 5 ? "5+" : recentJobs.length.toString()} />
          <Stat label="账户类型" value="标准" />
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">最近任务</h2>
          {recentJobs.length === 0 ? (
            <EmptyCard message="还没有生成记录。" />
          ) : (
            <ul className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
              {recentJobs.map((j) => {
                const title = (j.inputJson as { title?: string } | null)?.title ?? "未命名任务";
                return (
                  <li key={j.id}>
                    <Link
                      href={`/generate/${j.id}`}
                      className="px-4 py-3 flex items-center justify-between gap-4 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <span className="flex-1 truncate font-medium">{title}</span>
                      <JobStatusPill status={j.status} />
                      <span className="text-zinc-500 text-xs whitespace-nowrap">{j.creditsCost} 积分</span>
                      <span className="text-zinc-400 text-xs whitespace-nowrap hidden sm:inline">
                        {j.createdAt.toLocaleString("zh-CN")}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">积分流水</h2>
          {recentEntries.length === 0 ? (
            <EmptyCard message="还没有积分流水。" />
          ) : (
            <ul className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800">
              {recentEntries.map((e) => (
                <li key={e.id} className="px-4 py-3 flex items-center justify-between text-sm">
                  <span className="text-zinc-500">{e.type}</span>
                  <span className={e.amount >= 0 ? "text-emerald-600" : "text-red-600"}>
                    {e.amount > 0 ? `+${e.amount}` : e.amount}
                  </span>
                  <span className="text-zinc-500 truncate max-w-[40%]">{e.note ?? "—"}</span>
                  <span className="text-zinc-400 text-xs">{e.createdAt.toLocaleString("zh-CN")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function JobStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING: { label: "未开始", cls: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
    RUNNING: { label: "生成中", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200" },
    SUCCEEDED: { label: "完成", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
    PARTIAL: { label: "部分完成", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
    FAILED: { label: "失败", cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200" },
  };
  const m = map[status] ?? { label: status, cls: "bg-zinc-200 text-zinc-700" };
  return <span className={`text-[10px] rounded-full px-2 py-0.5 whitespace-nowrap ${m.cls}`}>{m.label}</span>;
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-white/50 dark:bg-zinc-900/50 px-4 py-8 text-center text-sm text-zinc-500">
      {message}
    </div>
  );
}
