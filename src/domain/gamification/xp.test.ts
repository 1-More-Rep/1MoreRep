import { describe, it, expect } from 'vitest';
import {
  dayKey,
  weekKey,
  localHour,
  daysBetween,
  previousDayKey,
  xpForLevel,
  levelForXp,
  levelProgress,
  isQualifyingSet,
  setXp,
  capDaily,
} from './xp';

describe('timezone-correct date keys', () => {
  const instant = new Date('2026-06-02T12:30:00Z');

  it('resolves the local calendar day per timezone', () => {
    expect(dayKey(instant, 'UTC')).toBe('2026-06-02');
    expect(dayKey(instant, 'Pacific/Auckland')).toBe('2026-06-03'); // UTC+12 -> next day
    expect(dayKey(instant, 'America/Los_Angeles')).toBe('2026-06-02'); // UTC-7
  });

  it('resolves local hour per timezone', () => {
    expect(localHour(instant, 'America/Los_Angeles')).toBe(5);
    expect(localHour(instant, 'UTC')).toBe(12);
  });

  it('changes day across a local midnight boundary (23:59 -> 00:01)', () => {
    const beforeMid = new Date('2026-06-02T06:59:00Z'); // LA 2026-06-01 23:59
    const afterMid = new Date('2026-06-02T07:01:00Z'); // LA 2026-06-02 00:01
    expect(dayKey(beforeMid, 'America/Los_Angeles')).toBe('2026-06-01');
    expect(dayKey(afterMid, 'America/Los_Angeles')).toBe('2026-06-02');
  });

  it('handles a DST transition day (America/New_York spring forward)', () => {
    expect(dayKey(new Date('2026-03-08T12:00:00Z'), 'America/New_York')).toBe('2026-03-08');
  });

  it('handles extreme offsets (+13 Tongatapu, -8 Pitcairn) at the UTC-midnight edge (W5-T4)', () => {
    const justAfterUtcMidnight = new Date('2026-06-02T00:30:00Z');
    expect(dayKey(justAfterUtcMidnight, 'Pacific/Tongatapu')).toBe('2026-06-02'); // +13 → already next-day afternoon
    expect(dayKey(justAfterUtcMidnight, 'Pacific/Pitcairn')).toBe('2026-06-01'); // -8 → still previous day
  });

  it('gives a traveler different day keys for the same instant (W5-T4)', () => {
    const instant = new Date('2026-06-02T23:00:00Z'); // Auckland → Jun 3, LA → Jun 2
    expect(dayKey(instant, 'Pacific/Auckland')).toBe('2026-06-03');
    expect(dayKey(instant, 'America/Los_Angeles')).toBe('2026-06-02');
    expect(dayKey(instant, 'Pacific/Auckland')).not.toBe(dayKey(instant, 'America/Los_Angeles'));
  });

  it('keeps a single calendar day across a 25-hour fall-back day (W5-T4)', () => {
    // America/New_York DST ends 2026-11-01; that local day spans 25 hours.
    const morning = new Date('2026-11-01T08:00:00Z'); // ~04:00 EDT
    const evening = new Date('2026-11-02T03:00:00Z'); // ~22:00 EST same local day
    expect(dayKey(morning, 'America/New_York')).toBe('2026-11-01');
    expect(dayKey(evening, 'America/New_York')).toBe('2026-11-01');
    expect(daysBetween(dayKey(morning, 'America/New_York'), '2026-11-02')).toBe(1);
  });

  it('groups ISO weeks Mon..Sun', () => {
    const mon = new Date('2026-06-01T12:00:00Z');
    const sun = new Date('2026-06-07T12:00:00Z');
    const nextMon = new Date('2026-06-08T12:00:00Z');
    expect(weekKey(mon, 'UTC')).toBe(weekKey(sun, 'UTC'));
    expect(weekKey(sun, 'UTC')).not.toBe(weekKey(nextMon, 'UTC'));
    expect(weekKey(mon, 'UTC')).toMatch(/^2026-W\d{2}$/);
  });
});

describe('day arithmetic', () => {
  it('daysBetween + previousDayKey', () => {
    expect(daysBetween('2026-06-02', '2026-06-03')).toBe(1);
    expect(daysBetween('2026-06-02', '2026-06-02')).toBe(0);
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1); // 2026 not a leap year
    expect(previousDayKey('2026-03-01')).toBe('2026-02-28');
    expect(previousDayKey('2026-01-01')).toBe('2025-12-31');
  });
});

describe('levels', () => {
  it('golden XP curve', () => {
    expect(xpForLevel(1)).toBe(50);
    expect(xpForLevel(2)).toBe(152);
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(49)).toBe(1);
    expect(levelForXp(50)).toBe(2);
    expect(levelForXp(50 + 152 - 1)).toBe(2);
    expect(levelForXp(50 + 152)).toBe(3);
  });
  it('levelProgress', () => {
    const p = levelProgress(50);
    expect(p.level).toBe(2);
    expect(p.intoLevel).toBe(0);
    expect(p.pct).toBe(0);
  });
});

describe('XP rules', () => {
  it('isQualifyingSet', () => {
    const base = { reps: 8, weightKg: 50, isWarmup: false, completed: true, isBodyweight: false };
    expect(isQualifyingSet(base)).toBe(true);
    expect(isQualifyingSet({ ...base, isWarmup: true })).toBe(false);
    expect(isQualifyingSet({ ...base, completed: false })).toBe(false);
    expect(isQualifyingSet({ ...base, reps: 0 })).toBe(false);
    expect(isQualifyingSet({ ...base, weightKg: 0 })).toBe(false);
    expect(isQualifyingSet({ ...base, weightKg: 0, isBodyweight: true })).toBe(true);
  });
  it('setXp diminishes and caps', () => {
    expect(setXp(1)).toBe(5);
    expect(setXp(25)).toBe(5);
    expect(setXp(26)).toBe(2);
    expect(setXp(40)).toBe(2);
    expect(setXp(41)).toBe(0);
  });
  it('capDaily clamps to the remaining budget', () => {
    expect(capDaily(100, 350)).toBe(50);
    expect(capDaily(100, 400)).toBe(0);
    expect(capDaily(30, 100)).toBe(30);
  });
});
