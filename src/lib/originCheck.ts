// Defence-in-depth CSRF guard: reject POST requests that don't come from
// our own origin. The session cookie already uses SameSite=lax, but lax
// allows top-level POSTs from anywhere — so adding an Origin/Referer check
// closes the small remaining window. The check is best-effort: if both
// headers are missing (uncommon for browsers but possible for certain
// curl-style clients) we let it through, since the endpoints are also
// auth-gated.

import { NextResponse } from "next/server";
import { env } from "./env";

function expectedHost(): string | null {
  try {
    return new URL(env().AUTH_URL).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Returns null if the request looks same-origin, or a 403 response if it
 * comes from a different origin. Call at the very top of any POST/PATCH
 * route handler that should only be invoked by our own UI.
 */
export function requireSameOrigin(req: Request): NextResponse | null {
  const host = expectedHost();
  if (!host) return null; // misconfig — fail open to avoid bricking the app

  const originRaw = req.headers.get("origin");
  const refererRaw = req.headers.get("referer");

  function hostOf(value: string | null): string | null {
    if (!value) return null;
    try {
      return new URL(value).host.toLowerCase();
    } catch {
      return null;
    }
  }

  const origin = hostOf(originRaw);
  const referer = hostOf(refererRaw);

  // No origin and no referer — uncommon for browser POSTs. We let it through
  // because (a) auth checks still apply and (b) some legitimate clients
  // (server-to-server tests) strip these headers.
  if (!origin && !referer) return null;

  // Either header matching our host is fine.
  if (origin === host) return null;
  if (referer === host) return null;

  return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });
}
