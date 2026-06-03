import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guards';
import { readPhoto } from '@/server/services/photoService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Serve a progress photo — only to its authenticated owner. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const buf = await readPhoto(user.id, id);
  if (!buf) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(new Uint8Array(buf), {
    headers: { 'content-type': 'image/webp', 'cache-control': 'private, max-age=3600', 'content-security-policy': "default-src 'none'" },
  });
}
