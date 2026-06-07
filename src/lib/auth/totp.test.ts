import { describe, it, expect } from 'vitest';
import { base32Encode, base32Decode, generateTotpSecret, verifyTotp, verifyTotpStep, totpAuthUri } from './totp';

// RFC 6238 Appendix B reference secret: ASCII "12345678901234567890".
const RFC_SECRET = Buffer.from('12345678901234567890', 'ascii');
const RFC_SECRET_B32 = base32Encode(RFC_SECRET);

describe('base32', () => {
  it('round-trips arbitrary bytes', () => {
    const buf = Buffer.from([0, 1, 2, 250, 99, 7, 200, 17, 19]);
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
  });
  it('tolerates lowercase, spaces and padding', () => {
    const enc = base32Encode(RFC_SECRET);
    const messy = (enc.toLowerCase().match(/.{1,4}/g) ?? []).join(' ') + '==';
    expect(base32Decode(messy).equals(RFC_SECRET)).toBe(true);
  });
});

describe('verifyTotp', () => {
  // RFC 6238 SHA-1 vectors → low 6 digits of the published 8-digit codes.
  it('accepts the RFC 6238 reference codes at their timestamps', () => {
    expect(verifyTotp('287082', RFC_SECRET_B32, { at: 59_000, window: 0 })).toBe(true);
    expect(verifyTotp('081804', RFC_SECRET_B32, { at: 1_111_111_109_000, window: 0 })).toBe(true);
    expect(verifyTotp('005924', RFC_SECRET_B32, { at: 1_234_567_890_000, window: 0 })).toBe(true);
  });
  it('rejects a wrong code', () => {
    expect(verifyTotp('000000', RFC_SECRET_B32, { at: 59_000 })).toBe(false);
  });
  it('honours the drift window', () => {
    // 287082 is valid at t=59s (step 1); at t=120s (step 4) it is 3 steps away.
    expect(verifyTotp('287082', RFC_SECRET_B32, { at: 120_000, window: 1 })).toBe(false);
    // one step earlier (t≈89s, step 2) it is within ±1 of step 1.
    expect(verifyTotp('287082', RFC_SECRET_B32, { at: 89_000, window: 1 })).toBe(true);
  });
  it('ignores spaces in the entered token', () => {
    expect(verifyTotp('287 082', RFC_SECRET_B32, { at: 59_000, window: 0 })).toBe(true);
  });
});

describe('verifyTotpStep (replay tracking)', () => {
  it('returns the matched RFC 6238 time-step for a valid code', () => {
    // t=59s, period 30s → step 1.
    expect(verifyTotpStep('287082', RFC_SECRET_B32, { at: 59_000, window: 0 })).toBe(1);
    // t=1111111109s → step 37037036.
    expect(verifyTotpStep('081804', RFC_SECRET_B32, { at: 1_111_111_109_000, window: 0 })).toBe(37037036);
  });
  it('returns null for a wrong code', () => {
    expect(verifyTotpStep('000000', RFC_SECRET_B32, { at: 59_000 })).toBeNull();
  });
  it('returns a monotonically increasing step as time advances (enables replay rejection)', () => {
    const earlier = verifyTotpStep('287082', RFC_SECRET_B32, { at: 59_000, window: 0 });
    // The same step value re-derived later is what a caller compares against its stored
    // last-used step to reject reuse; later valid codes map to strictly greater steps.
    expect(earlier).not.toBeNull();
    expect(verifyTotpStep('005924', RFC_SECRET_B32, { at: 1_234_567_890_000, window: 0 })!).toBeGreaterThan(earlier!);
  });
});

describe('generateTotpSecret', () => {
  it('produces a decodable 160-bit secret', () => {
    const s = generateTotpSecret();
    expect(base32Decode(s).length).toBe(20);
  });
});

describe('totpAuthUri', () => {
  it('encodes issuer, account and secret', () => {
    const uri = totpAuthUri('JBSWY3DPEHPK3PXP', 'a@b.com', '1MoreRep');
    expect(uri.startsWith('otpauth://totp/1MoreRep:a%40b.com?')).toBe(true);
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(uri).toContain('issuer=1MoreRep');
  });
});
