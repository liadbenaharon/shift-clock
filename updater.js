const APP_VERSION = 'v6.7';
let checkingUpdate = false;
let reloadingForUpdate = false;

function applyDisplayedVersion(version) {
  const badge = document.querySelector('header.top h1 span');
  if (badge) badge.textContent = version;
  document.title = document.title.replace(/v\d+\.\d+/, version);
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
