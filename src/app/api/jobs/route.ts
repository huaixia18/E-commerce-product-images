import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PANEL_IDS, type PanelId } from "@/lib/promptTemplate";

const STYLES = ["minimal", "vivid", "premium", "warm"] as const;
const PLATFORMS = ["taobao", "tmall", "jd", "amazon", "generic"] as const;

const schema = z.object({
  title: z.string().min(1).max(80),
  highlights: z.array(z.string().min(1).max(60)).min(1).max(8),
  style: z.enum(STYLES).optional(),
  platform: z.enum(PLATFORMS).optional(),
  sourceImageKeys: z
    .array(z.string().regex(/^uploads\/[\w/.-]+$/, "Invalid OSS key"))
    .min(1)
    .max(5),
  panels: z
    .array(z.enum(PANEL_IDS as [PanelId, ...PanelId[]]))
    .min(1)
    .max(PANEL_IDS.length)
    .optional(),
  specs: z
    .array(
      z.object({
        label: z.string().min(1).max(20),
        value: z.string().min(1).max(40),
      }),
    )
    .max(8)
    .optional(),
});

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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const userId = session.user.id;

  // Create the Job + register each uploaded photo as a SOURCE Image row.
  // Generation itself happens later (Phase 3) — this just snapshots intent.
  const job = await prisma.$transaction(async (tx) => {
    const j = await tx.job.create({
      data: {
        userId,
        status: "PENDING",
        inputJson: input,
        creditsCost: 0,
      },
    });
    await tx.image.createMany({
      data: input.sourceImageKeys.map((key) => ({
        jobId: j.id,
        kind: "SOURCE" as const,
        ossKey: key,
      })),
    });
    return j;
  });

  return NextResponse.json({ id: job.id }, { status: 201 });
}
