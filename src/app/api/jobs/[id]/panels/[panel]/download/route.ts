import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { loadImageBytes, safeSlug, extForMime, contentDisposition } from "@/lib/downloadHelpers";
import { PANEL_IDS, type JobInput, type PanelId } from "@/lib/promptTemplate";

/**
 * GET /api/jobs/[id]/panels/[panel]/download
 * Streams a single GENERATED image with a friendly filename.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; panel: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, panel } = await ctx.params;
  if (!PANEL_IDS.includes(panel as PanelId)) {
    return NextResponse.json({ error: "Unknown panel" }, { status: 400 });
  }

  const job = await prisma.job.findUnique({
    where: { id },
    include: { images: { where: { kind: "GENERATED", panel }, take: 1 } },
  });
  if (!job || job.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const img = job.images[0];
  if (!img) {
    return NextResponse.json({ error: "Panel not generated" }, { status: 404 });
  }

  const { buffer, mimeType } = await loadImageBytes(img);
  const input = job.inputJson as unknown as JobInput;
  const filename = `${safeSlug(input.title)}-${panel}.${extForMime(mimeType)}`;

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": contentDisposition(filename),
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
