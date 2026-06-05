// Per-muscle strength standards. A muscle's strength is estimated from the user's
// best estimated-1RM on the exercises that train it (PRIMARY), expressed as a
// multiple of bodyweight, then classified into six tiers from Beginner to Olympian.
//
// Bands are bodyweight-multiples for the muscle's *representative* movement, calibrated
// from published strength-standard tables (Strength Level / ExRx, intermediate ranges).
// They are deliberately approximate and TUNABLE — the UI always shows the contributing
// lift + the bodyweight multiple so the tier reads as evidence-based, not magic.

import type { Muscle } from '@/domain/muscles/taxonomy';
import type { Sex } from '@prisma/client';

export const STRENGTH_TIERS = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite', 'Olympian'] as const;
export type StrengthTier = (typeof STRENGTH_TIERS)[number];

export interface MuscleStandard {
  /** Lower-bound bodyweight multiples (male) for tiers Novice..Olympian (5 thresholds). */
  maleBands: [number, number, number, number, number];
  /** Female top-end runs lower; female bands = male × this factor. */
  femaleFactor: number;
  /** Short label for the contributing movement, for the UI explanation. */
  movement: string;
}

// Muscles with a defensible barbell/bodyweight 1RM standard. Muscles absent here
// (ABS, OBLIQUES, FOREARMS, ADDUCTORS, NECK) have no widely-accepted 1RM standard
// and render as "No data" in strength mode.
export const MUSCLE_STANDARD: Partial<Record<Muscle, MuscleStandard>> = {
  CHEST: { maleBands: [0.5, 0.75, 1.1, 1.5, 2.0], femaleFactor: 0.62, movement: 'bench press' },
  FRONT_DELTS: { maleBands: [0.35, 0.55, 0.8, 1.05, 1.3], femaleFactor: 0.62, movement: 'overhead press' },
  SIDE_DELTS: { maleBands: [0.35, 0.55, 0.8, 1.05, 1.3], femaleFactor: 0.62, movement: 'overhead press' },
  REAR_DELTS: { maleBands: [0.35, 0.55, 0.8, 1.05, 1.3], femaleFactor: 0.62, movement: 'overhead press' },
  TRICEPS: { maleBands: [0.4, 0.6, 0.85, 1.1, 1.4], femaleFactor: 0.64, movement: 'press' },
  BICEPS: { maleBands: [0.25, 0.4, 0.6, 0.8, 1.0], femaleFactor: 0.6, movement: 'curl' },
  LATS: { maleBands: [0.5, 0.75, 1.0, 1.35, 1.75], femaleFactor: 0.68, movement: 'row / pulldown' },
  RHOMBOIDS: { maleBands: [0.5, 0.75, 1.0, 1.35, 1.75], femaleFactor: 0.68, movement: 'row' },
  TRAPS: { maleBands: [1.0, 1.5, 2.0, 2.5, 3.0], femaleFactor: 0.72, movement: 'deadlift / shrug' },
  LOWER_BACK: { maleBands: [1.0, 1.5, 2.0, 2.5, 3.0], femaleFactor: 0.72, movement: 'deadlift' },
  QUADS: { maleBands: [0.75, 1.25, 1.75, 2.25, 2.75], femaleFactor: 0.74, movement: 'squat' },
  HAMSTRINGS: { maleBands: [1.0, 1.5, 2.0, 2.5, 3.0], femaleFactor: 0.74, movement: 'deadlift' },
  GLUTES: { maleBands: [1.0, 1.5, 2.0, 2.5, 3.0], femaleFactor: 0.78, movement: 'deadlift / hip thrust' },
  CALVES: { maleBands: [1.0, 1.5, 2.0, 2.5, 3.0], femaleFactor: 0.8, movement: 'calf raise' },
};

/** Resolve the bodyweight-multiple thresholds for a muscle given the user's sex. */
export function bandsForSex(std: MuscleStandard, sex: Sex): [number, number, number, number, number] {
  let factor: number;
  if (sex === 'MALE') factor = 1;
  else if (sex === 'FEMALE') factor = std.femaleFactor;
  else factor = (1 + std.femaleFactor) / 2; // UNSPECIFIED → unisex midpoint
  return std.maleBands.map((b) => +(b * factor).toFixed(3)) as [number, number, number, number, number];
}

export interface StrengthClass {
  tierIndex: number; // 0..5
  tier: StrengthTier;
  /** Bodyweight multiple needed to reach the next tier (null if already top). */
  nextThreshold: number | null;
}

/** Classify a relative-strength value (1RM / bodyweight) into a tier for a muscle. */
export function classifyStrength(relative: number, muscle: Muscle, sex: Sex): StrengthClass | null {
  const std = MUSCLE_STANDARD[muscle];
  if (!std) return null;
  const bands = bandsForSex(std, sex);
  let idx = 0;
  for (let i = bands.length - 1; i >= 0; i--) {
    if (relative >= bands[i]!) {
      idx = i + 1;
      break;
    }
  }
  const nextThreshold = idx < bands.length ? bands[idx]! : null;
  return { tierIndex: idx, tier: STRENGTH_TIERS[idx]!, nextThreshold };
}
