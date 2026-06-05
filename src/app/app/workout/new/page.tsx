import { getTranslations, getLocale } from 'next-intl/server';
import { requireUser } from '@/lib/auth/guards';
import { exName } from '@/lib/i18n/exercise';
import { listRoutines } from '@/server/queries/routines';
import { getActiveSession } from '@/server/queries/sessions';
import { startWorkoutAction } from '@/server/actions/workout';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Btn } from '@/components/ui/Btn';
import { Mono, SectionLabel } from '@/components/ui/typography';

export const dynamic = 'force-dynamic';

export default async function NewWorkoutPage() {
  const user = await requireUser();
  const t = await getTranslations('workout');
  const locale = await getLocale();
  const [routines, active] = await Promise.all([listRoutines(user.id), getActiveSession(user.id)]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>{t('startTitle')}</h1>

      {active && (
        <Card style={{ borderColor: 'var(--accent-line)' }}>
          <SectionLabel style={{ marginBottom: 8 }}>{t('inProgress')}</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{active.name ?? t('activeWorkout')}</div>
            <Link href="/app/workout/active" style={{ textDecoration: 'none' }}><Btn icon="play">{t('resume')}</Btn></Link>
          </div>
        </Card>
      )}

      <Link href="/app/workout/generate" style={{ textDecoration: 'none' }}>
        <Btn full size="lg" icon="bolt">{t('generateAWorkout')}</Btn>
      </Link>

      <form action={startWorkoutAction.bind(null, undefined)}>
        <Btn type="submit" kind="soft" full size="lg" icon="plus">{t('emptyWorkout')}</Btn>
      </form>

      <SectionLabel>{t('fromARoutine')}</SectionLabel>
      {routines.length === 0 && <Card soft><span style={{ color: 'var(--text-3)' }}>{t('noRoutinesYet')}</span></Card>}
      {routines.map((r) => (
        <form key={r.id} action={startWorkoutAction.bind(null, r.id)}>
          <Card style={{ cursor: 'pointer' }}>
            <button type="submit" style={{ all: 'unset', display: 'flex', width: '100%', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{r.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{r.items.slice(0, 4).map((it) => exName(it.exercise, locale)).join(' · ')}</div>
              </div>
              <Mono style={{ fontSize: 13, color: 'var(--text-3)' }}>{t('exerciseCount', { count: r._count.items })}</Mono>
            </button>
          </Card>
        </form>
      ))}
    </div>
  );
}
