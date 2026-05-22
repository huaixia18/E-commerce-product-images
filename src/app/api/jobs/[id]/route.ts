import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { signedGetUrl } from "@/lib/oss";
import { panelQueue, panelJobId } from "@/lib/queue";
import { ALL_PANEL_IDS, type JobInput, type PanelId } from "@/lib/promptTemplate";

type PanelState = "pending" | "running" | "done" | "failed";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      images: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!job || job.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const input = job.inputJson as unknown as JobInput;
  const requested = (input.panels ?? ALL_PANEL_IDS) as PanelId[];

  // Per-panel state: prefer DB (produced image) → queue state → "pending"
  const queue = job.status === "RUNNING" ? panelQueue() : null;
  const panels = await Promise.all(
    requested.map(async (panel) => {
      const img = job.images.find((i) => i.kind === "GENERATED" && i.panel === panel);
      if (img) {
        // Prefer the precomputed url (stub mode embeds a data URL); fall back
        // to a signed OSS GET URL in production.
        const url = img.url ?? signedGetUrl(img.ossKey, 3600);
        return {
          panel,
          state: "done" as PanelState,
          url,
          width: img.width,
          height: img.height,
        };
      }
      if (queue) {
        const qj = await queue.getJob(panelJobId(id, panel));
        if (qj) {
          const s = await qj.getState();
          if (s === "active") return { panel, state: "running" as PanelState };
          if (s === "failed") return { panel, state: "failed" as PanelState };
          return { panel, state: "pending" as PanelState };
        }
      }
      // Job finalized but no image produced (or not started yet)
      if (job.status === "PARTIAL" || job.status === "FAILED" || job.status === "SUCCEEDED") {
        return { panel, state: "failed" as PanelState };
      }
      return { panel, state: "pending" as PanelState };
    }),
  );

  // Source photos (signed) + display meta, so a client can render the full
  // job view without a server round-trip (used by the workbench).
  const sources = job.images
    .filter((i) => i.kind === "SOURCE")
    .map((i) => ({ id: i.id, url: i.url ?? signedGetUrl(i.ossKey, 3600) }));

  return NextResponse.json({
    id: job.id,
    status: job.status,
    creditsCost: job.creditsCost,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    errorMessage: job.errorMessage,
    panels,
    title: input.title,
    style: input.style ?? null,
    platform: input.platform ?? null,
    highlights: input.highlights ?? [],
    specs: input.specs ?? [],
    requestedPanels: requested,
    sources,
  });
}
