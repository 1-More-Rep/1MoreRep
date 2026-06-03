import type { Muscle } from '../muscles/taxonomy';

// Per-muscle weekly hard-set volume landmarks (RP-style; sets/week).
// MEV = minimum effective, MAV = adaptive target band, MRV = max recoverable.
// Documented as tunable defaults.
export interface Landmark {
  mev: number;
  mav: number;
  mrv: number;
}

export const LANDMARKS: Record<Muscle, Landmark> = {
  CHEST: { mev: 10, mav: 16, mrv: 22 },
  LATS: { mev: 10, mav: 18, mrv: 25 },
  TRAPS: { mev: 10, mav: 16, mrv: 22 },
  RHOMBOIDS: { mev: 8, mav: 14, mrv: 20 },
  FRONT_DELTS: { mev: 6, mav: 10, mrv: 14 },
  SIDE_DELTS: { mev: 12, mav: 18, mrv: 26 },
  REAR_DELTS: { mev: 10, mav: 16, mrv: 22 },
  BICEPS: { mev: 8, mav: 14, mrv: 20 },
  TRICEPS: { mev: 8, mav: 14, mrv: 20 },
  FOREARMS: { mev: 6, mav: 12, mrv: 18 },
  QUADS: { mev: 10, mav: 16, mrv: 22 },
  HAMSTRINGS: { mev: 8, mav: 14, mrv: 20 },
  GLUTES: { mev: 6, mav: 12, mrv: 18 },
  CALVES: { mev: 10, mav: 16, mrv: 22 },
  ABS: { mev: 8, mav: 14, mrv: 20 },
  OBLIQUES: { mev: 6, mav: 12, mrv: 16 },
  LOWER_BACK: { mev: 6, mav: 10, mrv: 16 },
  ADDUCTORS: { mev: 6, mav: 10, mrv: 14 },
  NECK: { mev: 4, mav: 8, mrv: 12 },
};
