// Service Worker for The Artisan Drop Bakery PWA / APK
const CACHE_NAME = 'artisan-bakery-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Network first with fallback
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});
