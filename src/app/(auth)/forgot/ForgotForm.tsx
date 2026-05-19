"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

const RESEND_COOLDOWN_S = 60;

export function ForgotForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sending, startSending] = useTransition();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function sendCode() {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("请先输入邮箱");
      return;
    }
    startSending(async () => {
      const res = await fetch("/api/auth/send-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        resendAfterSeconds?: number;
      };
      if (!res.ok) {
        setError(body.error ?? "发送失败");
        toast.error(body.error ?? "发送失败");
        return;
      }
      setCodeSent(true);
      setCooldown(body.resendAfterSeconds ?? RESEND_COOLDOWN_S);
      // Intentionally generic — never confirm whether the email is registered.
      toast.success("若邮箱已注册，验证码将稍后送达", {
        description: "请查收邮箱，10 分钟内有效",
      });
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const code = String(fd.get("code") ?? "").trim();
    const newPassword = String(fd.get("newPassword") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (!/^\d{6}$/.test(code)) {
      setError("请输入 6 位数字验证码");
      return;
    }
    if (newPassword !== confirm) {
      setError("两次输入的新密码不一致");
      return;
    }
    if (newPassword.length < 8) {
      setError("新密码至少 8 个字符");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code, newPassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.error ?? "重置失败";
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success("密码已重置", { description: "请使用新密码登录" });
      router.push("/login");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">邮箱</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="code">邮箱验证码</Label>
        <div className="flex gap-2">
          <Input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            autoComplete="one-time-code"
            placeholder="6 位数字"
            className="font-mono tracking-widest"
          />
          <Button
            type="button"
            variant="outline"
            onClick={sendCode}
            disabled={sending || cooldown > 0}
            className="whitespace-nowrap rounded-full font-bold"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : cooldown > 0 ? (
              `${cooldown}s 后重发`
            ) : codeSent ? (
              "重新发送"
            ) : (
              "获取验证码"
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">新密码</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="至少 8 个字符"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">确认新密码</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full rounded-full font-extrabold" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            重置中…
          </>
        ) : (
          "重置密码"
        )}
      </Button>
    </form>
  );
}
