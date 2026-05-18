"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export function RegisterForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
      name: String(fd.get("name") ?? "") || undefined,
    };
    startTransition(async () => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.error ?? "注册失败";
        setError(msg);
        toast.error(msg);
        return;
      }
      const signinRes = await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          email: payload.email,
          password: payload.password,
          redirect: "false",
        }),
      });
      if (signinRes.ok) {
        toast.success("欢迎加入", { description: "已送出 10 积分" });
        router.push("/dashboard");
        router.refresh();
      } else {
        router.push("/login");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">昵称 <span className="text-muted-foreground text-xs">（可选）</span></Label>
        <Input id="name" name="name" type="text" autoComplete="nickname" placeholder="给自己起个名字" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">邮箱</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">密码</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          placeholder="至少 8 个字符"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            注册中…
          </>
        ) : (
          "注册并获得 10 积分"
        )}
      </Button>
    </form>
  );
}
