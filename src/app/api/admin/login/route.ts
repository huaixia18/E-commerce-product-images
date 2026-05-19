import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signAdminToken, setAdminCookie } from "@/lib/adminAuth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Constant-time-ish: always run bcrypt even when admin missing, to avoid
  // timing-side-channel that reveals admin existence.
  const admin = await prisma.admin.findUnique({ where: { email: parsed.data.email } });
  const stored = admin?.passwordHash ?? "$2a$12$invalidhashinvalidhashinvalidhashinvalidhashinvalidhashinval";
  const ok = await bcrypt.compare(parsed.data.password, stored);
  if (!admin || !ok) {
    return NextResponse.json({ error: "邮箱或密码不正确" }, { status: 401 });
  }

  const token = await signAdminToken({ sub: admin.id, email: admin.email, name: admin.name ?? undefined });
  await setAdminCookie(token);

  return NextResponse.json({ ok: true });
}
