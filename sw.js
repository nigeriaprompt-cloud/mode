// Mode service worker: precache the whole app shell so it loads instantly and works offline.
const VERSION = 'mode-v1.0.0';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/app.js', 'js/util.js', 'js/store.js', 'js/stats.js', 'js/charts.js', 'js/ui.js', 'js/icons.js', 'js/fx.js', 'js/acts.js', 'js/reminders.js', 'js/pwa.js', 'js/focus.js',
  'js/pages/dashboard.js', 'js/pages/schedule.js', 'js/pages/checkin.js', 'js/pages/fitness.js', 'js/pages/habits.js', 'js/pages/career.js', 'js/pages/goals.js', 'js/pages/analytics.js', 'js/pages/journal.js', 'js/pages/settings.js',
  'assets/logo.svg', 'assets/favicon.svg', 'assets/favicon.ico', 'assets/fonts/inter.woff2', 'assets/fonts/jetbrains-mono.woff2',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/maskable-512.png', 'assets/icons/apple-touch-icon.png', 'assets/icons/favicon-32.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Cache-first with background refresh: instant loads, quietly picks up new versions.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || (req.mode === 'navigate' ? cache.match('index.html') : Response.error());
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const route = e.notification.data?.route || '#/dashboard';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const c = all[0];
    if (c) { await c.focus(); c.postMessage({ type: 'route', route }); }
    else await self.clients.openWindow('./' + route);
  })());
});
