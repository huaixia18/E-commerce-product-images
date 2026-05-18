import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterForm } from "./RegisterForm";
import { Logo } from "@/components/Logo";

export const metadata = { title: "注册 · 图作AI" };

export default async function RegisterPage() {
  const session = await auth();
  if (session) redirect("/dashboard");
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16 bg-muted/30">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>
        <Card className="border-border/60 shadow-md">
          <CardHeader className="space-y-1.5">
            <CardTitle className="text-2xl">创建账号</CardTitle>
            <CardDescription>使用邮箱注册，即送 10 积分。</CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterForm />
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
