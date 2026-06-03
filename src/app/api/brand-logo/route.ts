import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guards';
import { getSettings } from '@/lib/settings';
import { readBrandLogo } from '@/server/services/brandService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Serve the instance brand logo by its configured key. 404 when none is set. */
export async function GET() {
  await requireUser();
  const { brandLogoKey } = await getSettings();
  if (!brandLogoKey) return new NextResponse('Not found', { status: 404 });
  const buf = await readBrandLogo(brandLogoKey);
  if (!buf) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(new Uint8Array(buf), {
    headers: { 'content-type': 'image/png', 'cache-control': 'private, max-age=3600', 'content-security-policy': "default-src 'none'" },
  });
}
