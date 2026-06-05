// Per-muscle fatigue / recovery model. Pure + framework-free; all time inputs
// are explicit ("now" is injected) so tests are deterministic.

import { clamp01 } from '../units';
import { HALF_LIFE_HOURS, MUSCLE_REF_STIMULUS, MUSCLES, type Muscle } from '../muscles/taxonomy';
import {
  BODYWEIGHT_FRACTION,
  FRESH_THRESHOLD,
  MIN_INTENSITY,
  RPE_GAIN,
  RPE_REF,
  SORENESS_HALFLIFE_HOURS,
  SORENESS_LOOKBACK_HOURS,
  SORENESS_WEIGHT,
} from './constants';

export interface SetInput {
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
  rir: number | null;
  isWarmup: boolean;
  completed: boolean;
  bodyweightKg?: number | null;
}

export interface MuscleWeight {
  muscle: Muscle;
  weight: number;
}

export interface EntryInput {
  muscleWeights: MuscleWeight[];
  sets: SetInput[];
}

export interface SessionStimulus {
  ageHours: number;
  perMuscle: Partial<Record<Muscle, number>>;
}

export interface SorenessInput {
  muscle: Muscle;
  severity: number; // 0..10
  ageHours: number;
}

export interface MuscleFatigue {
  fatigue: number; // 0..1
  recoveryEtaHours: number; // 0 when already fresh
}

function effectiveRpe(set: SetInput): number {
  if (set.rpe != null) return set.rpe;
  if (set.rir != null) return 10 - set.rir;
  return RPE_REF;
}

/** Per-set stimulus (volume-load proxy, intensity-scaled, sqrt-damped). */
export function setStimulus(set: SetInput): number {
  if (set.isWarmup || !set.completed) return 0;
  const reps = set.reps ?? 0;
  if (reps <= 0) return 0;
  let load = set.weightKg ?? 0;
  if (load <= 0 && set.bodyweightKg) load = set.bodyweightKg * BODYWEIGHT_FRACTION;
  const volLoad = load * reps;
  if (volLoad <= 0) return 0;
  const intensity = Math.max(MIN_INTENSITY, 1 + RPE_GAIN * (effectiveRpe(set) - RPE_REF));
  return Math.sqrt(volLoad) * intensity;
}

/** Distribute a session's set stimulus across muscles by exercise weights. */
export function sessionMuscleStimulus(entries: EntryInput[]): Partial<Record<Muscle, number>> {
  const out: Partial<Record<Muscle, number>> = {};
  for (const e of entries) {
    let entryStimulus = 0;
    for (const s of e.sets) entryStimulus += setStimulus(s);
    if (entryStimulus === 0) continue;
    for (const mw of e.muscleWeights) {
      out[mw.muscle] = (out[mw.muscle] ?? 0) + entryStimulus * mw.weight;
    }
  }
  return out;
}

export function decayFactor(ageHours: number, muscle: Muscle): number {
  return 0.5 ** (ageHours / HALF_LIFE_HOURS[muscle]);
}

export function recoveryEtaHours(muscle: Muscle, fatigue: number): number {
  if (fatigue <= FRESH_THRESHOLD) return 0;
  return HALF_LIFE_HOURS[muscle] * Math.log2(fatigue / FRESH_THRESHOLD);
}

function sorenessBoost(muscle: Muscle, reports: SorenessInput[]): number {
  let boost = 0;
  for (const r of reports) {
    if (r.muscle !== muscle) continue;
    if (r.ageHours > SORENESS_LOOKBACK_HOURS) continue;
    boost += SORENESS_WEIGHT * r.severity * 0.5 ** (r.ageHours / SORENESS_HALFLIFE_HOURS);
  }
  return boost;
}

/** Compute per-muscle fatigue from decayed session stimuli + soreness reports. */
export function computeFatigue(
  sessions: SessionStimulus[],
  soreness: SorenessInput[] = [],
): Record<Muscle, MuscleFatigue> {
  const result = {} as Record<Muscle, MuscleFatigue>;
  for (const muscle of MUSCLES) {
    let raw = 0;
    for (const s of sessions) {
      const contrib = s.perMuscle[muscle];
      if (contrib) raw += contrib * decayFactor(s.ageHours, muscle);
    }
    const rawFatigue = raw / MUSCLE_REF_STIMULUS[muscle];
    const fatigue = clamp01(rawFatigue + sorenessBoost(muscle, soreness));
    result[muscle] = { fatigue, recoveryEtaHours: recoveryEtaHours(muscle, fatigue) };
  }
  return result;
}

/**
 * Map a fatigue value (0..1) to the body-map heat tint: an accent CSS variable
 * mixed over the surface by `alpha` (0..1). Fresh muscles keep a faint floor tint
 * so a recovered body still reads as intentionally "all fresh" rather than empty.
 * Single source of truth for the threshold mapping (consumed by BodyMap).
 */
export function fatigueToTint(fatigue: number): { cssVar: string; alpha: number } {
  const v = clamp01(fatigue);
  // Below ~12% snap to a subtle baseline tint; above it, alpha tracks fatigue.
  return { cssVar: '--accent', alpha: v < 0.12 ? 0.06 : v };
}
