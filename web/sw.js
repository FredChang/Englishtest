const CACHE = 'englishtest-v1.2.0';

/** 安裝時預快取（words.json 仍會在每次請求時走 network-first 更新） */
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/vocabulary.js',
  './js/dictionary.js',
  './js/guide-content.js',
  './js/guide-reading.js',
  './js/speech-voice.js',
  './js/guide-generate.js',
  './js/version.js',
  './words.json',
  './image-vocab.json',
  './manifest.webmanifest',
  './icon.svg'
];

/** 從 image-vocab.json 讀取所有圖片路徑，支援 png/jpg/webp/svg 等格式 */
async function loadImageAssets() {
  try {
    const res = await fetch('./image-vocab.json', { cache: 'no-store' });
    if (!res.ok) return [];
    const list = await res.json();
    if (!Array.isArray(list)) return [];

    return list
      .map((item) => item?.ImageUrl)
      .filter((url) => typeof url === 'string' && url.trim())
      .map((url) => `./${url.replace(/^\.?\//, '')}`);
  } catch {
    return [];
  }
}

function isWordsJsonRequest(request) {
  try {
    const { pathname } = new URL(request.url);
    return pathname.endsWith('/words.json') || pathname.endsWith('words.json');
  } catch {
    return false;
  }
}

function isSameOrigin(request) {
  try {
    return new URL(request.url).origin === self.location.origin;
  } catch {
    return false;
  }
}

/** words.json：先向網路要最新版，成功則更新快取；離線才用舊快取 */
async function networkFirstWords(request) {
  const cache = await caches.open(CACHE);

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      await cache.put(request, response.clone());
      return response;
    }
    const cached = await cache.match(request);
    return cached || response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return Response.error();
  }
}

/** 其他靜態資源：快取優先，背景更新 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200 && isSameOrigin(request)) {
        const clone = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, clone));
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const imageAssets = await loadImageAssets();
      await cache.addAll([...PRECACHE_ASSETS, ...imageAssets]);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (isWordsJsonRequest(event.request)) {
    event.respondWith(networkFirstWords(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});
