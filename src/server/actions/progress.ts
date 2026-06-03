'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/guards';
import { savePhoto, deletePhoto } from '@/server/services/photoService';
import { addBodyMetric, updateBodyMetric, deleteBodyMetric } from '@/server/services/bodyMetricService';
import type { Prisma } from '@prisma/client';

export interface ProgressState {
  error?: string;
  notice?: string;
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
  const bodyweight = formData.get('bodyweightKg');
  const bw = bodyweight ? Number(bodyweight) : null;
  const measurements: Record<string, number> = {};
  for (const key of ['waist', 'chest', 'arms', 'thighs', 'hips']) {
    const v = formData.get(key);
    if (v && !Number.isNaN(Number(v))) measurements[key] = Number(v);
  }
  if (bw == null && Object.keys(measurements).length === 0) return { error: 'Enter a bodyweight or a measurement.' };
  await addBodyMetric(user.id, { bodyweightKg: bw && !Number.isNaN(bw) ? bw : null, measurements: Object.keys(measurements).length ? (measurements as Prisma.InputJsonValue) : undefined });
  revalidatePath('/app/progress');
  return { notice: 'Logged.' };
}

export async function updateBodyMetricAction(_prev: ProgressState, formData: FormData): Promise<ProgressState> {
  const user = await requireUser();
  const id = String(formData.get('id') || '');
  if (!id) return { error: 'Missing entry.' };
  const bodyweight = formData.get('bodyweightKg');
  const bw = bodyweight ? Number(bodyweight) : null;
  const measurements: Record<string, number> = {};
  for (const key of ['waist', 'chest', 'arms', 'thighs', 'hips']) {
    const v = formData.get(key);
    if (v && !Number.isNaN(Number(v))) measurements[key] = Number(v);
  }
  if (bw == null && Object.keys(measurements).length === 0) return { error: 'Enter a bodyweight or a measurement.' };
  const updated = await updateBodyMetric(id, user.id, {
    bodyweightKg: bw && !Number.isNaN(bw) ? bw : null,
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
