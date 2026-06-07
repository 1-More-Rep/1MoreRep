import 'server-only';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';

/**
 * Rate limiters for a single-instance self-host.
 *
 * - `auth` / `email` are **persisted in the DB** (fixed window): the brute-force /
 *   abuse budget therefore survives a container restart, which happens on every
 *   `./update.sh`. Previously these were in-memory and reset on each deploy, opening a
 *   fresh guessing window after every upgrade.
 * - `generic` (per-IP request flood) stays **in-memory**: it is high-frequency and not
 *   security-sensitive, so a restart simply resets a soft request cap.
 */
const genericLimiter = new RateLimiterMemory({ points: 120, duration: 60 }); // 120 / min per ip

export interface RateResult {
  ok: boolean;
  retryAfterMs?: number;
}

async function consumeMemory(limiter: RateLimiterMemory, key: string): Promise<RateResult> {
  try {
    await limiter.consume(key);
    return { ok: true };
  } catch (res) {
    const ms = (res as { msBeforeNext?: number })?.msBeforeNext;
    return { ok: false, retryAfterMs: typeof ms === 'number' ? ms : 60_000 };
  }
}

/**
 * Persistent fixed-window limiter. Fails **open** on a DB error: a transient outage
 * must not lock every user out of signing in, and password guessing is still bounded by
 * the persisted per-account lockout (User.lockedUntil). Expired rows are GC'd by the
 * award.reconcile job.
 */
async function consumeDb(prefix: string, key: string, points: number, durationMs: number): Promise<RateResult> {
  const fullKey = `${prefix}:${key}`;
  const now = Date.now();
  try {
    const row = await prisma.rateLimit.findUnique({ where: { key: fullKey } });
    if (!row || row.expiresAt.getTime() <= now) {
      // No window, or the previous one has expired — (re)start it at count 1.
      await prisma.rateLimit.upsert({
        where: { key: fullKey },
        update: { count: 1, expiresAt: new Date(now + durationMs) },
        create: { key: fullKey, count: 1, expiresAt: new Date(now + durationMs) },
      });
      return { ok: true };
    }
    if (row.count >= points) {
      return { ok: false, retryAfterMs: row.expiresAt.getTime() - now };
    }
    // Conditional increment inside the SAME window: the (expiresAt, count < points)
    // guard stops two concurrent requests from both pushing the count past the limit.
    const inc = await prisma.rateLimit.updateMany({
      where: { key: fullKey, expiresAt: row.expiresAt, count: { lt: points } },
      data: { count: { increment: 1 } },
    });
    if (inc.count === 1) return { ok: true };
    // Lost the race (or the window just rolled) — re-read once and decide.
    const fresh = await prisma.rateLimit.findUnique({ where: { key: fullKey } });
    if (!fresh || fresh.expiresAt.getTime() <= now || fresh.count < points) return { ok: true };
    return { ok: false, retryAfterMs: fresh.expiresAt.getTime() - now };
  } catch (err) {
    logger.warn({ err, key: fullKey }, '[ratelimit] DB limiter failed open');
    return { ok: true };
  }
}

const AUTH = { points: 10, durationMs: 60_000 }; // 10 / min per key
const EMAIL = { points: 3, durationMs: 15 * 60_000 }; // 3 / 15min per recipient

export const rateLimit = {
  auth: (key: string) => consumeDb('auth', key, AUTH.points, AUTH.durationMs),
  email: (recipient: string) => consumeDb('email', recipient.toLowerCase(), EMAIL.points, EMAIL.durationMs),
  generic: (ip: string) => consumeMemory(genericLimiter, ip),
};
