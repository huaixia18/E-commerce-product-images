import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ALL_PANEL_IDS, type PanelId } from "@/lib/promptTemplate";
import { Sparkles, Wallet, Download, Image as ImageIcon, History, Plus, Bolt, Gift, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { headers } from "next/headers";
import { InvitePanel } from "@/components/InvitePanel";

export const metadata = { title: "我的 · 图作AI" };

const NAV_ITEMS = [
  { id: "projects", label: "我的作品", icon: ImageIcon, href: "/dashboard", external: false },
  { id: "invite", label: "邀请中心", icon: Gift, href: "/dashboard/invite", external: false },
  { id: "settings", label: "账号设置", icon: Settings, href: "/dashboard/settings", external: false },
  { id: "pricing", label: "充值", icon: Wallet, href: "/pricing", external: false },
] as const;

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, recentJobs, recentEntries, jobStats, referrals] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, name: true, credits: true, createdAt: true, referralCode: true },
    }),
    prisma.job.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 12,
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
    prisma.referral.aggregate({
      where: { referrerId: session.user.id, status: "GRANTED" },
      _sum: { referrerReward: true },
      _count: true,
    }),
  ]);
  if (!user) redirect("/login");

  const name = user.name ?? user.email.split("@")[0];
  const totalImages = jobStats._sum.creditsCost ?? 0;
  const totalJobs = jobStats._count;

  // Derive the public site origin so the referral link works on whichever
  // host the user is hitting (localhost, prod domain, etc).
  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const host = hdrs.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;

  return (
    <main className="flex-1 bg-background">
      <div className="mx-auto max-w-6xl px-6 py-8 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        {/* SIDEBAR — user card + nav */}
        <aside className="space-y-4">
          <Card className="border-border">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-11 h-11 rounded-full bg-brand-purple text-white grid place-items-center font-bold text-lg">
                  {name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="font-extrabold text-sm truncate">{name}</div>
                  <div className="text-[11px] text-muted-foreground">普通会员</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-4 border-t border-border">
                <div>
                  <div className="text-[11px] text-muted-foreground">累计生成</div>
                  <div className="text-base font-black mt-0.5 tabular-nums">{totalImages} 张</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">任务数</div>
                  <div className="text-base font-black mt-0.5 tabular-nums">{totalJobs}</div>
                </div>
              </div>
              <Button asChild className="w-full rounded-full font-extrabold gap-1.5">
                <Link href="/pricing">
                  <Bolt className="h-4 w-4" />
                  立即充值
                </Link>
              </Button>
            </CardContent>
          </Card>

          <nav className="space-y-1">
            {NAV_ITEMS.map((it) => (
              <NavItem
                key={it.id}
                href={it.href}
                active={it.id === "projects"}
                icon={<it.icon className="h-4 w-4" />}
                label={it.label}
              />
            ))}
          </nav>

          <InvitePanel
            referralCode={user.referralCode}
            origin={origin}
            invitedCount={referrals._count}
            earnedCredits={referrals._sum.referrerReward ?? 0}
          />
        </aside>

        {/* MAIN */}
        <section>
          <header className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-black tracking-tight">我的作品</h1>
              <p className="text-xs text-muted-foreground mt-1">
                共 {totalJobs} 个项目 · 累计 {totalImages} 张图 · 当前余额{" "}
                <strong className="text-primary tabular-nums">{user.credits}</strong> 积分
              </p>
            </div>
            <Button asChild className="rounded-full gap-1.5 font-bold">
              <Link href="/generate">
                <Plus className="h-3.5 w-3.5" />
                新建项目
              </Link>
            </Button>
          </header>

          {recentJobs.length === 0 ? (
            <Card className="border-dashed border-border">
              <CardContent className="p-12 text-center space-y-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div className="font-bold">还没有任何项目</div>
                <p className="text-sm text-muted-foreground">上传一张商品图，让 AI 给你出一整套详情图。</p>
                <Button asChild className="rounded-full font-bold mt-2">
                  <Link href="/generate">开始生成</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {recentJobs.map((j) => {
                const input = j.inputJson as { title?: string; platform?: string; panels?: PanelId[] } | null;
                const title = input?.title ?? "未命名任务";
                const platform = input?.platform ?? "generic";
                const panels = (input?.panels ?? ALL_PANEL_IDS) as PanelId[];
                const count = panels.length;
                return (
                  <Link
                    key={j.id}
                    href={`/generate/${j.id}`}
                    className="group block rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 transition-colors"
                  >
                    <ProjectThumb panels={panels} />
                    <div className="p-3 space-y-1.5">
                      <div className="font-bold text-sm truncate">{title}</div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{j.createdAt.toLocaleString("zh-CN")}</span>
                        <span className="bg-secondary text-foreground px-1.5 py-0.5 rounded font-semibold">
                          {PLATFORM_DISPLAY[platform] ?? "通用"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                          <ImageIcon className="h-3 w-3" />
                          {count} 张
                          <StatusInline status={j.status} />
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary">
                          <Download className="h-3 w-3" />
                          下载
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Credit ledger preview */}
          {recentEntries.length > 0 && (
            <div className="mt-10">
              <header className="flex items-baseline justify-between mb-3">
                <h2 className="text-lg font-extrabold">积分流水</h2>
                <span className="text-[11px] text-muted-foreground">最近 8 条</span>
              </header>
              <Card className="border-border">
                <CardContent className="p-0">
                  {recentEntries.map((e, i) => (
                    <div
                      key={e.id}
                      className={cn(
                        "grid grid-cols-[120px_80px_1fr_80px] items-center px-4 py-3 text-xs",
                        i > 0 && "border-t border-border",
                      )}
                    >
                      <span className="text-muted-foreground font-mono">
                        {e.createdAt.toLocaleString("zh-CN")}
                      </span>
                      <span className="font-bold text-foreground">{entryLabel(e.type)}</span>
                      <span className="text-muted-foreground truncate">{e.note ?? "—"}</span>
                      <span
                        className={cn(
                          "text-right font-mono font-black tabular-nums",
                          e.amount > 0 ? "text-success" : "text-foreground",
                        )}
                      >
                        {e.amount > 0 ? `+${e.amount}` : e.amount}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const PLATFORM_DISPLAY: Record<string, string> = {
  taobao: "淘宝",
  tmall: "天猫",
  jd: "京东",
  amazon: "亚马逊",
  generic: "通用",
};

function entryLabel(t: string): string {
  switch (t) {
    case "PURCHASE": return "充值";
    case "SPEND": return "消耗";
    case "REFUND": return "退分";
    case "ADMIN_ADJUST": return "调整";
    default: return t;
  }
}

function NavItem({
  active,
  icon,
  label,
  href,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
        active
          ? "bg-card text-foreground font-bold shadow-[0_2px_10px_rgba(26,18,8,0.06)]"
          : "text-muted-foreground hover:text-foreground hover:bg-card/60",
      )}
    >
      {icon}
      <span className="flex-1">{label}</span>
    </Link>
  );
}

function StatusInline({ status }: { status: string }) {
  if (status === "PARTIAL") return <span className="text-warning ml-1">· 部分</span>;
  if (status === "FAILED") return <span className="text-destructive ml-1">· 失败</span>;
  if (status === "PENDING") return <span className="text-muted-foreground ml-1">· 待开始</span>;
  if (status === "RUNNING") return <span className="text-primary ml-1">· 生成中</span>;
  return null;
}

/** Mini puzzle thumbnail mirroring the main mosaic layout. */
function ProjectThumb({ panels }: { panels: PanelId[] }) {
  const PANEL_BG: Record<PanelId, string> = {
    hero: "bg-primary",
    feature_1: "bg-brand-magenta",
    feature_2: "bg-brand-yellow",
    feature_3: "bg-brand-mint",
    lifestyle: "bg-brand-purple",
    spec: "bg-card ring-1 ring-border",
  };
  const has = (p: PanelId) => panels.includes(p);
  return (
    <div className="h-32 bg-secondary p-1 grid grid-cols-3 grid-rows-2 gap-1">
      <div className={cn("col-span-2 row-span-2 rounded-md", has("hero") ? PANEL_BG.hero : "border border-dashed border-border opacity-50")} />
      <div className={cn("rounded-md", has("feature_1") ? PANEL_BG.feature_1 : "border border-dashed border-border opacity-50")} />
      <div className={cn("rounded-md", has("feature_2") ? PANEL_BG.feature_2 : "border border-dashed border-border opacity-50")} />
    </div>
  );
}
