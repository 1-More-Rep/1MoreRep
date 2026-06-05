/* 1MoreRep service worker — app-shell precache + offline fallback + data caching + web push. */
const CACHE = '1mr-v3';
// App shell: a cold offline start should render the app + offline page.
const PRECACHE = ['/app', '/offline', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/badge-96.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // addAll is atomic; add individually so one 404 doesn't abort the whole precache.
  event.waitUntil(
    caches.open(CACHE).then((c) => Promise.all(PRECACHE.map((u) => c.add(u).catch(() => {})))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

/** True if a response is safe to cache (cacheable, same-origin, no auth cookies set). */
function isCacheable(res) {
  if (!res || !res.ok || res.type === 'opaque') return false;
  // Never persist responses that mint/refresh an auth session.
  if (res.headers.has('set-cookie')) return false;
  return true;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Never touch mutations or cross-origin/auth requests — let them hit the network untouched.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, fall back to the offline page when offline.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/offline')));
    return;
  }

  // Hashed static assets + icons: cache-first (immutable, safe).
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons')) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (isCacheable(res)) {
              const clone = res.clone();
              caches.open(CACHE).then((c) => c.put(req, clone));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Same-origin data GETs (/api/* and app data): network-first, fall back to cache offline.
  // Successful, cookie-free GET responses are cached so a cold offline start still has data.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/app')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (isCacheable(res)) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/offline'))),
    );
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || '1MoreRep';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      // Android status-bar badge: must be a monochrome, transparent-background
      // glyph (the alpha is tinted by the system). A full-color icon here renders
      // as a white square.
      badge: '/icons/badge-96.png',
      tag: data.tag,
      data: { url: data.url || '/app' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/app';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if (c.url.includes(target) && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
