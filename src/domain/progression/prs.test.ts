import { describe, it, expect } from 'vitest';
import { exercisePrCandidates, pickNewPrs, type SetData } from './prs';

function set(weightKg: number | null, reps: number | null, over: Partial<SetData> = {}): SetData {
  return { weightKg, reps, isWarmup: false, completed: true, ...over };
}

describe('PR candidates', () => {
  it('ignores warmups and incomplete sets', () => {
    const c = exercisePrCandidates([set(100, 5, { isWarmup: true }), set(60, 10, { completed: false })]);
    expect(c).toHaveLength(0);
  });

  it('computes best per kind across sets', () => {
    const cands = exercisePrCandidates([set(100, 5, { setLogId: 's1' }), set(80, 12, { setLogId: 's2' })]);
    const byKind = Object.fromEntries(cands.map((c) => [c.kind, c]));
    expect(byKind.BEST_WEIGHT!.value).toBe(100);
    expect(byKind.BEST_REPS!.value).toBe(12);
    expect(byKind.BEST_VOLUME_SET!.value).toBe(960); // 80*12
    expect(byKind.BEST_SESSION_VOLUME!.value).toBe(100 * 5 + 80 * 12);
    expect(byKind.EST_1RM!.value).toBeGreaterThan(100);
    expect(byKind.BEST_WEIGHT!.setLogId).toBe('s1');
  });

  it('counts bodyweight (0 weight) rep PRs', () => {
    const cands = exercisePrCandidates([set(0, 20)]);
    const byKind = Object.fromEntries(cands.map((c) => [c.kind, c]));
    expect(byKind.BEST_REPS!.value).toBe(20);
    expect(byKind.BEST_WEIGHT).toBeUndefined(); // 0 weight -> no weight PR
  });

  it('pickNewPrs keeps only improvements over prior', () => {
    const cands = exercisePrCandidates([set(100, 5)]);
    const prior = { BEST_WEIGHT: 100, EST_1RM: 90 };
    const fresh = pickNewPrs(cands, prior);
    const kinds = fresh.map((c) => c.kind);
    expect(kinds).toContain('EST_1RM'); // 100x5 est > 90
    expect(kinds).not.toContain('BEST_WEIGHT'); // tie, not an improvement
  });

  it('treats a missing prior as a new PR', () => {
    const cands = exercisePrCandidates([set(50, 8)]);
    expect(pickNewPrs(cands, {}).length).toBe(cands.length);
  });
});
