// POST /api/auth/send-code
// Sends a 6-digit code to an email for REGISTER purpose.
//
// Email-enumeration policy: we return the same 200 ok=true response
// whether the email is new or already registered. The registration page
// shows a static "如已注册，请直接登录" hint so the user gets context
// without us confirming the email's status to a curious stranger.
//
// Rate limits are enforced in Redis. If Redis is unreachable we fail
// closed (503) — better to drop a few legit sends than open the cooldown
// gate during an infra incident.

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
const COOLDOWN_S = 60;
const PER_EMAIL_DAY = 5;
const PER_IP_HOUR = 10;

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "0.0.0.0";
}

// Same shape as the success response — used when we silently no-op for
// already-registered emails or rate-limit overflows we don't want to
// confirm to the client.
function silentOk() {
  return NextResponse.json({
    ok: true,
    ttlMinutes: TTL_MIN,
    resendAfterSeconds: COOLDOWN_S,
  });
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

  // Rate limit FIRST so we can return the same throttled response shape
  // regardless of registration status. Fail closed on Redis errors.
  let rateLimited = false;
  let cooldownTtl = 0;
  try {
    const r = redisConnection();
    const cdKey = `vcode:cd:${email}`;
    const eDayKey = `vcode:eday:${email}`;
    const iHourKey = `vcode:ihour:${ip}`;

    const cd = await r.get(cdKey);
    if (cd) {
      cooldownTtl = Math.max(1, await r.ttl(cdKey));
      rateLimited = true;
    } else {
      const dayCount = await r.incr(eDayKey);
      if (dayCount === 1) await r.expire(eDayKey, 24 * 60 * 60);
      if (dayCount > PER_EMAIL_DAY) {
        rateLimited = true;
      } else {
        const hourCount = await r.incr(iHourKey);
        if (hourCount === 1) await r.expire(iHourKey, 60 * 60);
        if (hourCount > PER_IP_HOUR) {
          rateLimited = true;
        } else {
          await r.set(cdKey, "1", "EX", COOLDOWN_S);
        }
      }
    }
  } catch (e) {
    console.error("[send-code] redis throttle failed — fail closed", e);
    return NextResponse.json(
      { error: "服务暂时不可用" },
      { status: 503 },
    );
  }

  if (rateLimited) {
    return NextResponse.json(
      {
        error: cooldownTtl
          ? `请 ${cooldownTtl} 秒后再试`
          : "发送过于频繁，请稍后再试",
      },
      { status: 429 },
    );
  }

  // Silent no-op for already-registered emails — same response as success
  // so attackers can't enumerate.
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return silentOk();
  }

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
    return NextResponse.json({ error: "发送失败，请重试" }, { status: 502 });
  }

  return silentOk();
}
