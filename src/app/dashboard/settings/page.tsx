import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { NameForm } from "./NameForm";
import { PasswordForm } from "./PasswordForm";

export const metadata = { title: "账号设置 · 图作AI" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/dashboard/settings");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      name: true,
      credits: true,
      createdAt: true,
      emailVerified: true,
      referralCode: true,
    },
  });
  if (!user) redirect("/login");

  return (
    <main className="flex-1 bg-background">
      <div className="mx-auto max-w-2xl px-6 py-10 space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          返回控制台
        </Link>

        <header>
          <h1 className="text-3xl font-black tracking-tight">账号设置</h1>
          <p className="text-sm text-muted-foreground mt-1">管理你的账号信息和登录密码。</p>
        </header>

        {/* Account summary */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">账号信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="邮箱">
              <span className="font-mono">{user.email}</span>
              {user.emailVerified ? (
                <Badge variant="outline" className="border-success/40 text-success">
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  已验证
                </Badge>
              ) : (
                <Badge variant="outline" className="border-warning/40 text-warning">未验证</Badge>
              )}
            </Row>
            <Row label="昵称">{user.name ?? "—"}</Row>
            <Row label="积分余额">
              <strong className="text-primary tabular-nums">{user.credits}</strong>
              <Link href="/pricing" className="text-xs text-primary underline-offset-2 hover:underline">
                充值
              </Link>
            </Row>
            <Row label="注册时间">
              <span className="font-mono text-xs">{user.createdAt.toLocaleString("zh-CN")}</span>
            </Row>
            <Row label="邀请码">
              <span className="font-mono text-xs">{user.referralCode}</span>
              <Link href="/dashboard/invite" className="text-xs text-primary underline-offset-2 hover:underline">
                邀请中心 →
              </Link>
            </Row>
          </CardContent>
        </Card>

        {/* Edit nickname */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">修改昵称</CardTitle>
            <CardDescription>展示给其他用户的名字。</CardDescription>
          </CardHeader>
          <CardContent>
            <NameForm initialName={user.name ?? ""} />
          </CardContent>
        </Card>

        {/* Change password */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">修改密码</CardTitle>
            <CardDescription>修改后会立即生效，已登录的其他设备仍保持登录态。</CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          忘记密码？<Link href="/forgot" className="text-primary underline-offset-2 hover:underline">立即重置</Link>
        </p>
      </div>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-muted-foreground text-xs uppercase tracking-wide">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
