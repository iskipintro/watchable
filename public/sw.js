const CACHE_NAME = 'moovie-cache-v5';
const IMAGE_CACHE = 'moovie-image-cache-v1';
const PRECACHE_ASSETS = [
  '/',
  '/favicon.svg',
  '/manifest.json'
];

const IMAGE_HOSTS = [
  'image.tmdb.org',
  'watchable-virid.vercel.app',
  'aoneroom.com',
  'hakunaymatata.com',
  'watch21.shop',
  'watch22.shop',
  'anilist.co'
];

function isImageRequest(url) {
  return IMAGE_HOSTS.some(host => url.hostname.includes(host)) &&
    (url.pathname.match(/\.(jpg|jpeg|png|webp|avif|gif|svg|bmp)$/i) ||
     url.pathname.includes('/t/p/') ||
     url.pathname.includes('/static/') ||
     url.pathname.includes('/resize'));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isVideo =
    url.pathname.match(/\.(mp4|webm|m3u8|ts|mp3|m4a|aac|wav|ogg)$/i) ||
    event.request.headers.get('range') ||
    url.hostname.includes('animeplay') ||
    url.hostname.includes('cinestream') ||
    url.pathname.includes('/stream/') ||
    url.pathname.includes('/api/stream');
  if (isVideo) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((r) => {
          const rClone = r.clone();
          caches.open(CACHE_NAME).then((c) => c.put('/', rClone));
          return r;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  const isStaticAsset =
    url.origin === self.location.origin &&
    (url.pathname.includes('/assets/') ||
     url.pathname.includes('/icons/') ||
     url.pathname.endsWith('.js') ||
     url.pathname.endsWith('.css') ||
     url.pathname.endsWith('.woff2') ||
     url.pathname.endsWith('.png') ||
     url.pathname.endsWith('.svg'));

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((hit) => {
        if (hit) {
          fetch(event.request).then((net) => {
            if (net.status === 200) {
              const netClone = net.clone();
              caches.open(CACHE_NAME).then((c) => c.put(event.request, netClone));
            }
          }).catch(() => {});
          return hit;
        }
        return fetch(event.request).then((net) => {
          if (net && net.status === 200 && net.type === 'basic') {
            const netClone = net.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, netClone));
          }
          return net;
        });
      })
    );
    return;
  }

  if (isImageRequest(url)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) => {
        return cache.match(event.request).then((hit) => {
          if (hit) {
            fetch(event.request).then((net) => {
              if (net && net.ok) {
                const netClone = net.clone();
                cache.put(event.request, netClone);
              }
            }).catch(() => {});
            return hit;
          }
          return fetch(event.request).then((net) => {
            if (net && net.ok) cache.put(event.request, net.clone());
            return net;
          }).catch(() => {
            return new Response('', { status: 503, statusText: 'Offline' });
          });
        });
      })
    );
    return;
  }
});
