// Offline support for the website version: keeps every game file on the device.
const CACHE = 'johns-gambit-dev';
const FILES = [
  './',
  'css/style.css',
  'data/course.json',
  'data/eco.json',
  'data/extra.json',
  'data/masters.json',
  'data/puzzles.json',
  'engine/stockfish-19-lite-single.js',
  'engine/stockfish-19-lite-single.wasm',
  'fonts/pressstart2p.woff2',
  'fonts/vt323.woff2',
  'img/icon-192.png',
  'img/icon-512.png',
  'img/pieces/bB.svg',
  'img/pieces/bK.svg',
  'img/pieces/bN.svg',
  'img/pieces/bP.svg',
  'img/pieces/bQ.svg',
  'img/pieces/bR.svg',
  'img/pieces/wB.svg',
  'img/pieces/wK.svg',
  'img/pieces/wN.svg',
  'img/pieces/wP.svg',
  'img/pieces/wQ.svg',
  'img/pieces/wR.svg',
  'index.html',
  'js/app.js',
  'js/board.js',
  'js/data.js',
  'js/endgames.js',
  'js/engine.js',
  'js/explain.js',
  'js/music.js',
  'js/mypuzzles.js',
  'js/openings.js',
  'js/puzzles.js',
  'js/store.js',
  'js/ui.js',
  'js/vendor/chess.js',
  'manifest.webmanifest'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Serve from the device first; refresh in the background when online.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
