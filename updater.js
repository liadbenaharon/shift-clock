const APP_VERSION = 'v6.4';
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
  if (code === 'auth/unauthorized-domain') return 'הדומיין עדיין לא מורשה ב-Firebase. (auth/unauthorized-domain)';
  if (code === 'auth/operation-not-allowed') return 'Google Sign-In לא מופעל ב-Firebase. (auth/operation-not-allowed)';
  const message = String(err?.message || '').trim();
  return `שגיאת התחברות: ${code}${message ? ` — ${message}` : ''}`;
}

// v6.4: Keep the auth helper on the same first-party origin as the app.
// For GitHub Pages this avoids opening firebaseapp.com as a third-party helper
// page that Samsung/Chrome can immediately close or block.
const firebaseConfigV64 = {
  apiKey: 'AIzaSyDDEElCF6iH35N9TYo7uqW0Oafm_E1E1Sw',
  authDomain: 'liadbenaharon.github.io',
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
    const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfigV64);
    const auth = authMod.getAuth(app);
    await authMod.setPersistence(auth, authMod.browserLocalPersistence);
    return { auth, authMod };
  })();
  return popupAuthReady;
}

document.addEventListener('click', async event => {
  const button = event.target?.closest?.('#v59GoogleBtn');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  button.disabled = true;
  setCloudMessage('פותח התחברות עם Google…');
  try {
    const { auth, authMod } = await getPopupAuth();
    const provider = new authMod.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await authMod.signInWithPopup(auth, provider);
    if (!result?.user) throw new Error('Google sign-in returned no user');
    localStorage.setItem('shift-clock-google-connected', '1');
    setCloudMessage('✓ התחברת ל-Google. מסנכרן את הגיבוי…');
    setTimeout(() => location.reload(), 1000);
  } catch (err) {
    console.error('Google backup direct popup failed:', err);
    setCloudMessage(authErrorText(err), true);
    button.disabled = false;
  }
}, true);

const originalConsoleError = console.error.bind(console);
console.error = (...args) => {
  originalConsoleError(...args);
  try {
    const head = String(args[0] || '');
    if (head.includes('Google backup sign-in failed')) {
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
