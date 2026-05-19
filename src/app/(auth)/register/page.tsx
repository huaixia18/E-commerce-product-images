import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterForm } from "./RegisterForm";
import { Logo } from "@/components/Logo";
import { Gift } from "lucide-react";

export const metadata = { title: "注册 · 图作AI" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/dashboard");
  const sp = await searchParams;
  const refCode = typeof sp.ref === "string" ? sp.ref : undefined;

  // Look up the inviter (purely for the friendly banner — server-side guards
  // re-validate inside /api/auth/register).
  let inviter: { name: string | null; email: string } | null = null;
  if (refCode) {
    inviter = await prisma.user.findUnique({
      where: { referralCode: refCode },
      select: { name: true, email: true },
    });
  }

  const baseGift = 10;
  const inviteBonus = inviter ? 50 : 0;
  const totalGift = baseGift + inviteBonus;

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16 bg-muted/30">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>
        {inviter && (
          <div className="rounded-2xl border-2 border-brand-magenta/40 bg-brand-magenta/10 px-4 py-3 flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-magenta text-white">
              <Gift className="h-4 w-4" />
            </span>
            <div className="text-sm">
              <div className="font-extrabold">
                {/* Don't leak the inviter's email local-part or nickname to a
                 * stranger who got a share link — keep it generic. */}
                <span className="text-brand-magenta">朋友</span>
                邀请你加入图作AI
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                注册即得 <strong className="text-foreground tabular-nums">{totalGift}</strong> 积分（{baseGift} + 邀请奖励 {inviteBonus}）
              </div>
            </div>
          </div>
        )}
        <Card className="border-border/60 shadow-md">
          <CardHeader className="space-y-1.5">
            <CardTitle className="text-2xl">创建账号</CardTitle>
            <CardDescription>
              使用邮箱注册，即送 <strong className="text-foreground">{totalGift}</strong> 积分。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterForm refCode={refCode} totalGift={totalGift} />
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          已有账号？{" "}
          <Link href="/login" className="text-primary underline-offset-4 hover:underline font-medium">
            登录
          </Link>
        </p>
      </div>
    </main>
  );
}
