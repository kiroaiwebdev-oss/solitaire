/**
 * Service Worker for Premium Solitaire.
 * Cache-first strategy for offline play.
 */

const CACHE_NAME = 'solitaire-v2';

const FILES_TO_CACHE = [
  './index.html',
  './styles.css',
  './manifest.json',
  './src/main.js',
  './src/core/loop.js',
  './src/core/input.js',
  './src/core/math.js',
  './src/core/render.js',
  './src/core/audio.js',
  './src/game/game.js',
  './src/game/card.js',
  './src/game/deck.js',
  './src/game/tableau.js',
  './src/game/foundation.js',
  './src/game/stock.js',
  './src/game/drag.js',
  './src/systems/save-manager.js',
  './src/systems/progression.js',
  './src/systems/daily-challenge.js',
  './src/systems/achievements.js',
  './src/ui/hud.js',
  './src/ui/screens.js',
  './src/ui/text-fit.js',
  './src/ui/particles.js',
  './src/ui/animations.js',
  './src/platform/adapter.js',
  './src/platform/standalone.js',
  './src/platform/crazygames.js',
  './src/platform/gamedistribution.js',
  './src/platform/y8.js',
  './src/platform/playhop.js',
  './src/platform/sdkUtil.js',
  './src/platform/index.js',
  './src/config/scoring.js',
  './src/config/themes.js',
  './src/config/daily-seeds.js',
  './src/config/achievements.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FILES_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;
      return fetch(event.request).then((fetchResponse) => {
        if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
          return fetchResponse;
        }
        const responseToCache = fetchResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return fetchResponse;
      }).catch(() => {
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
