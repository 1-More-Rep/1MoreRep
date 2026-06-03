'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { Equipment, Mechanic, Muscle, MuscleRole } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { requireUser } from '@/lib/auth/guards';
import { MUSCLES } from '@/domain/muscles/taxonomy';
import { iconForEquipment } from '../../../prisma/seed/muscleMap';

export interface ExerciseFormState {
  error?: string;
}

const EQUIPMENT = ['BARBELL', 'DUMBBELL', 'MACHINE', 'CABLE', 'BODYWEIGHT', 'KETTLEBELL', 'BAND', 'EZ_BAR', 'BALL', 'OTHER'] as const;

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  equipment: z.enum(EQUIPMENT),
  mechanic: z.enum(['COMPOUND', 'ISOLATION', '']).optional(),
  primaryMuscle: z.enum(MUSCLES),
  secondaryMuscles: z.array(z.enum(MUSCLES)).default([]),
});

export async function createCustomExerciseAction(
  _prev: ExerciseFormState,
  formData: FormData,
): Promise<ExerciseFormState> {
  const user = await requireUser();
  const parsed = schema.safeParse({
    name: formData.get('name'),
    equipment: formData.get('equipment'),
    mechanic: formData.get('mechanic') || undefined,
    primaryMuscle: formData.get('primaryMuscle'),
    secondaryMuscles: formData.getAll('secondaryMuscles'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form.' };
  const { name, equipment, mechanic, primaryMuscle, secondaryMuscles } = parsed.data;

  const links = [{ muscle: primaryMuscle as Muscle, role: 'PRIMARY' as MuscleRole, weight: 1.0 }];
  for (const m of secondaryMuscles) {
    if (m !== primaryMuscle) links.push({ muscle: m as Muscle, role: 'SECONDARY' as MuscleRole, weight: 0.4 });
  }

  const ex = await prisma.exercise.create({
    data: {
      slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${user.id.slice(0, 6)}`,
      name,
      equipment: equipment as Equipment,
      mechanic: (mechanic || null) as Mechanic | null,
      instructions: [],
      iconKey: iconForEquipment(equipment as Equipment),
      isCustom: true,
      ownerId: user.id,
      source: 'CUSTOM',
      muscleLinks: { create: links },
    },
  });
  redirect(`/app/exercises/${ex.id}`);
}
