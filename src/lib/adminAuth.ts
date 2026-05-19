// Independent admin authentication. Distinct cookie, distinct JWT secret,
// no relation to NextAuth — a leaked user session never grants admin.
//
// Session cookie:
//   name: admin_session
//   payload: { sub: adminId, email, iat, exp }
//   signed HS256 with ADMIN_SESSION_SECRET (or AUTH_SECRET as fallback)
//   lifetime: 12 hours (short on purpose — admins should re-auth often)

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "./env";

export const ADMIN_COOKIE = "admin_session";
const ALG = "HS256";
const TTL_SECONDS = 12 * 60 * 60;

function secretKey(): Uint8Array {
  const secret = process.env.ADMIN_SESSION_SECRET ?? env().AUTH_SECRET;
  return new TextEncoder().encode(secret);
}

export interface AdminSession {
  sub: string; // admin id
  email: string;
  name?: string;
}

export async function signAdminToken(payload: AdminSession): Promise<string> {
  return await new SignJWT({ email: payload.email, name: payload.name })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifyAdminToken(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: [ALG] });
    if (!payload.sub || typeof payload.email !== "string") return null;
    return {
      sub: payload.sub,
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Read the current admin session from cookies, or null if missing/invalid.
 * Server components / route handlers should call this to gate behavior.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const c = await cookies();
  const token = c.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  return await verifyAdminToken(token);
}

/** Issue a fresh admin cookie. Caller is a route handler. */
export async function setAdminCookie(token: string) {
  const c = await cookies();
  c.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function clearAdminCookie() {
  const c = await cookies();
  c.delete(ADMIN_COOKIE);
}
