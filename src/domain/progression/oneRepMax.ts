// One-rep-max estimation. Pure (domain layer). Average of Epley & Brzycki for
// stability; reps beyond ~12 are flagged low-confidence by callers.

export function epley(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

export function brzycki(weight: number, reps: number): number {
  if (reps >= 37) return weight; // formula breaks down
  return (weight * 36) / (37 - reps);
}

/** Estimated 1RM from a working set. reps<=0 -> 0; reps==1 -> weight. */
export function est1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  const avg = (epley(weight, reps) + brzycki(weight, reps)) / 2;
  return Math.max(avg, weight);
}

/** Invert Epley: weight predicted to be liftable for `targetReps` given a 1RM. */
export function weightForReps(oneRm: number, targetReps: number): number {
  if (oneRm <= 0 || targetReps <= 0) return 0;
  if (targetReps === 1) return oneRm;
  return oneRm / (1 + targetReps / 30);
}

export const ONE_RM_CONFIDENT_MAX_REPS = 12;
