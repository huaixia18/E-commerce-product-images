import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";
import { requireSameOrigin } from "@/lib/originCheck";

const schema = z.object({
  delta: z.number().int().refine((n) => n !== 0, "delta must be non-zero"),
  note: z.string().max(200).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const originErr = requireSameOrigin(req);
  if (originErr) return originErr;
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

  // For negative deltas we use updateMany with a `credits >= -delta` guard
  // so two concurrent debits can't both succeed and drive the balance
  // negative — the second one will see count=0 and we return 400.
  try {
    const result = await prisma.$transaction(async (tx) => {
      if (delta < 0) {
        const claim = await tx.user.updateMany({
          where: { id, credits: { gte: -delta } },
          data: { credits: { increment: delta } },
        });
        if (claim.count === 0) {
          // Either user is missing or balance is insufficient. Distinguish for
          // the response so admin gets a useful error.
          const u = await tx.user.findUnique({
            where: { id },
            select: { credits: true },
          });
          if (!u) throw new Error("USER_NOT_FOUND");
          throw new Error("INSUFFICIENT_CREDITS");
        }
      } else {
        const u = await tx.user.findUnique({
          where: { id },
          select: { credits: true },
        });
        if (!u) throw new Error("USER_NOT_FOUND");
        await tx.user.update({
          where: { id },
          data: { credits: { increment: delta } },
        });
      }
      await tx.creditEntry.create({
        data: {
          userId: id,
          amount: delta,
          type: "ADMIN_ADJUST",
          note: note ?? `Admin ${admin.email} adjustment`,
        },
      });
      const final = await tx.user.findUnique({
        where: { id },
        select: { credits: true },
      });
      return final?.credits ?? 0;
    });
    return NextResponse.json({ ok: true, credits: result });
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "USER_NOT_FOUND") {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      if (e.message === "INSUFFICIENT_CREDITS") {
        return NextResponse.json({ error: "扣减后会变负数" }, { status: 400 });
      }
    }
    throw e;
  }
}
