// sw.js — 神獣オリュンポス の Service Worker(assemble.py が生成)。版名が変わると古いキャッシュを消す
const V = 'ms3d-9861aab110';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('ms3d-') && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url); if (u.origin !== location.origin) return;
  const p = u.pathname;
  if (/\/(models|img)\//.test(p) || /\.(glb|webp|png|jpg)$/.test(p)) {          // モデル・画像 = cache-first
    e.respondWith(caches.open(V).then(c => c.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }))));
  } else if (req.mode === 'navigate' || /\.html?$/.test(p) || p.endsWith('/')) {    // HTML = network-first
    e.respondWith(fetch(req).then(res => { if (res.ok) { const cl = res.clone(); caches.open(V).then(c => c.put(req, cl)); } return res; }).catch(() => caches.open(V).then(c => c.match(req, {ignoreSearch: true}))));
  }
});
