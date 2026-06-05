/**
 * Unit conversion + load rounding. Pure, framework-free (domain layer).
 * Weights are stored canonically in kg; conversion to lb is a display concern.
 */

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function cmToIn(cm: number): number {
  return cm / CM_PER_IN;
}

export function inToCm(inches: number): number {
  return inches * CM_PER_IN;
}

export type UnitSystemLike = 'METRIC' | 'IMPERIAL';

/** Short weight-unit label for the user's system. */
export function weightUnit(system: UnitSystemLike): 'kg' | 'lb' {
  return system === 'IMPERIAL' ? 'lb' : 'kg';
}

/** Short length-unit label (body measurements) for the user's system. */
export function lengthUnit(system: UnitSystemLike): 'cm' | 'in' {
  return system === 'IMPERIAL' ? 'in' : 'cm';
}

/**
 * Format a canonical (kg) weight for display in the user's unit system. Returns the number
 * string only — pair with {@link weightUnit} for the label so callers keep layout control.
 * Without this, the stored per-user IMPERIAL preference had no effect anywhere on screen.
 */
export function formatWeight(kg: number | null | undefined, system: UnitSystemLike, decimals?: number): string {
  if (kg == null || !Number.isFinite(kg)) return '—';
  const value = system === 'IMPERIAL' ? kgToLb(kg) : kg;
  const d = decimals ?? (Number.isInteger(value) ? 0 : 1);
  return value.toFixed(d);
}

/** Convert a user-entered display weight back into canonical kg for storage. */
export function toKg(value: number, system: UnitSystemLike): number {
  return system === 'IMPERIAL' ? lbToKg(value) : value;
}

/** Convert a user-entered display length (body measurement) back into canonical cm. */
export function toCm(value: number, system: UnitSystemLike): number {
  return system === 'IMPERIAL' ? inToCm(value) : value;
}

/** Render a canonical (cm) length as an editable input value in the user's unit. */
export function lengthInputValue(cm: number | null | undefined, system: UnitSystemLike): string {
  if (cm == null || !Number.isFinite(cm)) return '';
  const value = system === 'IMPERIAL' ? cmToIn(cm) : cm;
  return String(Math.round(value * 100) / 100);
}

/**
 * Render a canonical (kg) weight as the value for an editable number input: converted to the
 * user's unit, rounded to 2dp, and '' for empty. Pair with {@link toKg} on commit so what the
 * user sees and edits round-trips through storage in their own units.
 */
export function weightInputValue(kg: number | null | undefined, system: UnitSystemLike): string {
  if (kg == null || !Number.isFinite(kg)) return '';
  const value = system === 'IMPERIAL' ? kgToLb(kg) : kg;
  return String(Math.round(value * 100) / 100);
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
