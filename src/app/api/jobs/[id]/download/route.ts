import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { loadImageBytes, safeSlug, extForMime, contentDisposition } from "@/lib/downloadHelpers";
import type { JobInput } from "@/lib/promptTemplate";

// archiver v7 is CJS with `module.exports = function archiver(...)`.
// Marked as serverExternalPackages so Node loads it raw (default-import sugar
// would otherwise resolve to undefined under Turbopack's ESM interop).
import archiver from "archiver";

/**
 * GET /api/jobs/[id]/download
 * Streams a zip of all GENERATED images for this job.
 * Filename: <product-slug>-<jobIdShort>.zip
 * Per-file: <panel>.<ext>
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const job = await prisma.job.findUnique({
    where: { id },
    include: { images: { where: { kind: "GENERATED" }, orderBy: { createdAt: "asc" } } },
  });
  if (!job || job.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (job.images.length === 0) {
    return NextResponse.json({ error: "Nothing generated yet" }, { status: 409 });
  }

  const input = job.inputJson as unknown as JobInput;
  const zipName = `${safeSlug(input.title)}-${job.id.slice(0, 8)}.zip`;

  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.on("error", (err) => {
    console.error("[download] archive error:", err);
  });

  // Load images in parallel, append to archive as bytes (not as streams from OSS
  // — keeps memory predictable and avoids partial-buffer corruption).
  const loaded = await Promise.all(
    job.images.map(async (img) => {
      const { buffer, mimeType } = await loadImageBytes(img);
      const ext = extForMime(mimeType);
      const name = img.panel ? `${img.panel}.${ext}` : `${img.id}.${ext}`;
      return { name, buffer };
    }),
  );
  for (const f of loaded) archive.append(f.buffer, { name: f.name });
  void archive.finalize();

  // archiver is a Node Readable; convert to a Web ReadableStream for the
  // Next.js Response. Node 18+ has Readable.toWeb().
  const webStream = Readable.toWeb(archive) as unknown as ReadableStream<Uint8Array>;

  return new Response(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": contentDisposition(zipName),
      "Cache-Control": "private, no-store",
    },
  });
}
