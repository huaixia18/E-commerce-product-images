import OSS from "ali-oss";
import { env } from "./env";

let client: OSS | null = null;

export function ossClient(): OSS {
  if (client) return client;
  const e = env();
  client = new OSS({
    region: e.ALIYUN_OSS_REGION,
    accessKeyId: e.ALIYUN_OSS_ACCESS_KEY_ID,
    accessKeySecret: e.ALIYUN_OSS_ACCESS_KEY_SECRET,
    bucket: e.ALIYUN_OSS_BUCKET,
    endpoint: e.ALIYUN_OSS_ENDPOINT || undefined,
    secure: true,
  });
  return client;
}

export async function putObject(key: string, body: Buffer | NodeJS.ReadableStream, mime?: string) {
  return ossClient().put(key, body, {
    mime,
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  });
}

export function signedUrl(key: string, expiresSeconds = 3600): string {
  return ossClient().signatureUrl(key, { expires: expiresSeconds });
}
