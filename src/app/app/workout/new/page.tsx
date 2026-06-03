import { requireUser } from '@/lib/auth/guards';
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
  const [routines, active] = await Promise.all([listRoutines(user.id), getActiveSession(user.id)]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Start a workout</h1>

      {active && (
        <Card style={{ borderColor: 'var(--accent-line)' }}>
          <SectionLabel style={{ marginBottom: 8 }}>In progress</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{active.name ?? 'Active workout'}</div>
            <Link href="/app/workout/active" style={{ textDecoration: 'none' }}><Btn icon="play">Resume</Btn></Link>
          </div>
        </Card>
      )}

      <form action={startWorkoutAction.bind(null, undefined)}>
        <Btn type="submit" kind="soft" full size="lg" icon="plus">Empty workout</Btn>
      </form>

      <SectionLabel>From a routine</SectionLabel>
      {routines.length === 0 && <Card soft><span style={{ color: 'var(--text-3)' }}>No routines yet.</span></Card>}
      {routines.map((r) => (
        <form key={r.id} action={startWorkoutAction.bind(null, r.id)}>
          <Card style={{ cursor: 'pointer' }}>
            <button type="submit" style={{ all: 'unset', display: 'flex', width: '100%', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{r.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{r.items.slice(0, 4).map((it) => it.exercise.name).join(' · ')}</div>
              </div>
              <Mono style={{ fontSize: 13, color: 'var(--text-3)' }}>{r._count.items} ex</Mono>
            </button>
          </Card>
        </form>
      ))}
    </div>
  );
}
