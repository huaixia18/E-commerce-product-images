import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";
import { signedGetUrl } from "@/lib/oss";
import { ALL_PANEL_IDS, type JobInput, type PanelId } from "@/lib/promptTemplate";

/**
 * Admin-only job detail. Returns:
 *   - job header (status, timestamps, error)
 *   - user email
 *   - per-panel state (done/running/queued/failed) derived from Image rows
 *   - sources + generated image preview URLs (signed if on OSS, raw if stub)
 *   - credit entries tied to this job (spends + refunds)
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      user: { select: { email: true, credits: true } },
      images: { orderBy: { createdAt: "asc" } },
      creditEntries: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const input = job.inputJson as unknown as JobInput;
  const requested = (input.panels ?? ALL_PANEL_IDS) as PanelId[];

  function resolveUrl(ossKey: string, url: string | null): string {
    if (url?.startsWith("data:")) return url;
    try {
      return signedGetUrl(ossKey, 3600);
    } catch {
      return "";
    }
  }

  const sources = job.images
    .filter((i) => i.kind === "SOURCE")
    .map((i) => ({ id: i.id, url: resolveUrl(i.ossKey, i.url) }));

  const generated = job.images.filter((i) => i.kind === "GENERATED");
  const panels = requested.map((p) => {
    const img = generated.find((g) => g.panel === p);
    if (img) {
      return {
        panel: p,
        state: "done" as const,
        imageId: img.id,
        url: resolveUrl(img.ossKey, img.url),
        ossKey: img.ossKey,
      };
    }
    // No image yet — derive state from job-level status.
    if (job.status === "PENDING") return { panel: p, state: "queued" as const };
    if (job.status === "RUNNING") return { panel: p, state: "running" as const };
    return { panel: p, state: "failed" as const };
  });

  return NextResponse.json({
    id: job.id,
    userId: job.userId,
    userEmail: job.user.email,
    userCredits: job.user.credits,
    status: job.status,
    creditsCost: job.creditsCost,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    input,
    sources,
    panels,
    ledger: job.creditEntries.map((e) => ({
      id: e.id,
      amount: e.amount,
      type: e.type,
      note: e.note,
      createdAt: e.createdAt,
    })),
  });
}
