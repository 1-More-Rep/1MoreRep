import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { TokenType } from '@prisma/client';
import { ConfirmForm } from '@/components/auth/ConfirmForm';
import { inspectToken } from '@/lib/auth/tokens';

const VALID = new Set<TokenType>(['LOGIN_LINK', 'INVITE', 'EMAIL_VERIFY', 'PASSWORD_RESET', 'EMAIL_CHANGE']);

const HEADING_KEYS: Record<string, { title: string; body: string }> = {
  LOGIN_LINK: { title: 'callbackLoginTitle', body: 'callbackLoginBody' },
  INVITE: { title: 'callbackInviteTitle', body: 'callbackInviteBody' },
  EMAIL_VERIFY: { title: 'callbackVerifyTitle', body: 'callbackVerifyBody' },
  PASSWORD_RESET: { title: 'callbackResetTitle', body: 'callbackResetBody' },
  EMAIL_CHANGE: { title: 'callbackEmailChangeTitle', body: 'callbackEmailChangeBody' },
};

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; token?: string }>;
}) {
  const { type = '', token = '' } = await searchParams;
  const isValidType = VALID.has(type as TokenType);
  // Peek (no consume) so we can show a friendly invalid-link message up front.
  const info = isValidType ? await inspectToken(type as TokenType, token) : { valid: false };
  const keys = HEADING_KEYS[type];
  const t = await getTranslations('auth');

  if (!isValidType || !info.valid || !keys) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{t('linkExpired')}</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>
          {t('linkExpiredBody')}
        </p>
        <Link href="/login" style={{ color: 'var(--accent-text)', fontWeight: 600, textDecoration: 'none' }}>
          {t('backToSignIn')}
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.01em', margin: 0 }}>{t(keys.title)}</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '6px 0 0' }}>{t(keys.body)}</p>
      </div>
      {/* GET only renders; this button POSTs to consume the single-use token. */}
      <ConfirmForm type={type} token={token} />
    </div>
  );
}
