import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth/guards';
import { Icon } from '@/components/ui/Icon';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const user = await requireUser();
  const t = await getTranslations('onboarding');
  // Completed users are never re-onboarded.
  if (user.onboardedAt) redirect('/app');
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--bg)', padding: 'var(--screen-pad)' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--gap)', paddingTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={{ width: 40, height: 40, borderRadius: 'var(--r-sm)', background: 'var(--accent)', color: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bolt" size={23} stroke={2.1} />
          </span>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', margin: 0 }}>{t('welcome', { name: user.displayName })}</h1>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{t('welcomeSub')}</div>
          </div>
        </div>
        <OnboardingFlow />
      </div>
    </main>
  );
}
