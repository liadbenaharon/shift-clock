// Service worker for Shift Clock push notifications.
// It intentionally does not intercept fetch requests or cache app files,
// so updating this worker cannot replace or corrupt the existing app UI/data.

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

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

// Handle local test notifications requested by the app UI.
self.addEventListener('message', event => {
  const data = event.data || {};
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
  const targetUrl = (event.notification.data && event.notification.data.url) ||
    'https://liadbenaharon.github.io/shift-clock/';

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        try {
          await client.navigate(targetUrl);
        } catch (_) {}
        return client.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
  })());
});
