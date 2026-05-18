"use client";

// Client-side compression: downscale to a max edge before upload.
// gpt-image-2 only treats inputs as high-fidelity, so anything over ~2048px is
// wasted bandwidth and tokens. JPEG quality 0.85 keeps detail without bloat.

export const MAX_EDGE = 2048;
export const TARGET_MIME = "image/jpeg";
export const TARGET_QUALITY = 0.85;

export interface CompressedFile {
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
  /** Object URL for preview; caller is responsible for revoking. */
  previewUrl: string;
}

export async function compressImage(file: File): Promise<CompressedFile> {
  const bitmap = await createImageBitmap(file);
  const { width: w0, height: h0 } = bitmap;
  const scale = Math.min(1, MAX_EDGE / Math.max(w0, h0));
  const w = Math.round(w0 * scale);
  const h = Math.round(h0 * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
      TARGET_MIME,
      TARGET_QUALITY,
    );
  });

  return {
    blob,
    width: w,
    height: h,
    bytes: blob.size,
    previewUrl: URL.createObjectURL(blob),
  };
}
