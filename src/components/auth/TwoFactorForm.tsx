'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { verifyTwoFactorAction, type ActionState } from '@/server/actions/auth';
import { TextField, Alert, SubmitBtn } from './ui';

const initial: ActionState = {};

/**
 * The second-factor (authenticator-app / backup-code) entry step. Bound to
 * `verifyTwoFactorAction`, which reads the sealed `TWOFA_PENDING` cookie — so this
 * works both inline after a password login and standalone on `/login?mfa=1` after a
 * magic-link / password-reset link is consumed by a 2FA-enabled account.
 */
export function TwoFactorForm() {
  const t = useTranslations('auth');
  const [state, action] = useActionState(verifyTwoFactorAction, initial);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>{t('twoFactorPrompt')}</p>
      <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Alert kind="error">{state.error}</Alert>
        {/* inputMode="text": the field also accepts an alphanumeric backup code,
            which a numeric-only mobile keypad cannot type. */}
        <TextField
          label={t('twoFactorCode')}
          name="code"
          autoComplete="one-time-code"
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          placeholder="123456"
          autoFocus
          required
        />
        <SubmitBtn icon="check">{t('verify')}</SubmitBtn>
      </form>
      <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: 0 }}>{t('twoFactorBackupHint')}</p>
      {/* Escape hatch if the sealed pending cookie expired or this is the wrong account. */}
      <Link href="/login" style={{ fontSize: 12.5, color: 'var(--text-2)', textDecoration: 'none', alignSelf: 'flex-start' }}>
        {t('backToSignIn')}
      </Link>
    </div>
  );
}
