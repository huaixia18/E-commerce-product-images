// POST /api/auth/reset-password
// Verifies a PASSWORD_RESET code and replaces the user's password.

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

  // We intentionally use "验证码已过期或不正确" for any of {no user,
  // no verification, attempts exceeded, wrong code} so attackers can't
  // probe which emails are registered through the reset flow.
  const generic = NextResponse.json(
    { error: "验证码已过期或不正确" },
    { status: 400 },
  );

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });
  if (!user) return generic;

  const verification = await prisma.emailVerification.findFirst({
    where: {
      email,
      purpose: "PASSWORD_RESET",
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!verification) return generic;
  if (verification.attempts >= MAX_VERIFY_ATTEMPTS) return generic;

  const codeOk = await bcrypt.compare(parsed.data.code, verification.codeHash);
  if (!codeOk) {
    await prisma.emailVerification.update({
      where: { id: verification.id },
      data: { attempts: { increment: 1 } },
    });
    return generic;
  }

  // Reject "same password" to nudge people away from no-ops.
  if (user.passwordHash) {
    const same = await bcrypt.compare(parsed.data.newPassword, user.passwordHash);
    if (same) {
      return NextResponse.json({ error: "新密码不能与原密码相同" }, { status: 400 });
    }
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
