import 'server-only';
import { headers } from 'next/headers';

/** Best-effort client context from request headers (respects a trusted proxy). */
export async function getRequestContext(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const trustProxy = process.env.TRUST_PROXY === 'true';
  let ip: string | null = null;
  if (trustProxy) {
    const fwd = h.get('x-forwarded-for');
    if (fwd) ip = fwd.split(',')[0]?.trim() ?? null;
    ip ??= h.get('x-real-ip');
  }
  return { ip, userAgent: h.get('user-agent') };
}
