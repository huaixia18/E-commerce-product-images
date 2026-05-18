// GPT-Image-2 via BananaRouter (OpenAI-SDK compatible).
// Spec: docs/gpt-image-2.md
//
// Two call paths are useful for us:
//   1. Text-to-image: client.images.generate(...)        — JSON /v1/images/generations
//   2. Edit-by-URL:   raw fetch to /v1/images/generations with `image: string[]` of OSS URLs
//   3. Edit-by-upload: client.images.edit(...)           — multipart /v1/images/edits
//
// Phase 0 exports the text-to-image path + size validation + a thin edit-by-URL wrapper.
// Phase 3 will add retries, concurrency, and per-panel prompt-plan execution.

import OpenAI from "openai";
import { env } from "./env";

let client: OpenAI | null = null;

export function imageClient(): OpenAI {
  if (client) return client;
  const e = env();
  client = new OpenAI({
    apiKey: e.BANANAROUTER_API_KEY,
    baseURL: e.BANANAROUTER_BASE_URL,
  });
  return client;
}

export type Quality = "auto" | "low" | "medium" | "high";
export type OutputFormat = "png" | "jpeg" | "webp";

export interface GenerateInput {
  prompt: string;
  size?: string; // "auto" or "WxH"
  quality?: Quality;
  outputFormat?: OutputFormat;
  outputCompression?: number; // 0-100, jpeg/webp only
  /** OSS URLs to use as reference images; triggers the edit-by-URL path. */
  referenceUrls?: string[];
}

export interface GenerateResult {
  buffer: Buffer;
  mimeType: string;
  usage?: {
    totalTokens?: number;
    inputTokens?: number;
    outputTokens?: number;
  };
  revisedPrompt?: string;
}

/**
 * Validate a size string against gpt-image-2's pixel-level constraints.
 * Returns null if valid, otherwise an error message.
 *
 * Rules (from docs/gpt-image-2.md):
 *   - "auto" is allowed
 *   - format: WxH (positive integers)
 *   - max edge: 3840
 *   - both edges multiples of 16
 *   - aspect ratio (long/short) <= 3
 *   - 655_360 <= W*H <= 8_294_400
 */
export function validateSize(size: string): string | null {
  if (size === "auto") return null;
  const m = /^(\d+)x(\d+)$/.exec(size);
  if (!m) return `size must be "auto" or "WxH" (got ${size})`;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (w > 3840 || h > 3840) return "edge length must be <= 3840";
  if (w % 16 !== 0 || h % 16 !== 0) return "edges must be multiples of 16";
  const ratio = Math.max(w, h) / Math.min(w, h);
  if (ratio > 3) return "aspect ratio must be <= 3:1";
  const pixels = w * h;
  if (pixels < 655_360) return "total pixels must be >= 655,360";
  if (pixels > 8_294_400) return "total pixels must be <= 8,294,400";
  return null;
}

function mimeForFormat(fmt: OutputFormat | undefined): string {
  switch (fmt) {
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "png":
    default:
      return "image/png";
  }
}

/**
 * Text-to-image (no reference). Returns the decoded image bytes.
 */
export async function generateImage(input: GenerateInput): Promise<GenerateResult> {
  const e = env();
  if (e.STUB_IMAGE_MODEL === "1") {
    return stubImage(input);
  }
  if (input.referenceUrls?.length) {
    return editByUrl(input);
  }
  const size = input.size ?? "1024x1024";
  const sizeErr = validateSize(size);
  if (sizeErr) throw new Error(`Invalid size: ${sizeErr}`);

  const params: Record<string, unknown> = {
    model: e.BANANAROUTER_MODEL,
    prompt: input.prompt,
    n: 1,
    size,
    quality: input.quality ?? "auto",
    output_format: input.outputFormat ?? "png",
  };
  if (input.outputCompression !== undefined) {
    params.output_compression = input.outputCompression;
  }

  // Cast: the OpenAI SDK types lag behind BananaRouter's accepted params (e.g. quality enum).
  const result = await imageClient().images.generate(params as never);
  const item = (result as { data?: Array<{ b64_json?: string; revised_prompt?: string }> }).data?.[0];
  const b64 = item?.b64_json;
  if (!b64) throw new Error("Image API returned no data");
  return {
    buffer: Buffer.from(b64, "base64"),
    mimeType: mimeForFormat(input.outputFormat),
    revisedPrompt: item?.revised_prompt,
    usage: extractUsage(result),
  };
}

/**
 * Edit-by-URL path: passes reference image URLs (OSS signed/public) to /v1/images/generations.
 * Uses raw fetch because the OpenAI SDK typings don't expose `image: string[]` on generations.
 */
async function editByUrl(input: GenerateInput): Promise<GenerateResult> {
  const e = env();
  const size = input.size ?? "1024x1024";
  const sizeErr = validateSize(size);
  if (sizeErr) throw new Error(`Invalid size: ${sizeErr}`);

  const body: Record<string, unknown> = {
    model: e.BANANAROUTER_MODEL,
    prompt: input.prompt,
    image: input.referenceUrls,
    size,
    quality: input.quality ?? "auto",
    output_format: input.outputFormat ?? "png",
  };
  if (input.outputCompression !== undefined) {
    body.output_compression = input.outputCompression;
  }

  const res = await fetch(`${e.BANANAROUTER_BASE_URL}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${e.BANANAROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Image API ${res.status}: ${text}`);
  }
  const json = (await res.json()) as {
    data?: Array<{ b64_json?: string; revised_prompt?: string }>;
    usage?: { total_tokens?: number; input_tokens?: number; output_tokens?: number };
  };
  const item = json.data?.[0];
  const b64 = item?.b64_json;
  if (!b64) throw new Error("Image API returned no data");
  return {
    buffer: Buffer.from(b64, "base64"),
    mimeType: mimeForFormat(input.outputFormat),
    revisedPrompt: item.revised_prompt,
    usage: {
      totalTokens: json.usage?.total_tokens,
      inputTokens: json.usage?.input_tokens,
      outputTokens: json.usage?.output_tokens,
    },
  };
}

/**
 * Stub generator for local smoke tests. Returns a small solid-color PNG
 * deterministic from the prompt, so the worker can be exercised end-to-end
 * without API spend. Only activated when STUB_IMAGE_MODEL=1.
 */
async function stubImage(input: GenerateInput): Promise<GenerateResult> {
  // Test hook: include "FAIL_TEST" in any prompt to force a failure path —
  // used to verify retry + refund logic without a real API. No-op in prod.
  if (input.prompt.includes("FAIL_TEST")) {
    throw new Error("stub injected failure (FAIL_TEST in prompt)");
  }
  const sharp = (await import("sharp")).default;
  const h = simpleHash(input.prompt);
  const r = (h & 0xff0000) >> 16;
  const g = (h & 0x00ff00) >> 8;
  const b = h & 0x0000ff;
  const buf = await sharp({
    create: { width: 256, height: 256, channels: 3, background: { r, g, b } },
  })
    .png()
    .toBuffer();
  return {
    buffer: buf,
    mimeType: "image/png",
    revisedPrompt: "[STUB] " + input.prompt.slice(0, 80),
  };
}

function simpleHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return h >>> 0;
}

function extractUsage(raw: unknown) {
  const usage = (raw as { usage?: { total_tokens?: number; input_tokens?: number; output_tokens?: number } }).usage;
  if (!usage) return undefined;
  return {
    totalTokens: usage.total_tokens,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
  };
}
