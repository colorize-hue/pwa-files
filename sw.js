const CACHE_NAME = 'huhurez-v1.0.0';
const STATIC_CACHE = 'huhurez-static-v1.0.0';
const DYNAMIC_CACHE = 'huhurez-dynamic-v1.0.0';

// Assets to cache on install
const STATIC_ASSETS = [
  'https://www.huhurez.com/',
  'https://colorize-hue.github.io/pwa-files/favicon-32x32.png',
  'https://colorize-hue.github.io/pwa-files/favicon-16x16.png',
  'https://colorize-hue.github.io/pwa-files/apple-touch-icon.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// URLs that should always be fetched from network
const NETWORK_FIRST = [
  '/feeds/',
  '/search/',
  'googleapis.com',
  'google-analytics.com',
  'googletagmanager.com',
  'googlesyndication.com',
  'pagead2.googlesyndication.com'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('HuhuRez SW: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('HuhuRez SW: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('HuhuRez SW: Static assets cached');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('HuhuRez SW: Error caching static assets', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('HuhuRez SW: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('HuhuRez SW: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('HuhuRez SW: Activated');
        return self.clients.claim();
      })
  );
});

// Helper function to check if URL should be network first
function isNetworkFirst(url) {
  return NETWORK_FIRST.some(pattern => url.includes(pattern));
}

// Helper function to check if request should be cached
function shouldCache(request) {
  // Don't cache if it's not a GET request
  if (request.method !== 'GET') return false;
  
  // Don't cache Chrome extension requests
  if (request.url.startsWith('chrome-extension://')) return false;
  
  // Don't cache external analytics and ads (but allow network requests)
  if (isNetworkFirst(request.url)) return false;
  
  return true;
}

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  const { request } = event;
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip Chrome extension requests
  if (request.url.startsWith('chrome-extension://')) {
    return;
  }
  
  // Network first for analytics, ads, and feeds
  if (isNetworkFirst(request.url)) {
    event.respondWith(
      fetch(request).catch(error => {
        console.log('HuhuRez SW: Network request failed, no cache fallback for:', request.url);
        throw error;
      })
    );
    return;
  }
  
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        // Return cached version if available
        if (cachedResponse) {
          console.log('HuhuRez SW: Serving from cache:', request.url);
          return cachedResponse;
        }
        
        // Otherwise fetch from network
        return fetch(request)
          .then(networkResponse => {
            // Don't cache if not a valid response
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            
            // Don't cache if we shouldn't cache this request
            if (!shouldCache(request)) {
              return networkResponse;
            }
            
            // Cache dynamic content (blog posts, images, etc.)
            const responseToCache = networkResponse.clone();
            
            // Determine cache strategy based on request type
            if (request.url.includes('huhurez.com') || 
                request.destination === 'image' ||
                request.destination === 'document') {
              
              caches.open(DYNAMIC_CACHE)
                .then(cache => {
                  console.log('HuhuRez SW: Caching:', request.url);
                  cache.put(request, responseToCache);
                })
                .catch(error => {
                  console.log('HuhuRez SW: Cache put failed:', error);
                });
            }
            
            return networkResponse;
          })
          .catch(error => {
            console.log('HuhuRez SW: Fetch failed for:', request.url, error);
            
            // Return offline fallback for navigation requests
            if (request.destination === 'document') {
              return new Response(`
                <!DOCTYPE html>
                <html>
                <head>
                  <title>HuhuRez - Offline</title>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <style>
                    body { 
                      font-family: Inter, sans-serif; 
                      text-align: center; 
                      padding: 50px; 
                      background: #e4e0db;
                      color: #333;
                    }
                    .offline-icon { font-size: 4rem; margin-bottom: 1rem; }
                    h1 { color: #8c2828; }
                    .retry-btn {
                      background: #8c2828;
                      color: white;
                      padding: 10px 20px;
                      border: none;
                      border-radius: 5px;
                      cursor: pointer;
                      font-size: 1rem;
                      margin-top: 1rem;
                    }
                  </style>
                </head>
                <body>
                  <div class="offline-icon">📱</div>
                  <h1>HuhuRez - Offline</h1>
                  <p>Nu există conexiune la internet.</p>
                  <p>Verifică conexiunea și încearcă din nou.</p>
                  <button class="retry-btn" onclick="window.location.reload()">Încearcă din nou</button>
                </body>
                </html>
              `, {
                headers: { 
                  'Content-Type': 'text/html',
                  'Cache-Control': 'no-cache'
                }
              });
            }
            
            // Return placeholder for images
            if (request.destination === 'image') {
              return new Response(
                `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200">
                  <rect width="300" height="200" fill="#e4e0db"/>
                  <rect x="10" y="10" width="280" height="180" fill="none" stroke="#8c2828" stroke-width="2" stroke-dasharray="5,5"/>
                  <text x="150" y="90" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="14" fill="#8c2828">HuhuRez</text>
                  <text x="150" y="110" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="12" fill="#666">Imagine offline</text>
                  <text x="150" y="130" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="10" fill="#999">Verifică conexiunea</text>
                </svg>`,
                { 
                  headers: { 
                    'Content-Type': 'image/svg+xml',
                    'Cache-Control': 'no-cache'
                  } 
                }
              );
            }
            
            throw error;
          });
      })
  );
});

// Background sync for offline actions (if supported)
self.addEventListener('sync', event => {
  if (event.tag === 'huhurez-background-sync') {
    console.log('HuhuRez SW: Background sync triggered');
    // Handle background sync tasks here (e.g., upload queued comments)
    event.waitUntil(handleBackgroundSync());
  }
});

// Handle background sync tasks
async function handleBackgroundSync() {
  try {
    // Example: Sync queued comments or actions
    console.log('HuhuRez SW: Performing background sync tasks');
    
    // You can implement offline comment queueing and syncing here
    // const queuedComments = await getQueuedComments();
    // await syncComments(queuedComments);
    
  } catch (error) {
    console.error('HuhuRez SW: Background sync failed:', error);
  }
}

// Push notifications (for future implementation)
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'Articol nou pe HuhuRez',
      icon: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEglwcYFv9xvWAC4DkbgmeapUipse0Ur87XnUsqzL6pINOgsHDu2f4rIn5V35AZw59X6MSgwRzNmVqj_3-QmqMUwdKkq7IOPKVygHAl2Fb4TNzpKIYNLqmrxg1a2-hutH69DfMUi5BkZThLIYwLvUqy0YyLPV_N8cakF-4tFBs6oHdetIsYKQNEHsDJjCx0/s1600/android-chrome-192x192.png',
      badge: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhSSb-N4mH29MpfqdLKEH1h_T0Frer_KKuv3g6Jjm1vqiUG_t20WSyQnGVIHsMo2gUxxsTZkE-0hhOkNrALu03ceuZyExMeeAsx9XsWWr0RT4WGLSMXH-zbnx8qg2oCmWMRQkn-HWPr7vVCEFMioV2-nKEQ6pq-hExl6em_m15yExPVAfTG6glzhcoxaeE/s1600/favicon-32x32.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.primaryKey || 'huhurez-notification',
        url: data.url || 'https://www.huhurez.com/'
      },
      actions: [
        {
          action: 'open',
          title: 'Citește articolul',
          icon: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhSSb-N4mH29MpfqdLKEH1h_T0Frer_KKuv3g6Jjm1vqiUG_t20WSyQnGVIHsMo2gUxxsTZkE-0hhOkNrALu03ceuZyExMeeAsx9XsWWr0RT4WGLSMXH-zbnx8qg2oCmWMRQkn-HWPr7vVCEFMioV2-nKEQ6pq-hExl6em_m15yExPVAfTG6glzhcoxaeE/s1600/favicon-32x32.png'
        },
        {
          action: 'close',
          title: 'Închide',
          icon: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhSSb-N4mH29MpfqdLKEH1h_T0Frer_KKuv3g6Jjm1vqiUG_t20WSyQnGVIHsMo2gUxxsTZkE-0hhOkNrALu03ceuZyExMeeAsx9XsWWr0RT4WGLSMXH-zbnx8qg2oCmWMRQkn-HWPr7vVCEFMioV2-nKEQ6pq-hExl6em_m15yExPVAfTG6glzhcoxaeE/s1600/favicon-32x32.png'
        }
      ],
      tag: 'huhurez-notification',
      requireInteraction: false
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'HuhuRez - Articol nou', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('HuhuRez SW: Notification click received');
  
  event.notification.close();
  
  if (event.action === 'open') {
    const url = event.notification.data.url || 'https://www.huhurez.com/';
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(clientList => {
        // Check if a window is already open
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
    );
  }
});

// Handle cache updates and messages from main thread
self.addEventListener('message', event => {
  console.log('HuhuRez SW: Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE)
        .then(cache => {
          console.log('HuhuRez SW: Caching requested URLs');
          return cache.addAll(event.data.payload);
        })
        .catch(error => {
          console.error('HuhuRez SW: Failed to cache requested URLs:', error);
        })
    );
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      type: 'VERSION',
      version: CACHE_NAME
    });
  }
});
