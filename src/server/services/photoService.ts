import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { prisma } from '@/server/db/prisma';
import { validateImageUpload } from '@/lib/upload/image';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'data', 'uploads');
const MAX_DIM = 1600;

export interface SaveResult {
  ok: boolean;
  error?: string;
  id?: string;
}

/**
 * Validate (magic bytes + size), re-encode via sharp (which strips EXIF/GPS and
 * normalizes the format, defeating polyglot payloads), and store under the
 * uploads volume with a random key (outside the webroot).
 */
export async function savePhoto(userId: string, buf: Buffer): Promise<SaveResult> {
  const v = validateImageUpload(buf);
  if (!v.ok) return { ok: false, error: v.error };

  let out: Buffer;
  let width = 0;
  let height = 0;
  try {
    const pipeline = sharp(buf, { failOn: 'error' }).rotate(); // apply + drop EXIF orientation
    out = await pipeline.resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    const meta = await sharp(out).metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
  } catch {
    return { ok: false, error: 'Could not process the image' };
  }

  const key = `${userId.slice(0, 8)}/${crypto.randomBytes(16).toString('hex')}.webp`;
  const filePath = path.join(UPLOAD_DIR, key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, out);

  const photo = await prisma.progressPhoto.create({ data: { ownerId: userId, storageKey: key, width, height } });
  return { ok: true, id: photo.id };
}

/** Read a photo's bytes, enforcing ownership + path-traversal safety. */
export async function readPhoto(userId: string, id: string): Promise<Buffer | null> {
  const photo = await prisma.progressPhoto.findUnique({ where: { id } });
  if (!photo || photo.ownerId !== userId) return null;
  const resolved = path.resolve(UPLOAD_DIR, photo.storageKey);
  if (resolved !== path.resolve(UPLOAD_DIR, photo.storageKey) || !resolved.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) return null;
  return fs.readFile(resolved).catch(() => null);
}

export async function listPhotos(userId: string) {
  return prisma.progressPhoto.findMany({ where: { ownerId: userId }, orderBy: { takenAt: 'desc' }, take: 60 });
}

export async function deletePhoto(userId: string, id: string): Promise<void> {
  const photo = await prisma.progressPhoto.findUnique({ where: { id } });
  if (!photo || photo.ownerId !== userId) return;
  await prisma.progressPhoto.delete({ where: { id } });
  await fs.unlink(path.resolve(UPLOAD_DIR, photo.storageKey)).catch(() => {});
}
