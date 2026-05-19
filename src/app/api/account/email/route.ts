// PATCH /api/account/email
// Atomically changes the user's email after verifying:
//   1. Current password (re-auth — defends against an open laptop attack)
//   2. A valid EMAIL_CHANGE code sent to the NEW email
//   3. The new email is still unoccupied at commit time
//
// The User row's emailVerified is reset to the time of the change because
// the new email has just been proven controlled.

import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  newEmail: z.string().email().max(200),
  code: z.string().regex(/^\d{6}$/, "请输入 6 位数字验证码"),
  currentPassword: z.string().min(1).max(200),
});

const MAX_VERIFY_ATTEMPTS = 5;

export async function PATCH(req: Request) {
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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const newEmail = parsed.data.newEmail.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, passwordHash: true },
  });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.email.toLowerCase() === newEmail) {
    return NextResponse.json({ error: "新邮箱不能与当前邮箱相同" }, { status: 400 });
  }

  // 1. Re-auth with current password.
  if (!user.passwordHash) {
    return NextResponse.json({ error: "账户异常" }, { status: 400 });
  }
  const pwOk = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!pwOk) {
    return NextResponse.json({ error: "当前密码不正确" }, { status: 400 });
  }

  // 2. Verify the EMAIL_CHANGE code on the new address.
  const verification = await prisma.emailVerification.findFirst({
    where: {
      email: newEmail,
      purpose: "EMAIL_CHANGE",
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
  const codeOk = await bcrypt.compare(parsed.data.code, verification.codeHash);
  if (!codeOk) {
    await prisma.emailVerification.update({
      where: { id: verification.id },
      data: { attempts: { increment: 1 } },
    });
    return NextResponse.json({ error: "验证码不正确" }, { status: 400 });
  }

  // 3. Re-check uniqueness at commit time (race against parallel registrations).
  try {
    await prisma.$transaction(async (tx) => {
      const taken = await tx.user.findUnique({
        where: { email: newEmail },
        select: { id: true },
      });
      if (taken) throw new Error("EMAIL_TAKEN");
      await tx.emailVerification.update({
        where: { id: verification.id },
        data: { consumedAt: new Date() },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { email: newEmail, emailVerified: new Date() },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "EMAIL_TAKEN") {
      return NextResponse.json({ error: "该邮箱已被其他账号使用" }, { status: 409 });
    }
    throw e;
  }

  return NextResponse.json({ ok: true, newEmail });
}
