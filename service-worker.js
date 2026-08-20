// Service worker for Shift Clock push notifications and fresh app delivery.
// App files are always fetched from the network with cache bypassing so phones do not stay on stale versions.

importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDDEElCF6iH35N9TYo7uqW0Oafm_E1E1Sw',
  authDomain: 'shift-clock-19c2d.firebaseapp.com',
  projectId: 'shift-clock-19c2d',
  storageBucket: 'shift-clock-19c2d.firebasestorage.app',
  messagingSenderId: '470768596231',
  appId: '1:470768596231:web:2ac632c55e92a27c9c01a2'
});

const messaging = firebase.messaging();
const APP_FILES = new Set(['/shift-clock/', '/shift-clock/index.html', '/shift-clock/push-client.js', '/shift-clock/updater.js', '/shift-clock/version.json', '/shift-clock/manifest.json']);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      try {
        const url = new URL(client.url);
        url.searchParams.set('_sw', Date.now().toString());
        await client.navigate(url.toString());
      } catch (_) {}
    }
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation = request.mode === 'navigate';
  const isAppFile = APP_FILES.has(url.pathname);
  if (!isNavigation && !isAppFile) return;

  event.respondWith((async () => {
    const freshRequest = new Request(request, { cache: 'no-store' });
    let response;
    try {
      response = await fetch(freshRequest);
    } catch (_) {
      return fetch(request);
    }

    if (!isNavigation || !response.ok) return response;

    try {
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) return response;
      let html = await response.text();
      if (!html.includes('updater.js')) {
        html = html.replace('</body>', '<script src="./updater.js?_sw=5.6"></script></body>');
      }
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      return new Response(html, { status: response.status, statusText: response.statusText, headers });
    } catch (_) {
      return response;
    }
  })());
});

// Handle local test notifications requested by the app UI.
self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (data.type !== 'SHOW_NOTIFICATION') return;
  const title = data.title || 'שעון נוכחות';
  const options = data.options || {};
  event.waitUntil(self.registration.showNotification(title, options));
});

messaging.onBackgroundMessage(payload => {
  const data = payload.data || {};
  const title = data.title || 'שעון נוכחות';
  const options = {
    body: data.body || 'יש לך תזכורת לגבי המשמרת הפעילה.',
    tag: data.tag || 'shift-clock-reminder',
    renotify: true,
    data: { url: data.url || 'https://liadbenaharon.github.io/shift-clock/' }
  };
  return self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || 'https://liadbenaharon.github.io/shift-clock/';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        try { await client.navigate(targetUrl); } catch (_) {}
        return client.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
  })());
});
