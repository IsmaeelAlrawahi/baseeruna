/* ============================================================
   بصائرنا — service worker

   Keeps the program usable without a connection and lets audio
   keep playing when the screen is off.

   After changing any file, bump CACHE below so every installed
   device picks the new version up.
   ============================================================ */

const CACHE = 'basairuna-v34';

/* نصّ المصحف (٢٫٦م) وpdf.js لا يدخلان في التثبيت الأول حتى لا
   يثقُل، بل يُحفظان أول مرة يُفتحان ثم يعملان بلا إنترنت. */

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/theme.css',
  './css/app.css',
  './js/config.js',
  './js/i18n.js',
  './js/quran.js',
  './js/adhkar.js',
  './js/util.js',
  './js/program.js',
  './js/storage.js',
  './js/models.js',
  './js/streaks.js',
  './js/audio.js',
  './js/recorder.js',
  './js/tree.js',
  './js/ui.js',
  './js/router.js',
  './js/views/auth.js',
  './js/views/student.js',
  './js/views/listen.js',
  './js/views/salah.js',
  './js/views/adhkar.js',
  './js/views/reciters.js',
  './js/views/report.js',
  './js/views/program.js',
  './js/views/reader.js',
  './js/views/library.js',
  './js/views/mushaf.js',
  './js/views/status.js',
  './js/views/path.js',
  './js/views/results.js',
  './js/views/more.js',
  './js/views/teacher.js',
  './js/views/settings.js',
  './js/app.js',
  './assets/logo.jpeg',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    /* One bad URL shouldn't fail the whole install. */
    await Promise.all(SHELL.map(url =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* Recitation audio: let the network stream it, and never try to
     buffer a partial (Range) response into the cache. */
  const isAudio = req.destination === 'audio' ||
                  /\.(mp3|m4a|ogg|wav|opus|webm)$/i.test(url.pathname) ||
                  req.headers.has('range');
  if (isAudio) return;

  /* Fonts and other cross-origin assets: cache once, then serve fast. */
  if (url.origin !== location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
      } catch (e) {
        return hit || Response.error();
      }
    })());
    return;
  }

  /* Shell: stale-while-revalidate — الإدارة تحصل على نسخة فورية
     ويُحدّث الكاش في الخلفية، مع عرض الكاش أولاً لسرعة TTI. */
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    const fetchPromise = fetch(req).then(res => {
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { fetchPromise.then(() => {}); return hit; }
    const res = await fetchPromise;
    if (res) return res;
    if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
    return Response.error();
  })());
});
