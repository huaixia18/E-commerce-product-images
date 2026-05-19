// POST /api/account/email/send-code
// Sends a 6-digit verification code to a NEW email address for the
// currently-logged-in user. The code carries purpose=EMAIL_CHANGE so it
// can't be confused with register/reset codes.

import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { emailProvider } from "@/lib/email/provider";
import { redisConnection } from "@/lib/queue";

const schema = z.object({
  newEmail: z.string().email().max(200),
});

const TTL_MIN = 10;
const COOLDOWN_S = 60;
const PER_EMAIL_DAY = 5;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  const newEmail = parsed.data.newEmail.toLowerCase();

  // Disallow rebinding to your own current address.
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.email.toLowerCase() === newEmail) {
    return NextResponse.json({ error: "新邮箱不能与当前邮箱相同" }, { status: 400 });
  }

  // Disallow rebinding to another user's email.
  const taken = await prisma.user.findUnique({
    where: { email: newEmail },
    select: { id: true },
  });
  if (taken) {
    return NextResponse.json({ error: "该邮箱已被其他账号使用" }, { status: 409 });
  }

  // Rate limit on the new email — same keys as register flow so attackers
  // can't bypass by switching paths.
  try {
    const r = redisConnection();
    const cdKey = `vcode:cd:${newEmail}`;
    const eDayKey = `vcode:eday:${newEmail}`;
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
    await r.set(cdKey, "1", "EX", COOLDOWN_S);
  } catch (e) {
    console.error("[account/email] rate-limit failed", e);
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + TTL_MIN * 60 * 1000);

  await prisma.emailVerification.create({
    data: { email: newEmail, purpose: "EMAIL_CHANGE", codeHash, expiresAt },
  });

  try {
    await emailProvider().sendVerificationCode({
      to: newEmail,
      code,
      ttlMinutes: TTL_MIN,
      purposeLabel: "绑定新邮箱",
    });
  } catch (e) {
    console.error("[account/email] provider failed", e);
    return NextResponse.json({ error: "发送失败，请重试" }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    ttlMinutes: TTL_MIN,
    resendAfterSeconds: COOLDOWN_S,
  });
}
