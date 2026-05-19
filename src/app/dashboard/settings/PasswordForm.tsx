"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export function PasswordForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const currentPassword = String(fd.get("currentPassword") ?? "");
    const newPassword = String(fd.get("newPassword") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (newPassword !== confirm) {
      setError("两次输入的新密码不一致");
      return;
    }
    if (newPassword.length < 8) {
      setError("新密码至少 8 个字符");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.error ?? "修改失败";
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success("密码已修改");
      (e.target as HTMLFormElement).reset();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword" className="text-xs">当前密码</Label>
        <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newPassword" className="text-xs">新密码</Label>
        <Input id="newPassword" name="newPassword" type="password" required minLength={8} autoComplete="new-password" placeholder="至少 8 个字符" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm" className="text-xs">确认新密码</Label>
        <Input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="pt-1">
        <Button type="submit" disabled={pending} className="rounded-full font-bold">
          {pending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
          修改密码
        </Button>
      </div>
    </form>
  );
}
