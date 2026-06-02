/**
 * Unit conversion + load rounding. Pure, framework-free (domain layer).
 * Weights are stored canonically in kg; conversion to lb is a display concern.
 */

export const KG_PER_LB = 0.45359237;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

/** Round a value to the nearest increment (e.g. plate step). */
export function roundTo(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

/** Clamp a number to [0, 1]. Used pervasively by the fatigue/priority math. */
export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
