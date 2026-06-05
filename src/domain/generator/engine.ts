// Deterministic workout generator. Pure, no RNG (ties broken by stable slug
// ordering) so the same input always yields the same plan.

import { clamp01, roundTo } from '../units';
import { MUSCLE_LABEL, MUSCLES, type Muscle } from '../muscles/taxonomy';
import { weightForReps } from '../progression/oneRepMax';
import { LANDMARKS } from './landmarks';
import type { GenGoal, GeneratorInput, GeneratorPlan, PlannedExercise, PoolExercise } from './types';

interface Scheme {
  repLow: number;
  repHigh: number;
  rpe: number;
  restSec: number;
  setsPerEx: number;
  compoundBias: number;
}

const SCHEMES: Record<GenGoal, Scheme> = {
  STRENGTH: { repLow: 3, repHigh: 6, rpe: 8.5, restSec: 210, setsPerEx: 4, compoundBias: 0.9 },
  HYPERTROPHY: { repLow: 8, repHigh: 12, rpe: 8, restSec: 120, setsPerEx: 3, compoundBias: 0.5 },
  ENDURANCE: { repLow: 15, repHigh: 20, rpe: 7.5, restSec: 60, setsPerEx: 3, compoundBias: 0.3 },
  GENERAL: { repLow: 8, repHigh: 12, rpe: 8, restSec: 90, setsPerEx: 3, compoundBias: 0.5 },
};

const W_REC = 0.45;
const W_VOL = 0.45;
const W_FAT = 0.5;
const FATIGUE_BLOCK = 0.8;
const COVER_SAT = 2;
const VARIETY_PENALTY = 0.3;
const REDUNDANCY_PENALTY = 0.4;
const HIGH_PRIORITY = 0.7;
const OVERLOAD_STEP = 0.025;
const AVG_SET_SEC = 40;

function priority(m: Muscle, input: GeneratorInput): number {
  const { fatigue, weeklyVolume } = input.perMuscle[m];
  const L = LANDMARKS[m];
  const recovery = 1 - fatigue;
  const volumeGap = clamp01((L.mav - weeklyVolume) / L.mav);
  return W_REC * recovery + W_VOL * volumeGap - W_FAT * Math.max(0, fatigue - 0.6);
}

function isExcluded(m: Muscle, input: GeneratorInput): boolean {
  return input.perMuscle[m].fatigue > FATIGUE_BLOCK || input.perMuscle[m].weeklyVolume >= LANDMARKS[m].mrv;
}

function primaryMuscle(ex: PoolExercise): Muscle {
  let best = ex.muscleWeights[0];
  for (const mw of ex.muscleWeights) if (mw.weight > (best?.weight ?? -1)) best = mw;
  return (best?.muscle ?? 'CHEST') as Muscle;
}

const LARGE_FIRST: Muscle[] = ['QUADS', 'HAMSTRINGS', 'GLUTES', 'LATS', 'CHEST', 'TRAPS', 'RHOMBOIDS', 'LOWER_BACK'];

// Antagonist (opposing) muscle pairs — supersetting these saves time without
// compromising either lift (one rests while the other works).
const ANTAGONIST_PAIRS: [Muscle, Muscle][] = [
  ['CHEST', 'LATS'],
  ['BICEPS', 'TRICEPS'],
  ['QUADS', 'HAMSTRINGS'],
  ['FRONT_DELTS', 'REAR_DELTS'],
  ['ABS', 'LOWER_BACK'],
];
function areAntagonists(a: Muscle, b: Muscle): boolean {
  return ANTAGONIST_PAIRS.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}
// Tight sessions get antagonist supersets to fit the work into the time budget.
const TIME_TIGHT_MIN = 45;

function plateIncrement(equipment: string): number {
  if (equipment === 'DUMBBELL' || equipment === 'KETTLEBELL') return 1;
  return 2.5;
}

function loadSuggestion(ex: PoolExercise, input: GeneratorInput, scheme: Scheme): number | null {
  const h = input.history[ex.id];
  if (!h || h.est1RM <= 0) return null;
  let w = weightForReps(h.est1RM, scheme.repHigh);
  if (h.hitTopRangeLowRir) w *= 1 + OVERLOAD_STEP;
  return roundTo(w, plateIncrement(ex.equipment));
}

export function generateWorkout(input: GeneratorInput): GeneratorPlan {
  const scheme = SCHEMES[input.goal];
  const rationale: string[] = [];

  // Time budget -> target exercise count.
  const perExSec = scheme.setsPerEx * (AVG_SET_SEC + scheme.restSec);
  const targetCount = Math.max(3, Math.min(8, Math.floor((input.availableTimeMin * 60) / perExSec)));

  // Stable candidate ordering for deterministic tie-breaks.
  const pool = [...input.pool].sort((a, b) => a.slug.localeCompare(b.slug));
  const recentlyUsed = new Set(input.recentlyUsed);

  // Exclude exercises whose primary muscle is overreached / at cap.
  const candidates = pool.filter((ex) => !isExcluded(primaryMuscle(ex), input));

  const coverage: Partial<Record<Muscle, number>> = {};
  const primaryCount: Partial<Record<Muscle, number>> = {};
  const selected: PoolExercise[] = [];
  const selectedIds = new Set<string>();

  function exScore(ex: PoolExercise): number {
    let score = 0;
    for (const mw of ex.muscleWeights) {
      if (isExcluded(mw.muscle, input)) continue;
      const cov = coverage[mw.muscle] ?? 0;
      score += mw.weight * priority(mw.muscle, input) * Math.max(0, 1 - cov / COVER_SAT);
    }
    // goal-bias: reward compounds (high bias) or isolations (low bias)
    if (ex.mechanic === 'COMPOUND') score += scheme.compoundBias * 0.4;
    else if (ex.mechanic === 'ISOLATION') score += (1 - scheme.compoundBias) * 0.25;
    if (recentlyUsed.has(ex.id)) score -= VARIETY_PENALTY;
    const pm = primaryMuscle(ex);
    if ((primaryCount[pm] ?? 0) >= 2) score -= REDUNDANCY_PENALTY * ((primaryCount[pm] ?? 0) - 1);
    return score;
  }

  while (selected.length < targetCount) {
    let best: PoolExercise | null = null;
    let bestScore = -Infinity;
    for (const ex of candidates) {
      if (selectedIds.has(ex.id)) continue;
      const s = exScore(ex);
      if (s > bestScore) {
        bestScore = s;
        best = ex;
      }
    }
    if (!best || bestScore <= 0) break;
    selected.push(best);
    selectedIds.add(best.id);
    for (const mw of best.muscleWeights) coverage[mw.muscle] = (coverage[mw.muscle] ?? 0) + mw.weight;
    const pm = primaryMuscle(best);
    primaryCount[pm] = (primaryCount[pm] ?? 0) + 1;
    rationale.push(`${best.name} — ${MUSCLE_LABEL[pm]} (priority ${priority(pm, input).toFixed(2)})`);
  }

  // Force-cover any high-priority, non-excluded, uncovered muscle if a candidate exists.
  for (const m of MUSCLES) {
    if (isExcluded(m, input) || priority(m, input) < HIGH_PRIORITY) continue;
    if ((coverage[m] ?? 0) > 0) continue;
    const cand = candidates.find((ex) => !selectedIds.has(ex.id) && ex.muscleWeights.some((mw) => mw.muscle === m && mw.weight >= 0.8));
    if (cand && selected.length > 0) {
      // swap the lowest-scoring current selection
      let worstIdx = 0;
      let worst = Infinity;
      selected.forEach((ex, i) => {
        const s = exScore(ex);
        if (s < worst) {
          worst = s;
          worstIdx = i;
        }
      });
      const removed = selected[worstIdx]!;
      selectedIds.delete(removed.id);
      selected[worstIdx] = cand;
      selectedIds.add(cand.id);
      // Keep coverage/primaryCount in sync with the swap. Without this, later iterations of
      // this loop read STALE coverage: a muscle the removed exercise had covered still reads
      // as covered (so it's never force-covered), and cand's own coverage isn't credited —
      // causing redundant re-swaps and lost coverage.
      for (const mw of removed.muscleWeights) coverage[mw.muscle] = Math.max(0, (coverage[mw.muscle] ?? 0) - mw.weight);
      const removedPm = primaryMuscle(removed);
      primaryCount[removedPm] = Math.max(0, (primaryCount[removedPm] ?? 0) - 1);
      for (const mw of cand.muscleWeights) coverage[mw.muscle] = (coverage[mw.muscle] ?? 0) + mw.weight;
      const candPm = primaryMuscle(cand);
      primaryCount[candPm] = (primaryCount[candPm] ?? 0) + 1;
      rationale.push(`Forced ${MUSCLE_LABEL[m]} coverage (priority ${priority(m, input).toFixed(2)})`);
    }
  }

  // Note excluded high-priority muscles for transparency.
  for (const m of MUSCLES) {
    if (isExcluded(m, input) && input.perMuscle[m].fatigue > FATIGUE_BLOCK) {
      rationale.push(`Skipped ${MUSCLE_LABEL[m]} (fatigue ${Math.round(input.perMuscle[m].fatigue * 100)}%)`);
    }
  }

  // Order: compounds first, then largest-muscle-first, stable by slug.
  const ordered = [...selected].sort((a, b) => {
    const ac = a.mechanic === 'COMPOUND' ? 0 : 1;
    const bc = b.mechanic === 'COMPOUND' ? 0 : 1;
    if (ac !== bc) return ac - bc;
    const al = LARGE_FIRST.indexOf(primaryMuscle(a));
    const bl = LARGE_FIRST.indexOf(primaryMuscle(b));
    const ai = al === -1 ? 99 : al;
    const bi = bl === -1 ? 99 : bl;
    if (ai !== bi) return ai - bi;
    return a.slug.localeCompare(b.slug);
  });

  const exercises: PlannedExercise[] = ordered.map((ex) => ({
    exerciseId: ex.id,
    name: ex.name,
    primaryMuscle: primaryMuscle(ex),
    sets: scheme.setsPerEx,
    repLow: scheme.repLow,
    repHigh: scheme.repHigh,
    restSec: scheme.restSec,
    rpeTarget: scheme.rpe,
    loadSuggestionKg: loadSuggestion(ex, input, scheme),
  }));

  // When time is tight, pair adjacent antagonist exercises into supersets so the
  // work fits the budget (one muscle rests while the other works).
  if (input.availableTimeMin <= TIME_TIGHT_MIN) {
    let group = 1;
    for (let i = 0; i < exercises.length - 1; i++) {
      const a = exercises[i]!;
      const b = exercises[i + 1]!;
      if (a.supersetGroup != null || b.supersetGroup != null) continue;
      if (areAntagonists(a.primaryMuscle, b.primaryMuscle)) {
        a.supersetGroup = group;
        b.supersetGroup = group;
        group++;
        rationale.push(`Superset ${MUSCLE_LABEL[a.primaryMuscle]} + ${MUSCLE_LABEL[b.primaryMuscle]} (time-tight)`);
      }
    }
  }

  return { exercises, rationale };
}

/**
 * Replace the exercise at `index` with the next-best alternative for the same
 * primary muscle (deterministic; excludes exercises already in the plan).
 * Returns the original plan unchanged if no alternative exists.
 */
export function swapExercise(input: GeneratorInput, plan: GeneratorPlan, index: number): GeneratorPlan {
  const slot = plan.exercises[index];
  if (!slot) return plan;
  const scheme = SCHEMES[input.goal];
  const used = new Set(plan.exercises.map((e) => e.exerciseId));
  const rank = (a: PoolExercise, b: PoolExercise) => {
    const aw = a.muscleWeights.find((m) => m.muscle === slot.primaryMuscle)?.weight ?? 0;
    const bw = b.muscleWeights.find((m) => m.muscle === slot.primaryMuscle)?.weight ?? 0;
    if (aw !== bw) return bw - aw; // strongest contribution first
    return a.slug.localeCompare(b.slug); // deterministic tie-break
  };
  const candidates = input.pool
    .filter((ex) => !used.has(ex.id) && !isExcluded(primaryMuscle(ex), input))
    .filter((ex) => primaryMuscle(ex) === slot.primaryMuscle || ex.muscleWeights.some((mw) => mw.muscle === slot.primaryMuscle && mw.weight >= 0.5))
    .sort(rank);
  // Prefer a candidate whose PRIMARY muscle matches the slot (keeps coverage).
  const pick = candidates.find((ex) => primaryMuscle(ex) === slot.primaryMuscle) ?? candidates[0];
  if (!pick) return plan;
  const replacement: PlannedExercise = {
    exerciseId: pick.id,
    name: pick.name,
    primaryMuscle: primaryMuscle(pick),
    sets: scheme.setsPerEx,
    repLow: scheme.repLow,
    repHigh: scheme.repHigh,
    restSec: scheme.restSec,
    rpeTarget: scheme.rpe,
    loadSuggestionKg: loadSuggestion(pick, input, scheme),
    supersetGroup: slot.supersetGroup,
  };
  return { exercises: plan.exercises.map((e, i) => (i === index ? replacement : e)), rationale: plan.rationale };
}
