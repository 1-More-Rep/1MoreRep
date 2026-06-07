import { hash, verify } from '@node-rs/argon2';
import { logger } from '@/lib/logger';

// argon2id parameters (OWASP baseline; tune memoryCost up if the host allows).
const OPTS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
  algorithm: 2, // argon2id
} as const;

/** Hash a plaintext password with argon2id (per-hash random salt). */
export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTS);
}

/** Verify a password against a stored hash. Never throws on mismatch. */
export async function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(storedHash, plain, OPTS);
  } catch (err) {
    // verify() rejects on a malformed/foreign hash, not on a normal mismatch (that
    // returns false). Treat it as a failed login, but log it — a systemic hash-format
    // problem would otherwise masquerade as everyone suddenly having the wrong password.
    logger.warn({ err }, '[auth] argon2 verify threw (malformed stored hash?) — treating as failure');
    return false;
  }
}
