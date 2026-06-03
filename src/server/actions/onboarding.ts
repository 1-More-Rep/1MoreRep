'use server';

import { redirect } from 'next/navigation';
import type { Equipment, ExperienceLevel, Goal, UnitSystem } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { requireUser } from '@/lib/auth/guards';

const GOALS: Goal[] = ['HYPERTROPHY', 'STRENGTH', 'ENDURANCE', 'GENERAL'];
const LEVELS: ExperienceLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const EQUIP: Equipment[] = ['BARBELL', 'DUMBBELL', 'MACHINE', 'CABLE', 'BODYWEIGHT', 'KETTLEBELL', 'BAND'];

export interface OnboardingPayload {
  timezone: string;
  unitSystem: UnitSystem;
  goal: Goal;
  experience: ExperienceLevel;
  trainingDays: number;
  equipment: Equipment[];
  bodyweightKg?: number | null;
}

/**
 * Persist the captured onboarding profile to the User (+ an initial BodyMetric),
 * mark onboardedAt, and hand the chosen goal to the generator via the query param.
 */
export async function completeOnboardingAction(data: OnboardingPayload): Promise<void> {
  const user = await requireUser();

  let tz = 'UTC';
  try {
    Intl.DateTimeFormat(undefined, { timeZone: data.timezone });
    tz = data.timezone;
  } catch {
    tz = 'UTC';
  }
  const goal: Goal = GOALS.includes(data.goal) ? data.goal : 'HYPERTROPHY';
  const experience: ExperienceLevel = LEVELS.includes(data.experience) ? data.experience : 'INTERMEDIATE';
  const equipment = (data.equipment ?? []).filter((e) => EQUIP.includes(e));
  const trainingDays = Math.max(1, Math.min(7, Math.round(data.trainingDays || 3)));

  await prisma.user.update({
    where: { id: user.id },
    data: {
      timezone: tz,
      unitSystem: data.unitSystem === 'IMPERIAL' ? 'IMPERIAL' : 'METRIC',
      primaryGoal: goal,
      experienceLevel: experience,
      trainingDaysPerWeek: trainingDays,
      defaultEquipment: equipment,
      onboardedAt: new Date(),
    },
  });

  if (data.bodyweightKg != null && Number.isFinite(data.bodyweightKg) && data.bodyweightKg > 0) {
    await prisma.bodyMetric.create({ data: { ownerId: user.id, bodyweightKg: data.bodyweightKg } });
  }

  redirect(`/app/workout/generate?goal=${goal}`);
}
