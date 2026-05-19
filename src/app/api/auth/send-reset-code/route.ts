// POST /api/auth/send-reset-code
// Sends a 6-digit verification code for password reset. Shares the
// EmailVerification table with the register flow but uses purpose=PASSWORD_RESET.
//
// Security choice: we DO NOT confirm whether the email exists. The same
// 200-style response is returned either way to prevent email enumeration.
// Only when we actually find a user do we generate + send the code.

import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { emailProvider } from "@/lib/email/provider";
import { redisConnection } from "@/lib/queue";

const schema = z.object({ email: z.string().email().max(200) });

const TTL_MIN = 10;
const COOLDOWN_S = 60;
const PER_EMAIL_DAY = 5;
const PER_IP_HOUR = 10;

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "0.0.0.0";
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "请输入有效的邮箱地址" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();
  const ip = clientIp(req);

  // Rate-limit: same keys as registration so attackers can't bypass by
  // switching between send-code and send-reset-code.
  try {
    const r = redisConnection();
    const cdKey = `vcode:cd:${email}`;
    const eDayKey = `vcode:eday:${email}`;
    const iHourKey = `vcode:ihour:${ip}`;
    const cd = await r.get(cdKey);
    if (cd) {
      const ttl = await r.ttl(cdKey);
      return NextResponse.json(
        { error: `请 ${Math.max(1, ttl)} 秒后再试` },
        { status: 429 },
      );
    }
    const dayCount = await r.incr(eDayKey);
    if (dayCount === 1) await r.expire(eDayKey, 24 * 60 * 60);
    if (dayCount > PER_EMAIL_DAY) {
      return NextResponse.json({ error: "该邮箱今日发送次数已用尽" }, { status: 429 });
    }
    const hourCount = await r.incr(iHourKey);
    if (hourCount === 1) await r.expire(iHourKey, 60 * 60);
    if (hourCount > PER_IP_HOUR) {
      return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
    }
    await r.set(cdKey, "1", "EX", COOLDOWN_S);
  } catch (e) {
    console.error("[send-reset-code] redis rate-limit failed", e);
  }

  // Only proceed if user exists. Either way return ok=true to avoid
  // enumeration of registered emails.
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (user) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + TTL_MIN * 60 * 1000);

    await prisma.emailVerification.create({
      data: { email, purpose: "PASSWORD_RESET", codeHash, expiresAt, ip },
    });

    try {
      await emailProvider().sendVerificationCode({
        to: email,
        code,
        ttlMinutes: TTL_MIN,
        purposeLabel: "重置密码",
      });
    } catch (e) {
      console.error("[send-reset-code] provider failed", e);
      // Don't expose failure to the client (would leak email existence).
    }
  }

  return NextResponse.json({
    ok: true,
    ttlMinutes: TTL_MIN,
    resendAfterSeconds: COOLDOWN_S,
  });
}
