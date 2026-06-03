import { describe, it, expect } from 'vitest';
import { diffSessionVsSnapshot, type SnapshotItem, type LiveEntry } from './diff';

function snap(routineItemId: string, order: number, over: Partial<SnapshotItem> = {}): SnapshotItem {
  return { routineItemId, exerciseId: `ex-${routineItemId}`, order, targetSets: 3, targetRepLow: 8, targetRepHigh: 12, targetRestSec: 120, targetRpe: null, supersetGroup: null, ...over };
}
function entry(over: Partial<LiveEntry> & { order: number; id: string }): LiveEntry {
  return { exerciseId: 'ex', targetSets: 3, targetRepLow: 8, targetRepHigh: 12, targetRestSec: 120, targetRpe: null, supersetGroup: null, isRemoved: false, originRoutineItemId: null, ...over };
}

describe('diffSessionVsSnapshot', () => {
  const baseSnap = [snap('a', 0), snap('b', 1), snap('c', 2)];
  const cleanEntries: LiveEntry[] = baseSnap.map((s, i) =>
    entry({ id: `e${i}`, order: s.order, originRoutineItemId: s.routineItemId, exerciseId: s.exerciseId }),
  );

  it('reports no changes for an unmodified session', () => {
    const d = diffSessionVsSnapshot(baseSnap, cleanEntries);
    expect(d.isDirty).toBe(false);
    expect(d.added).toHaveLength(0);
    expect(d.removed).toHaveLength(0);
    expect(d.modified).toHaveLength(0);
    expect(d.reordered).toBe(false);
  });

  it('detects an added exercise (origin null)', () => {
    const d = diffSessionVsSnapshot(baseSnap, [...cleanEntries, entry({ id: 'new', order: 3, originRoutineItemId: null })]);
    expect(d.added).toHaveLength(1);
    expect(d.isDirty).toBe(true);
  });

  it('detects a soft-removed exercise', () => {
    const e = cleanEntries.map((x) => (x.originRoutineItemId === 'b' ? { ...x, isRemoved: true } : x));
    const d = diffSessionVsSnapshot(baseSnap, e);
    expect(d.removed).toEqual([{ routineItemId: 'b' }]);
    expect(d.isDirty).toBe(true);
  });

  it('detects a modified target', () => {
    const e = cleanEntries.map((x) => (x.originRoutineItemId === 'a' ? { ...x, targetSets: 5 } : x));
    const d = diffSessionVsSnapshot(baseSnap, e);
    expect(d.modified).toHaveLength(1);
    expect(d.modified[0]!.changes.targetSets).toEqual([3, 5]);
  });

  it('detects reorder via originRoutineItemId, not array index', () => {
    // swap order of a and b
    const e = cleanEntries.map((x) =>
      x.originRoutineItemId === 'a' ? { ...x, order: 1 } : x.originRoutineItemId === 'b' ? { ...x, order: 0 } : x,
    );
    const d = diffSessionVsSnapshot(baseSnap, e);
    expect(d.reordered).toBe(true);
    expect(d.modified).toHaveLength(0); // targets unchanged
  });

  it('added-then-removed is a no-op', () => {
    const d = diffSessionVsSnapshot(baseSnap, [...cleanEntries, entry({ id: 'tmp', order: 3, originRoutineItemId: null, isRemoved: true })]);
    expect(d.isDirty).toBe(false);
  });

  it('combined reorder + modify is reflected in both', () => {
    const e = cleanEntries.map((x) =>
      x.originRoutineItemId === 'a' ? { ...x, order: 2, targetRepHigh: 15 } : x.originRoutineItemId === 'c' ? { ...x, order: 0 } : x,
    );
    const d = diffSessionVsSnapshot(baseSnap, e);
    expect(d.reordered).toBe(true);
    expect(d.modified[0]!.changes.targetRepHigh).toEqual([12, 15]);
  });
});
