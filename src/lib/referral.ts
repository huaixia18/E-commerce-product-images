// Server-side referral helpers: anti-abuse guards + reward math.
//
// 7-layer defense (per the design):
//   1. referralCode is a unique column on User — one code per referrer.
//   2. Same-IP burst: ≤ 3 registrations per 24h on the same IP.
//   3. Referrer and invitee can't share an IP.
//   4. Referrer and invitee can't share a device fingerprint.
//   5. Disposable email domains rejected (mailinator etc).
//   6. Referrer must be >24h old before the reward applies.
//   7. Referral state is recorded in its own row so admins can audit/revoke.
//
// All checks short-circuit BEFORE the user/credit rows are created. A failed
// check either rejects the signup entirely (e.g. disposable email) or just
// drops the referral while still allowing the registration to succeed
// (e.g. self-invite via same IP — we don't want to punish legit users).

import { createHash } from "node:crypto";
import IORedis from "ioredis";
import { env } from "./env";

export const REFERRER_REWARD = 50;
export const INVITEE_REWARD = 50;
export const SIGNUP_GIFT = 10;
export const REFERRER_MIN_AGE_HOURS = 24;
export const SAME_IP_BURST_LIMIT = 3;
export const SAME_IP_WINDOW_SECONDS = 24 * 60 * 60;

let _redis: IORedis | null = null;
function redis(): IORedis {
  if (_redis) return _redis;
  _redis = new IORedis(env().REDIS_URL, { maxRetriesPerRequest: null });
  return _redis;
}

/**
 * Extract the client IP from the incoming request. We trust Cloudflare /
 * Nginx proxy headers first, then fall back to a static "unknown" so
 * dev requests don't blow up the throttle keys.
 */
export function clientIp(req: Request): string {
  const h = req.headers;
  const fwd = h.get("cf-connecting-ip")
    || h.get("x-real-ip")
    || h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || "unknown";
}

/**
 * A lightweight device fingerprint hash that doesn't rely on third-party
 * libraries: User-Agent + Accept-Language + Accept-Encoding combined and
 * SHA-256'd. Trivial to spoof if you really try, but enough to stop
 * single-browser multi-account farms.
 */
export function deviceFingerprint(req: Request): string {
  const h = req.headers;
  const seed = [
    h.get("user-agent") ?? "",
    h.get("accept-language") ?? "",
    h.get("accept-encoding") ?? "",
    h.get("sec-ch-ua") ?? "",
    h.get("sec-ch-ua-platform") ?? "",
  ].join("|");
  return createHash("sha256").update(seed).digest("hex").slice(0, 32);
}

/**
 * Hand-curated list of common disposable / temporary email domains. We keep
 * this short and high-signal — exhaustive lists rot fast. Add to it when you
 * see new patterns in the wild.
 */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "trashmail.com",
  "tempmail.com", "10minutemail.com", "yopmail.com", "dispostable.com",
  "fakeinbox.com", "throwawaymail.com", "maildrop.cc", "sharklasers.com",
  "moakt.com", "tempr.email", "getnada.com", "mailcatch.com", "mintemail.com",
]);

export function isDisposableEmail(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase().trim();
  return DISPOSABLE_DOMAINS.has(domain);
}

/**
 * Bump the per-IP signup counter. Returns true if this IP is now over the
 * burst limit (i.e. we should reject the new signup).
 *
 * When the client IP is unknown (request lacked any of the proxy headers we
 * trust), we route the count under a shared "unknown" bucket rather than
 * skipping the check entirely. This means a misconfigured proxy can't be used
 * to bypass burst limiting — at worst, all unknown-IP signups share the
 * same quota and step on each other, which is exactly what we want.
 */
export async function isIpBurstExceeded(ip: string): Promise<boolean> {
  const key = `signup:ip:${ip}`;
  const count = await redis().incr(key);
  if (count === 1) {
    await redis().expire(key, SAME_IP_WINDOW_SECONDS);
  }
  return count > SAME_IP_BURST_LIMIT;
}

export interface RefRejection {
  code: "self_ip" | "self_fingerprint" | "referrer_too_young" | "already_invited";
  reason: string;
}

/**
 * Decide whether to award referral credits, given everything we know about
 * the invitee. Returns null if the referral is OK to grant, or a reason
 * string explaining why we silently drop it (the signup still succeeds).
 */
export async function evaluateReferral(args: {
  referrerId: string;
  referrerIp: string | null;
  referrerFp: string | null;
  referrerCreatedAt: Date;
  inviteeIp: string;
  inviteeFp: string;
  inviteeAlreadyExists: boolean;
}): Promise<RefRejection | null> {
  if (args.inviteeAlreadyExists) {
    return { code: "already_invited", reason: "Invitee already registered before" };
  }
  if (
    args.referrerIp &&
    args.referrerIp !== "unknown" &&
    args.referrerIp === args.inviteeIp
  ) {
    return { code: "self_ip", reason: "Referrer and invitee share an IP" };
  }
  if (args.referrerFp && args.referrerFp === args.inviteeFp) {
    return { code: "self_fingerprint", reason: "Referrer and invitee share a device fingerprint" };
  }
  const ageMs = Date.now() - args.referrerCreatedAt.getTime();
  if (ageMs < REFERRER_MIN_AGE_HOURS * 60 * 60 * 1000) {
    return { code: "referrer_too_young", reason: "Referrer account is less than 24h old" };
  }
  return null;
}

/**
 * Recall a user's signup IP + device fingerprint from the User row.
 *
 * Previously we cached these in Redis with a 24h TTL — but referrer eligibility
 * also requires the referrer to be ≥24h old, so the cache always expired before
 * it could be checked. Now we persist on the User row at signup
 * (`signupIp` / `signupFp` columns) so the same-IP / same-fingerprint defense
 * layers actually fire.
 */
export async function recallUserDevice(
  userId: string,
): Promise<{ ip: string | null; fp: string | null } | null> {
  // Lazy import to avoid prisma being pulled into edge runtime if referral
  // helpers are ever imported there.
  const { prisma } = await import("./prisma");
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { signupIp: true, signupFp: true },
  });
  if (!u) return null;
  return { ip: u.signupIp, fp: u.signupFp };
}
