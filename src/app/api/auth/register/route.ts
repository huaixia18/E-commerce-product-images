import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Initial signup gift: keep small until pricing is finalized. Phase 5 will
// move this into a config table.
const SIGNUP_GIFT_CREDITS = 5;

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(40).optional(),
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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const { email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "邮箱已被注册" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { email, name, passwordHash, credits: SIGNUP_GIFT_CREDITS },
    });
    if (SIGNUP_GIFT_CREDITS > 0) {
      await tx.creditEntry.create({
        data: {
          userId: u.id,
          amount: SIGNUP_GIFT_CREDITS,
          type: "ADMIN_ADJUST",
          note: "Signup gift",
        },
      });
    }
    return u;
  });

  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}
