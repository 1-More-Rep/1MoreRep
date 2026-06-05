import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { requireUser } from '@/lib/auth/guards';
import { getActiveSession } from '@/server/queries/sessions';
import { exName } from '@/lib/i18n/exercise';
import { ActiveWorkout, type ActiveSessionData } from '@/components/workout/ActiveWorkout';

export const dynamic = 'force-dynamic';

export default async function ActiveWorkoutPage() {
  const user = await requireUser();
  const locale = await getLocale();
  const session = await getActiveSession(user.id);
  if (!session) redirect('/app/workout/new');

  const data: ActiveSessionData = {
    id: session.id,
    name: session.name,
    startedAtMs: session.startedAt.getTime(),
    fromRoutine: !!session.routineId,
    entries: session.entries
      .filter((e) => !e.isRemoved)
      .map((e) => ({
        id: e.id,
        exerciseId: e.exerciseId,
        exerciseName: exName(e.exercise, locale),
        iconKey: e.exercise.iconKey,
        supersetGroup: e.supersetGroup,
        targetSets: e.targetSets,
        targetRepLow: e.targetRepLow,
        targetRepHigh: e.targetRepHigh,
        targetRestSec: e.targetRestSec,
        sets: e.sets.map((s) => ({ setIndex: s.setIndex, weightKg: s.weightKg, reps: s.reps, rpe: s.rpe, isWarmup: s.isWarmup, completed: s.completed })),
      })),
  };

  return <ActiveWorkout session={data} unitSystem={user.unitSystem} />;
}
