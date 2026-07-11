const CACHE_NAME = 'ludo-royale-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// ইনস্টলেশন এবং ফাইল ক্যাশ করা
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// পুরনো ক্যাশ ডিলিট করা
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// রিকোয়েস্ট হ্যান্ডেল করা (অফলাইন সাপোর্ট)
self.addEventListener('fetch', (event) => {
  // WebSocket বা অন্য কোনো নন-http কানেকশন থাকলে এড়িয়ে যাবে
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
