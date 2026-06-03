import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/guards';
import { getRoutine } from '@/server/queries/routines';
import { startWorkoutAction } from '@/server/actions/workout';
import { deleteRoutineAction } from '@/server/actions/routines';
import { Btn } from '@/components/ui/Btn';
import { Chip } from '@/components/ui/Chip';
import { RoutineEditor } from '@/components/workout/RoutineEditor';

export const dynamic = 'force-dynamic';

export default async function RoutineEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const routine = await getRoutine(id, user.id);
  if (!routine) notFound();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <Link href="/app/workouts" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← Workouts</Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0, flex: '1 1 auto' }}>{routine.name}</h1>
        {routine.goal && <Chip accent>{routine.goal.toLowerCase()}</Chip>}
        <form action={startWorkoutAction.bind(null, routine.id)}>
          <Btn type="submit" icon="play">Start workout</Btn>
        </form>
      </div>

      <RoutineEditor
        routineId={routine.id}
        items={routine.items.map((it) => ({
          id: it.id,
          exerciseName: it.exercise.name,
          supersetGroup: it.supersetGroup,
          targetSets: it.targetSets,
          targetRepLow: it.targetRepLow,
          targetRepHigh: it.targetRepHigh,
          targetRestSec: it.targetRestSec,
        }))}
      />

      <form action={deleteRoutineAction.bind(null, routine.id)} style={{ marginTop: 20 }}>
        <Btn type="submit" kind="ghost" size="sm" icon="x">Delete routine</Btn>
      </form>
    </div>
  );
}
