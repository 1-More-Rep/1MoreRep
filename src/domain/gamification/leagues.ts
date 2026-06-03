// League settlement ranking. Pure.

export type LeagueOutcome = 'PROMOTE' | 'HOLD' | 'RELEGATE';

export const TIERS = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'] as const;
export type Tier = (typeof TIERS)[number];

export const COHORT_SIZE = 30;
export const PROMOTE_COUNT = 7;
export const RELEGATE_COUNT = 5;

export interface CohortMember {
  userId: string;
  weeklyXp: number;
  tiebreak: number; // higher wins ties (e.g. lifetime XP)
}

export interface SettledMember {
  userId: string;
  rank: number;
  outcome: LeagueOutcome;
}

export function tierIndex(tier: Tier): number {
  return TIERS.indexOf(tier);
}

export function nextTier(tier: Tier, outcome: LeagueOutcome): Tier {
  const i = tierIndex(tier);
  if (outcome === 'PROMOTE') return TIERS[Math.min(TIERS.length - 1, i + 1)]!;
  if (outcome === 'RELEGATE') return TIERS[Math.max(0, i - 1)]!;
  return tier;
}

/**
 * Rank a cohort and assign promote/hold/relegate. Top-of-Diamond and
 * bottom-of-Bronze can't move (clamped to HOLD). Promotion is checked before
 * relegation, so in tiny cohorts a top member is promoted rather than relegated.
 */
export function settleCohort(members: CohortMember[], tier: Tier): SettledMember[] {
  const idx = tierIndex(tier);
  const sorted = [...members].sort((a, b) => b.weeklyXp - a.weeklyXp || b.tiebreak - a.tiebreak || a.userId.localeCompare(b.userId));
  const n = sorted.length;
  return sorted.map((m, i) => {
    let outcome: LeagueOutcome = 'HOLD';
    if (i < PROMOTE_COUNT && idx < TIERS.length - 1) outcome = 'PROMOTE';
    else if (i >= n - RELEGATE_COUNT && idx > 0) outcome = 'RELEGATE';
    return { userId: m.userId, rank: i + 1, outcome };
  });
}
