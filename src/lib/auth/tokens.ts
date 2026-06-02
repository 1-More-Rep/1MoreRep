import 'server-only';
import type { Prisma, TokenType } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { hmacIp, randomToken, sha256 } from '@/lib/crypto';
import { env } from '@/lib/env';

const TTL_MS: Record<TokenType, number> = {
  INVITE: 7 * 24 * 60 * 60 * 1000, // 7d
  EMAIL_VERIFY: 24 * 60 * 60 * 1000, // 24h
  LOGIN_LINK: 15 * 60 * 1000, // 15m
  PASSWORD_RESET: 30 * 60 * 1000, // 30m
  EMAIL_CHANGE: 60 * 60 * 1000, // 1h
};

export interface IssuedToken {
  rawToken: string;
  url: string;
}

/**
 * Issue a single-use magic-link token. Stores only the SHA-256 hash; the raw
 * token lives only in the returned URL/email. Invalidates prior unconsumed
 * tokens of the same type for the user (one live link at a time).
 */
export async function issueToken(
  type: TokenType,
  userId: string,
  opts: { payload?: Prisma.InputJsonValue; ip?: string | null } = {},
): Promise<IssuedToken> {
  const rawToken = randomToken(32);
  const hashedToken = sha256(rawToken);
  const expiresAt = new Date(Date.now() + TTL_MS[type]);

  await prisma.$transaction([
    prisma.authToken.deleteMany({ where: { userId, type, consumedAt: null } }),
    prisma.authToken.create({
      data: {
        type,
        userId,
        hashedToken,
        expiresAt,
        payload: opts.payload,
        requestIpHash: opts.ip ? hmacIp(opts.ip) : null,
      },
    }),
  ]);

  return { rawToken, url: buildTokenUrl(type, rawToken) };
}

export function buildTokenUrl(type: TokenType, rawToken: string): string {
  const u = new URL('/auth/callback', env.APP_URL);
  u.searchParams.set('type', type);
  u.searchParams.set('token', rawToken);
  return u.toString();
}

export interface ConsumedToken {
  userId: string;
  payload: unknown;
}

/**
 * Consume a token of the expected type. Single-use and race-safe: the
 * consumedAt write is conditional (only-if-null), so concurrent attempts
 * yield exactly one winner. Returns null on any failure (not found / wrong
 * type / expired / already consumed).
 */
export async function consumeToken(type: TokenType, rawToken: string): Promise<ConsumedToken | null> {
  if (!rawToken) return null;
  const hashedToken = sha256(rawToken);
  const token = await prisma.authToken.findUnique({ where: { hashedToken } });
  if (!token) return null;
  if (token.type !== type) return null;
  if (token.consumedAt) return null;
  if (token.expiresAt.getTime() < Date.now()) return null;

  // Atomic claim: only succeeds if still unconsumed.
  const claimed = await prisma.authToken.updateMany({
    where: { id: token.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (claimed.count !== 1) return null;

  return { userId: token.userId, payload: token.payload };
}

/** Peek a token's metadata without consuming (for the GET confirm page). */
export async function inspectToken(
  type: TokenType,
  rawToken: string,
): Promise<{ valid: boolean; userId?: string }> {
  if (!rawToken) return { valid: false };
  const token = await prisma.authToken.findUnique({ where: { hashedToken: sha256(rawToken) } });
  if (!token || token.type !== type || token.consumedAt || token.expiresAt.getTime() < Date.now()) {
    return { valid: false };
  }
  return { valid: true, userId: token.userId };
}
