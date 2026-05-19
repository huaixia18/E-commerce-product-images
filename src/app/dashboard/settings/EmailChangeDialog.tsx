"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

const RESEND_COOLDOWN_S = 60;

export function EmailChangeDialog({ currentEmail }: { currentEmail: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, startSending] = useTransition();
  const [submitting, startSubmitting] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Reset on open/close.
  useEffect(() => {
    if (open) return;
    setNewEmail("");
    setCode("");
    setPassword("");
    setError(null);
    setCodeSent(false);
    setCooldown(0);
  }, [open]);

  function sendCode() {
    setError(null);
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("请先输入新邮箱");
      return;
    }
    if (trimmed === currentEmail.toLowerCase()) {
      setError("新邮箱不能与当前邮箱相同");
      return;
    }
    startSending(async () => {
      const res = await fetch("/api/account/email/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail: trimmed }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        resendAfterSeconds?: number;
      };
      if (!res.ok) {
        setError(body.error ?? "发送失败");
        return;
      }
      setCodeSent(true);
      setCooldown(body.resendAfterSeconds ?? RESEND_COOLDOWN_S);
      toast.success("验证码已发送", { description: "请查收新邮箱，10 分钟内有效" });
    });
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError("请输入 6 位数字验证码");
      return;
    }
    if (!password) {
      setError("请输入当前密码");
      return;
    }
    startSubmitting(async () => {
      const res = await fetch("/api/account/email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newEmail: newEmail.trim().toLowerCase(),
          code,
          currentPassword: password,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.error ?? "修改失败";
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success("邮箱已修改", { description: "请使用新邮箱重新登录" });
      setOpen(false);
      // Stale NextAuth JWT still carries the old email until next refresh.
      // Force a clean signout so the user lands on /login and the new email
      // becomes the authoritative identity from now on.
      await signOut({ callbackUrl: "/login" });
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="rounded-full font-bold"
        onClick={() => setOpen(true)}
      >
        修改邮箱
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>修改邮箱</DialogTitle>
          <DialogDescription>
            将向新邮箱发送 6 位验证码，输入验证码与当前密码以完成换绑。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="curEmail" className="text-xs">当前邮箱</Label>
            <Input id="curEmail" value={currentEmail} readOnly disabled className="font-mono text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newEmail" className="text-xs">新邮箱</Label>
            <Input
              id="newEmail"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              placeholder="new@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="code" className="text-xs">验证码</Label>
            <div className="flex gap-2">
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
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
          <div className="space-y-1.5">
            <Label htmlFor="curPw" className="text-xs">当前密码</Label>
            <Input
              id="curPw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="为安全起见，请再次输入"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="pt-2">
            <Button type="submit" disabled={submitting} className="w-full rounded-full font-bold">
              {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              确认修改
            </Button>
          </div>
        </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
