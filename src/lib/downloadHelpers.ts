import { ossClient } from "./oss";
import type { Image } from "@prisma/client";

/**
 * Load the bytes for a generated Image, whether it lives on OSS (production)
 * or is embedded as a data URL (stub mode). Returns the raw buffer + mime.
 */
export async function loadImageBytes(image: Pick<Image, "ossKey" | "url" | "mimeType">): Promise<{
  buffer: Buffer;
  mimeType: string;
}> {
  // Stub mode stores the PNG inline on Image.url as a data URL.
  if (image.url?.startsWith("data:")) {
    const m = /^data:([^;]+);base64,(.+)$/.exec(image.url);
    if (m) {
      return { buffer: Buffer.from(m[2], "base64"), mimeType: m[1] };
    }
  }
  // Production: fetch from OSS using the SDK directly (cheaper than signing + http).
  const result = await ossClient().get(image.ossKey);
  return {
    buffer: result.content as Buffer,
    mimeType: image.mimeType ?? "image/png",
  };
}

/**
 * Make a filename-safe slug from a Chinese/mixed string.
 * Keeps CJK chars, strips control chars and characters disallowed by FAT/Windows,
 * collapses whitespace to "-", trims to a reasonable length.
 */
export function safeSlug(input: string, maxLen = 40): string {
  const cleaned = input
    .normalize("NFKC")
    // strip: \/:*?"<>|, control chars, leading/trailing dots
    .replace(/[\\/:*?"<>|\x00-\x1f]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
  return (cleaned || "product").slice(0, maxLen);
}

export function extForMime(mime?: string | null): string {
  if (!mime) return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}

/**
 * Build an RFC 5987 Content-Disposition value. HTTP headers are latin-1 only,
 * so the unicode filename must live in `filename*=` and the legacy `filename=`
 * fallback gets an ASCII-only stand-in.
 */
export function contentDisposition(filename: string): string {
  // ASCII fallback: replace anything outside printable ASCII with "_".
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
