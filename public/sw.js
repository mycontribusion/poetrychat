const CACHE_NAME = 'poetrychat-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/favicon.ico',
    '/logo192.png',
    '/logo512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    // If request is for an API, don't cache
    if (event.request.url.includes('/api/')) return;

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached version or fetch new
                return response || fetch(event.request).catch(() => caches.match('/index.html'));
            })
    );
});
