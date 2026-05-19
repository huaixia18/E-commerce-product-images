"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Gift, Users, Sparkles } from "lucide-react";

export function InvitePanel({
  referralCode,
  origin,
  invitedCount,
  earnedCredits,
}: {
  referralCode: string;
  origin: string;
  invitedCount: number;
  earnedCredits: number;
}) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const link = `${origin}/register?ref=${referralCode}`;

  async function copy(text: string, kind: "link" | "code") {
    try {
      await navigator.clipboard.writeText(text);
      if (kind === "link") {
        setCopiedLink(true);
        toast.success("链接已复制");
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedCode(true);
        toast.success("邀请码已复制");
        setTimeout(() => setCopiedCode(false), 2000);
      }
    } catch {
      toast.error("复制失败，请手动选择");
    }
  }

  return (
    <Card className="border-border bg-gradient-to-br from-primary/8 via-card to-brand-magenta/8 !overflow-visible relative">
      <span className="absolute -top-3 -right-3 rotate-[8deg] rounded-full bg-brand-magenta text-white px-3 py-1 text-[11px] font-extrabold shadow-md">
        🎁 邀请有奖
      </span>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Gift className="h-5 w-5" />
          </span>
          <div>
            <div className="font-extrabold text-base">邀请好友，双方各得 50 积分</div>
            <div className="text-[11px] text-muted-foreground">朋友通过你的链接注册即生效</div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-card border border-border px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Users className="h-3 w-3" />
              已邀请
            </div>
            <div className="text-xl font-black tabular-nums mt-0.5">{invitedCount}</div>
          </div>
          <div className="rounded-xl bg-card border border-border px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              已获得
            </div>
            <div className="text-xl font-black tabular-nums text-primary mt-0.5">+{earnedCredits}</div>
          </div>
        </div>

        {/* Code + link copy */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            你的邀请链接
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-full bg-card border border-border px-3 py-2 text-xs font-mono truncate">
              {link}
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => copy(link, "link")}
              className="rounded-full font-bold gap-1.5 shrink-0"
            >
              <Copy className="h-3.5 w-3.5" />
              {copiedLink ? "已复制" : "复制"}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-[11px] text-muted-foreground">或邀请码</div>
            <button
              type="button"
              onClick={() => copy(referralCode, "code")}
              className="font-mono text-xs font-bold text-foreground bg-secondary px-2 py-0.5 rounded hover:bg-secondary/70"
              title="点击复制邀请码"
            >
              {referralCode}
            </button>
            {copiedCode && <span className="text-[11px] text-success">✓ 已复制</span>}
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground leading-relaxed border-t border-border pt-3">
          ⚠️ 防刷机制：邀请人与被邀人不能同 IP / 同设备；新账号 24 小时内不可邀请；
          一次性邮箱被屏蔽。违规邀请奖励不发放。
        </p>
      </CardContent>
    </Card>
  );
}
