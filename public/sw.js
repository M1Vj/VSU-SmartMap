const CACHE_NAME = 'vsu-smartmap-v16';
const TILE_CACHE_NAME = 'map-tiles-v1';
const TILE_CACHE_MAX_ENTRIES = 400;
const PRECACHE_OPERATION_TIMEOUT_MS = 10000;
const ENABLE_LOCAL_OFFLINE_PREVIEW = new URL(self.location.href).searchParams.get('offline') === '1';
const IS_LOCAL_DEVELOPMENT = ['localhost', '127.0.0.1', '0.0.0.0'].includes(self.location.hostname) &&
  !ENABLE_LOCAL_OFFLINE_PREVIEW;

const STATIC_ASSETS = [
  '/',
  '/directory',
  '/boarding-houses',
  '/chat',
  '/events',
  '/info',
  '/schedule',
  '/offline',
  '/manifest.json',
  '/icons/icon-192x192.png?v=20260709',
  '/icons/icon-512x512.png?v=20260709',
];

const OFFLINE_CACHE_MARKER_SCRIPT = `
<script>
window.__VSU_SMARTMAP_SERVED_FROM_OFFLINE_CACHE__ = true;
</script>`;

const DEV_HMR_OFFLINE_SHIM = `
<script>
(function () {
  if (window.__VSU_SMARTMAP_OFFLINE_HMR_SHIM__) return;
  window.__VSU_SMARTMAP_OFFLINE_HMR_SHIM__ = true;
  var NativeWebSocket = window.WebSocket;
  if (!NativeWebSocket) return;
  function SilentSocket(url, protocols) {
    if (String(url).indexOf('/_next/webpack-hmr') === -1) {
      return protocols === undefined ? new NativeWebSocket(url) : new NativeWebSocket(url, protocols);
    }
    var target = new EventTarget();
    target.url = String(url);
    target.readyState = NativeWebSocket.CLOSED;
    target.bufferedAmount = 0;
    target.extensions = '';
    target.protocol = '';
    target.binaryType = 'blob';
    target.close = function () {};
    target.send = function () {};
    setTimeout(function () {
      target.dispatchEvent(new CloseEvent('close'));
    }, 0);
    return target;
  }
  SilentSocket.CONNECTING = NativeWebSocket.CONNECTING;
  SilentSocket.OPEN = NativeWebSocket.OPEN;
  SilentSocket.CLOSING = NativeWebSocket.CLOSING;
  SilentSocket.CLOSED = NativeWebSocket.CLOSED;
  SilentSocket.prototype = NativeWebSocket.prototype;
  window.WebSocket = SilentSocket;
})();
</script>`;

function isMapTileRequest(url) {
  return url.hostname === 'tile.openstreetmap.org' ||
    url.hostname.endsWith('.openstreetmap.org') ||
    url.hostname === 'basemaps.cartocdn.com' ||
    url.hostname.endsWith('.cartocdn.com') ||
    url.hostname === 'tiles.openfreemap.org' ||
    url.hostname === 'server.arcgisonline.com';
}

async function trimTileCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= TILE_CACHE_MAX_ENTRIES) return;

  await Promise.all(
    keys
      .slice(0, keys.length - TILE_CACHE_MAX_ENTRIES)
      .map((request) => cache.delete(request))
  );
}

function isNetworkOnlyRequest(url, request) {
  if (request.method !== 'GET') return true;
  if (url.origin === self.location.origin) {
    return url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/');
  }
  const isSupabaseProjectHost = url.hostname !== 'supabase.co' &&
    url.hostname.endsWith('.supabase.co');
  if (isSupabaseProjectHost && url.pathname.startsWith('/auth/v1/')) return true;
  return url.pathname.includes('/rest/v1/') || url.pathname.includes('/rpc/');
}

function isSameOriginGet(url, request) {
  return url.origin === self.location.origin && request.method === 'GET';
}

function isAdminRoute(url) {
  return url.origin === self.location.origin && url.pathname.startsWith('/admin');
}

function isOwnerRoute(url) {
  return url.origin === self.location.origin && url.pathname.startsWith('/owner');
}

function isCacheablePage(url, request) {
  if (!isSameOriginGet(url, request)) return false;
  if (isAdminRoute(url)) return false;
  if (isOwnerRoute(url)) return false;
  if (url.pathname.startsWith('/api/')) return false;
  if (url.pathname.startsWith('/_next/')) return false;
  return request.mode === 'navigate';
}

function isNextRscRequest(url, request) {
  const accept = request.headers.get('Accept') || '';
  if (!isSameOriginGet(url, request)) return false;
  if (isAdminRoute(url)) return false;
  if (isOwnerRoute(url)) return false;
  return request.headers.get('RSC') === '1' ||
    url.searchParams.has('_rsc') ||
    accept.includes('text/x-component');
}

function getStaticAssetUrlsFromHtml(html) {
  const matches = html.match(/\/_next\/static\/[^"'\\<>\s)]+/g) || [];
  return [...new Set(matches)].map((assetPath) => new URL(assetPath, self.location.origin).toString());
}

function runBoundedPrecacheOperation(label, operation, onTimeout) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (onTimeout) onTimeout();
      reject(new Error(`Timed out while attempting to ${label}`));
    }, PRECACHE_OPERATION_TIMEOUT_MS);

    Promise.resolve()
      .then(operation)
      .then(resolve, reject)
      .finally(() => clearTimeout(timeout));
  });
}

function fetchForPrecache(request) {
  const controller = new AbortController();
  return runBoundedPrecacheOperation(
    `fetch ${request.url}`,
    () => fetch(request, { signal: controller.signal }),
    () => controller.abort()
  );
}

function matchForPrecache(cache, request) {
  return runBoundedPrecacheOperation(
    `read ${request.url} from the precache`,
    () => cache.match(request)
  );
}

function putForPrecache(cache, request, response) {
  return runBoundedPrecacheOperation(
    `write ${request.url} to the precache`,
    () => cache.put(request, response)
  );
}

async function cacheOptionalStaticAsset(assetUrl, cache) {
  const request = new Request(assetUrl);
  const cached = await matchForPrecache(cache, request);
  if (cached) return;

  const response = await fetchForPrecache(request);
  if (!response.ok) {
    throw new Error(`Failed to precache optional asset ${assetUrl}: ${response.status}`);
  }
  await putForPrecache(cache, request, response);
}

async function cacheStaticAssetsFromHtml(html, cache, optionalAssetTasks = new Map()) {
  const assetUrls = getStaticAssetUrlsFromHtml(html);

  await Promise.all(assetUrls.map((assetUrl) => {
    if (!optionalAssetTasks.has(assetUrl)) {
      const task = cacheOptionalStaticAsset(assetUrl, cache).catch((error) => {
        console.warn(`[service-worker] Optional precache asset skipped: ${assetUrl}`, error);
      });
      optionalAssetTasks.set(assetUrl, task);
    }
    return optionalAssetTasks.get(assetUrl);
  }));
}

async function cachePageResponse(request, response, precacheCache, optionalAssetTasks) {
  if (!response || !response.ok) return;
  const cache = precacheCache || await caches.open(CACHE_NAME);
  const contentType = response.headers.get('Content-Type') || '';

  if (!contentType.includes('text/html')) {
    await putForPrecache(cache, request, response.clone());
    return;
  }

  const headers = new Headers(response.headers);
  const html = await runBoundedPrecacheOperation(
    `read ${request.url} response body`,
    () => response.text()
  );
  const offlineScripts = html.includes('/_next/webpack-hmr')
    ? `${OFFLINE_CACHE_MARKER_SCRIPT}${DEV_HMR_OFFLINE_SHIM}`
    : OFFLINE_CACHE_MARKER_SCRIPT;
  const withOfflineShim = html.includes('<head>')
    ? html.replace('<head>', `<head>${offlineScripts}`)
    : `${offlineScripts}${html}`;

  await putForPrecache(cache, request, new Response(withOfflineShim, {
    status: response.status,
    statusText: response.statusText,
    headers,
  }));
  await cacheStaticAssetsFromHtml(html, cache, optionalAssetTasks);
}

async function precacheRequiredStaticAsset(asset, cache, optionalAssetTasks) {
  const request = new Request(asset);
  const response = await fetchForPrecache(request);

  if (!response.ok) {
    throw new Error(`Failed to precache ${asset}: ${response.status}`);
  }

  const contentType = response.headers.get('Content-Type') || '';
  if (contentType.includes('text/html')) {
    await cachePageResponse(request, response, cache, optionalAssetTasks);
    return;
  }

  await putForPrecache(cache, request, response);
}

async function precacheStaticAssets() {
  const cache = await runBoundedPrecacheOperation(
    `open ${CACHE_NAME}`,
    () => caches.open(CACHE_NAME)
  );
  const optionalAssetTasks = new Map();
  const results = await Promise.allSettled(
    STATIC_ASSETS.map((asset) =>
      precacheRequiredStaticAsset(asset, cache, optionalAssetTasks)
    )
  );
  const failures = results
    .map((result, index) => ({ result, asset: STATIC_ASSETS[index] }))
    .filter(({ result }) => result.status === 'rejected');

  if (failures.length > 0) {
    failures.forEach(({ result, asset }) => {
      console.error(`[service-worker] Required precache asset failed: ${asset}`, result.reason);
    });
    throw new Error(`Failed to precache ${failures.length} required static asset(s)`);
  }
}



self.addEventListener('install', (event) => {
  event.waitUntil(IS_LOCAL_DEVELOPMENT ? Promise.resolve() : precacheStaticAssets());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const keepCaches = [CACHE_NAME, TILE_CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      const deleteCaches = Promise.all(
        cacheNames
          .filter((name) => !keepCaches.includes(name))
          .map((name) => caches.delete(name))
      );
      if (!IS_LOCAL_DEVELOPMENT) return deleteCaches;

      return Promise.all([
        deleteCaches,
        caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name)))),
        self.registration.unregister(),
      ]);
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (IS_LOCAL_DEVELOPMENT) {
    event.respondWith(fetch(request));
    return;
  }

  if (isNetworkOnlyRequest(url, request)) {
    event.respondWith(fetch(request));
    return;
  }

  // Cache-first for Next.js static assets (versioned/immutable)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) =>
          cached || fetch(request).then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          }).catch(() => {
            return new Response(
              'throw new Error("VSU SmartMap cannot load this uncached code while offline.");',
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: {
                  'Content-Type': 'application/javascript; charset=utf-8',
                  'Cache-Control': 'no-store',
                },
              }
            );
          })
        )
      )
    );
    return;
  }

  // Cache-first for map tiles
  if (isMapTileRequest(url)) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request).then((networkResponse) => {
            if (networkResponse.ok) {
              event.waitUntil(
                cache
                  .put(request, networkResponse.clone())
                  .then(() => trimTileCache(cache))
              );
            }
            return networkResponse;
          }).catch(() => {
            return new Response('', { status: 204 });
          });
        });
      })
    );
    return;
  }

  // Network-first for warmed Next.js RSC payloads used by client navigation.
  if (isNextRscRequest(url, request)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request, { ignoreSearch: true });

        try {
          const response = await fetch(request);
          if (response.ok) {
            await cache.put(request, response.clone());
          }
          return response;
        } catch {
          if (cachedResponse) return cachedResponse;
          return new Response('', { status: 204 });
        }
      })
    );
    return;
  }

  // Network-first for navigation with offline fallback
  if (request.mode === 'navigate') {
    if (isAdminRoute(url)) {
      event.respondWith(
        fetch(request).catch(() => caches.match('/offline').then((offlinePage) => {
          if (offlinePage) return offlinePage;
          return new Response('Admin is unavailable offline.', { status: 200 });
        }))
      );
      return;
    }

    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isCacheablePage(url, request) && response.ok) {
            event.waitUntil(cachePageResponse(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request, { ignoreSearch: true }).then((cachedPage) => {
            if (cachedPage) return cachedPage;
            return caches.match('/offline').then((offlinePage) => {
              if (offlinePage) return offlinePage;
              return new Response('Offline', { status: 200 });
            });
          });
        })
    );
    return;
  }

  // Cache-first with network fallback for other assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).catch(() => {
        return new Response('', { status: 204 });
      });
    })
  );
});
