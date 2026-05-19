import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signAdminToken, setAdminCookie } from "@/lib/adminAuth";
import { redisConnection } from "@/lib/queue";
import { requireSameOrigin } from "@/lib/originCheck";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

// Brute-force throttle. The admin panel can move money + close accounts,
// so the limits here are intentionally tight.
//   per email:   ≥ 10 failed attempts within 1h locks the email for 1h
//   per IP:      ≥ 60 attempts in 1h (success or fail) — generic abuse cap
// Counters reset on successful login (for the email) and on natural TTL.
const EMAIL_FAIL_LIMIT = 10;
const EMAIL_FAIL_WINDOW_S = 60 * 60;
const IP_ATTEMPT_LIMIT = 60;
const IP_ATTEMPT_WINDOW_S = 60 * 60;

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const fromFwd = fwd.split(",")[0]?.trim();
  return fromFwd || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: Request) {
  const originErr = requireSameOrigin(req);
  if (originErr) return originErr;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();
  const ip = clientIp(req);

  // ─── Throttle (fail-closed if Redis is dead) ────────────────────────────
  // If we can't enforce the limit we refuse rather than letting an
  // attacker exploit a Redis outage. Admin endpoints are high-value.
  try {
    const r = redisConnection();
    const failKey = `admin:fail:${email}`;
    const ipKey = `admin:ip:${ip}`;

    const failCount = Number((await r.get(failKey)) ?? 0);
    if (failCount >= EMAIL_FAIL_LIMIT) {
      const ttl = await r.ttl(failKey);
      return NextResponse.json(
        {
          error: `账号已临时锁定，请 ${Math.max(60, ttl)} 秒后再试`,
        },
        { status: 429 },
      );
    }

    const ipCount = await r.incr(ipKey);
    if (ipCount === 1) await r.expire(ipKey, IP_ATTEMPT_WINDOW_S);
    if (ipCount > IP_ATTEMPT_LIMIT) {
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试" },
        { status: 429 },
      );
    }
  } catch (e) {
    console.error("[admin/login] redis throttle failed — fail closed", e);
    return NextResponse.json(
      { error: "服务暂时不可用" },
      { status: 503 },
    );
  }

  // ─── Constant-time-ish password compare ─────────────────────────────────
  const admin = await prisma.admin.findUnique({ where: { email } });
  const stored =
    admin?.passwordHash ?? "$2a$12$invalidhashinvalidhashinvalidhashinvalidhashinvalidhashinval";
  const ok = await bcrypt.compare(parsed.data.password, stored);
  if (!admin || !ok) {
    // Bump the per-email fail counter only on actual failures (not on bad
    // JSON / missing fields — those bumped the IP counter above).
    try {
      const r = redisConnection();
      const failKey = `admin:fail:${email}`;
      const newCount = await r.incr(failKey);
      if (newCount === 1) await r.expire(failKey, EMAIL_FAIL_WINDOW_S);
    } catch {
      /* throttle already enforced above; logging not critical */
    }
    return NextResponse.json({ error: "邮箱或密码不正确" }, { status: 401 });
  }

  // Success — reset the email fail counter so a forgetful admin doesn't
  // get locked out next time.
  try {
    await redisConnection().del(`admin:fail:${email}`);
  } catch {
    /* harmless */
  }

  const token = await signAdminToken({
    sub: admin.id,
    email: admin.email,
    name: admin.name ?? undefined,
  });
  await setAdminCookie(token);

  return NextResponse.json({ ok: true });
}
