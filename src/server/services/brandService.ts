import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { validateImageUpload } from '@/lib/upload/image';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'data', 'uploads');
const MAX_LOGO_DIM = 512;

export interface SaveLogoResult {
  ok: boolean;
  error?: string;
  key?: string;
}

/**
 * Validate (magic bytes + size), re-encode via sharp (strips EXIF/metadata and
 * normalizes the format, defeating polyglot payloads), and store the brand logo
 * under the uploads volume with a random key. Output is PNG to preserve
 * transparency. Mirrors the progress-photo storage-key pattern.
 */
export async function saveBrandLogo(buf: Buffer): Promise<SaveLogoResult> {
  const v = validateImageUpload(buf);
  if (!v.ok) return { ok: false, error: v.error };

  let out: Buffer;
  try {
    out = await sharp(buf, { failOn: 'error' })
      .rotate()
      .resize({ width: MAX_LOGO_DIM, height: MAX_LOGO_DIM, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch {
    return { ok: false, error: 'Could not process the logo' };
  }

  const key = `brand/${crypto.randomBytes(16).toString('hex')}.png`;
  const filePath = path.join(UPLOAD_DIR, key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, out);
  return { ok: true, key };
}

/** Read a brand logo's bytes by storage key, with path-traversal safety. */
export async function readBrandLogo(storageKey: string): Promise<Buffer | null> {
  const resolved = path.resolve(UPLOAD_DIR, storageKey);
  if (!resolved.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) return null;
  return fs.readFile(resolved).catch(() => null);
}
