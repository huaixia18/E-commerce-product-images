import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";

const schema = z.object({
  delta: z.number().int().refine((n) => n !== 0, "delta must be non-zero"),
  note: z.string().max(200).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

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
  const { delta, note } = parsed.data;

  // For negative deltas, ensure the user has enough credits — otherwise we'd
  // leave them in the red. Use updateMany with a guard.
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.findUnique({ where: { id }, select: { credits: true } });
    if (!u) throw new Error("USER_NOT_FOUND");
    if (delta < 0 && u.credits + delta < 0) throw new Error("INSUFFICIENT_CREDITS");
    const next = await tx.user.update({
      where: { id },
      data: { credits: { increment: delta } },
    });
    await tx.creditEntry.create({
      data: {
        userId: id,
        amount: delta,
        type: "ADMIN_ADJUST",
        note: note ?? `Admin ${admin.email} adjustment`,
      },
    });
    return next.credits;
  }).catch((e) => {
    if (e instanceof Error) {
      if (e.message === "USER_NOT_FOUND") return null;
      if (e.message === "INSUFFICIENT_CREDITS") return "INSUFFICIENT";
    }
    throw e;
  });

  if (updated === null) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (updated === "INSUFFICIENT") return NextResponse.json({ error: "扣减后会变负数" }, { status: 400 });

  return NextResponse.json({ ok: true, credits: updated });
}
