import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/server/db/prisma';
import { computeAndCacheFatigue } from '@/server/services/fatigueService';
import { weeklyVolumeByMuscle } from '@/server/services/generatorService';
import { computeMuscleStrength } from '@/server/services/strengthService';
import { LANDMARKS } from '@/domain/generator/landmarks';
import { MUSCLES, type Muscle } from '@/domain/muscles/taxonomy';
import { MuscleOverview, type MuscleInfo } from '@/components/body-map/MuscleOverview';

export const dynamic = 'force-dynamic';

export default async function MusclePage() {
  const user = await requireUser();
  const fatigue = await computeAndCacheFatigue(user.id);
  const weeklyVolume = await weeklyVolumeByMuscle(user.id, new Date());
  const { bodyweightKg, byMuscle: strength } = await computeMuscleStrength(user.id, user.sex);

  const data = {} as Record<Muscle, MuscleInfo>;
  for (const m of MUSCLES) {
    data[m] = {
      fatigue: fatigue[m].fatigue,
      recoveryEtaHours: fatigue[m].recoveryEtaHours,
      weeklyVolume: weeklyVolume[m],
      landmarks: LANDMARKS[m],
    };
  }

  // Top exercises per muscle (primary), relevance-ranked by muscle-link weight.
  const exercises = await prisma.exercise.findMany({
    where: { ownerId: null, muscleLinks: { some: { role: 'PRIMARY' } } },
    include: { muscleLinks: { where: { role: 'PRIMARY' } } },
    take: 400,
  });
  const ranked: Record<string, { id: string; name: string; weight: number }[]> = {};
  for (const ex of exercises) {
    for (const link of ex.muscleLinks) {
      (ranked[link.muscle] ??= []).push({ id: ex.id, name: ex.name, weight: link.weight });
    }
  }
  const topExercises: Record<string, { id: string; name: string }[]> = {};
  for (const [muscle, list] of Object.entries(ranked)) {
    topExercises[muscle] = list
      .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name))
      .map(({ id, name }) => ({ id, name }));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Muscles</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '6px 0 0' }}>
          Recovery shows fatigue from recent training; Strength shows your level per muscle from your lifts.
        </p>
      </div>
      <MuscleOverview data={data} strength={strength} bodyweightKg={bodyweightKg} topExercises={topExercises} />
    </div>
  );
}
