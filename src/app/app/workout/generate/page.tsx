import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth/guards';
import { GeneratorFlow } from '@/components/workout/GeneratorFlow';
import type { GenGoal } from '@/domain/generator/types';

export const dynamic = 'force-dynamic';

const GOALS: GenGoal[] = ['HYPERTROPHY', 'STRENGTH', 'ENDURANCE', 'GENERAL'];

export default async function GenerateWorkoutPage({ searchParams }: { searchParams: Promise<{ goal?: string }> }) {
  const user = await requireUser();
  const t = await getTranslations('workout');
  const { goal } = await searchParams;
  // Seed the goal from the onboarding hand-off (?goal=) or the user's saved primary goal.
  const initialGoal = (GOALS.includes(goal as GenGoal) ? (goal as GenGoal) : (user.primaryGoal as GenGoal | null)) ?? undefined;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', maxWidth: 560 }}>
      <Link href="/app/workout/new" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>{t('backToStart')}</Link>{/* unitSystem drives load-suggestion display */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>{t('generateTitle')}</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '6px 0 0' }}>
          {t('generateSubtitle')}
        </p>
      </div>
      <GeneratorFlow initialGoal={initialGoal} unitSystem={user.unitSystem} />
    </div>
  );
}
