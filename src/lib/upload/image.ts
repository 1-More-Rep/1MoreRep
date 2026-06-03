// Image upload validation by MAGIC BYTES (not extension/header) + size cap.
// Pure + dependency-free so it's unit-testable; sharp re-encoding lives in the
// photo service (strips EXIF/GPS and normalizes format).

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export type ImageKind = 'jpeg' | 'png' | 'webp';

export function detectImageKind(buf: Buffer): ImageKind | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

export interface ImageValidation {
  ok: boolean;
  error?: string;
  kind?: ImageKind;
}

export function validateImageUpload(buf: Buffer): ImageValidation {
  if (buf.length === 0) return { ok: false, error: 'Empty file' };
  if (buf.length > MAX_IMAGE_BYTES) return { ok: false, error: 'Image too large (max 8MB)' };
  const kind = detectImageKind(buf);
  if (!kind) return { ok: false, error: 'Only JPEG, PNG or WebP images are allowed' };
  return { ok: true, kind };
}
