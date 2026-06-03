import { describe, it, expect } from 'vitest';
import { settleCohort, nextTier, type CohortMember } from './leagues';

function cohort(n: number): CohortMember[] {
  // descending weeklyXp so rank == index
  return Array.from({ length: n }, (_, i) => ({ userId: `u${String(i).padStart(2, '0')}`, weeklyXp: (n - i) * 100, tiebreak: 0 }));
}

describe('settleCohort', () => {
  it('promotes top 7, relegates bottom 5, holds the rest in a full cohort', () => {
    const r = settleCohort(cohort(30), 'GOLD');
    const promote = r.filter((m) => m.outcome === 'PROMOTE');
    const relegate = r.filter((m) => m.outcome === 'RELEGATE');
    const hold = r.filter((m) => m.outcome === 'HOLD');
    expect(promote).toHaveLength(7);
    expect(relegate).toHaveLength(5);
    expect(hold).toHaveLength(18);
    expect(r[0]!.rank).toBe(1);
    expect(promote.map((m) => m.userId)).toContain('u00'); // top scorer
  });

  it('Bronze never relegates', () => {
    const r = settleCohort(cohort(30), 'BRONZE');
    expect(r.some((m) => m.outcome === 'RELEGATE')).toBe(false);
    expect(r.filter((m) => m.outcome === 'PROMOTE')).toHaveLength(7);
  });

  it('Diamond never promotes', () => {
    const r = settleCohort(cohort(30), 'DIAMOND');
    expect(r.some((m) => m.outcome === 'PROMOTE')).toBe(false);
    expect(r.filter((m) => m.outcome === 'RELEGATE')).toHaveLength(5);
  });

  it('breaks ties by tiebreak then userId (stable, deterministic)', () => {
    const members: CohortMember[] = [
      { userId: 'b', weeklyXp: 100, tiebreak: 1 },
      { userId: 'a', weeklyXp: 100, tiebreak: 5 },
      { userId: 'c', weeklyXp: 100, tiebreak: 5 },
    ];
    const r = settleCohort(members, 'GOLD');
    expect(r.map((m) => m.userId)).toEqual(['a', 'c', 'b']); // tiebreak 5 first; a<c
  });

  it('handles small cohorts without double-classifying (promote wins)', () => {
    const r = settleCohort(cohort(5), 'GOLD');
    // top of a 5-member cohort is promoted, not relegated
    expect(r[0]!.outcome).toBe('PROMOTE');
  });

  it('nextTier moves correctly and clamps', () => {
    expect(nextTier('GOLD', 'PROMOTE')).toBe('PLATINUM');
    expect(nextTier('GOLD', 'RELEGATE')).toBe('SILVER');
    expect(nextTier('GOLD', 'HOLD')).toBe('GOLD');
    expect(nextTier('DIAMOND', 'PROMOTE')).toBe('DIAMOND');
    expect(nextTier('BRONZE', 'RELEGATE')).toBe('BRONZE');
  });
});
