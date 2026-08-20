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
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch (_) {
    return {};
  }
}

function applyV43Dashboard() {
  document.title = document.title.replace(/v\d+\.\d+/, 'v4.3');
  const version = document.querySelector('header.top h1 span');
  if (version) version.textContent = 'v4.3';

  if (!document.getElementById('dashboard-v43-style')) {
    const style = document.createElement('style');
    style.id = 'dashboard-v43-style';
    style.textContent = `
      :root.dark{--cream:#0b1017;--card:#121a24;--line:#263444;--muted:#8f9cab;--surface-dark:#0f1824;}
      body{background:radial-gradient(circle at 80% 0%,rgba(47,122,109,.14),transparent 28%),var(--cream);}
      .wrap{max-width:900px;padding:18px 14px 98px;}
      header.top{margin-bottom:22px;align-items:flex-start;}
      header.top h1{font-size:30px!important;line-height:1.05;display:flex;align-items:center;gap:9px;}
      header.top h1 span{font-size:18px!important;color:#61dc79;font-weight:700;}
      header.top .sub{font-size:15px!important;margin-top:5px;}
      .rate-pill{background:#111923!important;border:1px solid #314255!important;border-radius:17px!important;padding:10px 14px!important;}
      .rate-pill input{font-size:18px!important;width:72px!important;}
      .clock-card{background:linear-gradient(180deg,#111d2b 0%,#0f1824 100%)!important;border:1px solid #2b3c4f!important;border-radius:26px!important;padding:22px 20px!important;box-shadow:0 18px 42px rgba(0,0,0,.25)!important;}
      .clock-card .status-line{font-size:16px!important;color:#9aa7b5!important;}
      #timerDigits{font-size:clamp(58px,16vw,88px)!important;letter-spacing:.015em!important;margin:18px 0 6px!important;}
      #timerSub{font-size:18px!important;color:#9ba8b7!important;}
      #timerSub b{color:#f1b53b!important;font-size:23px!important;}
      .v43-info-grid{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid #2d3e50;border-bottom:1px solid #2d3e50;margin:24px 0 18px;padding:20px 0;}
      .v43-info{padding:0 10px;text-align:center;border-inline-start:1px solid #2d3e50;}
      .v43-info:first-child{border-inline-start:none;}
      .v43-info .ico{font-size:22px;display:block;margin-bottom:7px;}
      .v43-info .lbl{font-size:13px;color:#9aa6b4;}
      .v43-info .val{font-size:18px;font-weight:800;margin-top:2px;white-space:nowrap;}
      .v43-info .sub{font-size:12px;color:#7f8d9d;margin-top:2px;}
      .v43-info.pay .val{color:#62dd7a;}
      .v43-tag-title{font-size:15px;font-weight:700;color:#98a5b4;margin:10px 0;}
      .v43-tags{display:flex;gap:9px;justify-content:center;flex-wrap:wrap;margin-bottom:18px;}
      .v43-chip{border-radius:999px;padding:7px 13px;border:1px solid #3f5872;background:#14263a;color:#d9e7f7;font-size:13px;font-weight:700;}
      .v43-chip.orange{border-color:#7f5617;background:#2a2111;color:#efb34a;}
      .v43-chip.purple{border-color:#67427d;background:#24192d;color:#d3a0ec;}
      .v43-actions{display:grid!important;grid-template-columns:1fr 1fr;gap:12px!important;margin-top:18px!important;}
      .v43-actions .clock-btn,.v43-actions #cancelShiftBtn{min-height:92px!important;border-radius:22px!important;font-size:23px!important;font-weight:900!important;display:flex!important;align-items:center!important;justify-content:center!important;margin:0!important;}
      .v43-actions .clock-btn.stop{background:#111923!important;border:2px solid #57d975!important;color:white!important;}
      .v43-actions #cancelShiftBtn{background:#111923!important;border:2px solid #ff5858!important;color:white!important;}
      .summary-card,.totals-row>div,.shift-row{background:#131b25!important;border:1px solid #293847!important;border-radius:20px!important;box-shadow:none!important;}
      .summary-card{min-height:118px!important;display:flex;flex-direction:column;align-items:center;justify-content:center;}
      .summary-card .value{font-size:27px!important;}
      .summary-card .label{font-size:14px!important;}
      .shift-row{min-height:86px!important;align-items:center!important;}
      .shift-row .date-col{min-width:64px!important;}
      .shift-row .pay-col{min-width:82px!important;}
      .shift-row .actions{min-width:66px!important;}
      #sumExpenses,[for="editExpenses"],#editExpenses,.expense,.expenses,.expenses-row{display:none!important;}
      .v43-bottom-nav{position:fixed;left:50%;transform:translateX(-50%);bottom:0;width:min(900px,100%);z-index:9999;display:grid;grid-template-columns:repeat(4,1fr);padding:11px 14px 13px;background:rgba(12,18,26,.97);backdrop-filter:blur(16px);border:1px solid #283747;border-bottom:none;border-radius:22px 22px 0 0;box-shadow:0 -10px 28px rgba(0,0,0,.25);}
      .v43-nav{text-align:center;color:#8f9baa;font-size:12px;cursor:pointer;user-select:none;}
      .v43-nav .ico{display:block;font-size:22px;line-height:1;margin-bottom:5px;}
      .v43-nav.active{color:#61dc79;font-weight:800;}
      @media(max-width:640px){
        header.top h1{font-size:26px!important;}
        .v43-info-grid{grid-template-columns:repeat(2,1fr);row-gap:18px;}
        .v43-info:nth-child(3){border-inline-start:none;}
        .v43-actions .clock-btn,.v43-actions #cancelShiftBtn{min-height:86px!important;font-size:21px!important;}
      }
    `;
    document.head.appendChild(style);
  }

  const card = document.querySelector('.clock-card');
  if (card && !card.querySelector('.v43-info-grid')) {
    const timerSub = document.getElementById('timerSub');
    const grid = document.createElement('div');
    grid.className = 'v43-info-grid';
    grid.innerHTML = `
      <div class="v43-info"><span class="ico">📅</span><div class="lbl">תאריך</div><div class="val" id="v43Date">—</div><div class="sub" id="v43Day">—</div></div>
      <div class="v43-info"><span class="ico">🕒</span><div class="lbl">שעות</div><div class="val" id="v43Hours">—</div><div class="sub">זמן אמת</div></div>
      <div class="v43-info pay"><span class="ico">💵</span><div class="lbl">שכר משוער</div><div class="val" id="v43Pay">—</div><div class="sub">עד כה</div></div>
      <div class="v43-info"><span class="ico">⏱️</span><div class="lbl">משך</div><div class="val" id="v43Duration">—</div><div class="sub">שעות</div></div>`;
    if (timerSub) timerSub.insertAdjacentElement('afterend', grid);
    const title = document.createElement('div');
    title.className = 'v43-tag-title';
    title.textContent = 'תגיות';
    grid.insertAdjacentElement('afterend', title);
    const tags = document.createElement('div');
    tags.className = 'v43-tags';
    tags.innerHTML = '<span class="v43-chip">🌙 ערב</span><span class="v43-chip orange">◔ שעות נוספות</span><span class="v43-chip purple">📅 יומי</span>';
    title.insertAdjacentElement('afterend', tags);
  }

  const clockBtn = document.getElementById('clockBtn');
  const cancelBtn = document.getElementById('cancelShiftBtn');
  if (clockBtn && cancelBtn && !clockBtn.parentElement.classList.contains('v43-actions')) {
    const actions = document.createElement('div');
    actions.className = 'v43-actions';
    clockBtn.parentElement.insertBefore(actions, clockBtn);
    actions.appendChild(clockBtn);
    actions.appendChild(cancelBtn);
  }

  const expensesSummary = document.getElementById('sumExpenses');
  if (expensesSummary) {
    const card = expensesSummary.closest('.summary-card') || expensesSummary.parentElement;
    if (card) card.style.display = 'none';
  }

  if (!document.querySelector('.v43-bottom-nav')) {
    const nav = document.createElement('div');
    nav.className = 'v43-bottom-nav';
    nav.innerHTML = '<div class="v43-nav active" data-target="home"><span class="ico">⌂</span>בית</div><div class="v43-nav" data-target="history"><span class="ico">◷</span>היסטוריה</div><div class="v43-nav" data-target="reports"><span class="ico">▥</span>דיווחים</div><div class="v43-nav" data-target="settings"><span class="ico">⚙</span>הגדרות</div>';
    document.body.appendChild(nav);
    nav.addEventListener('click', (e) => {
      const item = e.target.closest('.v43-nav');
      if (!item) return;
      nav.querySelectorAll('.v43-nav').forEach(x => x.classList.remove('active'));
      item.classList.add('active');
      const target = item.dataset.target;
      if (target === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
      if (target === 'history') (document.getElementById('historyList') || document.querySelector('.history-section'))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (target === 'reports') (document.querySelector('.summary-grid') || document.querySelector('.totals-row'))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (target === 'settings') document.getElementById('settingsBtn')?.click();
    });
  }

  const refresh = () => {
    const state = readLocalState();
    const startMs = Number(state.activeStart || 0);
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    if (!startMs) {
      set('v43Date', '—'); set('v43Day', '—'); set('v43Hours', '—'); set('v43Pay', '₪0.00'); set('v43Duration', '0:00');
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
    set('v43Date', `${pad(start.getDate())}/${pad(start.getMonth()+1)}/${start.getFullYear()}`);
    set('v43Day', days[start.getDay()]);
    set('v43Hours', `${pad(start.getHours())}:${pad(start.getMinutes())} - עכשיו`);
    set('v43Pay', `₪${pay.toFixed(2)}`);
    set('v43Duration', `${h}:${pad(m)}`);
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
    if (desc) {
      desc.textContent = isIos() && !isStandalone()
        ? 'באייפון: יש להוסיף את האתר למסך הבית, לפתוח משם ולאשר התראות.'
        : 'ההתראה נשלחת ב-Push ויכולה להגיע גם כשהאפליקציה סגורה.';
    }
  }
}

async function ensureAnonymousUser() {
  if (currentUser) return currentUser;
  if (auth.currentUser) {
    currentUser = auth.currentUser;
    return currentUser;
  }
  const credential = await signInAnonymously(auth);
  currentUser = credential.user;
  return currentUser;
}

async function getServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) throw new Error('Service Worker is not supported');
  let registration = await navigator.serviceWorker.getRegistration('./');
  if (!registration) registration = await navigator.serviceWorker.register('./service-worker.js');
  await navigator.serviceWorker.ready;
  return registration;
}

async function ensurePushToken() {
  const state = readLocalState();
  if (!state.notifyEnabled) return null;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return null;
  if (!(await isMessagingSupported())) return null;

  if (currentToken) return currentToken;
  const registration = await getServiceWorkerRegistration();
  const messaging = getMessaging(app);
  currentToken = await getToken(messaging, {
    vapidKey: VAPID_PUBLIC_KEY,
    serviceWorkerRegistration: registration
  });
  return currentToken || null;
}

async function syncActiveShift() {
  if (syncRunning) return;
  syncRunning = true;
  try {
    const state = readLocalState();
    const activeStart = state.activeStart ? Number(state.activeStart) : null;
    const notifyEnabled = !!state.notifyEnabled;

    if (!notifyEnabled) {
      if (currentUser) await deleteDoc(doc(db, ACTIVE_COLLECTION, currentUser.uid)).catch(() => {});
      lastObservedStart = activeStart;
      return;
    }

    const user = await ensureAnonymousUser();
    const ref = doc(db, ACTIVE_COLLECTION, user.uid);

    if (!activeStart) {
      await deleteDoc(ref).catch(() => {});
      lastObservedStart = null;
      return;
    }

    const token = await ensurePushToken();
    if (!token) {
      lastObservedStart = activeStart;
      return;
    }

    const existing = await getDoc(ref);
    const existingData = existing.exists() ? existing.data() : null;
    const sameShift = existingData && Number(existingData.startedAtMs) === activeStart;

    if (sameShift) {
      await setDoc(ref, {
        token,
        updatedAt: serverTimestamp(),
        platform: isIos() ? 'ios-web' : 'web'
      }, { merge: true });
    } else {
      await setDoc(ref, {
        uid: user.uid,
        token,
        startedAtMs: activeStart,
        remindAtMs: activeStart + REMINDER_DELAY_MS,
        notificationSent: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        platform: isIos() ? 'ios-web' : 'web'
      });
    }

    lastObservedStart = activeStart;
  } catch (err) {
    console.warn('Push reminder sync failed:', err);
  } finally {
    syncRunning = false;
  }
}

async function refreshIfNeeded() {
  const state = readLocalState();
  const start = state.activeStart ? Number(state.activeStart) : null;
  if (start !== lastObservedStart || state.notifyEnabled) await syncActiveShift();
}

applyV43Dashboard();
updateNotificationHelp();
setInterval(refreshIfNeeded, 2500);
window.addEventListener('focus', refreshIfNeeded);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshIfNeeded();
});
setTimeout(refreshIfNeeded, 600);
