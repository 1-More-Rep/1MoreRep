import { hash, verify } from '@node-rs/argon2';

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
  } catch {
    return false;
  }
}
