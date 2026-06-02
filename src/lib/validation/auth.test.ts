import { describe, it, expect } from 'vitest';
import { emailSchema, passwordSchema, handleSchema, registerSchema } from './auth';

describe('auth validation', () => {
  it('normalizes email (lowercase/trim)', () => {
    expect(emailSchema.parse('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });

  it('rejects invalid email', () => {
    expect(emailSchema.safeParse('nope').success).toBe(false);
  });

  it('enforces password length', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false);
    expect(passwordSchema.safeParse('longenough1').success).toBe(true);
  });

  it('handle allows only word chars within length', () => {
    expect(handleSchema.safeParse('valid_Handle1').success).toBe(true);
    expect(handleSchema.safeParse('has space').success).toBe(false);
    expect(handleSchema.safeParse('ab').success).toBe(false);
  });

  it('register schema parses a valid payload', () => {
    const r = registerSchema.safeParse({
      email: 'A@b.com',
      displayName: 'Alex',
      handle: 'alex',
      password: 'longenough1',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('a@b.com');
  });
});
