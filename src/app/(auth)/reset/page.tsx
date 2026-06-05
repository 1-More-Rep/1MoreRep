import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ResetForm } from '@/components/auth/ResetForm';

export default async function ResetPage() {
  const t = await getTranslations('auth');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.01em', margin: 0 }}>{t('resetPassword')}</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '6px 0 0' }}>
          {t('resetIntro')}
        </p>
      </div>
      <ResetForm />
      <div style={{ fontSize: 13, textAlign: 'center' }}>
        <Link href="/login" style={{ color: 'var(--text-2)', textDecoration: 'none' }}>
          {t('backToSignIn')}
        </Link>
      </div>
    </div>
  );
}
