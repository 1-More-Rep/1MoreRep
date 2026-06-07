import crypto from 'node:crypto';

/**
 * RFC 6238 TOTP (and RFC 4226 HOTP underneath) — the authenticator-app second
 * factor. Implemented on node:crypto so there is no third-party dependency in the
 * critical auth path. Defaults match what Google Authenticator / Aegis / 1Password
 * expect: SHA-1, 6 digits, 30-second period.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; // RFC 4648, no padding

// Single source of truth for the TOTP parameters: the otpauth:// URI we hand to the
// authenticator app and the verifier MUST agree, or codes never match. Changing one
// here changes both.
export const TOTP_PERIOD = 30; // seconds per step
export const TOTP_DIGITS = 6;
export const TOTP_ALGORITHM = 'SHA1';
// node:crypto hash name for TOTP_ALGORITHM — derived from the single source of
// truth above so the otpauth:// URI and the verifier can never drift apart.
const HMAC_HASH = TOTP_ALGORITHM.toLowerCase();

/** Encode bytes as unpadded base32 (the format authenticator apps consume). */
export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** Decode an (optionally spaced/lower-cased/padded) base32 string back to bytes. */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue; // skip stray characters
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A fresh, random base32 TOTP secret (160 bits — the RFC-recommended size). */
export function generateTotpSecret(bytes = 20): string {
  return base32Encode(crypto.randomBytes(bytes));
}

function hotp(secret: Buffer, counter: number, digits: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac(HMAC_HASH, secret).update(msg).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const bin =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return (bin % 10 ** digits).toString().padStart(digits, '0');
}

export interface TotpOptions {
  period?: number;
  digits?: number;
  /** Allowed clock-drift steps on each side (default ±1 = ±30s). */
  window?: number;
  /** Override the current time (epoch ms) — for tests only. */
  at?: number;
}

/**
 * Verify a user-entered token against a base32 secret, allowing a small drift
 * window. Returns the matched RFC 6238 time-step (counter) on success, or null on
 * failure. Constant-time comparison per candidate step. Callers that need replay
 * protection persist the returned step and reject any step <= the last accepted one.
 */
export function verifyTotpStep(token: string, secretBase32: string, opts: TotpOptions = {}): number | null {
  const period = opts.period ?? TOTP_PERIOD;
  const digits = opts.digits ?? TOTP_DIGITS;
  const window = opts.window ?? 1;
  const cleaned = token.replace(/\D/g, '');
  if (cleaned.length !== digits) return null;

  const secret = base32Decode(secretBase32);
  if (secret.length === 0) return null;
  const counter = Math.floor((opts.at ?? Date.now()) / 1000 / period);
  const given = Buffer.from(cleaned);
  for (let i = -window; i <= window; i++) {
    const expected = Buffer.from(hotp(secret, counter + i, digits));
    if (expected.length === given.length && crypto.timingSafeEqual(expected, given)) return counter + i;
  }
  return null;
}

/** Boolean convenience wrapper around {@link verifyTotpStep} (no replay tracking). */
export function verifyTotp(token: string, secretBase32: string, opts: TotpOptions = {}): boolean {
  return verifyTotpStep(token, secretBase32, opts) !== null;
}

/** Build the otpauth:// URI an authenticator app reads from the QR code. */
export function totpAuthUri(secretBase32: string, account: string, issuer: string): string {
  // Keep the issuer:account separator a literal colon (the conventional otpauth
  // label form); only the parts themselves are percent-encoded.
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: TOTP_ALGORITHM,
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
