import 'server-only';
import crypto from 'node:crypto';
import { cookies, headers } from 'next/headers';
import type { User } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { encryptSecret, decryptSecret, sha256, hmac } from '@/lib/crypto';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { verifyTotpStep } from './totp';

/**
 * Server-only helpers shared by the 2FA server actions and the login flow:
 * short-lived sealed cookies for in-flight ceremonies, WebAuthn relying-party
 * derivation, backup-code generation/verification, and the login second-factor
 * check. Kept out of the `'use server'` action modules so non-async helpers can
 * be exported and reused.
 */

// Cookie names for the (short-lived, httpOnly) ceremony state.
export const TOTP_ENROLL_COOKIE = '1mr-totp-enroll';
export const WEBAUTHN_REG_COOKIE = '1mr-wa-reg';
export const WEBAUTHN_AUTH_COOKIE = '1mr-wa-auth';
export const TWOFA_PENDING_COOKIE = '1mr-2fa-pending';

/** Seal an object into an AES-GCM cookie with an embedded expiry. */
export async function setSealedCookie(name: string, data: Record<string, unknown>, ttlMs: number): Promise<void> {
  const sealed = encryptSecret(JSON.stringify({ ...data, exp: Date.now() + ttlMs }));
  (await cookies()).set(name, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.ceil(ttlMs / 1000),
  });
}

/** Read + validate a sealed cookie. Returns null if absent, tampered or expired. */
export async function readSealedCookie<T extends Record<string, unknown>>(name: string): Promise<T | null> {
  const raw = (await cookies()).get(name)?.value;
  if (!raw) return null;
  try {
    const obj = JSON.parse(decryptSecret(raw)) as T & { exp?: number };
    if (typeof obj.exp !== 'number' || obj.exp < Date.now()) return null;
    return obj;
  } catch {
    return null;
  }
}

export async function clearCookie(name: string): Promise<void> {
  (await cookies()).delete(name);
}

/**
 * The WebAuthn relying-party id + expected origin. Derived from the request host
 * (what the browser is actually on, so the ceremony matches), falling back to the
 * configured APP_URL when there is no host header.
 */
export async function rpInfo(): Promise<{ rpID: string; origin: string }> {
  const h = await headers();
  const appUrl = new URL(env.APP_URL);
  // Only honour forwarded headers when explicitly behind a trusted proxy (mirrors
  // getRequestContext()) — otherwise a direct client could spoof the rpID/origin.
  const trustProxy = process.env.TRUST_PROXY === 'true';
  const host = (trustProxy ? h.get('x-forwarded-host') : null) ?? h.get('host');
  if (host) {
    const hostname = host.split(':')[0]!;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    const fwdProto = trustProxy ? h.get('x-forwarded-proto') : null;
    // Scheme priority: trusted forwarded proto → the operator's APP_URL scheme when the
    // host matches it (so a plain-HTTP LAN/IP self-host derives http, not a broken
    // https) → http for localhost → https otherwise.
    const proto =
      fwdProto ?? (hostname === appUrl.hostname ? appUrl.protocol.replace(':', '') : isLocal ? 'http' : 'https');
    return { rpID: hostname, origin: `${proto}://${host}` };
  }
  return { rpID: appUrl.hostname, origin: appUrl.origin };
}

// Recovery-code alphabet: no 0/O/1/I/L to avoid transcription ambiguity.
const BACKUP_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** Ten single-use recovery codes, formatted `xxxx-xxxx` for readability. */
export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    // crypto.randomInt is rejection-sampled → no modulo bias across the 31-char alphabet.
    const raw = Array.from({ length: 8 }, () => BACKUP_ALPHABET[crypto.randomInt(0, BACKUP_ALPHABET.length)]).join('');
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
  });
}

/** Canonicalize a typed code (strip dashes/spaces, upper-case) before hashing. */
export function normalizeBackupCode(code: string): string {
  return code.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/**
 * Hash a recovery code for storage. HMAC-SHA256 keyed by APP_KEY (a "pepper"):
 * recovery codes carry only ~40 bits of entropy, so a bare unsalted hash would be
 * brute-forceable offline from a DB dump. The HMAC key lives in the environment,
 * never in the database, so an exfiltrated BackupCode table cannot be cracked
 * without also stealing APP_KEY. Deterministic, so the single-use claim stays a
 * direct indexed `where codeHash` lookup.
 */
export function hashBackupCode(code: string): string {
  return hmac(`bk:${normalizeBackupCode(code)}`);
}

/**
 * Legacy (pre-pepper) recovery-code hash — bare SHA-256. Still accepted at
 * verification time so codes minted before the pepper was introduced keep working
 * across an upgrade (golden rule); never used to write new codes.
 */
function legacyHashBackupCode(code: string): string {
  return sha256(normalizeBackupCode(code));
}

/** Whether password login must demand a second factor for this user. */
export function requiresSecondFactor(user: Pick<User, 'totpEnabledAt'>): boolean {
  return user.totpEnabledAt != null;
}

/** Verify a TOTP code only (no backup-code consumption) — used for re-auth. */
export async function verifyTotpForUser(userId: string, code: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecretEnc: true, totpEnabledAt: true, totpLastUsedStep: true },
  });
  if (!user?.totpEnabledAt || !user.totpSecretEnc) return false;
  let secret: string;
  try {
    secret = decryptSecret(user.totpSecretEnc);
  } catch (err) {
    // A decryption failure means APP_KEY changed/lost — log it, since otherwise every
    // user silently sees "invalid code" with no operational signal.
    logger.error({ err, userId }, '[2fa] TOTP secret could not be decrypted (APP_KEY rotated or lost?)');
    return false;
  }
  const step = verifyTotpStep(code, secret);
  if (step === null) return false;
  // Replay defence (RFC 6238 §5.2): only accept a step strictly newer than the last
  // one consumed. The conditional updateMany is atomic, so two concurrent submissions
  // of the same code race for the row and exactly one wins. A transient DB error must
  // fail the verification closed (return false), never throw a 500 into the login path.
  try {
    const claimed = await prisma.user.updateMany({
      where: { id: userId, OR: [{ totpLastUsedStep: null }, { totpLastUsedStep: { lt: BigInt(step) } }] },
      data: { totpLastUsedStep: BigInt(step) },
    });
    return claimed.count === 1;
  } catch (err) {
    logger.error({ err, userId }, '[2fa] TOTP replay-claim write failed');
    return false;
  }
}

/**
 * Verify a login second factor: a current TOTP code, or a single-use backup code
 * (consumed atomically). Returns which factor matched (for audit), or null on failure.
 */
export async function verifyUserSecondFactor(userId: string, code: string): Promise<'totp' | 'backup' | null> {
  if (await verifyTotpForUser(userId, code)) return 'totp';

  // Fall back to a recovery code. Atomic claim: only the first concurrent use of a
  // given code wins, and a code can be redeemed at most once. Match either the
  // peppered hash (new codes) or the legacy SHA-256 hash (codes from before the
  // pepper upgrade) so recovery keeps working across `./update.sh`.
  try {
    const claimed = await prisma.backupCode.updateMany({
      where: { userId, codeHash: { in: [hashBackupCode(code), legacyHashBackupCode(code)] }, usedAt: null },
      data: { usedAt: new Date() },
    });
    return claimed.count === 1 ? 'backup' : null;
  } catch (err) {
    logger.error({ err, userId }, '[2fa] backup-code claim write failed');
    return null;
  }
}

/** How many unused recovery codes remain. */
export async function remainingBackupCodes(userId: string): Promise<number> {
  return prisma.backupCode.count({ where: { userId, usedAt: null } });
}
