import { describe, it, expect } from 'vitest';
import { detectImageKind, validateImageUpload, MAX_IMAGE_BYTES } from './image';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')]);
const fake = Buffer.from('<script>alert(1)</script>plus some bytes');

describe('image magic-byte detection', () => {
  it('detects real image signatures', () => {
    expect(detectImageKind(png)).toBe('png');
    expect(detectImageKind(jpeg)).toBe('jpeg');
    expect(detectImageKind(webp)).toBe('webp');
  });

  it('rejects non-image content (e.g. a disguised script)', () => {
    expect(detectImageKind(fake)).toBeNull();
    expect(validateImageUpload(fake).ok).toBe(false);
  });

  it('rejects empty and oversized files', () => {
    expect(validateImageUpload(Buffer.alloc(0)).ok).toBe(false);
    expect(validateImageUpload(Buffer.alloc(MAX_IMAGE_BYTES + 1)).ok).toBe(false);
  });

  it('accepts a valid small image', () => {
    const r = validateImageUpload(png);
    expect(r.ok).toBe(true);
    expect(r.kind).toBe('png');
  });
});
