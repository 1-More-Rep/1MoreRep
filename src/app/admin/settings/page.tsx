import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/guards';
import { getSettings } from '@/lib/settings';
import { GeneralForm, BrandingForm, SmtpForm, LlmForm } from '@/components/admin/SettingsForms';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const actor = await getCurrentUser();
  if (actor?.role !== 'SUPERADMIN') redirect('/admin');
  const settings = await getSettings();
  const t = await getTranslations('admin');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t('instanceSettingsTitle')}</h1>
      <GeneralForm s={settings} />
      <BrandingForm s={settings} />
      <SmtpForm s={settings} />
      <LlmForm s={settings} />
    </div>
  );
}
