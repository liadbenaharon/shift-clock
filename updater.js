const APP_VERSION = 'v6.1';
let checkingUpdate = false;
let reloadingForUpdate = false;

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

function authErrorText(err) {
  const code = String(err?.code || 'unknown-error');
  const message = String(err?.message || '').trim();
  return `שגיאת התחברות: ${code}${message ? ` — ${message}` : ''}`;
}

// v6.1: On mobile use Firebase redirect auth instead of a popup. Mobile
// browsers often open the popup for a moment and then close it immediately.
const firebaseConfigV61 = {
  apiKey: 'AIzaSyDDEElCF6iH35N9TYo7uqW0Oafm_E1E1Sw',
  authDomain: 'shift-clock-19c2d.firebaseapp.com',
  projectId: 'shift-clock-19c2d',
  storageBucket: 'shift-clock-19c2d.firebasestorage.app',
  messagingSenderId: '470768596231',
  appId: '1:470768596231:web:2ac632c55e92a27c9c01a2'
};

let redirectAuthReady = null;
async function getRedirectAuth() {
  if (redirectAuthReady) return redirectAuthReady;
  redirectAuthReady = (async () => {
    const appMod = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js');
    const authMod = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js');
    const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfigV61);
    const auth = authMod.getAuth(app);
    return { auth, authMod };
  })();
  return redirectAuthReady;
}

async function finishRedirectLogin() {
  try {
    const { auth, authMod } = await getRedirectAuth();
    const result = await authMod.getRedirectResult(auth);
    if (result?.user) {
      sessionStorage.removeItem('shift-clock-google-redirect-pending');
      setCloudMessage('✓ מחובר ל-Google. הגיבוי הקבוע פעיל.');
      setTimeout(() => location.reload(), 700);
    }
  } catch (err) {
    if (sessionStorage.getItem('shift-clock-google-redirect-pending') === '1') {
      sessionStorage.removeItem('shift-clock-google-redirect-pending');
      setCloudMessage(authErrorText(err), true);
    }
  }
}

// Capture the Google-backup button before push-client's popup handler.
document.addEventListener('click', async event => {
  const button = event.target?.closest?.('#v59GoogleBtn');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  button.disabled = true;
  setCloudMessage('מעביר להתחברות מאובטחת עם Google…');
  try {
    const { auth, authMod } = await getRedirectAuth();
    const provider = new authMod.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    sessionStorage.setItem('shift-clock-google-redirect-pending', '1');
    await authMod.signInWithRedirect(auth, provider);
  } catch (err) {
    sessionStorage.removeItem('shift-clock-google-redirect-pending');
    setCloudMessage(authErrorText(err), true);
  }
}, true);

// Keep exact popup diagnostics as a fallback for older cached code.
const originalConsoleError = console.error.bind(console);
console.error = (...args) => {
  originalConsoleError(...args);
  try {
    if (String(args[0] || '').includes('Google backup sign-in failed')) {
      const err = args.find(v => v && typeof v === 'object' && (v.code || v.message));
      setCloudMessage(authErrorText(err), true);
    }
  } catch (_) {}
};

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
finishRedirectLogin();
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
