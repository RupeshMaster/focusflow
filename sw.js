/**
 * sw.js
 * Service Worker for Offline Caching
 */

const CACHE_NAME = 'focusflow-v4.0';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './js/storage.js',
    './js/scheduler.js',
    './js/charts.js',
    './manifest.json'
    // Icons would strictly need to be cached if they exist
    // './assets/icon-192.png' 
];

// Install Event
self.addEventListener('install', event => {
    self.skipWaiting(); // Force immediate activation
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
});

// Activate Event (Cleanup old caches)
self.addEventListener('activate', event => {
    console.log('[SW] Activating new version:', CACHE_NAME);
    event.waitUntil(
        Promise.all([
            self.clients.claim(), // Force control of open clients
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
        ])
    );
});

// Fetch Event (Network First, then Cache? Or Stale-While-Revalidate? Or Cache First?)
// Offline-first usually implies Cache First for static assets.
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                return fetch(event.request).then(
                    function (response) {
                        // Check if we received a valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone the response
                        var responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then(function (cache) {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    }
                );
            })
    );
});
