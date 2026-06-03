import 'server-only';
import { Prisma } from '@prisma/client';
import type { Goal, SessionEntry, SetLog } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { AuthorizationError } from '@/lib/auth/guards';
import { diffSessionVsSnapshot, type LiveEntry, type RoutineDiff, type SnapshotItem } from '@/domain/routine/diff';
import { applySessionPrs, type NewPr } from './prService';
import { awardForWorkout, type AwardResult } from '@/server/gamification/award';
import { dayKey } from '@/domain/gamification/xp';
import { writeActivity } from '@/server/social/activity';
import { evaluateFriendStreaks } from '@/server/social/friendStreak';

export type SaveMode = 'NONE' | 'UPDATE_ROUTINE' | 'NEW_ROUTINE';

async function ownedSession(sessionId: string, userId: string) {
  const s = await prisma.workoutSession.findUnique({ where: { id: sessionId } });
  if (!s) throw new Error('Session not found');
  if (s.ownerId !== userId) throw new AuthorizationError();
  return s;
}

async function ownedEntry(entryId: string, userId: string) {
  const e = await prisma.sessionEntry.findUnique({ where: { id: entryId }, include: { session: true } });
  if (!e) throw new Error('Entry not found');
  if (e.session.ownerId !== userId) throw new AuthorizationError();
  return e;
}

/** Start a session, optionally from a routine (copying its items + snapshot). */
export async function startSession(
  userId: string,
  opts: { routineId?: string; name?: string; goal?: Goal } = {},
): Promise<string> {
  // Only one active session at a time — abandon any prior active session.
  await prisma.workoutSession.updateMany({
    where: { ownerId: userId, status: 'ACTIVE' },
    data: { status: 'ABANDONED' },
  });

  let snapshot: SnapshotItem[] | undefined;
  let entriesCreate: Prisma.SessionEntryCreateWithoutSessionInput[] = [];
  let name = opts.name;
  let goal = opts.goal;

  if (opts.routineId) {
    const routine = await prisma.routine.findUnique({
      where: { id: opts.routineId },
      include: { items: { orderBy: { order: 'asc' }, include: { exercise: true } } },
    });
    if (!routine || routine.ownerId !== userId) throw new AuthorizationError();
    name ??= routine.name;
    goal ??= routine.goal ?? undefined;
    snapshot = routine.items.map((it) => ({
      routineItemId: it.id,
      exerciseId: it.exerciseId,
      order: it.order,
      supersetGroup: it.supersetGroup,
      targetSets: it.targetSets,
      targetRepLow: it.targetRepLow,
      targetRepHigh: it.targetRepHigh,
      targetRestSec: it.targetRestSec,
      targetRpe: it.targetRpe,
    }));
    entriesCreate = routine.items.map((it) => ({
      exercise: { connect: { id: it.exerciseId } },
      order: it.order,
      supersetGroup: it.supersetGroup,
      originRoutineItemId: it.id,
      targetSets: it.targetSets,
      targetRepLow: it.targetRepLow,
      targetRepHigh: it.targetRepHigh,
      targetRestSec: it.targetRestSec,
      targetRpe: it.targetRpe,
      sets: { create: placeholderSets(it.targetSets) },
    }));
  }

  const session = await prisma.workoutSession.create({
    data: {
      ownerId: userId,
      routineId: opts.routineId,
      sourceSnapshot: snapshot ? (snapshot as unknown as Prisma.InputJsonValue) : undefined,
      name,
      goal,
      status: 'ACTIVE',
      entries: { create: entriesCreate },
    },
  });
  return session.id;
}

function placeholderSets(n: number): Prisma.SetLogCreateWithoutEntryInput[] {
  return Array.from({ length: Math.max(1, n) }, (_, i) => ({ setIndex: i + 1, completed: false }));
}

/** Add an exercise to a live session (origin null = added mid-workout). */
export async function addEntry(userId: string, sessionId: string, exerciseId: string) {
  await ownedSession(sessionId, userId);
  const ex = await prisma.exercise.findUnique({ where: { id: exerciseId } });
  if (!ex) throw new Error('Exercise not found');
  const max = await prisma.sessionEntry.aggregate({ where: { sessionId }, _max: { order: true } });
  return prisma.sessionEntry.create({
    data: {
      sessionId,
      exerciseId,
      order: (max._max.order ?? -1) + 1,
      originRoutineItemId: null,
      targetSets: ex.defaultSets,
      targetRepLow: ex.defaultRepLow,
      targetRepHigh: ex.defaultRepHigh,
      targetRestSec: ex.defaultRestSec,
      sets: { create: placeholderSets(ex.defaultSets) },
    },
    include: { exercise: { select: { id: true, name: true, iconKey: true } }, sets: { orderBy: { setIndex: 'asc' } } },
  });
}

export async function removeEntry(userId: string, entryId: string): Promise<void> {
  await ownedEntry(entryId, userId);
  await prisma.sessionEntry.update({ where: { id: entryId }, data: { isRemoved: true } });
}

export async function updateEntryTargets(
  userId: string,
  entryId: string,
  data: Partial<Pick<SessionEntry, 'targetSets' | 'targetRepLow' | 'targetRepHigh' | 'targetRestSec' | 'targetRpe' | 'supersetGroup'>>,
): Promise<void> {
  await ownedEntry(entryId, userId);
  await prisma.sessionEntry.update({ where: { id: entryId }, data });
}

export async function reorderEntries(userId: string, sessionId: string, orderedEntryIds: string[]): Promise<void> {
  await ownedSession(sessionId, userId);
  await prisma.$transaction(
    orderedEntryIds.map((id, i) => prisma.sessionEntry.update({ where: { id }, data: { order: i } })),
  );
}

/** Upsert a set log (check-off / edit weight·reps·rpe). */
export async function logSet(
  userId: string,
  entryId: string,
  setIndex: number,
  data: Partial<Pick<SetLog, 'weightKg' | 'reps' | 'rpe' | 'rir' | 'isWarmup' | 'completed'>>,
): Promise<void> {
  await ownedEntry(entryId, userId);
  const completedAt = data.completed === true ? new Date() : data.completed === false ? null : undefined;
  await prisma.setLog.upsert({
    where: { entryId_setIndex: { entryId, setIndex } },
    update: { ...data, ...(completedAt !== undefined ? { completedAt } : {}) },
    create: { entryId, setIndex, ...data },
  });
}

export async function addSet(userId: string, entryId: string): Promise<void> {
  await ownedEntry(entryId, userId);
  const max = await prisma.setLog.aggregate({ where: { entryId }, _max: { setIndex: true } });
  await prisma.setLog.create({ data: { entryId, setIndex: (max._max.setIndex ?? 0) + 1, completed: false } });
}

export async function deleteSet(userId: string, entryId: string, setIndex: number): Promise<void> {
  await ownedEntry(entryId, userId);
  await prisma.setLog.deleteMany({ where: { entryId, setIndex } });
}

/** Compute the live-vs-routine diff for the finish modal. */
export async function getSessionDiff(userId: string, sessionId: string): Promise<RoutineDiff | null> {
  const s = await ownedSession(sessionId, userId);
  if (!s.routineId || !s.sourceSnapshot) return null;
  const snapshot = s.sourceSnapshot as unknown as SnapshotItem[];
  const entries = await prisma.sessionEntry.findMany({ where: { sessionId } });
  return diffSessionVsSnapshot(snapshot, entries.map(toLiveEntry));
}

function toLiveEntry(e: SessionEntry): LiveEntry {
  return {
    id: e.id,
    originRoutineItemId: e.originRoutineItemId,
    exerciseId: e.exerciseId,
    order: e.order,
    supersetGroup: e.supersetGroup,
    targetSets: e.targetSets,
    targetRepLow: e.targetRepLow,
    targetRepHigh: e.targetRepHigh,
    targetRestSec: e.targetRestSec,
    targetRpe: e.targetRpe,
    isRemoved: e.isRemoved,
  };
}

export interface FinishResult {
  newPrs: NewPr[];
  routineId?: string;
  award: AwardResult | null;
}

/** Finish a session: apply the chosen save mode, complete it, compute PRs. */
export async function finishSession(
  userId: string,
  sessionId: string,
  opts: { saveMode: SaveMode; newRoutineName?: string; bodyweightKg?: number; durationSec?: number; notes?: string } = { saveMode: 'NONE' },
): Promise<FinishResult> {
  const s = await ownedSession(sessionId, userId);
  // Idempotency (W1-T4): finishing an already-COMPLETED session must not
  // re-award XP/PRs (double-submit, retry, back-button). Short-circuit cleanly.
  if (s.status === 'COMPLETED') {
    return { newPrs: [], routineId: s.routineId ?? undefined, award: null };
  }
  const entries = await prisma.sessionEntry.findMany({ where: { sessionId, isRemoved: false }, orderBy: { order: 'asc' } });

  let resultRoutineId: string | undefined;

  if (opts.saveMode === 'UPDATE_ROUTINE' && s.routineId) {
    await rebuildRoutineItems(s.routineId, entries);
    await prisma.routine.update({ where: { id: s.routineId }, data: { updatedAt: new Date() } });
    resultRoutineId = s.routineId;
  } else if (opts.saveMode === 'NEW_ROUTINE') {
    const routine = await prisma.routine.create({
      data: { ownerId: userId, name: opts.newRoutineName?.trim() || s.name || 'New routine', goal: s.goal ?? undefined },
    });
    await rebuildRoutineItems(routine.id, entries);
    resultRoutineId = routine.id;
  }

  const durationSec = opts.durationSec ?? Math.max(0, Math.round((Date.now() - s.startedAt.getTime()) / 1000));
  await prisma.workoutSession.update({
    where: { id: sessionId },
    data: { status: 'COMPLETED', completedAt: new Date(), durationSec, bodyweightKg: opts.bodyweightKg, notes: opts.notes, restTimer: Prisma.JsonNull },
  });

  const newPrs = await applySessionPrs(userId, sessionId);
  const award = await awardForWorkout(userId, sessionId, newPrs.length).catch(() => null);

  // Social: activity feed + friend streaks (best-effort, never block the finish).
  try {
    const owner = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    const dk = dayKey(new Date(), owner?.timezone ?? 'UTC');
    await writeActivity(userId, 'WORKOUT_DONE', { sessionId });
    if (newPrs.length > 0) await writeActivity(userId, 'PR', { count: newPrs.length });
    if (award?.leveledUp) await writeActivity(userId, 'LEVEL_UP', { level: award.newLevel });
    await evaluateFriendStreaks(userId, dk);
  } catch {
    /* social side-effects are non-critical */
  }

  return { newPrs, routineId: resultRoutineId, award };
}

async function rebuildRoutineItems(routineId: string, entries: SessionEntry[]): Promise<void> {
  await prisma.routineItem.deleteMany({ where: { routineId } });
  await prisma.routineItem.createMany({
    data: entries.map((e, i) => ({
      routineId,
      exerciseId: e.exerciseId,
      order: i,
      supersetGroup: e.supersetGroup,
      targetSets: e.targetSets,
      targetRepLow: e.targetRepLow,
      targetRepHigh: e.targetRepHigh,
      targetRestSec: e.targetRestSec,
      targetRpe: e.targetRpe,
    })),
  });
}

export async function abandonSession(userId: string, sessionId: string): Promise<void> {
  await ownedSession(sessionId, userId);
  await prisma.workoutSession.update({ where: { id: sessionId }, data: { status: 'ABANDONED' } });
}
