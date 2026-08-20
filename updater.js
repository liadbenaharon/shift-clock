const APP_VERSION = 'v6.0';
let checkingUpdate = false;
let reloadingForUpdate = false;

function applyDisplayedVersion(version) {
  const badge = document.querySelector('header.top h1 span');
  if (badge) badge.textContent = version;
  document.title = document.title.replace(/v\d+\.\d+/, version);
}

// v6.0 diagnostics: when Google/Firebase sign-in fails, show the exact
// Firebase Auth error code in the cloud-backup panel instead of hiding it
// behind a generic message. This makes mobile popup failures diagnosable.
const originalConsoleError = console.error.bind(console);
console.error = (...args) => {
  originalConsoleError(...args);
  try {
    if (String(args[0] || '').includes('Google backup sign-in failed')) {
      const err = args.find(v => v && typeof v === 'object' && (v.code || v.message));
      const code = err?.code ? String(err.code) : 'unknown-error';
      const message = err?.message ? String(err.message) : '';
      const status = document.getElementById('v59CloudStatus');
      if (status) {
        status.classList.add('v59-error');
        status.textContent = `שגיאת התחברות: ${code}${message ? ` — ${message}` : ''}`;
      }
      const button = document.getElementById('v59GoogleBtn');
      if (button) button.disabled = false;
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
