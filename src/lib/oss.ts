import OSS from "ali-oss";
import { env } from "./env";

let _client: OSS | null = null;

export function ossClient(): OSS {
  if (_client) return _client;
  const e = env();
  _client = new OSS({
    region: e.ALIYUN_OSS_REGION,
    accessKeyId: e.ALIYUN_OSS_ACCESS_KEY_ID,
    accessKeySecret: e.ALIYUN_OSS_ACCESS_KEY_SECRET,
    bucket: e.ALIYUN_OSS_BUCKET,
    endpoint: e.ALIYUN_OSS_ENDPOINT || undefined,
    secure: true,
  });
  return _client;
}

export async function putObject(
  key: string,
  body: Buffer | NodeJS.ReadableStream,
  mime?: string,
) {
  return ossClient().put(key, body, {
    mime,
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  });
}

/** Signed GET URL for reading an object (used to feed gpt-image-2 by URL). */
export function signedGetUrl(key: string, expiresSeconds = 3600): string {
  return ossClient().signatureUrl(key, { expires: expiresSeconds });
}

/**
 * Signed PUT URL for browser-direct upload. Caller PUTs the file body to this URL
 * with the matching Content-Type. Bucket CORS must allow PUT from the app origin.
 */
export function signedPutUrl(
  key: string,
  contentType: string,
  expiresSeconds = 600,
): string {
  return ossClient().signatureUrl(key, {
    method: "PUT",
    expires: expiresSeconds,
    "Content-Type": contentType,
  });
}
