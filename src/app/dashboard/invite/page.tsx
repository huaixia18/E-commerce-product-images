import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Gift, Sparkles } from "lucide-react";
import { InviteShare } from "./InviteShare";

export const metadata = { title: "邀请中心 · 图作AI" };

export default async function InvitePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/dashboard/invite");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { referralCode: true, name: true, email: true },
  });
  if (!user) redirect("/login");

  const [grantedRefs, totalRewardAgg] = await Promise.all([
    prisma.referral.findMany({
      where: { referrerId: session.user.id, status: "GRANTED" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { invitee: { select: { email: true, name: true } } },
    }),
    prisma.referral.aggregate({
      where: { referrerId: session.user.id, status: "GRANTED" },
      _sum: { referrerReward: true },
      _count: true,
    }),
  ]);

  const baseUrl = env().AUTH_URL.replace(/\/$/, "");
  const link = `${baseUrl}/register?ref=${user.referralCode}`;
  const totalReward = totalRewardAgg._sum.referrerReward ?? 0;
  const totalCount = totalRewardAgg._count;

  return (
    <main className="flex-1 bg-background">
      <div className="mx-auto max-w-3xl px-6 py-10 space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          返回控制台
        </Link>

        <header>
          <h1 className="text-3xl font-black tracking-tight">邀请中心</h1>
          <p className="text-sm text-muted-foreground mt-1">
            每邀请一位好友注册，<strong className="text-foreground">双方各得 50 积分</strong>。
          </p>
        </header>

        {/* Headline stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-border">
            <CardContent className="p-5 flex items-start gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-magenta text-white">
                <Gift className="h-5 w-5" />
              </span>
              <div>
                <div className="text-[11px] text-muted-foreground">成功邀请</div>
                <div className="text-2xl font-black tabular-nums">{totalCount}</div>
                <div className="text-[11px] text-muted-foreground">人</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-5 flex items-start gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <div className="text-[11px] text-muted-foreground">累计获得</div>
                <div className="text-2xl font-black tabular-nums">{totalReward}</div>
                <div className="text-[11px] text-muted-foreground">积分</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Share block (client-side: copy, QR, share text) */}
        <InviteShare link={link} code={user.referralCode} inviterName={user.name ?? user.email.split("@")[0]} />

        {/* Recent referrals */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">邀请记录</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {grantedRefs.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                还没有邀请记录。把上方链接分享给朋友吧。
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {grantedRefs.map((r) => (
                  <li
                    key={r.id}
                    className="px-5 py-3 flex items-center justify-between text-sm"
                  >
                    <div className="min-w-0">
                      {/* Always mask — even nicknames are PII to other users. */}
                      <div className="font-medium truncate">{maskEmail(r.invitee.email)}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">
                        {r.createdAt.toLocaleString("zh-CN")}
                      </div>
                    </div>
                    <Badge variant="outline" className="border-success/40 text-success font-bold">
                      +{r.referrerReward}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          反作弊提示：邀请人和被邀人若同 IP / 同设备，或邮箱属一次性服务，该笔奖励会被风控系统拒绝。
          <br />
          异常邀请已被自动作废时，积分会从双方账户扣回。
        </p>
      </div>
    </main>
  );
}

/** mask local part so visitors don't see other users' raw emails. */
function maskEmail(e: string): string {
  const [local, domain] = e.split("@");
  if (!local) return e;
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}
