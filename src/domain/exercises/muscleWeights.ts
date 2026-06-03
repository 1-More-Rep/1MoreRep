import type { Muscle } from '../muscles/taxonomy';

/**
 * Curated muscle-weight overrides for staple lifts. The free-exercise-db only
 * marks primary/secondary muscles (no weights and no front/side/rear delt
 * distinction); these overrides give the fatigue model and generator accurate,
 * weighted contributions for the exercises people actually train.
 *
 * Matched by case-insensitive name substring (first match wins, so order from
 * most specific to least specific).
 */
export interface CuratedOverride {
  match: string[]; // all substrings must be present in the lowercased name
  weights: Partial<Record<Muscle, number>>; // muscle -> contribution (primary ~1.0)
}

export const CURATED_OVERRIDES: CuratedOverride[] = [
  { match: ['incline', 'press'], weights: { CHEST: 0.9, FRONT_DELTS: 0.6, TRICEPS: 0.4 } },
  { match: ['decline', 'press'], weights: { CHEST: 1.0, TRICEPS: 0.4, FRONT_DELTS: 0.3 } },
  { match: ['bench press'], weights: { CHEST: 1.0, FRONT_DELTS: 0.5, TRICEPS: 0.4 } },
  { match: ['romanian deadlift'], weights: { HAMSTRINGS: 1.0, GLUTES: 0.7, LOWER_BACK: 0.5 } },
  { match: ['stiff', 'deadlift'], weights: { HAMSTRINGS: 1.0, GLUTES: 0.6, LOWER_BACK: 0.5 } },
  { match: ['sumo', 'deadlift'], weights: { GLUTES: 0.9, QUADS: 0.6, HAMSTRINGS: 0.6, LOWER_BACK: 0.8, ADDUCTORS: 0.5, TRAPS: 0.3 } },
  { match: ['deadlift'], weights: { HAMSTRINGS: 0.8, GLUTES: 0.8, LOWER_BACK: 0.9, LATS: 0.3, TRAPS: 0.4, QUADS: 0.4, FOREARMS: 0.4 } },
  { match: ['front squat'], weights: { QUADS: 1.0, GLUTES: 0.5, ABS: 0.4, ADDUCTORS: 0.3 } },
  { match: ['squat'], weights: { QUADS: 1.0, GLUTES: 0.7, HAMSTRINGS: 0.4, LOWER_BACK: 0.3, ADDUCTORS: 0.3 } },
  { match: ['overhead press'], weights: { FRONT_DELTS: 1.0, SIDE_DELTS: 0.5, TRICEPS: 0.5, TRAPS: 0.3 } },
  { match: ['military press'], weights: { FRONT_DELTS: 1.0, SIDE_DELTS: 0.5, TRICEPS: 0.5, TRAPS: 0.3 } },
  { match: ['shoulder press'], weights: { FRONT_DELTS: 1.0, SIDE_DELTS: 0.4, TRICEPS: 0.5 } },
  { match: ['lateral raise'], weights: { SIDE_DELTS: 1.0, FRONT_DELTS: 0.3, TRAPS: 0.2 } },
  { match: ['front raise'], weights: { FRONT_DELTS: 1.0, SIDE_DELTS: 0.3 } },
  { match: ['face pull'], weights: { REAR_DELTS: 1.0, RHOMBOIDS: 0.5, TRAPS: 0.4 } },
  { match: ['reverse', 'fly'], weights: { REAR_DELTS: 1.0, RHOMBOIDS: 0.5 } },
  { match: ['pull-up'], weights: { LATS: 1.0, BICEPS: 0.5, RHOMBOIDS: 0.4, REAR_DELTS: 0.3, FOREARMS: 0.3 } },
  { match: ['pullup'], weights: { LATS: 1.0, BICEPS: 0.5, RHOMBOIDS: 0.4, FOREARMS: 0.3 } },
  { match: ['chin-up'], weights: { LATS: 0.9, BICEPS: 0.7, RHOMBOIDS: 0.4, FOREARMS: 0.3 } },
  { match: ['pulldown'], weights: { LATS: 1.0, BICEPS: 0.4, RHOMBOIDS: 0.4, REAR_DELTS: 0.3 } },
  { match: ['bent', 'row'], weights: { LATS: 1.0, RHOMBOIDS: 0.7, REAR_DELTS: 0.5, BICEPS: 0.4, LOWER_BACK: 0.3, TRAPS: 0.3 } },
  { match: ['barbell row'], weights: { LATS: 1.0, RHOMBOIDS: 0.7, REAR_DELTS: 0.5, BICEPS: 0.4, LOWER_BACK: 0.3, TRAPS: 0.3 } },
  { match: ['seated', 'row'], weights: { LATS: 0.9, RHOMBOIDS: 0.8, REAR_DELTS: 0.4, BICEPS: 0.4, TRAPS: 0.3 } },
  { match: ['leg press'], weights: { QUADS: 1.0, GLUTES: 0.6, HAMSTRINGS: 0.3 } },
  { match: ['leg extension'], weights: { QUADS: 1.0 } },
  { match: ['leg curl'], weights: { HAMSTRINGS: 1.0, CALVES: 0.2 } },
  { match: ['calf raise'], weights: { CALVES: 1.0 } },
  { match: ['hip thrust'], weights: { GLUTES: 1.0, HAMSTRINGS: 0.4 } },
  { match: ['dip'], weights: { TRICEPS: 0.8, CHEST: 0.8, FRONT_DELTS: 0.4 } },
  { match: ['curl'], weights: { BICEPS: 1.0, FOREARMS: 0.4 } },
  { match: ['pushdown'], weights: { TRICEPS: 1.0 } },
  { match: ['triceps', 'extension'], weights: { TRICEPS: 1.0 } },
  { match: ['plank'], weights: { ABS: 1.0, OBLIQUES: 0.4 } },
  { match: ['crunch'], weights: { ABS: 1.0, OBLIQUES: 0.2 } },
];

/** Find a curated override for an exercise name, if any. */
export function findCuratedOverride(name: string): CuratedOverride | null {
  const n = name.toLowerCase();
  for (const o of CURATED_OVERRIDES) {
    if (o.match.every((m) => n.includes(m))) return o;
  }
  return null;
}
