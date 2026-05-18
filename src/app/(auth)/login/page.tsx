import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./LoginForm";
import { Logo } from "@/components/Logo";

export const metadata = { title: "登录 · 图作AI" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await auth();
  const sp = await searchParams;
  if (session) redirect(sp.next ?? "/dashboard");
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16 bg-muted/30">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>
        <Card className="border-border/60 shadow-md">
          <CardHeader className="space-y-1.5">
            <CardTitle className="text-2xl">欢迎回来</CardTitle>
            <CardDescription>使用你的邮箱和密码登录。</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm next={sp.next ?? "/dashboard"} />
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          还没有账号？{" "}
          <Link href="/register" className="text-primary underline-offset-4 hover:underline font-medium">
            免费注册
          </Link>
        </p>
      </div>
    </main>
  );
}
