import { describe, it, expect } from 'vitest';
import { registerActivity, rolloverInto, type StreakState } from './streak';
import { dayKey } from './xp';

const fresh: StreakState = { current: 0, longest: 0, lastActiveDay: null, freezes: 0 };

describe('registerActivity', () => {
  it('starts a streak on first activity', () => {
    const r = registerActivity(fresh, '2026-06-02');
    expect(r.state.current).toBe(1);
    expect(r.changed).toBe(true);
  });

  it('continues across consecutive days', () => {
    let s = registerActivity(fresh, '2026-06-01').state;
    s = registerActivity(s, '2026-06-02').state;
    expect(s.current).toBe(2);
  });

  it('does not double-count the same day', () => {
    const s = registerActivity(fresh, '2026-06-02').state;
    const r = registerActivity(s, '2026-06-02');
    expect(r.changed).toBe(false);
    expect(r.state.current).toBe(1);
  });

  it('restarts at 1 after a gap', () => {
    const s = registerActivity(fresh, '2026-06-01').state;
    const r = registerActivity(s, '2026-06-05');
    expect(r.state.current).toBe(1);
  });

  it('earns a freeze every 7 consecutive days (max 2)', () => {
    let s: StreakState = { current: 6, longest: 6, lastActiveDay: '2026-06-06', freezes: 0 };
    s = registerActivity(s, '2026-06-07').state;
    expect(s.current).toBe(7);
    expect(s.freezes).toBe(1);
  });

  it('tracks the longest streak', () => {
    let s = registerActivity(fresh, '2026-06-01').state;
    s = registerActivity(s, '2026-06-02').state;
    s = registerActivity(s, '2026-06-10').state; // reset to 1
    expect(s.current).toBe(1);
    expect(s.longest).toBe(2);
  });

  it('crossing local midnight (23:59 -> 00:01) advances the streak', () => {
    const tz = 'America/Los_Angeles';
    const d1 = dayKey(new Date('2026-06-02T06:59:00Z'), tz); // 2026-06-01
    const d2 = dayKey(new Date('2026-06-02T07:01:00Z'), tz); // 2026-06-02
    let s = registerActivity(fresh, d1).state;
    s = registerActivity(s, d2).state;
    expect(s.current).toBe(2);
  });
});

describe('rolloverInto (missed-day handling)', () => {
  it('leaves an active streak intact when yesterday was trained', () => {
    const s: StreakState = { current: 3, longest: 3, lastActiveDay: '2026-06-02', freezes: 0 };
    const r = rolloverInto(s, '2026-06-03'); // yesterday=06-02 was trained
    expect(r.outcome).toBe('intact');
    expect(r.state.current).toBe(3);
  });

  it('consumes a freeze when yesterday was missed', () => {
    const s: StreakState = { current: 5, longest: 5, lastActiveDay: '2026-06-01', freezes: 1 };
    const r = rolloverInto(s, '2026-06-03'); // missed 06-02
    expect(r.outcome).toBe('frozen');
    expect(r.state.current).toBe(5);
    expect(r.state.freezes).toBe(0);
    expect(r.state.lastActiveDay).toBe('2026-06-02'); // bridged
  });

  it('resets when yesterday was missed and no freeze is available', () => {
    const s: StreakState = { current: 5, longest: 5, lastActiveDay: '2026-06-01', freezes: 0 };
    const r = rolloverInto(s, '2026-06-03');
    expect(r.outcome).toBe('reset');
    expect(r.state.current).toBe(0);
  });

  it('a frozen streak continues if the user trains today', () => {
    const s: StreakState = { current: 5, longest: 5, lastActiveDay: '2026-06-01', freezes: 1 };
    const frozen = rolloverInto(s, '2026-06-03').state;
    const after = registerActivity(frozen, '2026-06-03').state;
    expect(after.current).toBe(6);
  });
});
