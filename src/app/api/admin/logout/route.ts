import { NextResponse } from "next/server";
import { clearAdminCookie } from "@/lib/adminAuth";
import { requireSameOrigin } from "@/lib/originCheck";

export async function POST(req: Request) {
  const originErr = requireSameOrigin(req);
  if (originErr) return originErr;
  await clearAdminCookie();
  return NextResponse.json({ ok: true });
}
