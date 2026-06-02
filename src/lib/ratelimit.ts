import 'server-only';
import { RateLimiterMemory } from 'rate-limiter-flexible';

/**
 * In-memory rate limiters (single-instance self-host). Swap to a Postgres/Redis
 * backend later by changing the constructor — the consume() API is unchanged.
 */
const authLimiter = new RateLimiterMemory({ points: 10, duration: 60 }); // 10 / min per key
const emailLimiter = new RateLimiterMemory({ points: 3, duration: 15 * 60 }); // 3 / 15min per recipient
const genericLimiter = new RateLimiterMemory({ points: 120, duration: 60 }); // 120 / min per ip

export interface RateResult {
  ok: boolean;
  retryAfterMs?: number;
}

async function consume(limiter: RateLimiterMemory, key: string): Promise<RateResult> {
  try {
    await limiter.consume(key);
    return { ok: true };
  } catch (res) {
    const ms = (res as { msBeforeNext?: number })?.msBeforeNext;
    return { ok: false, retryAfterMs: typeof ms === 'number' ? ms : 60_000 };
  }
}

export const rateLimit = {
  auth: (key: string) => consume(authLimiter, key),
  email: (recipient: string) => consume(emailLimiter, recipient.toLowerCase()),
  generic: (ip: string) => consume(genericLimiter, ip),
};
