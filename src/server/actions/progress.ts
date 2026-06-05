'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/guards';
import { savePhoto, deletePhoto } from '@/server/services/photoService';
import { addBodyMetric, updateBodyMetric, deleteBodyMetric } from '@/server/services/bodyMetricService';
import { toKg, toCm, type UnitSystemLike } from '@/domain/units';
import type { Prisma } from '@prisma/client';

export interface ProgressState {
  error?: string;
  notice?: string;
}

const MAX_BODYWEIGHT_KG = 1000;
const MAX_MEASUREMENT_CM = 500;

/**
 * Read bodyweight + measurements from the form, convert them from the user's display unit
 * back to canonical kg/cm, and clamp to sane bounds (rejecting absurd / non-positive floats).
 */
function parseBodyMetric(formData: FormData, system: UnitSystemLike): { bw: number | null; measurements: Record<string, number> } {
  const bwRaw = formData.get('bodyweightKg');
  const bwNum = bwRaw ? Number(bwRaw) : NaN;
  const bw = Number.isFinite(bwNum) && bwNum > 0 ? Math.min(MAX_BODYWEIGHT_KG, toKg(bwNum, system)) : null;

  const measurements: Record<string, number> = {};
  for (const key of ['waist', 'chest', 'arms', 'thighs', 'hips']) {
    const v = formData.get(key);
    const n = v ? Number(v) : NaN;
    if (Number.isFinite(n) && n > 0) measurements[key] = Math.min(MAX_MEASUREMENT_CM, toCm(n, system));
  }
  return { bw, measurements };
}

export async function uploadPhotoAction(_prev: ProgressState, formData: FormData): Promise<ProgressState> {
  const user = await requireUser();
  const file = formData.get('photo');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose an image to upload.' };
  const buf = Buffer.from(await file.arrayBuffer());
  const r = await savePhoto(user.id, buf);
  if (!r.ok) return { error: r.error };
  revalidatePath('/app/progress/photos');
  return { notice: 'Photo added.' };
}

export async function deletePhotoAction(id: string): Promise<void> {
  const user = await requireUser();
  await deletePhoto(user.id, id);
  revalidatePath('/app/progress/photos');
}

export async function addBodyMetricAction(_prev: ProgressState, formData: FormData): Promise<ProgressState> {
  const user = await requireUser();
  const { bw, measurements } = parseBodyMetric(formData, user.unitSystem);
  if (bw == null && Object.keys(measurements).length === 0) return { error: 'Enter a bodyweight or a measurement.' };
  await addBodyMetric(user.id, { bodyweightKg: bw, measurements: Object.keys(measurements).length ? (measurements as Prisma.InputJsonValue) : undefined });
  revalidatePath('/app/progress');
  return { notice: 'Logged.' };
}

export async function updateBodyMetricAction(_prev: ProgressState, formData: FormData): Promise<ProgressState> {
  const user = await requireUser();
  const id = String(formData.get('id') || '');
  if (!id) return { error: 'Missing entry.' };
  const { bw, measurements } = parseBodyMetric(formData, user.unitSystem);
  if (bw == null && Object.keys(measurements).length === 0) return { error: 'Enter a bodyweight or a measurement.' };
  const updated = await updateBodyMetric(id, user.id, {
    bodyweightKg: bw,
    measurements: Object.keys(measurements).length ? (measurements as Prisma.InputJsonValue) : undefined,
  });
  if (!updated) return { error: 'Entry not found.' };
  revalidatePath('/app/progress');
  return { notice: 'Updated.' };
}

export async function deleteBodyMetricAction(id: string): Promise<void> {
  const user = await requireUser();
  await deleteBodyMetric(user.id, id);
  revalidatePath('/app/progress');
}
