import 'server-only';
import type { Equipment, Muscle, Prisma } from '@prisma/client';
import { prisma } from '@/server/db/prisma';

export interface ExerciseFilter {
  q?: string;
  muscle?: Muscle;
  equipment?: Equipment;
  userId: string;
  take?: number;
}

/** Library exercises (ownerId null) plus the current user's custom exercises. */
export async function searchExercises(f: ExerciseFilter) {
  const and: Prisma.ExerciseWhereInput[] = [{ OR: [{ ownerId: null }, { ownerId: f.userId }] }];
  if (f.q) and.push({ name: { contains: f.q, mode: 'insensitive' } });
  if (f.muscle) and.push({ muscleLinks: { some: { muscle: f.muscle, role: 'PRIMARY' } } });
  if (f.equipment) and.push({ equipment: f.equipment });

  return prisma.exercise.findMany({
    where: { AND: and },
    include: { muscleLinks: true },
    orderBy: { name: 'asc' },
    take: f.take ?? 60,
  });
}

export async function getExercise(id: string, userId: string) {
  const ex = await prisma.exercise.findUnique({ where: { id }, include: { muscleLinks: true } });
  if (!ex) return null;
  if (ex.ownerId && ex.ownerId !== userId) return null; // can't view others' custom exercises
  return ex;
}

export async function countExercises(userId: string): Promise<number> {
  return prisma.exercise.count({ where: { OR: [{ ownerId: null }, { ownerId: userId }] } });
}
