import crypto from 'node:crypto';
import { env } from './env';

/**
 * App-wide cryptography helpers.
 * - AES-256-GCM for secrets-at-rest (SMTP/LLM/VAPID private keys in the DB)
 * - SHA-256 for token-at-rest hashing
 * - HMAC for privacy-preserving IP fingerprints
 * - constant-time comparisons
 *
 * The key is derived from APP_KEY (base64 32 bytes). In production APP_KEY is
 * mandatory; in dev/test a stable insecure key is used so the app runs without
 * install.sh (never used to protect real data).
 */
function deriveKey(): Buffer {
  const raw = env.APP_KEY;
  if (raw) {
    const buf = Buffer.from(raw, 'base64');
    if (buf.length === 32) return buf;
    // Any other form (hex/utf8/short) is hashed to a stable 32-byte key.
    return crypto.createHash('sha256').update(raw).digest();
  }
  if (env.NODE_ENV === 'production') {
    throw new Error('APP_KEY is required in production');
  }
  return crypto.createHash('sha256').update('1morerep-dev-insecure-key').digest();
}

// Derived lazily so `next build` (NODE_ENV=production, no APP_KEY yet) doesn't
// throw at import time; validation happens on first real use at runtime.
let cachedKey: Buffer | null = null;
function key(): Buffer {
  if (!cachedKey) cachedKey = deriveKey();
  return cachedKey;
}

/** Encrypt a UTF-8 string. Returns `iv:tag:ciphertext` (all base64). */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

/** Decrypt a value produced by {@link encryptSecret}. Throws on tamper. */
export function decryptSecret(enc: string): string {
  const [ivB, tagB, ctB] = enc.split(':');
  if (!ivB || !tagB || !ctB) throw new Error('malformed ciphertext');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB, 'base64')), decipher.final()]).toString('utf8');
}

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/** Keyed hash for IPs — correlate abuse without storing PII. */
export function hmacIp(ip: string): string {
  return crypto.createHmac('sha256', key()).update(ip).digest('hex');
}

/** URL-safe random token with `bytes` of entropy (default 256 bits). */
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Random opaque id (for session ids). */
export function randomId(bytes = 24): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Constant-time equality of two hex strings. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ab.length !== bb.length || ab.length === 0) return false;
  return crypto.timingSafeEqual(ab, bb);
}
