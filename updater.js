const APP_VERSION = 'v7.9';
const FIREBASE_HOST = 'shift-clock-19c2d.web.app';
const FIREBASE_URL = `https://${FIREBASE_HOST}/`;
const STORAGE_KEY = 'ilShiftTrackerData_v1';
let checkingUpdate = false;
let reloadingForUpdate = false;
let googleFlowRunning = false;

function applyDisplayedVersion(version) {
  const badge = document.querySelector('header.top h1 span');
  if (badge) badge.textContent = version;
  document.title = document.title.replace(/v\d+\.\d+/, version);
}

function setCloudMessage(text, isError = false) {
  const status = document.getElementById('v59CloudStatus');
  if (status) {
    status.textContent = text;
    status.classList.toggle('v59-error', isError);
  }
  const button = document.getElementById('v59GoogleBtn');
  if (button) button.disabled = false;
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  let s = value.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const binary = atob(s);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function makeTransferPayload() {
  const raw = localStorage.getItem(STORAGE_KEY) || '{}';
  return bytesToBase64Url(new TextEncoder().encode(raw));
}

function consumeTransferPayload() {
  if (location.hostname !== FIREBASE_HOST || !location.hash) return false;
  const params = new URLSearchParams(location.hash.slice(1));
  const state = params.get('shiftState');
  const autoGoogle = params.get('google') === '1';
  let imported = false;
  if (state) {
    try {
      const raw = new TextDecoder().decode(base64UrlToBytes(state));
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        imported = true;
      }
    } catch (err) {
      console.warn('State transfer failed:', err);
    }
  }
  if (autoGoogle) sessionStorage.setItem('shift-clock-auto-google', '1');
  history.replaceState(null, '', location.pathname + location.search);
  return imported;
}

const transferredState = consumeTransferPayload();

async function getHostingAuth() {
  const appMod = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js');
  const authMod = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js');

  const hostingConfig = {
    apiKey: 'AIzaSyDDEElCF6iH35N9TYo7uqW0Oafm_E1E1Sw',
    authDomain: FIREBASE_HOST,
    projectId: 'shift-clock-19c2d',
    storageBucket: 'shift-clock-19c2d.firebasestorage.app',
    messagingSenderId: '470768596231',
    appId: '1:470768596231:web:2ac632c55e92a27c9c01a2'
  };

  let hostingApp;
  try {
    hostingApp = appMod.getApp('google-hosting-auth');
  } catch (_) {
    hostingApp = appMod.initializeApp(hostingConfig, 'google-hosting-auth');
  }
  const hostingAuth = authMod.getAuth(hostingApp);
  try { await authMod.setPersistence(hostingAuth, authMod.browserLocalPersistence); } catch (_) {}
  return { appMod, authMod, hostingAuth };
}

async function finishRedirectIfPresent() {
  if (location.hostname !== FIREBASE_HOST) return false;
  try {
    const { appMod, authMod, hostingAuth } = await getHostingAuth();
    const result = await authMod.getRedirectResult(hostingAuth);
    if (!result?.user) return false;

    const credential = authMod.GoogleAuthProvider.credentialFromResult(result);
    if (!credential) throw Object.assign(new Error('No Google credential returned'), { code: 'auth/no-google-credential' });

    const defaultApp = appMod.getApps().find(app => app.name === '[DEFAULT]');
    if (defaultApp) {
      const defaultAuth = authMod.getAuth(defaultApp);
      await authMod.signInWithCredential(defaultAuth, credential);
    }

    localStorage.setItem('shift-clock-google-connected', '1');
    setCloudMessage('✓ התחברת ל-Google. הגיבוי הקבוע פעיל.');
    const button = document.getElementById('v59GoogleBtn');
    if (button) {
      button.textContent = '✓ מחובר ל-Google — הגיבוי קבוע';
      button.disabled = true;
    }
    return true;
  } catch (err) {
    console.error('Google redirect completion failed:', err);
    setCloudMessage(`שגיאת התחברות: ${err?.code || 'unknown-error'}${err?.message ? ` — ${err.message}` : ''}`, true);
    return false;
  }
}

async function startGoogleFlow(button) {
  if (googleFlowRunning) return;
  googleFlowRunning = true;
  button.disabled = true;

  try {
    if (location.hostname !== FIREBASE_HOST) {
      setCloudMessage('מעביר לגרסת Firebase המאובטחת כדי להשלים התחברות ל-Google…');
      const state = makeTransferPayload();
      location.href = `${FIREBASE_URL}#google=1&shiftState=${encodeURIComponent(state)}`;
      return;
    }

    setCloudMessage('מעביר ל-Google להתחברות…');
    const { authMod, hostingAuth } = await getHostingAuth();
    const provider = new authMod.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await authMod.signInWithRedirect(hostingAuth, provider);
  } catch (err) {
    console.error('Google redirect start failed:', err);
    setCloudMessage(`שגיאת התחברות: ${err?.code || 'unknown-error'}${err?.message ? ` — ${err.message}` : ''}`, true);
    button.disabled = false;
    googleFlowRunning = false;
  }
}

function installGoogleHandler() {
  const oldButton = document.getElementById('v59GoogleBtn');
  if (!oldButton || oldButton.dataset.v68Handler === '1') return false;
  const button = oldButton.cloneNode(true);
  button.dataset.v68Handler = '1';
  oldButton.replaceWith(button);
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    startGoogleFlow(button);
  });
  return true;
}

async function bootGoogleAuth() {
  installGoogleHandler();
  const observer = new MutationObserver(() => {
    if (installGoogleHandler()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 10000);

  if (location.hostname === FIREBASE_HOST) {
    const finished = await finishRedirectIfPresent();
    const auto = sessionStorage.getItem('shift-clock-auto-google') === '1';
    if (auto && !finished) {
      sessionStorage.removeItem('shift-clock-auto-google');
      const waitForButton = setInterval(() => {
        const button = document.getElementById('v59GoogleBtn');
        if (!button) return;
        clearInterval(waitForButton);
        startGoogleFlow(button);
      }, 150);
      setTimeout(() => clearInterval(waitForButton), 8000);
    } else if (finished) {
      sessionStorage.removeItem('shift-clock-auto-google');
    } else if (transferredState) {
      setCloudMessage('הנתונים הועברו לגרסת Firebase. אפשר להתחבר ל-Google לגיבוי קבוע.');
    }
  }
}

async function checkForAppUpdate(force = false) {
  if (checkingUpdate || reloadingForUpdate) return;
  checkingUpdate = true;
  try {
    const response = await fetch(`./version.json?_=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) return;
    const info = await response.json();
    const latest = String(info.version || '').trim();
    if (!latest) return;

    applyDisplayedVersion(APP_VERSION);

    if (latest !== APP_VERSION || force) {
      const lastReload = Number(sessionStorage.getItem('shift-clock-update-reload') || 0);
      if (Date.now() - lastReload < 15000) return;
      sessionStorage.setItem('shift-clock-update-reload', String(Date.now()));
      reloadingForUpdate = true;
      const url = new URL(window.location.href);
      url.searchParams.set('_appv', latest.replace(/^v/, ''));
      url.searchParams.set('_ts', String(Date.now()));
      window.location.replace(url.toString());
    }
  } catch (err) {
    console.debug('Update check skipped:', err);
  } finally {
    checkingUpdate = false;
  }
}

applyDisplayedVersion(APP_VERSION);
bootGoogleAuth();
checkForAppUpdate();
setTimeout(checkForAppUpdate, 2500);
setInterval(checkForAppUpdate, 30000);
window.addEventListener('focus', () => checkForAppUpdate());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkForAppUpdate();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(registration => {
    registration.update().catch(() => {});
  }).catch(() => {});
}
