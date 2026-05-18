import OpenAI from "openai";
import { env } from "./env";

// BananaRouter is OpenAI-SDK compatible. Phase 3 will wrap this with retries,
// prompt-plan execution, and panel-aware concurrency.
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

export interface GeneratePanelInput {
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024" | string;
  quality?: "auto" | "low" | "medium" | "high";
}

export async function generatePanel(input: GeneratePanelInput): Promise<Buffer> {
  const e = env();
  const result = await imageClient().images.generate({
    model: e.BANANAROUTER_MODEL,
    prompt: input.prompt,
    n: 1,
    size: input.size ?? "1024x1024",
    quality: input.quality ?? "auto",
  });
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image API returned no data");
  return Buffer.from(b64, "base64");
}
