import 'server-only';
import { prisma } from '@/server/db/prisma';
import { computeFatigue, sessionMuscleStimulus, type EntryInput, type MuscleFatigue, type SorenessInput, type SessionStimulus } from '@/domain/fatigue/model';
import { LOOKBACK_DAYS, SORENESS_LOOKBACK_HOURS } from '@/domain/fatigue/constants';
import { MUSCLES, type Muscle } from '@/domain/muscles/taxonomy';

const HOUR = 3600_000;

/**
 * Compute per-muscle fatigue from the trailing window of completed sessions +
 * recent soreness reports. Persists a snapshot cache (rebuildable any time) and
 * returns the fatigue map. `now` is injectable for tests.
 */
export async function computeAndCacheFatigue(userId: string, now: Date = new Date()): Promise<Record<Muscle, MuscleFatigue>> {
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 24 * HOUR);

  const sessionsRaw = await prisma.workoutSession.findMany({
    where: { ownerId: userId, status: 'COMPLETED', completedAt: { gte: since } },
    include: {
      entries: {
        where: { isRemoved: false },
        include: { exercise: { include: { muscleLinks: true } }, sets: true },
      },
    },
  });

  const sessions: SessionStimulus[] = sessionsRaw.map((s) => {
    const entries: EntryInput[] = s.entries.map((e) => ({
      muscleWeights: e.exercise.muscleLinks.map((m) => ({ muscle: m.muscle, weight: m.weight })),
      sets: e.sets.map((st) => ({
        weightKg: st.weightKg,
        reps: st.reps,
        rpe: st.rpe,
        rir: st.rir,
        isWarmup: st.isWarmup,
        completed: st.completed,
        bodyweightKg: s.bodyweightKg,
      })),
    }));
    const ageHours = Math.max(0, (now.getTime() - (s.completedAt ?? s.startedAt).getTime()) / HOUR);
    return { ageHours, perMuscle: sessionMuscleStimulus(entries) };
  });

  const sorenessRaw = await prisma.sorenessReport.findMany({
    where: { ownerId: userId, reportedAt: { gte: new Date(now.getTime() - SORENESS_LOOKBACK_HOURS * HOUR) } },
  });
  const soreness: SorenessInput[] = sorenessRaw.map((r) => ({
    muscle: r.muscle,
    severity: r.severity,
    ageHours: Math.max(0, (now.getTime() - r.reportedAt.getTime()) / HOUR),
  }));

  const fatigue = computeFatigue(sessions, soreness);

  // Persist snapshot cache (one row per muscle).
  await prisma.$transaction(
    MUSCLES.map((m) =>
      prisma.muscleFatigueSnapshot.upsert({
        where: { ownerId_muscle: { ownerId: userId, muscle: m } },
        update: { fatigue: fatigue[m].fatigue, recoveryEtaAt: etaToDate(now, fatigue[m].recoveryEtaHours), computedAt: now },
        create: { ownerId: userId, muscle: m, fatigue: fatigue[m].fatigue, recoveryEtaAt: etaToDate(now, fatigue[m].recoveryEtaHours), computedAt: now },
      }),
    ),
  );

  return fatigue;
}

function etaToDate(now: Date, hours: number): Date | null {
  return hours > 0 ? new Date(now.getTime() + hours * HOUR) : null;
}

/** Convenience: per-muscle fatigue number (0..1) for the body map. */
export async function getFatigueByMuscle(userId: string, now: Date = new Date()): Promise<Record<Muscle, number>> {
  const f = await computeAndCacheFatigue(userId, now);
  const out = {} as Record<Muscle, number>;
  for (const m of MUSCLES) out[m] = f[m].fatigue;
  return out;
}

export async function reportSoreness(userId: string, muscle: Muscle, severity: number): Promise<void> {
  await prisma.sorenessReport.create({ data: { ownerId: userId, muscle, severity: Math.max(0, Math.min(10, Math.round(severity))) } });
}
