import 'server-only';
import type { Sex } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { MUSCLES, type Muscle } from '@/domain/muscles/taxonomy';
import { classifyStrength, type StrengthTier } from '@/domain/strength/standards';
import { exName } from '@/lib/i18n/exercise';

export interface MuscleStrength {
  /** Best estimated 1RM (kg) on a PRIMARY exercise for this muscle. */
  best1RMkg: number;
  /** 1RM as a multiple of bodyweight. */
  relative: number;
  tierIndex: number;
  tier: StrengthTier;
  /** Bodyweight multiple to reach the next tier (null if at the top). */
  nextThreshold: number | null;
  /** Name of the exercise that produced the best 1RM (the evidence). */
  bestLift: string;
}

/** Latest known bodyweight (kg): newest BodyMetric, else newest workout bodyweight. */
async function latestBodyweightKg(userId: string): Promise<number | null> {
  const metric = await prisma.bodyMetric.findFirst({
    where: { ownerId: userId, bodyweightKg: { not: null } },
    orderBy: { recordedAt: 'desc' },
    select: { bodyweightKg: true },
  });
  if (metric?.bodyweightKg) return metric.bodyweightKg;
  const session = await prisma.workoutSession.findFirst({
    where: { ownerId: userId, bodyweightKg: { not: null } },
    orderBy: { startedAt: 'desc' },
    select: { bodyweightKg: true },
  });
  return session?.bodyweightKg ?? null;
}

/**
 * Per-muscle strength tiers. For each muscle we take the user's best EST_1RM among
 * the exercises that train it as a PRIMARY mover, express it relative to bodyweight,
 * and classify against that muscle's standard. Muscles with no 1RM PRs, no standard,
 * or no known bodyweight are omitted (rendered "No data" by the UI).
 */
export async function computeMuscleStrength(
  userId: string,
  sex: Sex,
  locale = 'en',
): Promise<{ bodyweightKg: number | null; byMuscle: Partial<Record<Muscle, MuscleStrength>> }> {
  const bodyweightKg = await latestBodyweightKg(userId);
  const byMuscle: Partial<Record<Muscle, MuscleStrength>> = {};
  if (!bodyweightKg || bodyweightKg <= 0) return { bodyweightKg, byMuscle };

  // Best EST_1RM per exercise, with the exercise's PRIMARY muscle links. nameDe is
  // fetched so the contributing lift renders in the viewer's locale.
  const prs = await prisma.personalRecord.findMany({
    where: { ownerId: userId, kind: 'EST_1RM' },
    include: { exercise: { select: { name: true, nameDe: true, muscleLinks: { where: { role: 'PRIMARY' } } } } },
  });

  // For each muscle, find the max 1RM among its primary exercises.
  const best: Partial<Record<Muscle, { value: number; lift: string }>> = {};
  for (const pr of prs) {
    for (const link of pr.exercise.muscleLinks) {
      const m = link.muscle as Muscle;
      const cur = best[m];
      if (!cur || pr.value > cur.value) best[m] = { value: pr.value, lift: exName(pr.exercise, locale) };
    }
  }

  for (const m of MUSCLES) {
    const b = best[m];
    if (!b) continue;
    const relative = b.value / bodyweightKg;
    const cls = classifyStrength(relative, m, sex);
    if (!cls) continue;
    byMuscle[m] = {
      best1RMkg: b.value,
      relative,
      tierIndex: cls.tierIndex,
      tier: cls.tier,
      nextThreshold: cls.nextThreshold,
      bestLift: b.lift,
    };
  }

  return { bodyweightKg, byMuscle };
}
