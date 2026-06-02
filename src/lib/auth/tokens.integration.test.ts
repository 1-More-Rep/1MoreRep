import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { issueToken, consumeToken, inspectToken } from './tokens';

// Runs only when a migrated database is reachable (local dev DB / CI service).
let dbReachable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbReachable = true;
} catch {
  dbReachable = false;
}

const d = dbReachable ? describe : describe.skip;

d('AuthToken lifecycle (DB)', () => {
  let userId: string;

  beforeAll(async () => {
    const u = await prisma.user.create({
      data: { email: `tok-${Date.now()}@test.local`, displayName: 'Tok Test', status: 'ACTIVE' },
    });
    userId = u.id;
  });

  afterAll(async () => {
    await prisma.authToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it('issues a token whose raw value is not stored', async () => {
    const { rawToken } = await issueToken('LOGIN_LINK', userId);
    const row = await prisma.authToken.findFirst({ where: { userId, type: 'LOGIN_LINK' } });
    expect(row).toBeTruthy();
    expect(row!.hashedToken).not.toBe(rawToken);
  });

  it('consumes once; a second consume fails', async () => {
    const { rawToken } = await issueToken('EMAIL_VERIFY', userId);
    const first = await consumeToken('EMAIL_VERIFY', rawToken);
    expect(first?.userId).toBe(userId);
    expect(await consumeToken('EMAIL_VERIFY', rawToken)).toBeNull();
  });

  it('rejects wrong type and unknown token', async () => {
    const { rawToken } = await issueToken('PASSWORD_RESET', userId);
    expect(await consumeToken('LOGIN_LINK', rawToken)).toBeNull(); // wrong type
    expect(await consumeToken('PASSWORD_RESET', 'bogus')).toBeNull();
    // original still valid (wrong-type attempt didn't consume it)
    expect(await consumeToken('PASSWORD_RESET', rawToken)).not.toBeNull();
  });

  it('rejects an expired token', async () => {
    const { rawToken } = await issueToken('LOGIN_LINK', userId);
    await prisma.authToken.updateMany({
      where: { userId, type: 'LOGIN_LINK', consumedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await consumeToken('LOGIN_LINK', rawToken)).toBeNull();
  });

  it('invalidates prior unconsumed tokens of the same type', async () => {
    const a = await issueToken('LOGIN_LINK', userId);
    const b = await issueToken('LOGIN_LINK', userId); // should delete a
    expect(await consumeToken('LOGIN_LINK', a.rawToken)).toBeNull();
    expect(await consumeToken('LOGIN_LINK', b.rawToken)).not.toBeNull();
  });

  it('is race-safe: concurrent consumes yield exactly one winner', async () => {
    const { rawToken } = await issueToken('EMAIL_VERIFY', userId);
    const results = await Promise.all([
      consumeToken('EMAIL_VERIFY', rawToken),
      consumeToken('EMAIL_VERIFY', rawToken),
      consumeToken('EMAIL_VERIFY', rawToken),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('inspectToken does not consume', async () => {
    const { rawToken } = await issueToken('PASSWORD_RESET', userId);
    expect((await inspectToken('PASSWORD_RESET', rawToken)).valid).toBe(true);
    // still consumable afterwards
    expect(await consumeToken('PASSWORD_RESET', rawToken)).not.toBeNull();
  });
});
