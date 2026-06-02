import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret, sha256, hmacIp, randomToken, timingSafeEqualHex } from './crypto';

describe('crypto', () => {
  it('encrypts and decrypts round-trip', () => {
    const plain = 'super-secret-smtp-password!';
    const enc = encryptSecret(plain);
    expect(enc).not.toContain(plain);
    expect(enc.split(':')).toHaveLength(3);
    expect(decryptSecret(enc)).toBe(plain);
  });

  it('produces distinct ciphertexts for the same input (random IV)', () => {
    expect(encryptSecret('x')).not.toBe(encryptSecret('x'));
  });

  it('fails to decrypt tampered ciphertext', () => {
    const enc = encryptSecret('data');
    const [iv, tag] = enc.split(':');
    const tampered = [iv, tag, Buffer.from('zzzz').toString('base64')].join(':');
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('sha256 is deterministic and hmacIp differs from sha256', () => {
    expect(sha256('a')).toBe(sha256('a'));
    expect(hmacIp('1.2.3.4')).not.toBe(sha256('1.2.3.4'));
  });

  it('randomToken is url-safe and unique', () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('timingSafeEqualHex compares correctly', () => {
    const h = sha256('hello');
    expect(timingSafeEqualHex(h, h)).toBe(true);
    expect(timingSafeEqualHex(h, sha256('world'))).toBe(false);
    expect(timingSafeEqualHex('', '')).toBe(false);
  });
});
