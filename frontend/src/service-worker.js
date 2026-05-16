/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

// Cache the built app shell plus static assets so the PWA opens offline.
// Network calls to the Worker backend are NOT cached — those need fresh data.

const CACHE = `vi-${version}`;
const ASSETS = [...build, ...files];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(ASSETS);
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Don't cache the Worker backend — always fetch fresh.
  if (url.hostname.endsWith('.workers.dev')) return;
  // Don't cache Discogs / eBay either (we only link to them).
  if (url.hostname.endsWith('discogs.com') || url.hostname.endsWith('ebay.com')) return;

  // Same-origin assets: cache-first.
  if (url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const res = await fetch(request);
          if (res.ok) cache.put(request, res.clone());
          return res;
        } catch (e) {
          return new Response('Offline', { status: 503 });
        }
      })()
    );
  }
});
