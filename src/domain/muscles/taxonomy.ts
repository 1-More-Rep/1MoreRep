// Muscle taxonomy — the closed set of muscle groups used by the exercise library,
// the 2D body map, the fatigue model, and the generator's volume landmarks.
// Pure data; the Prisma `Muscle` enum mirrors MUSCLES (keep in sync).

export const MUSCLES = [
  'CHEST',
  'FRONT_DELTS',
  'SIDE_DELTS',
  'REAR_DELTS',
  'BICEPS',
  'TRICEPS',
  'FOREARMS',
  'LATS',
  'TRAPS',
  'RHOMBOIDS',
  'LOWER_BACK',
  'ABS',
  'OBLIQUES',
  'QUADS',
  'HAMSTRINGS',
  'GLUTES',
  'CALVES',
  'ADDUCTORS',
  'NECK',
] as const;

export type Muscle = (typeof MUSCLES)[number];

export function isMuscle(v: string): v is Muscle {
  return (MUSCLES as readonly string[]).includes(v);
}

export const MUSCLE_LABEL: Record<Muscle, string> = {
  CHEST: 'Chest',
  FRONT_DELTS: 'Front delts',
  SIDE_DELTS: 'Side delts',
  REAR_DELTS: 'Rear delts',
  BICEPS: 'Biceps',
  TRICEPS: 'Triceps',
  FOREARMS: 'Forearms',
  LATS: 'Lats',
  TRAPS: 'Traps',
  RHOMBOIDS: 'Rhomboids',
  LOWER_BACK: 'Lower back',
  ABS: 'Abs',
  OBLIQUES: 'Obliques',
  QUADS: 'Quads',
  HAMSTRINGS: 'Hamstrings',
  GLUTES: 'Glutes',
  CALVES: 'Calves',
  ADDUCTORS: 'Adductors',
  NECK: 'Neck',
};

export type BodyView = 'front' | 'back';

/** Which view each muscle is primarily shown on in the 2D body map. */
export const MUSCLE_VIEW: Record<Muscle, BodyView> = {
  CHEST: 'front',
  FRONT_DELTS: 'front',
  SIDE_DELTS: 'front',
  REAR_DELTS: 'back',
  BICEPS: 'front',
  TRICEPS: 'back',
  FOREARMS: 'front',
  LATS: 'back',
  TRAPS: 'back',
  RHOMBOIDS: 'back',
  LOWER_BACK: 'back',
  ABS: 'front',
  OBLIQUES: 'front',
  QUADS: 'front',
  HAMSTRINGS: 'back',
  GLUTES: 'back',
  CALVES: 'back',
  ADDUCTORS: 'front',
  NECK: 'back',
};

/**
 * Recovery half-life (hours) per muscle — bigger/slower muscles recover slower.
 * Drives the exponential decay in the fatigue model.
 */
export const HALF_LIFE_HOURS: Record<Muscle, number> = {
  CHEST: 60,
  LATS: 60,
  TRAPS: 48,
  RHOMBOIDS: 48,
  LOWER_BACK: 72,
  QUADS: 72,
  HAMSTRINGS: 66,
  GLUTES: 72,
  CALVES: 48,
  FRONT_DELTS: 48,
  SIDE_DELTS: 48,
  REAR_DELTS: 42,
  BICEPS: 42,
  TRICEPS: 42,
  FOREARMS: 36,
  ABS: 36,
  OBLIQUES: 36,
  ADDUCTORS: 60,
  NECK: 36,
};

/**
 * Per-muscle reference stimulus — the decayed stimulus sum that maps to ~0.6
 * fatigue (one solid session). Calibrated roughly with weekly volume capacity;
 * documented as tunable. Used to normalize rawFatigue into 0..1.
 */
export const MUSCLE_REF_STIMULUS: Record<Muscle, number> = {
  CHEST: 320,
  LATS: 340,
  TRAPS: 300,
  RHOMBOIDS: 260,
  LOWER_BACK: 240,
  QUADS: 380,
  HAMSTRINGS: 300,
  GLUTES: 300,
  CALVES: 220,
  FRONT_DELTS: 220,
  SIDE_DELTS: 240,
  REAR_DELTS: 220,
  BICEPS: 220,
  TRICEPS: 240,
  FOREARMS: 180,
  ABS: 200,
  OBLIQUES: 180,
  ADDUCTORS: 200,
  NECK: 140,
};
