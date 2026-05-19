import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { ForgotForm } from "./ForgotForm";

export const metadata = { title: "重置密码 · 图作AI" };

export default async function ForgotPage() {
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
            <CardTitle className="text-2xl">重置密码</CardTitle>
            <CardDescription>
              填写你注册时的邮箱，输入收到的验证码与新密码即可重置。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ForgotForm />
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          想起来了？{" "}
          <Link href="/login" className="text-primary underline-offset-4 hover:underline font-medium">
            返回登录
          </Link>
        </p>
      </div>
    </main>
  );
}
