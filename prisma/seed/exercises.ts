import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Mechanic, Muscle, MuscleRole, PrismaClient } from '@prisma/client';
import { mapMuscle, mapEquipment, mapCategory, mapMechanic, mapForce, iconForEquipment } from './muscleMap';
import { findCuratedOverride } from '../../src/domain/exercises/muscleWeights';

interface RawExercise {
  id: string;
  name: string;
  force?: string | null;
  level?: string | null;
  mechanic?: string | null;
  equipment?: string | null;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  instructions?: string[];
  category?: string | null;
}

interface MuscleLink {
  muscle: Muscle;
  role: MuscleRole;
  weight: number;
}

function loadDataset(): RawExercise[] {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return JSON.parse(readFileSync(path.join(here, 'data', 'exercises.json'), 'utf8')) as RawExercise[];
}

type DeOverlay = Record<string, { name: string; instructions: string[] }>;

/** German name/instructions overlay, keyed by the dataset id. Optional (best-effort). */
function loadDeOverlay(): DeOverlay {
  const here = path.dirname(fileURLToPath(import.meta.url));
  try {
    return JSON.parse(readFileSync(path.join(here, 'data', 'exercises.de.json'), 'utf8')) as DeOverlay;
  } catch {
    return {};
  }
}

function schemeFor(mechanic: Mechanic | null) {
  if (mechanic === 'COMPOUND') return { defaultSets: 3, defaultRepLow: 5, defaultRepHigh: 8, defaultRestSec: 150 };
  if (mechanic === 'ISOLATION') return { defaultSets: 3, defaultRepLow: 10, defaultRepHigh: 15, defaultRestSec: 75 };
  return { defaultSets: 3, defaultRepLow: 8, defaultRepHigh: 12, defaultRestSec: 120 };
}

function buildLinks(ex: RawExercise): MuscleLink[] {
  const curated = findCuratedOverride(ex.name);
  if (curated) {
    return Object.entries(curated.weights).map(([muscle, weight]) => ({
      muscle: muscle as Muscle,
      role: (weight >= 0.8 ? 'PRIMARY' : 'SECONDARY') as MuscleRole,
      weight,
    }));
  }
  const links = new Map<Muscle, MuscleLink>();
  for (const m of ex.primaryMuscles ?? []) {
    const mm = mapMuscle(m);
    if (mm) links.set(mm, { muscle: mm, role: 'PRIMARY', weight: 1.0 });
  }
  for (const m of ex.secondaryMuscles ?? []) {
    const mm = mapMuscle(m);
    if (mm && !links.has(mm)) links.set(mm, { muscle: mm, role: 'SECONDARY', weight: 0.4 });
  }
  return [...links.values()];
}

export interface SeedExercisesResult {
  total: number;
  created: number;
  skipped: number;
  deBackfilled: number;
  unmappedMuscles: string[];
}

/** Idempotently seed the exercise library from free-exercise-db (keyed on sourceId). */
export async function seedExercises(prisma: PrismaClient): Promise<SeedExercisesResult> {
  const data = loadDataset();
  const de = loadDeOverlay();
  const unmapped = new Set<string>();
  let created = 0;
  let skipped = 0;

  // Find which sourceIds already exist (one query) so reseed is fast + idempotent.
  const existing = new Set(
    (await prisma.exercise.findMany({ where: { source: 'FREE_EXERCISE_DB' }, select: { sourceId: true } }))
      .map((e) => e.sourceId)
      .filter((s): s is string => !!s),
  );

  const CHUNK = 25;
  for (let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.slice(i, i + CHUNK);
    await Promise.all(
      chunk.map(async (ex) => {
        if (existing.has(ex.id)) {
          skipped++;
          return;
        }
        // track muscle-mapping coverage
        for (const m of [...(ex.primaryMuscles ?? []), ...(ex.secondaryMuscles ?? [])]) {
          if (!mapMuscle(m)) unmapped.add(m);
        }
        const mechanic = mapMechanic(ex.mechanic);
        const equipment = mapEquipment(ex.equipment);
        const links = buildLinks(ex);
        await prisma.exercise.create({
          data: {
            slug: ex.id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
            name: ex.name,
            category: mapCategory(ex.category),
            equipment,
            mechanic,
            force: mapForce(ex.force),
            level: ex.level ?? null,
            instructions: ex.instructions ?? [],
            nameDe: de[ex.id]?.name ?? null,
            instructionsDe: de[ex.id]?.instructions ?? [],
            iconKey: iconForEquipment(equipment),
            ...schemeFor(mechanic),
            isCustom: false,
            source: 'FREE_EXERCISE_DB',
            sourceId: ex.id,
            muscleLinks: { create: links },
          },
        });
        created++;
      }),
    );
  }

  // Backfill the German overlay onto rows seeded before the overlay existed.
  // Idempotent: only touches rows whose German name is still null.
  let deBackfilled = 0;
  if (Object.keys(de).length > 0) {
    const needDe = await prisma.exercise.findMany({
      where: { source: 'FREE_EXERCISE_DB', nameDe: null },
      select: { id: true, sourceId: true },
    });
    const DCHUNK = 50;
    for (let i = 0; i < needDe.length; i += DCHUNK) {
      const chunk = needDe.slice(i, i + DCHUNK);
      await Promise.all(
        chunk.map(async (row) => {
          const tr = row.sourceId ? de[row.sourceId] : undefined;
          if (!tr) return;
          await prisma.exercise.update({
            where: { id: row.id },
            data: { nameDe: tr.name, instructionsDe: tr.instructions },
          });
          deBackfilled++;
        }),
      );
    }
  }

  return { total: data.length, created, skipped, deBackfilled, unmappedMuscles: [...unmapped] };
}
