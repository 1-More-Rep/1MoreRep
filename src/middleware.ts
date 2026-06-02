import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/constants';

const PROTECTED_PREFIXES = ['/app', '/admin', '/onboarding', '/account'];
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // --- Same-origin enforcement for mutating requests (CSRF defense-in-depth) ---
  if (MUTATING.has(req.method)) {
    const origin = req.headers.get('origin');
    if (origin) {
      const host = req.headers.get('host');
      try {
        if (new URL(origin).host !== host) {
          return new NextResponse('Cross-origin request blocked', { status: 403 });
        }
      } catch {
        return new NextResponse('Bad origin', { status: 400 });
      }
    }
  }

  // --- Coarse auth routing gate (UX only; real authz is server-side) ---
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isProtected && !req.cookies.get(SESSION_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // --- Per-request CSP nonce + security headers ---
  const nonce = btoa(crypto.randomUUID());
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    `connect-src 'self'`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ]
    .join('; ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  // Next.js reads the nonce from the CSP on the request headers to tag its scripts.
  requestHeaders.set('Content-Security-Policy', csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }
  return res;
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|robots.txt|sw.js).*)'],
};
