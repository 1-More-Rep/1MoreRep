import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/guards';
import { getRoutine } from '@/server/queries/routines';
import { startWorkoutAction } from '@/server/actions/workout';
import { Btn } from '@/components/ui/Btn';
import { Card } from '@/components/ui/Card';
import { RoutineEditor } from '@/components/workout/RoutineEditor';
import { RoutineHeaderEditor } from '@/components/workout/RoutineHeaderEditor';
import { ArchiveRoutineButton } from '@/components/workout/ArchiveRoutineButton';

export const dynamic = 'force-dynamic';

type GoalValue = '' | 'HYPERTROPHY' | 'STRENGTH' | 'ENDURANCE' | 'GENERAL';

export default async function RoutineEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const routine = await getRoutine(id, user.id);
  if (!routine) notFound();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Link href="/app/workouts" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← Workouts</Link>
        <form action={startWorkoutAction.bind(null, routine.id)}>
          <Btn type="submit" icon="play">Start workout</Btn>
        </form>
      </div>

      <Card>
        <RoutineHeaderEditor
          routineId={routine.id}
          name={routine.name}
          goal={(routine.goal ?? '') as GoalValue}
          notes={routine.notes ?? ''}
        />
      </Card>

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

      <div style={{ marginTop: 20 }}>
        <ArchiveRoutineButton routineId={routine.id} name={routine.name} />
      </div>
    </div>
  );
}
