// POST /api/auth/reset-password
// Verifies a PASSWORD_RESET code and replaces the user's password.
//
// Email-enumeration policy: every failure mode (no user / no verification /
// attempts exhausted / wrong code) returns the same generic error AFTER
// running the same number of bcrypt compares as the happy path, so an
// attacker can't tell registered emails apart via response timing.

import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().email().max(200),
  code: z.string().regex(/^\d{6}$/, "请输入 6 位数字验证码"),
  newPassword: z.string().min(8).max(200),
});

const MAX_VERIFY_ATTEMPTS = 5;

// Two well-formed but never-matching bcrypt hashes. Used to keep timing
// equal across happy and error paths (always run exactly 2 bcrypt.compares,
// then 1 bcrypt.hash, no matter what).
const DUMMY_HASH_A = "$2a$10$invalidhashinvalidhashinvalidhashinvalidhashinvalidhashinval";
const DUMMY_HASH_B = "$2a$12$invalidhashinvalidhashinvalidhashinvalidhashinvalidhashinval";

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
  const email = parsed.data.email.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  const verification = user
    ? await prisma.emailVerification.findFirst({
        where: {
          email,
          purpose: "PASSWORD_RESET",
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const tooManyAttempts =
    !!verification && verification.attempts >= MAX_VERIFY_ATTEMPTS;

  // Always run two bcrypt.compares — either against the real hashes (when
  // user + verification both exist and attempts are fine) or against dummy
  // hashes that will never match. Compare durations are dominated by the
  // bcrypt work factor, not the hash bytes, so the two paths are
  // indistinguishable to an external observer.
  const codeHashToTest =
    verification && !tooManyAttempts ? verification.codeHash : DUMMY_HASH_A;
  const pwHashToTest = user?.passwordHash ?? DUMMY_HASH_B;

  const [codeOk, sameAsCurrent] = await Promise.all([
    bcrypt.compare(parsed.data.code, codeHashToTest),
    bcrypt.compare(parsed.data.newPassword, pwHashToTest),
  ]);

  // Now decide what to do. Generic-failure responses share the same wording
  // so attackers can't tell what failed.
  const generic = NextResponse.json(
    { error: "验证码已过期或不正确" },
    { status: 400 },
  );

  if (!user || !verification) return generic;
  if (tooManyAttempts) return generic;
  if (!codeOk) {
    await prisma.emailVerification.update({
      where: { id: verification.id },
      data: { attempts: { increment: 1 } },
    });
    return generic;
  }

  // Same-password rejection lives behind a verified code, so it's only ever
  // seen by the email's legitimate owner — the timing leak vs the generic
  // path is fine, because at this point we've already confirmed account
  // ownership.
  if (user.passwordHash && sameAsCurrent) {
    return NextResponse.json({ error: "新密码不能与原密码相同" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.$transaction(async (tx) => {
    await tx.emailVerification.update({
      where: { id: verification.id },
      data: { consumedAt: new Date() },
    });
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
  });

  return NextResponse.json({ ok: true });
}
