import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, Sparkles, Wallet, History, ArrowRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = { title: "控制台 · 详图AI" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, recentJobs, recentEntries, jobStats] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, name: true, credits: true, createdAt: true },
    }),
    prisma.job.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, status: true, createdAt: true, creditsCost: true, inputJson: true },
    }),
    prisma.creditEntry.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, amount: true, type: true, note: true, createdAt: true },
    }),
    prisma.job.aggregate({
      where: { userId: session.user.id, status: { in: ["SUCCEEDED", "PARTIAL"] } },
      _sum: { creditsCost: true },
      _count: true,
    }),
  ]);

  if (!user) redirect("/login");

  return (
    <main className="flex-1 bg-muted/30">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">你好，{user.name ?? user.email.split("@")[0]}</h1>
            <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/pricing">
                <Wallet className="h-4 w-4 mr-1.5" />
                充值
              </Link>
            </Button>
            <Button asChild className="gap-2">
              <Link href="/generate">
                <Sparkles className="h-4 w-4" />
                开始生成
              </Link>
            </Button>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="剩余积分"
            value={user.credits.toString()}
            icon={Coins}
            accent="primary"
            sub={
              user.credits < 6 ? (
                <Link href="/pricing" className="text-primary underline-offset-4 hover:underline">
                  立即充值
                </Link>
              ) : (
                "1 积分 = 1 张图"
              )
            }
          />
          <StatCard
            label="累计生成"
            value={String(jobStats._sum.creditsCost ?? 0)}
            icon={Sparkles}
            accent="success"
            sub={`${jobStats._count} 个任务`}
          />
          <StatCard
            label="账户类型"
            value="标准"
            icon={Wallet}
            accent="muted"
            sub={`注册于 ${user.createdAt.toLocaleDateString("zh-CN")}`}
          />
        </section>

        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-semibold">最近任务</h2>
            <span className="text-xs text-muted-foreground">最近 8 条</span>
          </div>
          {recentJobs.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="还没有任何任务"
              desc="上传一张商品图，让 AI 给你出一整套详情图。"
              cta={{ href: "/generate", label: "开始生成" }}
            />
          ) : (
            <Card className="border-border/60 overflow-hidden">
              <ul className="divide-y divide-border/60">
                {recentJobs.map((j) => {
                  const title = (j.inputJson as { title?: string } | null)?.title ?? "未命名任务";
                  return (
                    <li key={j.id}>
                      <Link
                        href={`/generate/${j.id}`}
                        className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{title}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {j.createdAt.toLocaleString("zh-CN")}
                          </div>
                        </div>
                        <JobStatusPill status={j.status} />
                        <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums hidden sm:inline">
                          {j.creditsCost} 积分
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-none" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </section>

        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-semibold">积分流水</h2>
            <span className="text-xs text-muted-foreground">最近 8 条</span>
          </div>
          {recentEntries.length === 0 ? (
            <EmptyState
              icon={History}
              title="还没有积分变动"
              desc="充值或开始生成后，你的积分流水会显示在这里。"
            />
          ) : (
            <Card className="border-border/60 overflow-hidden">
              <ul className="divide-y divide-border/60">
                {recentEntries.map((e) => (
                  <li key={e.id} className="px-4 py-3 flex items-center justify-between gap-4 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{entryLabel(e.type)}</div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">{e.note ?? "—"}</div>
                    </div>
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        e.amount > 0 ? "text-emerald-600" : "text-destructive",
                      )}
                    >
                      {e.amount > 0 ? `+${e.amount}` : e.amount}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
                      {e.createdAt.toLocaleString("zh-CN")}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      </div>
    </main>
  );
}

type AccentColor = "primary" | "success" | "muted";

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: AccentColor;
  sub?: React.ReactNode;
}) {
  const accentCls: Record<AccentColor, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <Card className="border-border/60">
      <CardContent className="p-5 flex items-start gap-4">
        <span className={cn("inline-flex h-10 w-10 items-center justify-center rounded-lg", accentCls[accent])}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="space-y-0.5 min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold tabular-nums">{value}</div>
          {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function JobStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING: { label: "未开始", cls: "bg-muted text-muted-foreground" },
    RUNNING: { label: "生成中", cls: "bg-primary/10 text-primary border-primary/20" },
    SUCCEEDED: { label: "已完成", cls: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40" },
    PARTIAL: { label: "部分完成", cls: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40" },
    FAILED: { label: "失败", cls: "bg-destructive/10 text-destructive border-destructive/20" },
  };
  const m = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={cn("text-[10px]", m.cls)}>{m.label}</Badge>;
}

function entryLabel(t: string): string {
  switch (t) {
    case "PURCHASE": return "充值";
    case "SPEND": return "消耗";
    case "REFUND": return "退还";
    case "ADMIN_ADJUST": return "调整";
    default: return t;
  }
}

function EmptyState({
  icon: Icon,
  title,
  desc,
  cta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  cta?: { href: string; label: string };
}) {
  return (
    <Card className="border-dashed border-border/60 bg-card/40">
      <CardContent className="p-10 flex flex-col items-center text-center gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-6 w-6" />
        </span>
        <div>
          <div className="font-medium">{title}</div>
          <div className="text-sm text-muted-foreground mt-1">{desc}</div>
        </div>
        {cta && (
          <Button asChild variant="default" size="sm" className="mt-2 gap-1.5">
            <Link href={cta.href}>
              {cta.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
