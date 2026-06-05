import Link from 'next/link';
import { requireUser } from '@/lib/auth/guards';
import { listRoutines, listArchivedRoutines } from '@/server/queries/routines';
import { startWorkoutAction } from '@/server/actions/workout';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Btn } from '@/components/ui/Btn';
import { Icon, Mono, SectionLabel } from '@/components/ui';
import { CreateRoutineForm } from '@/components/workout/CreateRoutineForm';
import { RoutineCardMenu } from '@/components/workout/RoutineCardMenu';

export const dynamic = 'force-dynamic';

export default async function WorkoutsPage() {
  const user = await requireUser();
  const [routines, archived] = await Promise.all([listRoutines(user.id), listArchivedRoutines(user.id)]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Workouts</h1>

      <Card>
        <SectionLabel style={{ marginBottom: 12 }}>Create routine</SectionLabel>
        <CreateRoutineForm />
      </Card>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionLabel>Your routines</SectionLabel>
        <form action={startWorkoutAction.bind(null, undefined)}>
          <Btn type="submit" kind="ghost" size="sm" icon="play">Empty workout</Btn>
        </form>
      </div>

      {routines.length === 0 && (
        <Card soft><span style={{ color: 'var(--text-3)' }}>No routines yet. Create one above, or start an empty workout.</span></Card>
      )}

      {routines.map((r) => (
        <Card key={r.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <Link href={`/app/workouts/${r.id}`} style={{ fontSize: 17, fontWeight: 700, textDecoration: 'none', color: 'var(--text)' }}>
                {r.name}
              </Link>
              <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 3 }}>
                {r.items.slice(0, 4).map((it) => it.exercise.name).join(' · ')}
                {r.items.length > 4 ? ` +${r.items.length - 4}` : ''}
              </div>
            </div>
            <Chip><Mono>{r._count.items}</Mono>&nbsp;exercises</Chip>
            {r.goal && <Chip accent>{r.goal.toLowerCase()}</Chip>}
            <div style={{ display: 'flex', gap: 8 }}>
              <form action={startWorkoutAction.bind(null, r.id)}><Btn type="submit" size="sm" icon="play">Start</Btn></form>
              <RoutineCardMenu routineId={r.id} name={r.name} />
            </div>
          </div>
        </Card>
      ))}

      {archived.length > 0 && (
        <Link
          href="/app/workouts/archived"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}
        >
          <Icon name="history" size={15} stroke={1.8} /> Archived routines ({archived.length})
        </Link>
      )}
    </div>
  );
}
