const CACHE = 'englishtest-v1.6.0';

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
  './js/version.js',
  './words.json',
  './friends.txt',
  './image-vocab.json',
  './manifest.webmanifest',
  './icon.svg'
];


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

/** 程式碼與版本檔：永遠先向網路要最新版，避免 PWA 卡在舊版 */
function isAppCodeRequest(request) {
  try {
    const { pathname } = new URL(request.url);
    return (
      pathname.endsWith('/sw.js') ||
      pathname.endsWith('sw.js') ||
      pathname.endsWith('/index.html') ||
      pathname.endsWith('index.html') ||
      pathname.includes('/js/') ||
      pathname.includes('/css/')
    );
  } catch {
    return false;
  }
}

async function networkFirstAppCode(request) {
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
      await cache.addAll(PRECACHE_ASSETS);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
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
  // 跨域請求（雲端 TTS、字典 API 等）不經 SW，避免攔截失敗
  if (!isSameOrigin(event.request)) return;

  if (isWordsJsonRequest(event.request)) {
    event.respondWith(networkFirstWords(event.request));
    return;
  }

  if (isAppCodeRequest(event.request)) {
    event.respondWith(networkFirstAppCode(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});
