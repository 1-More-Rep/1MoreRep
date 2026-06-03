// Mid-workout diff: compare a live session's entries against the immutable
// snapshot of the routine they started from. Pure + framework-free.
//
// The diff covers PRESCRIPTION (membership, targets, order) — not logged
// performance. Matching is by originRoutineItemId, so it survives reordering.

export interface SnapshotItem {
  routineItemId: string;
  exerciseId: string;
  order: number;
  supersetGroup?: number | null;
  targetSets: number;
  targetRepLow: number;
  targetRepHigh: number;
  targetRestSec: number;
  targetRpe?: number | null;
}

export interface LiveEntry {
  id: string;
  originRoutineItemId?: string | null; // null = added mid-workout
  exerciseId: string;
  order: number;
  supersetGroup?: number | null;
  targetSets: number;
  targetRepLow: number;
  targetRepHigh: number;
  targetRestSec: number;
  targetRpe?: number | null;
  isRemoved: boolean;
}

export interface ItemChanges {
  targetSets?: [number, number];
  targetRepLow?: [number, number];
  targetRepHigh?: [number, number];
  targetRestSec?: [number, number];
  targetRpe?: [number | null, number | null];
  supersetGroup?: [number | null, number | null];
}

export interface RoutineDiff {
  added: LiveEntry[];
  removed: { routineItemId: string }[];
  modified: { routineItemId: string; changes: ItemChanges }[];
  reordered: boolean;
  isDirty: boolean;
}

function targetChanges(snap: SnapshotItem, entry: LiveEntry): ItemChanges {
  const c: ItemChanges = {};
  if (snap.targetSets !== entry.targetSets) c.targetSets = [snap.targetSets, entry.targetSets];
  if (snap.targetRepLow !== entry.targetRepLow) c.targetRepLow = [snap.targetRepLow, entry.targetRepLow];
  if (snap.targetRepHigh !== entry.targetRepHigh) c.targetRepHigh = [snap.targetRepHigh, entry.targetRepHigh];
  if (snap.targetRestSec !== entry.targetRestSec) c.targetRestSec = [snap.targetRestSec, entry.targetRestSec];
  if ((snap.targetRpe ?? null) !== (entry.targetRpe ?? null)) c.targetRpe = [snap.targetRpe ?? null, entry.targetRpe ?? null];
  if ((snap.supersetGroup ?? null) !== (entry.supersetGroup ?? null)) c.supersetGroup = [snap.supersetGroup ?? null, entry.supersetGroup ?? null];
  return c;
}

export function diffSessionVsSnapshot(snapshot: SnapshotItem[], entries: LiveEntry[]): RoutineDiff {
  const snapById = new Map(snapshot.map((s) => [s.routineItemId, s]));

  const added: LiveEntry[] = [];
  const removed: { routineItemId: string }[] = [];
  const modified: { routineItemId: string; changes: ItemChanges }[] = [];

  for (const e of entries) {
    if (!e.originRoutineItemId) {
      if (!e.isRemoved) added.push(e); // an added-then-removed entry is a no-op
      continue;
    }
    if (e.isRemoved) {
      removed.push({ routineItemId: e.originRoutineItemId });
      continue;
    }
    const snap = snapById.get(e.originRoutineItemId);
    if (!snap) {
      // origin no longer in snapshot (shouldn't happen) — treat as added
      added.push(e);
      continue;
    }
    const changes = targetChanges(snap, e);
    if (Object.keys(changes).length > 0) modified.push({ routineItemId: e.originRoutineItemId, changes });
  }

  // Reorder detection: compare the surviving origin sequence (by live order)
  // against the snapshot order restricted to surviving items.
  const removedIds = new Set(removed.map((r) => r.routineItemId));
  const liveSeq = entries
    .filter((e) => e.originRoutineItemId && !e.isRemoved)
    .sort((a, b) => a.order - b.order)
    .map((e) => e.originRoutineItemId as string);
  const snapSeq = snapshot
    .filter((s) => !removedIds.has(s.routineItemId) && liveSeq.includes(s.routineItemId))
    .sort((a, b) => a.order - b.order)
    .map((s) => s.routineItemId);
  const reordered = liveSeq.join('>') !== snapSeq.join('>');

  const isDirty = added.length > 0 || removed.length > 0 || modified.length > 0 || reordered;
  return { added, removed, modified, reordered, isDirty };
}
