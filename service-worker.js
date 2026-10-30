const CACHE = 'sitecam-v6.3.8';
const APP_SHELL = [
  '/', '/index.html', '/manifest.webmanifest',
  '/camera_ui.css','/camera_ui.js','/contractor_stats.js','/web_drive_config.js','/drive_photos.js',
  '/handover.js','/handover_merge.js','/photo_geometry.js','/ui_locales.js','/cloud_sync.js',
  '/voice_controls_locales.js','/voice_entry.js','/voice_locales.js',
  '/voice_translator.html','/voice_translator.js','/dong_hui_logo.png',
  '/icons/sitecam-192.png','/icons/sitecam-512.png','/icons/apple-touch-icon.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(async cache => {
    for (const url of APP_SHELL) {
      try { await cache.add(url); } catch (_) {}
    }
  }).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(res => {
      const copy=res.clone(); caches.open(CACHE).then(c=>c.put('/index.html',copy)).catch(()=>{}); return res;
    }).catch(()=>caches.match('/index.html')));
    return;
  }
  event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res && res.ok) { const copy=res.clone(); caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{}); }
    return res;
  })));
});
