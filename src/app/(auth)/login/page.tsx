import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { LoginForm } from '@/components/auth/LoginForm';
import { TwoFactorForm } from '@/components/auth/TwoFactorForm';
import { Alert } from '@/components/auth/ui';
import { getSettings } from '@/lib/settings';
import { getCurrentUser } from '@/lib/auth/guards';
import { readSealedCookie, TWOFA_PENDING_COOKIE } from '@/lib/auth/twofactor';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; next?: string; mfa?: string }>;
}) {
  if (await getCurrentUser()) redirect('/app');
  const sp = await searchParams;
  const settings = await getSettings();
  const t = await getTranslations('auth');

  // Magic-link / password-reset landing for a 2FA-enabled account: the token was
  // already consumed and a pending cookie sealed; demand the second factor here
  // before any session is created. Only honoured when that pending cookie exists.
  const mfaPending = sp.mfa === '1' && (await readSealedCookie<{ userId: string }>(TWOFA_PENDING_COOKIE)) !== null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.01em', margin: 0 }}>{t('signIn')}</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '6px 0 0' }}>{t('welcomeBack')}</p>
      </div>

      {sp.verified && <Alert kind="notice">{t('emailVerifiedSignIn')}</Alert>}

      {mfaPending ? <TwoFactorForm /> : <LoginForm />}

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
        <Link href="/reset" style={{ color: 'var(--text-2)', textDecoration: 'none' }}>
          {t('forgotPassword')}
        </Link>
        {settings.allowSelfRegistration && (
          <Link href="/register" style={{ color: 'var(--accent-text)', textDecoration: 'none', fontWeight: 600 }}>
            {t('createAccount')}
          </Link>
        )}
      </div>
    </div>
  );
}
