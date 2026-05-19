"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

const RESEND_COOLDOWN_S = 60;

export function RegisterForm({
  refCode,
  totalGift = 10,
}: {
  refCode?: string;
  totalGift?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sending, startSending] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);

  // Tick the resend cooldown.
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
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; resendAfterSeconds?: number };
      if (!res.ok) {
        setError(body.error ?? "发送失败");
        toast.error(body.error ?? "发送失败");
        return;
      }
      setCodeSent(true);
      setCooldown(body.resendAfterSeconds ?? RESEND_COOLDOWN_S);
      toast.success("验证码已发送", { description: "请查收邮箱，10 分钟内有效" });
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!agreed) {
      setError("请先阅读并勾选《用户协议》与《隐私政策》");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const code = String(fd.get("code") ?? "").trim();
    if (!/^\d{6}$/.test(code)) {
      setError("请输入 6 位数字验证码");
      return;
    }
    const payload: Record<string, string> = {
      email: email.trim(),
      code,
      password: String(fd.get("password") ?? ""),
    };
    const name = String(fd.get("name") ?? "").trim();
    if (name) payload.name = name;
    if (refCode) payload.ref = refCode;

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
      const body = (await res.json()) as {
        credits: number;
        referralApplied?: boolean;
        referralRejected?: string;
      };
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
        if (body.referralApplied) {
          toast.success("欢迎加入", { description: `+${body.credits} 积分已到账（含邀请奖励）` });
        } else if (body.referralRejected) {
          toast.success("欢迎加入", { description: `+${body.credits} 积分已到账 · 邀请码未生效` });
        } else {
          toast.success("欢迎加入", { description: `已送出 ${body.credits} 积分` });
        }
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
        <Label htmlFor="name">
          昵称 <span className="text-muted-foreground text-xs">（可选）</span>
        </Label>
        <Input id="name" name="name" type="text" autoComplete="nickname" placeholder="给自己起个名字" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">邮箱</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
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
        {codeSent && (
          <p className="text-xs text-muted-foreground">
            验证码已发送到 <strong>{email}</strong>，10 分钟内有效
          </p>
        )}
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

      <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer select-none">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 accent-primary cursor-pointer"
        />
        <span>
          我已阅读并同意
          <Link href="/terms" target="_blank" className="text-primary hover:underline mx-0.5">
            《用户协议》
          </Link>
          与
          <Link href="/privacy" target="_blank" className="text-primary hover:underline mx-0.5">
            《隐私政策》
          </Link>
        </span>
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="submit"
        className="w-full rounded-full font-extrabold"
        disabled={pending || !agreed}
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            注册中…
          </>
        ) : (
          `注册并获得 ${totalGift} 积分`
        )}
      </Button>
    </form>
  );
}
