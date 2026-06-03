import type { Muscle, Equipment, ExCategory, Mechanic, Force } from '@prisma/client';

/** free-exercise-db muscle string -> our Muscle enum. */
export const MUSCLE_MAP: Record<string, Muscle> = {
  abdominals: 'ABS',
  abductors: 'GLUTES', // hip abductors ~ glute medius (no dedicated region)
  adductors: 'ADDUCTORS',
  biceps: 'BICEPS',
  calves: 'CALVES',
  chest: 'CHEST',
  forearms: 'FOREARMS',
  glutes: 'GLUTES',
  hamstrings: 'HAMSTRINGS',
  lats: 'LATS',
  'lower back': 'LOWER_BACK',
  'middle back': 'RHOMBOIDS',
  neck: 'NECK',
  quadriceps: 'QUADS',
  shoulders: 'FRONT_DELTS', // dataset doesn't split delts; curated overrides refine
  traps: 'TRAPS',
  triceps: 'TRICEPS',
};

export function mapMuscle(s: string): Muscle | null {
  return MUSCLE_MAP[s.trim().toLowerCase()] ?? null;
}

const EQUIPMENT_MAP: Record<string, Equipment> = {
  bands: 'BAND',
  barbell: 'BARBELL',
  'body only': 'BODYWEIGHT',
  cable: 'CABLE',
  dumbbell: 'DUMBBELL',
  'e-z curl bar': 'EZ_BAR',
  'exercise ball': 'BALL',
  'foam roll': 'OTHER',
  kettlebells: 'KETTLEBELL',
  machine: 'MACHINE',
  'medicine ball': 'BALL',
  other: 'OTHER',
};

export function mapEquipment(s: string | null | undefined): Equipment {
  if (!s) return 'OTHER';
  return EQUIPMENT_MAP[s.trim().toLowerCase()] ?? 'OTHER';
}

const CATEGORY_MAP: Record<string, ExCategory> = {
  strength: 'STRENGTH',
  cardio: 'CARDIO',
  'olympic weightlifting': 'OLYMPIC',
  plyometrics: 'PLYOMETRICS',
  powerlifting: 'POWERLIFTING',
  stretching: 'STRETCHING',
  strongman: 'STRONGMAN',
};

export function mapCategory(s: string | null | undefined): ExCategory {
  if (!s) return 'OTHER';
  return CATEGORY_MAP[s.trim().toLowerCase()] ?? 'OTHER';
}

export function mapMechanic(s: string | null | undefined): Mechanic | null {
  if (s === 'compound') return 'COMPOUND';
  if (s === 'isolation') return 'ISOLATION';
  return null;
}

export function mapForce(s: string | null | undefined): Force | null {
  if (s === 'push') return 'PUSH';
  if (s === 'pull') return 'PULL';
  if (s === 'static') return 'STATIC';
  return null;
}

/** Pick a sensible icon glyph key from equipment/category. */
export function iconForEquipment(eq: Equipment): string {
  switch (eq) {
    case 'BARBELL':
    case 'EZ_BAR':
      return 'weight';
    case 'DUMBBELL':
    case 'KETTLEBELL':
      return 'dumbbell';
    case 'CABLE':
    case 'MACHINE':
    case 'BAND':
      return 'repeat';
    case 'BODYWEIGHT':
      return 'user';
    default:
      return 'target';
  }
}
