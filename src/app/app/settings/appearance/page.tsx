import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth/guards';
import { AppearanceControls } from '@/components/settings/AppearanceControls';
import { LanguageSelector } from '@/components/i18n/LanguageSelector';
import { Card, SectionLabel } from '@/components/ui';
import { isLocale, DEFAULT_LOCALE } from '@/i18n/config';

export const dynamic = 'force-dynamic';

export default async function AppearanceSettingsPage() {
  const user = await requireUser();
  const t = await getTranslations('appearance');
  const tn = await getTranslations('nav');
  const tl = await getTranslations('language');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', maxWidth: 520 }}>
      <Link href="/app/settings" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← {tn('settings')}</Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>{t('title')}</h1>
      <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>{t('intro')}</p>
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SectionLabel>{tl('title')}</SectionLabel>
        <div style={{ maxWidth: 240 }}>
          <LanguageSelector current={isLocale(user.locale) ? user.locale : DEFAULT_LOCALE} />
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{tl('subtitle')}</span>
      </Card>
      <AppearanceControls />
    </div>
  );
}
