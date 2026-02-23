// Service Worker for Offline Support
const CACHE_NAME = 'brazel-safety-v1';
const urlsToCache = [
  './brazel-logo.png',
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/admin.js',
  '/form.js',
  '/storage.js',
  '/pdf-generator.js',
  '/email-sender.js',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/signature_pad@4.1.7/dist/signature_pad.umd.min.js'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        
        // Clone the request
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then((response) => {
          // Check if valid response
          if (!response || response.status !== 200) {
            return response;
          }
          
          // Clone the response
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        }).catch(() => {
          // Network request failed, return offline page if available
          return caches.match('/index.html');
        });
      })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Background sync for pending forms (if supported)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-forms') {
    event.waitUntil(syncPendingForms());
  }
});

async function syncPendingForms() {
  // This would be called when connection is restored
  // The actual syncing logic is in app.js
  console.log('Background sync triggered');
}
