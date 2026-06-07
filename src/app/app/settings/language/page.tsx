import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth/guards';
import { LanguageSelector } from '@/components/i18n/LanguageSelector';
import { Card, SectionLabel } from '@/components/ui';
import { isLocale, DEFAULT_LOCALE } from '@/i18n/config';

export const dynamic = 'force-dynamic';

export default async function LanguageSettingsPage() {
  const user = await requireUser();
  const tn = await getTranslations('nav');
  const tl = await getTranslations('language');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', maxWidth: 520 }}>
      <Link href="/app/settings" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← {tn('settings')}</Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>{tl('title')}</h1>
      <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>{tl('subtitle')}</p>
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SectionLabel>{tl('title')}</SectionLabel>
        <div style={{ maxWidth: 240 }}>
          <LanguageSelector current={isLocale(user.locale) ? user.locale : DEFAULT_LOCALE} />
        </div>
      </Card>
    </div>
  );
}
