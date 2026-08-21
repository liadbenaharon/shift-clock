const APP_VERSION = 'v6.6';
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
  if (button && !button.dataset.googleConnected) button.disabled = false;
}

function authErrorText(err) {
  const code = String(err?.code || 'unknown-error');
  if (code === 'auth/popup-blocked') return 'הדפדפן חסם את חלון Google. אפשר חלונות קופצים לאתר ונסה שוב. (auth/popup-blocked)';
  if (code === 'auth/popup-closed-by-user') return 'חלון Google נסגר לפני שההתחברות הושלמה. אם אתה מפעיל את האתר כאפליקציה, נסה לפתוח פעם אחת ב-Chrome. (auth/popup-closed-by-user)';
  if (code === 'auth/cancelled-popup-request') return 'בקשת התחברות נוספת ביטלה את הקודמת. נסה שוב פעם אחת. (auth/cancelled-popup-request)';
  if (code === 'auth/unauthorized-domain') return 'הדומיין עדיין לא מורשה ב-Firebase. (auth/unauthorized-domain)';
  if (code === 'auth/operation-not-allowed') return 'Google Sign-In לא מופעל ב-Firebase. (auth/operation-not-allowed)';
  if (code === 'auth/network-request-failed') return 'הייתה שגיאת רשת בזמן ההתחברות ל-Google. (auth/network-request-failed)';
  if (code === 'auth/web-storage-unsupported') return 'הדפדפן חוסם אחסון שנדרש להתחברות ל-Google. (auth/web-storage-unsupported)';
  const message = String(err?.message || '').trim();
  return `שגיאת התחברות: ${code}${message ? ` — ${message}` : ''}`;
}

const firebaseConfigV66 = {
  apiKey: 'AIzaSyDDEElCF6iH35N9TYo7uqW0Oafm_E1E1Sw',
  authDomain: 'shift-clock-19c2d.firebaseapp.com',
  projectId: 'shift-clock-19c2d',
  storageBucket: 'shift-clock-19c2d.firebasestorage.app',
  messagingSenderId: '470768596231',
  appId: '1:470768596231:web:2ac632c55e92a27c9c01a2'
};

let authReady = null;
async function getGoogleAuth() {
  if (authReady) return authReady;
  authReady = (async () => {
    const appMod = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js');
    const authMod = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js');
    const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfigV66);
    const auth = authMod.getAuth(app);
    try { await authMod.setPersistence(auth, authMod.browserLocalPersistence); } catch (_) {}
    return { auth, authMod };
  })();
  return authReady;
}

let googleSignInRunning = false;

async function handleGoogleBackupClick(button) {
  if (googleSignInRunning) return;
  googleSignInRunning = true;
  button.disabled = true;
  setCloudMessage('פותח התחברות עם Google…');
  try {
    const { auth, authMod } = await getGoogleAuth();
    const provider = new authMod.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await authMod.signInWithPopup(auth, provider);
    if (!result?.user) throw Object.assign(new Error('Google sign-in returned no user'), { code: 'auth/no-user-returned' });
    localStorage.setItem('shift-clock-google-connected', '1');
    button.dataset.googleConnected = '1';
    button.textContent = '✓ מחובר ל-Google — הגיבוי קבוע';
    button.disabled = true;
    setCloudMessage('✓ התחברת ל-Google. הגיבוי הקבוע פעיל.');
    // push-client.js observes Firebase Auth and uploads the existing local data
    // under the Google user automatically.
    setTimeout(() => location.reload(), 1200);
  } catch (err) {
    console.error('Google backup single handler failed:', err);
    setCloudMessage(authErrorText(err), true);
    button.disabled = false;
  } finally {
    googleSignInRunning = false;
  }
}

// push-client.js originally adds its own Google click listener. Replace the
// button node once it appears; cloning removes that old listener. From this
// point there is exactly one Google Auth handler on the page.
function installSingleGoogleHandler() {
  const oldButton = document.getElementById('v59GoogleBtn');
  if (!oldButton || oldButton.dataset.singleGoogleHandler === '1') return false;
  const button = oldButton.cloneNode(true);
  button.dataset.singleGoogleHandler = '1';
  oldButton.replaceWith(button);
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    handleGoogleBackupClick(button);
  });
  return true;
}

installSingleGoogleHandler();
document.addEventListener('DOMContentLoaded', installSingleGoogleHandler, { once: true });
const googleButtonObserver = new MutationObserver(() => {
  if (installSingleGoogleHandler()) googleButtonObserver.disconnect();
});
googleButtonObserver.observe(document.documentElement, { childList: true, subtree: true });
setTimeout(() => {
  installSingleGoogleHandler();
  googleButtonObserver.disconnect();
}, 10000);

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
