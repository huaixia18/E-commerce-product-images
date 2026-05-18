import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1),
  AUTH_URL: z.string().url(),
  BANANAROUTER_API_KEY: z.string().min(1),
  BANANAROUTER_BASE_URL: z.string().url().default("https://api.bananarouter.com/v1"),
  BANANAROUTER_MODEL: z.string().default("gpt-image-2"),
  ALIYUN_OSS_REGION: z.string().min(1),
  ALIYUN_OSS_BUCKET: z.string().min(1),
  ALIYUN_OSS_ACCESS_KEY_ID: z.string().min(1),
  ALIYUN_OSS_ACCESS_KEY_SECRET: z.string().min(1),
  ALIYUN_OSS_ENDPOINT: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables:\n${parsed.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n")}`,
    );
  }
  cached = parsed.data;
  return cached;
}
