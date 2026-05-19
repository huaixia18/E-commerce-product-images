import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  REFERRER_REWARD,
  INVITEE_REWARD,
  SIGNUP_GIFT,
  clientIp,
  deviceFingerprint,
  isDisposableEmail,
  isIpBurstExceeded,
  evaluateReferral,
  recallUserDevice,
  rememberUserDevice,
} from "@/lib/referral";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(40).optional(),
  /** 6-digit code from /api/auth/send-code. Required. */
  code: z.string().regex(/^\d{6}$/, "请输入 6 位数字验证码"),
  /** Referrer's referralCode pulled from /register?ref=... */
  ref: z.string().min(1).max(64).optional(),
  /**
   * Must be true. The client-side checkbox is just UX; this server-side
   * gate is what gives us actual evidence the user agreed (recorded as
   * termsAgreedAt on the User row).
   */
  agreedToTerms: z.literal(true, {
    message: "请同意《用户协议》与《隐私政策》后再注册",
  }),
});

const MAX_VERIFY_ATTEMPTS = 5;

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const { password, name, ref, code } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  // ─── Anti-abuse: hard rejections (block signup entirely) ───────────────
  if (isDisposableEmail(email)) {
    return NextResponse.json({ error: "请使用常用邮箱注册" }, { status: 400 });
  }

  const ip = clientIp(req);
  const fp = deviceFingerprint(req);

  if (await isIpBurstExceeded(ip)) {
    return NextResponse.json({ error: "注册过于频繁，请稍后再试" }, { status: 429 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "邮箱已被注册" }, { status: 409 });
  }

  // ─── Verify email code ────────────────────────────────────────────────
  // Pull the most recent unconsumed, unexpired code for this email.
  const verification = await prisma.emailVerification.findFirst({
    where: {
      email,
      purpose: "REGISTER",
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!verification) {
    return NextResponse.json({ error: "验证码已过期，请重新获取" }, { status: 400 });
  }
  if (verification.attempts >= MAX_VERIFY_ATTEMPTS) {
    return NextResponse.json(
      { error: "尝试次数过多，请重新获取验证码" },
      { status: 429 },
    );
  }
  const codeOk = await bcrypt.compare(code, verification.codeHash);
  if (!codeOk) {
    await prisma.emailVerification.update({
      where: { id: verification.id },
      data: { attempts: { increment: 1 } },
    });
    return NextResponse.json({ error: "验证码不正确" }, { status: 400 });
  }

  // ─── Anti-abuse: soft rejections (signup ok, referral dropped) ─────────
  let referrer: { id: string; createdAt: Date } | null = null;
  let rejectionReason: string | null = null;

  if (ref) {
    const r = await prisma.user.findUnique({
      where: { referralCode: ref },
      select: { id: true, createdAt: true },
    });
    if (!r) {
      rejectionReason = "邀请码无效";
    } else {
      referrer = r;
      const device = await recallUserDevice(r.id);
      const verdict = await evaluateReferral({
        referrerId: r.id,
        referrerIp: device?.ip ?? null,
        referrerFp: device?.fp ?? null,
        referrerCreatedAt: r.createdAt,
        inviteeIp: ip,
        inviteeFp: fp,
        inviteeAlreadyExists: false,
      });
      if (verdict) {
        rejectionReason = verdict.reason;
        referrer = null;
      }
    }
  }

  // ─── All checks passed: create user (+ optional referral) atomically ───
  const passwordHash = await bcrypt.hash(password, 12);
  const inviteeReward = referrer ? INVITEE_REWARD : 0;
  const totalGift = SIGNUP_GIFT + inviteeReward;

  const user = await prisma.$transaction(async (tx) => {
    // Consume the verification first so even if user creation fails for
    // some reason later, this code can't be reused.
    await tx.emailVerification.update({
      where: { id: verification.id },
      data: { consumedAt: new Date() },
    });
    const now = new Date();
    const u = await tx.user.create({
      data: {
        email,
        name,
        passwordHash,
        credits: totalGift,
        emailVerified: now,
        termsAgreedAt: now,
      },
    });
    await tx.creditEntry.create({
      data: {
        userId: u.id,
        amount: SIGNUP_GIFT,
        type: "ADMIN_ADJUST",
        note: "Signup gift",
      },
    });
    if (referrer) {
      await tx.creditEntry.create({
        data: {
          userId: u.id,
          amount: INVITEE_REWARD,
          type: "ADMIN_ADJUST",
          note: `Invited by referral`,
        },
      });
      // Grant referrer reward + log
      await tx.user.update({
        where: { id: referrer.id },
        data: { credits: { increment: REFERRER_REWARD } },
      });
      await tx.creditEntry.create({
        data: {
          userId: referrer.id,
          amount: REFERRER_REWARD,
          type: "ADMIN_ADJUST",
          note: `Referred ${email}`,
        },
      });
      await tx.referral.create({
        data: {
          referrerId: referrer.id,
          inviteeId: u.id,
          referrerReward: REFERRER_REWARD,
          inviteeReward: INVITEE_REWARD,
          inviteeIp: ip === "unknown" ? null : ip,
          inviteeFp: fp,
        },
      });
    }
    return u;
  });

  // Cache the new user's signup device so a future invite from them can
  // be checked against this IP / FP.
  await rememberUserDevice(user.id, ip, fp).catch(() => {});

  return NextResponse.json(
    {
      id: user.id,
      email: user.email,
      credits: user.credits,
      referralApplied: !!referrer,
      referralRejected: rejectionReason ?? undefined,
    },
    { status: 201 },
  );
}
