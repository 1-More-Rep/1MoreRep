import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import sharp from 'sharp';
import { prisma } from '@/server/db/prisma';
import { savePhoto, readPhoto, deletePhoto } from './photoService';
import { detectImageKind } from '@/lib/upload/image';

let dbReachable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbReachable = true;
} catch {
  dbReachable = false;
}
const d = dbReachable ? describe : describe.skip;

d('progress photos (DB + sharp)', () => {
  let ownerId: string;
  let otherId: string;
  let photoId: string;

  beforeAll(async () => {
    ownerId = (await prisma.user.create({ data: { email: `ph-${Date.now()}@test.local`, displayName: 'Ph', status: 'ACTIVE' } })).id;
    otherId = (await prisma.user.create({ data: { email: `ph2-${Date.now()}@test.local`, displayName: 'Ph2', status: 'ACTIVE' } })).id;
  });
  afterAll(async () => {
    if (photoId) await deletePhoto(ownerId, photoId);
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
  });

  it('rejects non-image content (magic-byte check)', async () => {
    const fake = Buffer.from('GIF89a-not-an-allowed-image' + 'x'.repeat(20));
    const r = await savePhoto(ownerId, fake);
    expect(r.ok).toBe(false);
  });

  it('re-encodes to webp and strips EXIF', async () => {
    const jpegWithExif = await sharp({ create: { width: 24, height: 24, channels: 3, background: { r: 200, g: 60, b: 50 } } })
      .jpeg()
      .withExif({ IFD0: { Copyright: '1MoreRep-test', Make: 'TestCam' } })
      .toBuffer();
    expect((await sharp(jpegWithExif).metadata()).exif).toBeTruthy(); // input HAS exif

    const r = await savePhoto(ownerId, jpegWithExif);
    expect(r.ok).toBe(true);
    photoId = r.id!;

    const stored = await readPhoto(ownerId, photoId);
    expect(stored).not.toBeNull();
    expect(detectImageKind(stored!)).toBe('webp'); // normalized format
    expect((await sharp(stored!).metadata()).exif).toBeUndefined(); // EXIF stripped
  });

  it('serves a photo only to its owner', async () => {
    expect(await readPhoto(ownerId, photoId)).not.toBeNull();
    expect(await readPhoto(otherId, photoId)).toBeNull(); // ownership enforced
  });
});
