/* Jur'ah service-worker shell — Phase 1.
   Caches the app shell and serves the offline page (H3). It subscribes to nothing.
   G12: a push notification, if one ever arrives in Phase 2, opens a screen and does nothing else.
   No notification action may write clinical data, so `actions` is never set on a notification —
   scripts/guards/no-dose-write.ts checks this file for it. */
const CACHE = 'jurah-shell-v1';
const SHELL = ['/ar', '/en', '/ar/offline', '/en/offline', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.mode !== 'navigate') return;
  event.respondWith(
    fetch(request).catch(async () => {
      const url = new URL(request.url);
      const locale = url.pathname.split('/')[1] === 'en' ? 'en' : 'ar';
      const cache = await caches.open(CACHE);
      return (await cache.match(`/${locale}/offline`)) || (await cache.match(`/${locale}`)) || Response.error();
    }),
  );
});

/* Phase 2 will deliver real pushes. The handler exists now so the rule is visible: title, body and
   a URL to open. No actions. Safety-critical detail lives on the screen the URL points to. */
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) { payload = {}; }
  const title = typeof payload.title === 'string' ? payload.title : 'Jur’ah';
  const options = {
    body: typeof payload.body === 'string' ? payload.body : '',
    data: { url: typeof payload.url === 'string' ? payload.url : '/' },
    icon: '/icons/icon.svg',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(self.clients.openWindow(url));
});
