// sw.js (বা আপনার সার্ভিস ওয়ার্কার ফাইল)
const CACHE_NAME = 'ludo-royale-cache-v3'; // ক্যাশ ভার্সন আপডেট করা হলো

const ASSETS = [
  './',            // গিটহাব পেজেস ডিরেক্টরি সাবপাথ ডাইনামিকালি ডিটেক্ট করবে
  'index.html',    // রিলেটিভ পাথ (গিটহাবের ৪0৪ এরর ফিক্স করার জন্য)
  'style.css',
  'script.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png'
];

// ইনস্টলেশন এবং ফাইল ক্যাশ করা
self.addEventListener('install', (event) => {
  self.skipWaiting(); // নতুন সার্ভিস ওয়ার্কারকে ওয়েটিং স্টেট ছাড়াই অ্যাক্টিভেট করবে
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// পুরনো ক্যাশ ডিলিট করা এবং নতুন সার্ভিস ওয়ার্কার ক্লেইম করা
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
    }).then(() => {
      return self.clients.claim(); // পেজের ইনস্ট্যান্ট কন্ট্রোল নিয়ে আপডেট কার্যকর করবে
    })
  );
});

// রিকোয়েস্ট হ্যান্ডেল করা (অফলাইন সাপোর্ট ও ব্যাকগ্রাউন্ড ক্যাশ আপডেট)
self.addEventListener('fetch', (event) => {
  // WebSocket বা অন্য কোনো নন-http কানেকশন থাকলে এড়িয়ে যাবে
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Stale-While-Revalidate স্ট্র্যাটেজি: 
      // ক্যাশে ফাইল থাকলে দ্রুত দেখাবে এবং ব্যাকগ্রাউন্ডে নতুন আপডেট করা ফাইলটি ফেচ করে ক্যাশ মেমোরি আপডেট করে নেবে।
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // অফলাইন থাকলে বা নেটওয়ার্ক এরর হলে শান্তভাবে হ্যান্ডেল করবে
      });

      return cachedResponse || fetchPromise;
    })
  );
});
