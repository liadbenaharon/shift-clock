import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { getMessaging, getToken, isSupported as isMessagingSupported } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDDEElCF6iH35N9TYo7uqW0Oafm_E1E1Sw',
  authDomain: 'shift-clock-19c2d.firebaseapp.com',
  projectId: 'shift-clock-19c2d',
  storageBucket: 'shift-clock-19c2d.firebasestorage.app',
  messagingSenderId: '470768596231',
  appId: '1:470768596231:web:2ac632c55e92a27c9c01a2'
};

const VAPID_PUBLIC_KEY = 'BEX0RBD1Nim-a7ZKM0u5FH_c4kI2WCmQmDxuCrTULCOIQAtUHiDflf1zg4cH8asiBBrHuS7pe7SdAPVeHstEAmA';
const STORAGE_KEY = 'ilShiftTrackerData_v1';
const ACTIVE_COLLECTION = 'activeShifts';
const REMINDER_DELAY_MS = (8 * 60 + 30) * 60 * 1000;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentToken = null;
let syncRunning = false;
let lastObservedStart = Symbol('initial');

function readLocalState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch (_) { return {}; }
}

function applyV53Dashboard() {
  document.title = document.title.replace(/v\d+\.\d+/, 'v5.3');
  const version = document.querySelector('header.top h1 span');
  if (version) version.textContent = 'v5.3';

  if (!document.getElementById('dashboard-v53-style')) {
    const style = document.createElement('style');
    style.id = 'dashboard-v53-style';
    style.textContent = `
      :root.dark{--cream:#0b1017;--card:#121a24;--line:#263444;--muted:#8f9cab;--surface-dark:#0f1824;}
      body{background:radial-gradient(circle at 80% 0%,rgba(47,122,109,.14),transparent 28%),var(--cream);}
      .wrap{max-width:900px;padding:18px 14px 112px;}
      header.top{margin-bottom:22px;align-items:flex-start;}
      header.top h1{font-size:30px!important;line-height:1.05;display:flex;align-items:center;gap:9px;}
      header.top h1 span{font-size:18px!important;color:#61dc79;font-weight:700;}
      header.top .sub{font-size:15px!important;margin-top:5px;}
      #settingsBtn{display:none!important;}
      .clock-card{background:linear-gradient(180deg,#111d2b 0%,#0f1824 100%)!important;border:1px solid #2b3c4f!important;border-radius:26px!important;padding:22px 20px!important;box-shadow:0 18px 42px rgba(0,0,0,.25)!important;}
      .clock-card .status-line{font-size:16px!important;color:#9aa7b5!important;}
      #timerDigits{font-size:clamp(58px,16vw,88px)!important;letter-spacing:.015em!important;margin:18px 0 6px!important;}
      #timerSub{font-size:18px!important;color:#9ba8b7!important;}
      #timerSub b{color:#f1b53b!important;font-size:23px!important;}
      .v53-info-grid{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid #2d3e50;border-bottom:1px solid #2d3e50;margin:24px 0 18px;padding:20px 0;}
      .v53-info{padding:0 10px;text-align:center;border-inline-start:1px solid #2d3e50;}
      .v53-info:first-child{border-inline-start:none;}
      .v53-info .ico{font-size:22px;display:block;margin-bottom:7px;}
      .v53-info .lbl{font-size:13px;color:#9aa6b4;}
      .v53-info .val{font-size:18px;font-weight:800;margin-top:2px;white-space:nowrap;}
      .v53-info .sub{font-size:12px;color:#7f8d9d;margin-top:2px;}
      .v53-info.pay .val{color:#62dd7a;}
      .v53-tag-title{font-size:15px;font-weight:700;color:#98a5b4;margin:10px 0;}
      .v53-tags{display:flex;gap:9px;justify-content:center;flex-wrap:wrap;margin-bottom:18px;}
      .v53-chip{border-radius:999px;padding:7px 13px;border:1px solid #3f5872;background:#14263a;color:#d9e7f7;font-size:13px;font-weight:700;}
      .v53-chip.orange{border-color:#7f5617;background:#2a2111;color:#efb34a;}
      .v53-chip.purple{border-color:#67427d;background:#24192d;color:#d3a0ec;}
      .v53-actions{display:grid!important;grid-template-columns:1fr 1fr;gap:12px!important;margin-top:18px!important;}
      .v53-actions .clock-btn,.v53-actions #cancelShiftBtn{min-height:92px!important;border-radius:22px!important;font-size:23px!important;font-weight:900!important;display:flex!important;align-items:center!important;justify-content:center!important;margin:0!important;}
      .v53-actions .clock-btn.stop{background:#111923!important;border:2px solid #57d975!important;color:white!important;}
      .v53-actions #cancelShiftBtn{background:#111923!important;border:2px solid #ff5858!important;color:white!important;}
      .summary-card,.totals-row>div,.shift-row{background:#131b25!important;border:1px solid #293847!important;border-radius:20px!important;box-shadow:none!important;}
      .summary-card{min-height:118px!important;display:flex;flex-direction:column;align-items:center;justify-content:center;}
      .summary-card .value{font-size:27px!important;}
      .summary-card .label{font-size:14px!important;}
      .shift-row{min-height:86px!important;align-items:center!important;overflow:hidden;}
      .shift-row .date-col{min-width:64px!important;}
      .shift-row .pay-col{min-width:82px!important;}
      .shift-row .actions{min-width:66px!important;}
      .shift-row .mid{min-width:0!important;}
      .shift-row .badges{display:flex!important;flex-wrap:wrap!important;gap:4px!important;justify-content:center!important;align-items:center!important;max-width:100%!important;overflow:visible!important;}
      .shift-row .tag{display:inline-flex!important;align-items:center!important;justify-content:center!important;max-width:100%!important;white-space:nowrap!important;line-height:1.2!important;}
      #sumExpenses,[for="editExpenses"],#editExpenses,.expense,.expenses,.expenses-row{display:none!important;}

      .v53-bottom-nav{position:fixed;left:50%;transform:translateX(-50%);bottom:0;width:min(900px,100%);z-index:9999;display:grid;grid-template-columns:repeat(4,1fr);padding:11px 14px calc(13px + env(safe-area-inset-bottom));background:rgba(12,18,26,.97);backdrop-filter:blur(16px);border:1px solid #283747;border-bottom:none;border-radius:22px 22px 0 0;box-shadow:0 -10px 28px rgba(0,0,0,.25);}
      .v53-nav{text-align:center;color:#8f9baa;font-size:12px;cursor:pointer;user-select:none;}
      .v53-nav .ico{display:block;font-size:22px;line-height:1;margin-bottom:5px;}
      .v53-nav.active{color:#61dc79;font-weight:800;}

      /* Undo delete toast must sit above the fixed bottom navigation on phones. */
      #undoToast{bottom:calc(92px + env(safe-area-inset-bottom))!important;z-index:10030!important;max-width:calc(100vw - 24px)!important;}

      /* Settings sheet: same bottom-flush behavior as clock-out/edit. */
      #settingsOverlay.open{z-index:10060!important;align-items:flex-end!important;justify-content:center!important;overflow:hidden!important;padding:0!important;}
      #settingsOverlay .modal{width:min(480px,100%)!important;margin:0!important;max-height:calc(100vh - env(safe-area-inset-top))!important;overflow-y:auto!important;padding:20px 20px 0!important;border-radius:20px 20px 0 0!important;}
      #settingsOverlay .modal-actions{position:sticky!important;bottom:0!important;z-index:20!important;margin:18px -20px 0!important;padding:12px 20px calc(12px + env(safe-area-inset-bottom))!important;background:#0b1017!important;border-top:1px solid #293847!important;box-shadow:0 -8px 20px rgba(0,0,0,.22)!important;}
      #settingsOverlay .modal-actions .btn{min-height:48px!important;font-size:16px!important;}
      body.v53-settings-open .v53-bottom-nav{display:none!important;}

      /* Clock-out/edit sheet: flush to the bottom with no visible gap. */
      #editOverlay.open{z-index:10060!important;align-items:flex-end!important;justify-content:center!important;overflow:hidden!important;padding:0!important;}
      #editOverlay .modal{width:min(480px,100%)!important;margin:0!important;max-height:calc(100vh - env(safe-area-inset-top))!important;overflow-y:auto!important;padding:20px 20px 0!important;border-radius:20px 20px 0 0!important;}
      #editOverlay .modal-actions{position:sticky!important;bottom:0!important;z-index:20!important;margin:18px -20px 0!important;padding:12px 20px calc(12px + env(safe-area-inset-bottom))!important;background:#0b1017!important;border-top:1px solid #293847!important;box-shadow:0 -8px 20px rgba(0,0,0,.22)!important;}
      #editOverlay .modal-actions .btn{min-height:48px!important;font-size:16px!important;}
      body.v53-edit-open .v53-bottom-nav{display:none!important;}

      @media(max-width:640px){
        header.top h1{font-size:26px!important;}
        .v53-info-grid{grid-template-columns:repeat(2,1fr);row-gap:18px;}
        .v53-info:nth-child(3){border-inline-start:none;}
        .v53-actions .clock-btn,.v53-actions #cancelShiftBtn{min-height:86px!important;font-size:21px!important;}
        #editOverlay .modal,#settingsOverlay .modal{width:100%!important;border-radius:20px 20px 0 0!important;}
        .shift-row{display:grid!important;grid-template-columns:58px minmax(0,1fr) 92px 58px!important;grid-template-areas:'date mid pay actions'!important;gap:7px!important;padding:12px 10px!important;min-height:96px!important;}
        .shift-row .date-col{grid-area:date!important;min-width:0!important;width:auto!important;}
        .shift-row .mid{grid-area:mid!important;min-width:0!important;width:auto!important;text-align:center!important;margin:0!important;order:initial!important;font-size:12px!important;}
        .shift-row .pay-col{grid-area:pay!important;min-width:0!important;width:auto!important;}
        .shift-row .actions{grid-area:actions!important;min-width:0!important;width:auto!important;gap:4px!important;}
        .shift-row .badges{margin-top:5px!important;gap:3px!important;justify-content:center!important;}
        .shift-row .tag{font-size:8.5px!important;padding:2px 4px!important;max-width:100%!important;}
        .shift-row .icon-btn{width:27px!important;height:27px!important;flex:0 0 27px!important;font-size:14px!important;}
        #undoToast{bottom:calc(98px + env(safe-area-inset-bottom))!important;}
      }
    `;
    document.head.appendChild(style);
  }

  const card = document.querySelector('.clock-card');
  if (card && !card.querySelector('.v53-info-grid')) {
    const timerSub = document.getElementById('timerSub');
    const grid = document.createElement('div');
    grid.className = 'v53-info-grid';
    grid.innerHTML = `
      <div class="v53-info"><span class="ico">📅</span><div class="lbl">תאריך</div><div class="val" id="v53Date">—</div><div class="sub" id="v53Day">—</div></div>
      <div class="v53-info"><span class="ico">🕒</span><div class="lbl">שעות</div><div class="val" id="v53Hours">—</div><div class="sub">זמן אמת</div></div>
      <div class="v53-info pay"><span class="ico">💵</span><div class="lbl">שכר משוער</div><div class="val" id="v53Pay">—</div><div class="sub">עד כה</div></div>
      <div class="v53-info"><span class="ico">⏱️</span><div class="lbl">משך</div><div class="val" id="v53Duration">—</div><div class="sub">שעות</div></div>`;
    if (timerSub) timerSub.insertAdjacentElement('afterend', grid);
    const title = document.createElement('div');
    title.className = 'v53-tag-title';
    title.textContent = 'תגיות';
    grid.insertAdjacentElement('afterend', title);
    const tags = document.createElement('div');
    tags.className = 'v53-tags';
    tags.innerHTML = '<span class="v53-chip">🌙 ערב</span><span class="v53-chip orange">◔ שעות נוספות</span><span class="v53-chip purple">📅 יומי</span>';
    title.insertAdjacentElement('afterend', tags);
  }

  const clockBtn = document.getElementById('clockBtn');
  const cancelBtn = document.getElementById('cancelShiftBtn');
  if (clockBtn && cancelBtn && !clockBtn.parentElement.classList.contains('v53-actions')) {
    const actions = document.createElement('div');
    actions.className = 'v53-actions';
    clockBtn.parentElement.insertBefore(actions, clockBtn);
    actions.appendChild(clockBtn);
    actions.appendChild(cancelBtn);
  }

  const expensesSummary = document.getElementById('sumExpenses');
  if (expensesSummary) {
    const summaryCard = expensesSummary.closest('.summary-card') || expensesSummary.parentElement;
    if (summaryCard) summaryCard.style.display = 'none';
  }

  const settingsOverlay = document.getElementById('settingsOverlay');
  const settingsBtn = document.getElementById('settingsBtn');
  const editOverlay = document.getElementById('editOverlay');
  const resetSettingsToTop = () => {
    if (!settingsOverlay) return;
    settingsOverlay.scrollTop = 0;
    const inner = settingsOverlay.querySelector('.modal');
    if (inner) inner.scrollTop = 0;
  };
  const closeSettings = () => {
    settingsOverlay?.classList.remove('open');
    document.body.classList.remove('v53-settings-open');
  };
  const openSettings = () => {
    settingsBtn?.click();
    setTimeout(() => {
      if (settingsOverlay?.classList.contains('open')) {
        document.body.classList.add('v53-settings-open');
        resetSettingsToTop();
      }
    }, 0);
  };

  if (!document.querySelector('.v53-bottom-nav')) {
    const nav = document.createElement('div');
    nav.className = 'v53-bottom-nav';
    nav.innerHTML = '<div class="v53-nav active" data-target="home"><span class="ico">⌂</span>בית</div><div class="v53-nav" data-target="history"><span class="ico">◷</span>היסטוריה</div><div class="v53-nav" data-target="reports"><span class="ico">▥</span>דיווחים</div><div class="v53-nav" data-target="settings"><span class="ico">⚙</span>הגדרות</div>';
    document.body.appendChild(nav);

    nav.addEventListener('click', (e) => {
      const item = e.target.closest('.v53-nav');
      if (!item) return;
      const target = item.dataset.target;
      const wasSettingsOpen = !!settingsOverlay?.classList.contains('open');

      if (target === 'settings') {
        if (wasSettingsOpen) {
          closeSettings();
          item.classList.remove('active');
          nav.querySelector('[data-target="home"]')?.classList.add('active');
          return;
        }
        nav.querySelectorAll('.v53-nav').forEach(x => x.classList.remove('active'));
        item.classList.add('active');
        openSettings();
        return;
      }

      if (wasSettingsOpen) closeSettings();
      nav.querySelectorAll('.v53-nav').forEach(x => x.classList.remove('active'));
      item.classList.add('active');
      if (target === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
      if (target === 'history') (document.getElementById('historyList') || document.querySelector('.history-section'))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (target === 'reports') (document.querySelector('.summary-grid') || document.querySelector('.totals-row'))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  settingsBtn?.addEventListener('click', () => {
    setTimeout(() => {
      if (settingsOverlay?.classList.contains('open')) {
        document.body.classList.add('v53-settings-open');
        resetSettingsToTop();
      } else {
        document.body.classList.remove('v53-settings-open');
      }
    }, 0);
  });
  document.getElementById('settingsCancel')?.addEventListener('click', () => document.body.classList.remove('v53-settings-open'));
  document.getElementById('settingsSave')?.addEventListener('click', () => document.body.classList.remove('v53-settings-open'));

  const syncEditOverlayState = () => {
    const open = !!editOverlay?.classList.contains('open');
    document.body.classList.toggle('v53-edit-open', open);
    if (open) {
      editOverlay.scrollTop = 0;
      const modal = editOverlay.querySelector('.modal');
      if (modal) modal.scrollTop = 0;
    }
  };
  if (editOverlay) {
    new MutationObserver(syncEditOverlayState).observe(editOverlay, { attributes: true, attributeFilter: ['class'] });
    syncEditOverlayState();
  }

  const refresh = () => {
    const state = readLocalState();
    const startMs = Number(state.activeStart || 0);
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    if (!startMs) {
      set('v53Date', '—'); set('v53Day', '—'); set('v53Hours', '—'); set('v53Pay', '₪0.00'); set('v53Duration', '0:00');
      return;
    }
    const start = new Date(startMs);
    const now = new Date();
    const elapsed = Math.max(0, now.getTime() - startMs);
    const h = Math.floor(elapsed / 3600000);
    const m = Math.floor((elapsed % 3600000) / 60000);
    const rate = Number(state.rate || 0);
    const pay = rate * (elapsed / 3600000);
    const pad = n => String(n).padStart(2, '0');
    const days = ['יום א׳','יום ב׳','יום ג׳','יום ד׳','יום ה׳','יום ו׳','שבת'];
    set('v53Date', `${pad(start.getDate())}/${pad(start.getMonth()+1)}/${start.getFullYear()}`);
    set('v53Day', days[start.getDay()]);
    set('v53Hours', `${pad(start.getHours())}:${pad(start.getMinutes())} - עכשיו`);
    set('v53Pay', `₪${pay.toFixed(2)}`);
    set('v53Duration', `${h}:${pad(m)}`);
  };
  refresh();
  setInterval(refresh, 30000);
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function updateNotificationHelp() {
  const label = document.querySelector('label[for="settingsNotify"]');
  if (label) {
    const firstText = Array.from(label.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
    if (firstText) firstText.textContent = '\n        🔔 התראה אם משמרת נשארה פתוחה יותר מ־8 שעות ו־30 דקות\n        ';
    const desc = label.querySelector('div');
    if (desc) desc.textContent = isIos() && !isStandalone() ? 'באייפון: יש להוסיף את האתר למסך הבית, לפתוח משם ולאשר התראות.' : 'ההתראה נשלחת ב-Push ויכולה להגיע גם כשהאפליקציה סגורה.';
  }
}
async function ensureAnonymousUser() {
  if (currentUser) return currentUser;
  if (auth.currentUser) { currentUser = auth.currentUser; return currentUser; }
  const credential = await signInAnonymously(auth); currentUser = credential.user; return currentUser;
}
async function getServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) throw new Error('Service Worker is not supported');
  let registration = await navigator.serviceWorker.getRegistration('./');
  if (!registration) registration = await navigator.serviceWorker.register('./service-worker.js');
  await navigator.serviceWorker.ready; return registration;
}
async function ensurePushToken() {
  const state = readLocalState();
  if (!state.notifyEnabled) return null;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return null;
  if (!(await isMessagingSupported())) return null;
  if (currentToken) return currentToken;
  const registration = await getServiceWorkerRegistration();
  const messaging = getMessaging(app);
  currentToken = await getToken(messaging, { vapidKey: VAPID_PUBLIC_KEY, serviceWorkerRegistration: registration });
  return currentToken || null;
}
async function syncActiveShift() {
  if (syncRunning) return; syncRunning = true;
  try {
    const state = readLocalState();
    const activeStart = state.activeStart ? Number(state.activeStart) : null;
    const notifyEnabled = !!state.notifyEnabled;
    if (!notifyEnabled) { if (currentUser) await deleteDoc(doc(db, ACTIVE_COLLECTION, currentUser.uid)).catch(() => {}); lastObservedStart = activeStart; return; }
    const user = await ensureAnonymousUser();
    const ref = doc(db, ACTIVE_COLLECTION, user.uid);
    if (!activeStart) { await deleteDoc(ref).catch(() => {}); lastObservedStart = null; return; }
    const token = await ensurePushToken();
    if (!token) { lastObservedStart = activeStart; return; }
    const existing = await getDoc(ref);
    const existingData = existing.exists() ? existing.data() : null;
    const sameShift = existingData && Number(existingData.startedAtMs) === activeStart;
    if (sameShift) {
      await setDoc(ref, { token, updatedAt: serverTimestamp(), platform: isIos() ? 'ios-web' : 'web' }, { merge: true });
    } else {
      await setDoc(ref, { uid: user.uid, token, startedAtMs: activeStart, remindAtMs: activeStart + REMINDER_DELAY_MS, notificationSent: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), platform: isIos() ? 'ios-web' : 'web' });
    }
    lastObservedStart = activeStart;
  } catch (err) { console.warn('Push reminder sync failed:', err); }
  finally { syncRunning = false; }
}
async function refreshIfNeeded() {
  const state = readLocalState();
  const start = state.activeStart ? Number(state.activeStart) : null;
  if (start !== lastObservedStart || state.notifyEnabled) await syncActiveShift();
}
applyV53Dashboard();
updateNotificationHelp();
setInterval(refreshIfNeeded, 2500);
window.addEventListener('focus', refreshIfNeeded);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshIfNeeded(); });
setTimeout(refreshIfNeeded, 600);