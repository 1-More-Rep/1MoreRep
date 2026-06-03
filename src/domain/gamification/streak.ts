// Daily streak transitions. Pure — operates on tz-resolved dayKeys, so all
// timezone correctness lives in xp.ts dayKey()/previousDayKey().

import { daysBetween, previousDayKey } from './xp';

export const MAX_FREEZES = 2;
export const FREEZE_EVERY = 7;

export interface StreakState {
  current: number;
  longest: number;
  lastActiveDay: string | null;
  freezes: number;
}

/** Apply a qualifying activity on `today` (a dayKey). */
export function registerActivity(state: StreakState, today: string): { state: StreakState; changed: boolean } {
  if (state.lastActiveDay === today) return { state, changed: false };
  const gap = state.lastActiveDay ? daysBetween(state.lastActiveDay, today) : Infinity;
  const current = gap === 1 ? state.current + 1 : 1;
  let freezes = state.freezes;
  if (current > 0 && current % FREEZE_EVERY === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
  const longest = Math.max(state.longest, current);
  return { state: { current, longest, lastActiveDay: today, freezes }, changed: true };
}

/**
 * At local-midnight rollover into `today` (dayKey): if yesterday was missed,
 * consume a freeze to preserve the streak, else reset it.
 */
export function rolloverInto(state: StreakState, today: string): { state: StreakState; outcome: 'intact' | 'frozen' | 'reset' } {
  if (!state.lastActiveDay || state.current === 0) return { state, outcome: 'intact' };
  const yesterday = previousDayKey(today);
  // trained yesterday (or later) -> nothing to do
  if (daysBetween(state.lastActiveDay, yesterday) <= 0) return { state, outcome: 'intact' };
  if (state.freezes > 0) {
    return { state: { ...state, freezes: state.freezes - 1, lastActiveDay: yesterday }, outcome: 'frozen' };
  }
  return { state: { ...state, current: 0 }, outcome: 'reset' };
}
