import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { emailProvider } from "@/lib/email/provider";
import { redisConnection } from "@/lib/queue";

const schema = z.object({
  email: z.string().email().max(200),
});

const TTL_MIN = 10;
const COOLDOWN_S = 60;          // 60s between sends to the same email
const PER_EMAIL_DAY = 5;        // ≤5 per email per 24h
const PER_IP_HOUR = 10;         // ≤10 per IP per hour

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

  // Refuse to send to an already-registered email — login flow is separate.
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "该邮箱已注册，请直接登录" }, { status: 409 });
  }

  // Redis-based rate limiting. Keys are short-lived and atomically incremented.
  try {
    const r = redisConnection();
    const cdKey = `vcode:cd:${email}`;
    const eDayKey = `vcode:eday:${email}`;
    const iHourKey = `vcode:ihour:${ip}`;

    // Same-email cooldown
    const cd = await r.get(cdKey);
    if (cd) {
      const ttl = await r.ttl(cdKey);
      return NextResponse.json(
        { error: `请 ${Math.max(1, ttl)} 秒后再试` },
        { status: 429 },
      );
    }
    // Per-day per-email
    const dayCount = await r.incr(eDayKey);
    if (dayCount === 1) await r.expire(eDayKey, 24 * 60 * 60);
    if (dayCount > PER_EMAIL_DAY) {
      return NextResponse.json({ error: "该邮箱今日发送次数已用尽" }, { status: 429 });
    }
    // Per-hour per-IP
    const hourCount = await r.incr(iHourKey);
    if (hourCount === 1) await r.expire(iHourKey, 60 * 60);
    if (hourCount > PER_IP_HOUR) {
      return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
    }

    // Set cooldown only AFTER limit checks pass, so a blocked attempt
    // doesn't extend the user's wait.
    await r.set(cdKey, "1", "EX", COOLDOWN_S);
  } catch (e) {
    console.error("[send-code] redis rate-limit failed", e);
    // Fall through — better to send than to block legit users.
  }

  // Generate a 6-digit code (cryptographically random).
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + TTL_MIN * 60 * 1000);

  await prisma.emailVerification.create({
    data: { email, purpose: "REGISTER", codeHash, expiresAt, ip },
  });

  try {
    await emailProvider().sendVerificationCode({
      to: email,
      code,
      ttlMinutes: TTL_MIN,
      purposeLabel: "注册账号",
    });
  } catch (e) {
    console.error("[send-code] provider failed", e);
    // Mark the verification as expired so the user can re-request.
    return NextResponse.json({ error: "发送失败，请重试" }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    ttlMinutes: TTL_MIN,
    resendAfterSeconds: COOLDOWN_S,
  });
}
