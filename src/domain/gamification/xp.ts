// XP, levels, and timezone-correct date keys. Pure.

export const XP = {
  SET: 5,
  WORKOUT: 25,
  PR: 30,
  STREAK_DAY: 15,
  VOLUME_MILESTONE: 50,
  FRIEND_STREAK: 10,
} as const;

export const DAILY_XP_CAP = 400;
export const MAX_XP_SETS_PER_DAY = 40;
export const DIMINISH_AFTER_SETS = 25;
export const MAX_XP_WORKOUTS_PER_DAY = 2;
export const MAX_PR_AWARDS_PER_DAY = 3;
export const MAX_FRIEND_STREAK_BONUSES_PER_DAY = 3;

export const VOLUME_MILESTONES = [50_000, 100_000, 250_000, 500_000, 1_000_000]; // lifetime kg·reps

// ---- timezone-correct date keys ----

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
}

function localParts(instant: Date, tz: string): LocalParts {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(instant).map((x) => [x.type, x.value]));
  return { year: Number(p.year), month: Number(p.month), day: Number(p.day), hour: Number(p.hour) };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day "YYYY-MM-DD" in the given timezone. */
export function dayKey(instant: Date, tz: string): string {
  const { year, month, day } = localParts(instant, tz);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Local hour (0-23) in the given timezone. */
export function localHour(instant: Date, tz: string): number {
  return localParts(instant, tz).hour;
}

function isoWeekOf(year: number, month: number, day: number): { year: number; week: number } {
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return { year: date.getUTCFullYear(), week };
}

/** ISO week key "YYYY-Www" for the local date in the given timezone. */
export function weekKey(instant: Date, tz: string): string {
  const { year, month, day } = localParts(instant, tz);
  const { year: wy, week } = isoWeekOf(year, month, day);
  return `${wy}-W${pad(week)}`;
}

/** Integer day difference b - a for "YYYY-MM-DD" keys (calendar days). */
export function daysBetween(a: string, b: string): number {
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  const ua = Date.UTC(pa[0]!, pa[1]! - 1, pa[2]!);
  const ub = Date.UTC(pb[0]!, pb[1]! - 1, pb[2]!);
  return Math.round((ub - ua) / 86400000);
}

/** dayKey of the day before the given dayKey. */
export function previousDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const t = Date.UTC(y!, m! - 1, d!) - 86400000;
  const dt = new Date(t);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

// ---- levels ----

/** XP to advance from level L to L+1. */
export function xpForLevel(level: number): number {
  return Math.round(50 * level ** 1.6);
}

function cumulativeXp(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpForLevel(l);
  return total;
}

export function levelForXp(totalXp: number): number {
  let level = 1;
  while (cumulativeXp(level + 1) <= totalXp) level++;
  return level;
}

export function levelProgress(totalXp: number): { level: number; intoLevel: number; forNext: number; pct: number } {
  const level = levelForXp(totalXp);
  const base = cumulativeXp(level);
  const forNext = xpForLevel(level);
  const intoLevel = totalXp - base;
  return { level, intoLevel, forNext, pct: forNext > 0 ? intoLevel / forNext : 0 };
}

// ---- qualifying set + daily set XP ----

export interface QualifySet {
  reps: number | null;
  weightKg: number | null;
  isWarmup: boolean;
  completed: boolean;
  isBodyweight: boolean;
}

export function isQualifyingSet(s: QualifySet): boolean {
  if (s.isWarmup || !s.completed) return false;
  if ((s.reps ?? 0) < 1) return false;
  return (s.weightKg ?? 0) > 0 || s.isBodyweight;
}

/** XP for the Nth qualifying set of the day (1-based), with diminishing returns + cap. */
export function setXp(setNumberToday: number): number {
  if (setNumberToday > MAX_XP_SETS_PER_DAY) return 0;
  return setNumberToday > DIMINISH_AFTER_SETS ? 2 : XP.SET;
}

/** Clamp a raw award to the remaining daily budget. */
export function capDaily(rawAmount: number, alreadyAwardedToday: number): number {
  return Math.max(0, Math.min(rawAmount, DAILY_XP_CAP - alreadyAwardedToday));
}
