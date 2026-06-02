import Link from 'next/link';
import type { TokenType } from '@prisma/client';
import { ConfirmForm } from '@/components/auth/ConfirmForm';
import { inspectToken } from '@/lib/auth/tokens';

const VALID = new Set<TokenType>(['LOGIN_LINK', 'INVITE', 'EMAIL_VERIFY', 'PASSWORD_RESET', 'EMAIL_CHANGE']);

const HEADING: Record<string, { title: string; body: string }> = {
  LOGIN_LINK: { title: 'Sign in', body: 'Confirm to sign in to your account.' },
  INVITE: { title: 'Accept your invite', body: 'Confirm to activate your account.' },
  EMAIL_VERIFY: { title: 'Verify your email', body: 'Confirm to verify this email address.' },
  PASSWORD_RESET: { title: 'Reset password', body: 'Confirm to continue and set a new password.' },
  EMAIL_CHANGE: { title: 'Confirm email change', body: 'Confirm to update your account email.' },
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
  const copy = HEADING[type];

  if (!isValidType || !info.valid || !copy) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Link expired</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>
          This link is invalid or has already been used. Request a new one.
        </p>
        <Link href="/login" style={{ color: 'var(--accent-text)', fontWeight: 600, textDecoration: 'none' }}>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.01em', margin: 0 }}>{copy.title}</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '6px 0 0' }}>{copy.body}</p>
      </div>
      {/* GET only renders; this button POSTs to consume the single-use token. */}
      <ConfirmForm type={type} token={token} />
    </div>
  );
}
