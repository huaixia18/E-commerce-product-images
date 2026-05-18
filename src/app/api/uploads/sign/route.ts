import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { signedPutUrl } from "@/lib/oss";

// Sign up to N upload URLs per request. Keep this small — abuse vector is
// trivial otherwise (client can request thousands of URLs without uploading).
const MAX_FILES_PER_REQUEST = 5;
const MAX_BYTES = 10 * 1024 * 1024; // 10MB ceiling per file (client compresses first)
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const fileSchema = z.object({
  contentType: z.string().refine((v) => ALLOWED_MIME.has(v), {
    message: "Unsupported MIME (jpeg/png/webp only)",
  }),
  size: z.number().int().positive().max(MAX_BYTES),
});

const schema = z.object({
  files: z.array(fileSchema).min(1).max(MAX_FILES_PER_REQUEST),
});

function extFor(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "bin";
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const userId = session.user.id;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const items = parsed.data.files.map((f) => {
    const key = `uploads/${today}/${userId}/${randomUUID()}.${extFor(f.contentType)}`;
    const uploadUrl = signedPutUrl(key, f.contentType, 600);
    return { ossKey: key, uploadUrl, contentType: f.contentType };
  });

  return NextResponse.json({ items });
}
