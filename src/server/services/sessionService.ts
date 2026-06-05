import 'server-only';
import { Prisma } from '@prisma/client';
import type { Goal, SessionEntry, SetLog } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';
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

/**
 * Start a session. Optionally seed entries from a routine (copying its items +
 * snapshot) or from a previous session (`fromSessionId`, "repeat workout").
 */
export async function startSession(
  userId: string,
  opts: { routineId?: string; fromSessionId?: string; name?: string; goal?: Goal } = {},
): Promise<string> {
  let snapshot: SnapshotItem[] | undefined;
  let entriesCreate: Prisma.SessionEntryCreateWithoutSessionInput[] = [];
  let name = opts.name;
  let goal = opts.goal;

  if (opts.fromSessionId) {
    const src = await prisma.workoutSession.findUnique({
      where: { id: opts.fromSessionId },
      include: { entries: { where: { isRemoved: false }, orderBy: { order: 'asc' } } },
    });
    if (!src || src.ownerId !== userId) throw new AuthorizationError();
    name ??= src.name ?? undefined;
    goal ??= src.goal ?? undefined;
    entriesCreate = src.entries.map((e, i) => ({
      exercise: { connect: { id: e.exerciseId } },
      order: i,
      supersetGroup: e.supersetGroup,
      originRoutineItemId: null, // a repeat isn't bound to a routine item
      targetSets: e.targetSets,
      targetRepLow: e.targetRepLow,
      targetRepHigh: e.targetRepHigh,
      targetRestSec: e.targetRestSec,
      targetRpe: e.targetRpe,
      sets: { create: placeholderSets(e.targetSets) },
    }));
  } else if (opts.routineId) {
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

  // Abandon the prior ACTIVE session and create the new one atomically: if the create
  // fails, the abandon rolls back, so a failed start never loses the in-progress workout.
  const session = await prisma.$transaction(async (tx) => {
    await tx.workoutSession.updateMany({
      where: { ownerId: userId, status: 'ACTIVE' },
      data: { status: 'ABANDONED' },
    });
    return tx.workoutSession.create({
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
  // Ownership guard (mirrors getExercise): a custom exercise (ownerId set) belongs to
  // exactly one user; library exercises (ownerId null) are shared. Without this a user
  // could attach another user's private custom exercise by id (IDOR / info leak).
  if (ex.ownerId && ex.ownerId !== userId) throw new AuthorizationError();
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
  // The client sends the ids of the currently-visible (non-removed) entries in their new
  // order. We load the session's real rows rather than trusting the list, and require it
  // to be a permutation of the active set. Crucially, @@unique([sessionId, order]) spans
  // soft-removed rows too: a removed entry keeps its old `order`, so naively assigning the
  // active entries 0..n-1 can collide with it (P2002). We therefore renumber EVERY row —
  // active entries take 0..n-1, removed ones are parked just after — all inside one
  // two-phase transaction so there is never a transient duplicate-order collision.
  const all = await prisma.sessionEntry.findMany({ where: { sessionId }, select: { id: true, isRemoved: true } });
  const activeIds = all.filter((e) => !e.isRemoved).map((e) => e.id);
  const activeSet = new Set(activeIds);
  const ordered = orderedEntryIds.filter((id) => activeSet.has(id));
  if (ordered.length !== activeIds.length || new Set(ordered).size !== activeIds.length) {
    throw new Error("reorder list must be a permutation of the session's active entries");
  }
  const removedIds = all.filter((e) => e.isRemoved).map((e) => e.id);
  const OFFSET = 100000;
  await prisma.$transaction([
    // Phase 1: park every row out of the active range.
    ...all.map((e, i) => prisma.sessionEntry.update({ where: { id: e.id }, data: { order: i + OFFSET } })),
    // Phase 2: active entries take the requested 0..n-1; removed rows follow, never colliding.
    ...ordered.map((id, i) => prisma.sessionEntry.update({ where: { id }, data: { order: i } })),
    ...removedIds.map((id, i) => prisma.sessionEntry.update({ where: { id }, data: { order: ordered.length + i } })),
  ]);
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
    // Apply the derived completedAt on the create path too, so a set first written
    // as completed:true (rather than updated) records its completion timestamp.
    create: { entryId, setIndex, ...data, ...(completedAt !== undefined ? { completedAt } : {}) },
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
  // State guard (W1-T4): only an ACTIVE session can be finished. COMPLETED
  // (double-submit/retry/back-button) and ABANDONED are terminal and must never
  // re-award XP/PRs. The early return covers the common terminal case; the atomic
  // claim below closes the TOCTOU window between two concurrent ACTIVE finishes.
  if (s.status !== 'ACTIVE') {
    return { newPrs: [], routineId: s.routineId ?? undefined, award: null };
  }
  const entries = await prisma.sessionEntry.findMany({ where: { sessionId, isRemoved: false }, orderBy: { order: 'asc' } });

  const durationSec = opts.durationSec ?? Math.max(0, Math.round((Date.now() - s.startedAt.getTime()) / 1000));
  // Atomic claim FIRST: flip ACTIVE -> COMPLETED in a single conditional write. Two
  // concurrent finishes both pass the guard above, but only one updateMany sees
  // status:'ACTIVE' and gets count===1; the loser bails here — before any routine is
  // created — so a double-submit can never leave a duplicate/orphan routine behind.
  const claimed = await prisma.workoutSession.updateMany({
    where: { id: sessionId, status: 'ACTIVE' },
    data: { status: 'COMPLETED', completedAt: new Date(), durationSec, bodyweightKg: opts.bodyweightKg, notes: opts.notes, restTimer: Prisma.JsonNull },
  });
  if (claimed.count !== 1) {
    return { newPrs: [], routineId: s.routineId ?? undefined, award: null };
  }

  // Only the winner of the claim reaches here, so the routine save runs exactly once.
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

  // Both are idempotent (applySessionPrs upserts only on improvement; awardForWorkout
  // dedupes on XpEvent.workoutId), so a crash here can be recovered by re-running
  // without double-crediting. Errors are logged — never silently swallowed — so XP/PR
  // loss is visible in ops rather than disappearing.
  const newPrs = await applySessionPrs(userId, sessionId).catch((err): NewPr[] => {
    logger.error({ err, userId, sessionId }, '[finishSession] applySessionPrs failed');
    return [];
  });
  const award = await awardForWorkout(userId, sessionId, newPrs.length).catch((err) => {
    logger.error({ err, userId, sessionId }, '[finishSession] awardForWorkout failed');
    return null;
  });

  // Social: activity feed + friend streaks (best-effort, never block the finish).
  try {
    const owner = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    const dk = dayKey(new Date(), owner?.timezone ?? 'UTC');
    await writeActivity(userId, 'WORKOUT_DONE', { sessionId });
    if (newPrs.length > 0) await writeActivity(userId, 'PR', { count: newPrs.length });
    if (award?.leveledUp) await writeActivity(userId, 'LEVEL_UP', { level: award.newLevel });
    await evaluateFriendStreaks(userId, dk);
  } catch (err) {
    logger.warn({ err, userId, sessionId }, '[finishSession] social side-effects failed (non-critical)');
  }

  return { newPrs, routineId: resultRoutineId, award };
}

async function rebuildRoutineItems(routineId: string, entries: SessionEntry[]): Promise<void> {
  // Wrap delete+create in one transaction so a crash/throw between them can never
  // leave the routine permanently empty — it either fully rebuilds or rolls back.
  await prisma.$transaction([
    prisma.routineItem.deleteMany({ where: { routineId } }),
    prisma.routineItem.createMany({
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
    }),
  ]);
}

export async function abandonSession(userId: string, sessionId: string): Promise<void> {
  await ownedSession(sessionId, userId);
  await prisma.workoutSession.update({ where: { id: sessionId }, data: { status: 'ABANDONED' } });
}
