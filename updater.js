const APP_VERSION = 'v6.5';
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
  if (code === 'auth/popup-blocked') return 'הדפדפן חסם את חלון Google. אפשר חלונות קופצים לאתר ונסה שוב. (auth/popup-blocked)';
  if (code === 'auth/popup-closed-by-user') return 'חלון Google נסגר לפני שההתחברות הושלמה. נסה שוב. (auth/popup-closed-by-user)';
  if (code === 'auth/cancelled-popup-request') return 'בקשת ההתחברות בוטלה לפני שהושלמה. נסה שוב פעם אחת. (auth/cancelled-popup-request)';
  if (code === 'auth/unauthorized-domain') return 'הדומיין עדיין לא מורשה ב-Firebase. (auth/unauthorized-domain)';
  if (code === 'auth/operation-not-allowed') return 'Google Sign-In לא מופעל ב-Firebase. (auth/operation-not-allowed)';
  if (code === 'auth/network-request-failed') return 'הייתה שגיאת רשת בזמן ההתחברות ל-Google. (auth/network-request-failed)';
  if (code === 'auth/web-storage-unsupported') return 'הדפדפן חוסם אחסון שנדרש להתחברות ל-Google. (auth/web-storage-unsupported)';
  const message = String(err?.message || '').trim();
  return `שגיאת התחברות: ${code}${message ? ` — ${message}` : ''}`;
}

// v6.5: GitHub Pages is NOT Firebase Hosting, so the GitHub Pages host cannot
// be used directly as authDomain because it does not serve Firebase's /__/auth
// helper routes. Keep Firebase's real authDomain and use popup auth.
const firebaseConfigV65 = {
  apiKey: 'AIzaSyDDEElCF6iH35N9TYo7uqW0Oafm_E1E1Sw',
  authDomain: 'shift-clock-19c2d.firebaseapp.com',
  projectId: 'shift-clock-19c2d',
  storageBucket: 'shift-clock-19c2d.firebasestorage.app',
  messagingSenderId: '470768596231',
  appId: '1:470768596231:web:2ac632c55e92a27c9c01a2'
};

let popupAuthReady = null;
async function getPopupAuth() {
  if (popupAuthReady) return popupAuthReady;
  popupAuthReady = (async () => {
    const appMod = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js');
    const authMod = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js');
    const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfigV65);
    const auth = authMod.getAuth(app);
    try {
      await authMod.setPersistence(auth, authMod.browserLocalPersistence);
    } catch (_) {}
    return { auth, authMod };
  })();
  return popupAuthReady;
}

let googlePopupRunning = false;

document.addEventListener('click', async event => {
  const button = event.target?.closest?.('#v59GoogleBtn');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  if (googlePopupRunning) return;
  googlePopupRunning = true;
  button.disabled = true;
  setCloudMessage('פותח את Google… אם החלון נסגר לבד, תופיע כאן שגיאה מדויקת.');
  try {
    const { auth, authMod } = await getPopupAuth();
    const provider = new authMod.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await authMod.signInWithPopup(auth, provider);
    if (!result?.user) throw Object.assign(new Error('Google sign-in returned no user'), { code: 'auth/no-user-returned' });
    localStorage.setItem('shift-clock-google-connected', '1');
    setCloudMessage('✓ התחברת ל-Google. מסנכרן את הגיבוי…');
    setTimeout(() => location.reload(), 1000);
  } catch (err) {
    console.error('Google backup direct popup failed:', err);
    setCloudMessage(authErrorText(err), true);
  } finally {
    googlePopupRunning = false;
    button.disabled = false;
  }
}, true);

const originalConsoleError = console.error.bind(console);
console.error = (...args) => {
  originalConsoleError(...args);
  try {
    const head = String(args[0] || '');
    if (head.includes('Google backup sign-in failed') || head.includes('Google backup direct popup failed')) {
      const err = args.find(v => v && typeof v === 'object' && (v.code || v.message));
      if (err) setCloudMessage(authErrorText(err), true);
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
