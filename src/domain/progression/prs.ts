import { est1RM } from './oneRepMax';

export type PrKind = 'EST_1RM' | 'BEST_WEIGHT' | 'BEST_VOLUME_SET' | 'BEST_REPS' | 'BEST_SESSION_VOLUME';

export interface SetData {
  weightKg: number | null;
  reps: number | null;
  isWarmup: boolean;
  completed: boolean;
  setLogId?: string;
}

export interface PrCandidate {
  kind: PrKind;
  value: number;
  unit: string;
  setLogId?: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Best PR candidate per kind from one exercise's sets in a session. */
export function exercisePrCandidates(sets: SetData[]): PrCandidate[] {
  const working = sets.filter((s) => s.completed && !s.isWarmup && (s.reps ?? 0) > 0);
  if (working.length === 0) return [];

  let best1rm = 0;
  let best1rmSet: string | undefined;
  let bestWeight = 0;
  let bestWeightSet: string | undefined;
  let bestVol = 0;
  let bestVolSet: string | undefined;
  let bestReps = 0;
  let bestRepsSet: string | undefined;
  let sessionVol = 0;

  for (const s of working) {
    const w = s.weightKg ?? 0;
    const r = s.reps ?? 0;
    const e = est1RM(w, r);
    if (e > best1rm) {
      best1rm = e;
      best1rmSet = s.setLogId;
    }
    if (w > bestWeight) {
      bestWeight = w;
      bestWeightSet = s.setLogId;
    }
    const vol = w * r;
    if (vol > bestVol) {
      bestVol = vol;
      bestVolSet = s.setLogId;
    }
    if (r > bestReps) {
      bestReps = r;
      bestRepsSet = s.setLogId;
    }
    sessionVol += vol;
  }

  const out: PrCandidate[] = [];
  if (best1rm > 0) out.push({ kind: 'EST_1RM', value: round1(best1rm), unit: 'kg', setLogId: best1rmSet });
  if (bestWeight > 0) out.push({ kind: 'BEST_WEIGHT', value: round1(bestWeight), unit: 'kg', setLogId: bestWeightSet });
  if (bestVol > 0) out.push({ kind: 'BEST_VOLUME_SET', value: round1(bestVol), unit: 'kg·reps', setLogId: bestVolSet });
  if (bestReps > 0) out.push({ kind: 'BEST_REPS', value: bestReps, unit: 'reps', setLogId: bestRepsSet });
  if (sessionVol > 0) out.push({ kind: 'BEST_SESSION_VOLUME', value: round1(sessionVol), unit: 'kg·reps' });
  return out;
}

/** Keep only candidates that beat the prior best (by more than `margin`). */
export function pickNewPrs(
  candidates: PrCandidate[],
  prior: Partial<Record<PrKind, number>>,
  margin = 0,
): PrCandidate[] {
  return candidates.filter((c) => {
    const p = prior[c.kind];
    return p == null || c.value > p + margin;
  });
}
