// 네트워크 우선 서비스 워커: 항상 서버의 최신 파일을 먼저 받고, 오프라인일 때만 캐시를 사용
const CACHE_NAME = 'green-app-v7';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/engine.js',
  '/app.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  // API 요청과 외부 자원은 서비스 워커가 관여하지 않음
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('/index.html')))
  );
});
