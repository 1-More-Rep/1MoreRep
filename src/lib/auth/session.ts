import 'server-only';
import { cookies } from 'next/headers';
import type { User } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { hmacIp, randomId, randomToken, sha256, timingSafeEqualHex } from '@/lib/crypto';
import { SESSION_COOKIE } from './constants';

export { SESSION_COOKIE };

const IDLE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const ROLL_THROTTLE_MS = 60 * 60 * 1000; // refresh idle expiry at most hourly

export interface SessionContext {
  ip?: string | null;
  userAgent?: string | null;
  label?: string | null;
}

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    expires,
  };
}

/** Create a session for a user and set the session cookie. */
export async function createSession(userId: string, ctx: SessionContext = {}): Promise<void> {
  const id = randomId();
  const secret = randomToken();
  const now = Date.now();
  const idleExpiresAt = new Date(now + IDLE_MS);
  const absoluteExpiresAt = new Date(now + ABSOLUTE_MS);

  await prisma.session.create({
    data: {
      id,
      userId,
      hashedSecret: sha256(secret),
      idleExpiresAt,
      absoluteExpiresAt,
      ipHash: ctx.ip ? hmacIp(ctx.ip) : null,
      userAgent: ctx.userAgent ?? null,
      label: ctx.label ?? null,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, `${id}.${secret}`, cookieOptions(absoluteExpiresAt));
}

export interface SessionUser {
  sessionId: string;
  user: User;
}

/** Validate the request's session cookie; returns the user or null. */
export async function validateSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const sep = raw.indexOf('.');
  if (sep <= 0) return null;
  const id = raw.slice(0, sep);
  const secret = raw.slice(sep + 1);

  const session = await prisma.session.findUnique({ where: { id }, include: { user: true } });
  if (!session) return null;

  // constant-time secret check
  if (!timingSafeEqualHex(sha256(secret), session.hashedSecret)) return null;

  const now = Date.now();
  if (session.idleExpiresAt.getTime() < now || session.absoluteExpiresAt.getTime() < now) {
    await prisma.session.delete({ where: { id } }).catch(() => {});
    return null;
  }
  if (session.user.status === 'DEACTIVATED') {
    await prisma.session.delete({ where: { id } }).catch(() => {});
    return null;
  }

  // Roll idle expiry forward (throttled to limit writes).
  if (now - session.lastUsedAt.getTime() > ROLL_THROTTLE_MS) {
    const newIdle = new Date(Math.min(now + IDLE_MS, session.absoluteExpiresAt.getTime()));
    await prisma.session
      .update({ where: { id }, data: { lastUsedAt: new Date(now), idleExpiresAt: newIdle } })
      .catch(() => {});
  }

  return { sessionId: id, user: session.user };
}

/** Delete the current session and clear the cookie. */
export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (raw) {
    const id = raw.split('.')[0];
    if (id) await prisma.session.delete({ where: { id } }).catch(() => {});
  }
  store.delete(SESSION_COOKIE);
}

/** Revoke every session for a user (logout-all / password reset / deactivate). */
export async function destroyAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

/** Revoke all of a user's sessions except one (keep the current device). */
export async function destroyOtherSessions(userId: string, keepSessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId, id: { not: keepSessionId } } });
}

/** The current request's session id (from the cookie), or null. */
export async function currentSessionId(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const id = raw.split('.')[0];
  return id || null;
}
