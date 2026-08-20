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

function applyUiV42() {
  document.title = document.title.replace(/v\d+\.\d+/, 'v4.2');
  const version = document.querySelector('header.top h1 span');
  if (version) version.textContent = 'v4.2';

  if (!document.getElementById('v42-dashboard-style')) {
    const style = document.createElement('style');
    style.id = 'v42-dashboard-style';
    style.textContent = `
      :root.dark{--cream:#0f141b;--card:#151c25;--line:#293543;--muted:#8894a3;--surface-dark:#101a27;}
      body{background:radial-gradient(circle at 80% 0%,rgba(42,112,173,.10),transparent 28%),var(--cream);}
      .wrap{max-width:900px;padding-bottom:96px;}
      header.top{margin-bottom:28px;}
      header.top h1{font-size:32px;display:flex;align-items:center;gap:10px;}
      header.top h1 span{font-size:24px;color:#67e37f;font-weight:500;}
      header.top .sub{font-size:18px;margin-top:4px;}
      .rate-pill{border-radius:18px;padding:12px 18px;border:1px solid #334354;background:rgba(15,23,33,.78);box-shadow:inset 0 1px 0 rgba(255,255,255,.03);}
      .rate-pill input{font-size:19px;width:76px;}

      .clock-card{border:1px solid #2d3f52;border-radius:28px;padding:26px 28px 24px;background:linear-gradient(180deg,#111d2b 0%,#101a27 100%);box-shadow:0 16px 46px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.025);}
      .clock-card .status-line{font-size:18px!important;color:#95a2b1!important;}
      #timerDigits{font-size:clamp(64px,10vw,104px)!important;letter-spacing:.02em;margin:22px 0 8px!important;text-shadow:0 1px 0 rgba(255,255,255,.08);}
      #timerSub{font-size:20px!important;color:#9aa8b8!important;}
      #timerSub b{color:#f6b633;font-size:25px;}

      .v42-detail-grid{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid #314152;border-bottom:1px solid #314152;margin:26px 0 18px;padding:22px 0;}
      .v42-detail-item{text-align:center;padding:0 12px;border-inline-start:1px solid #314152;}
      .v42-detail-item:first-child{border-inline-start:none;}
      .v42-detail-icon{font-size:25px;margin-bottom:8px;display:block;}
      .v42-detail-label{color:#a9b4c1;font-size:16px;}
      .v42-detail-value{font-size:21px;font-weight:700;margin-top:3px;}
      .v42-detail-sub{font-size:15px;color:#8492a3;margin-top:3px;}
      .v42-detail-item.pay .v42-detail-value{color:#67dd7a;}
      .v42-tags-title{font-size:18px;font-weight:700;color:#9aa6b4;margin:12px 0;}
      .v42-tags{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:20px;}
      .v42-chip{border-radius:999px;padding:9px 18px;border:1px solid #3f5771;background:#14263b;color:#d7e6f8;font-weight:700;}
      .v42-chip.orange{border-color:#8e5a0e;background:#2a2110;color:#f3b13a;}
      .v42-chip.purple{border-color:#6a3c8e;background:#23172e;color:#d89cff;}
      .v42-actions{display:grid!important;grid-template-columns:1fr 1fr;gap:22px;margin-top:22px;}
      .v42-actions .clock-btn,.v42-actions #cancelShiftBtn{min-height:126px!important;border-radius:28px!important;font-size:29px!important;font-weight:900!important;display:flex!important;align-items:center!important;justify-content:center!important;line-height:1.25!important;}
      .v42-actions .clock-btn.stop{background:#111923!important;border:2px solid #5ae073!important;color:#fff!important;}
      .v42-actions #cancelShiftBtn{background:#111923!important;border:2px solid #ff4d4d!important;color:#fff!important;}

      .summary-grid{gap:12px!important;}
      .summary-card{border-radius:22px!important;background:#151c25!important;border:1px solid #2d3946!important;min-height:132px;display:flex;flex-direction:column;align-items:center;justify-content:center;}
      .summary-card .value{font-size:30px!important;}
      .summary-card .label{font-size:16px!important;}
      .totals-row>div{border-radius:22px!important;background:#151c25!important;border:1px solid #2d3946!important;}
      .shift-row{border-radius:20px!important;border:1px solid #2d3946!important;background:#151c25!important;}
      .shift-row .badges{min-height:20px;}

      .v42-bottom-nav{position:fixed;left:50%;transform:translateX(-50%);bottom:0;width:min(900px,100%);background:rgba(14,20,28,.96);backdrop-filter:blur(16px);border:1px solid #273644;border-bottom:none;border-radius:24px 24px 0 0;padding:12px 16px 14px;display:grid;grid-template-columns:repeat(4,1fr);z-index:9999;box-shadow:0 -10px 30px rgba(0,0,0,.22);}
      .v42-nav-item{text-align:center;color:#98a5b5;font-size:14px;}
      .v42-nav-item .ico{display:block;font-size:26px;line-height:1;margin-bottom:6px;}
      .v42-nav-item.active{color:#62da77;font-weight:700;}

      @media(max-width:640px){
        .wrap{padding:18px 14px 92px;}
        header.top h1{font-size:29px;}
        header.top h1 span{font-size:20px;}
        header.top .sub{font-size:16px;}
        .clock-card{padding:22px 20px;}
        #timerDigits{font-size:64px!important;}
        .v42-detail-grid{grid-template-columns:repeat(2,1fr);row-gap:20px;}
        .v42-detail-item:nth-child(3){border-inline-start:none;}
        .v42-actions{gap:14px;}
        .v42-actions .clock-btn,.v42-actions #cancelShiftBtn{min-height:112px!important;font-size:26px!important;border-radius:24px!important;}
      }
    `;
    document.head.appendChild(style);
  }

  const clockCard = document.querySelector('.clock-card');
  if (clockCard && !clockCard.querySelector('.v42-detail-grid')) {
    const timerSub = document.getElementById('timerSub');
    const detailGrid = document.createElement('div');
    detailGrid.className = 'v42-detail-grid';
    detailGrid.innerHTML = `
      <div class="v42-detail-item"><span class="v42-detail-icon">📅</span><div class="v42-detail-label">תאריך</div><div class="v42-detail-value" id="v42Date">—</div><div class="v42-detail-sub" id="v42Day">—</div></div>
      <div class="v42-detail-item"><span class="v42-detail-icon">🕒</span><div class="v42-detail-label">שעות</div><div class="v42-detail-value" id="v42Hours">—</div><div class="v42-detail-sub">זמן אמת</div></div>
      <div class="v42-detail-item pay"><span class="v42-detail-icon">💵</span><div class="v42-detail-label">שכר משוער</div><div class="v42-detail-value" id="v42Pay">—</div><div class="v42-detail-sub">עד כה</div></div>
      <div class="v42-detail-item"><span class="v42-detail-icon">⏱️</span><div class="v42-detail-label">משך משוער</div><div class="v42-detail-value" id="v42Duration">—</div><div class="v42-detail-sub">שעות</div></div>`;
    if (timerSub) timerSub.insertAdjacentElement('afterend', detailGrid);

    const tagsTitle = document.createElement('div');
    tagsTitle.className = 'v42-tags-title';
    tagsTitle.textContent = 'תגיות';
    detailGrid.insertAdjacentElement('afterend', tagsTitle);
    const tags = document.createElement('div');
    tags.className = 'v42-tags';
    tags.innerHTML = '<span class="v42-chip">🌙 ערב</span><span class="v42-chip orange">◔ שעות נוספות</span><span class="v42-chip purple">📅 יומי</span>';
    tagsTitle.insertAdjacentElement('afterend', tags);
  }

  const clockBtn = document.getElementById('clockBtn');
  const cancelBtn = document.getElementById('cancelShiftBtn');
  if (clockBtn && cancelBtn && !clockBtn.parentElement.classList.contains('v42-actions')) {
    const actions = document.createElement('div');
    actions.className = 'v42-actions';
    clockBtn.parentElement.insertBefore(actions, clockBtn);
    actions.appendChild(clockBtn);
    actions.appendChild(cancelBtn);
  }

  if (!document.querySelector('.v42-bottom-nav')) {
    const nav = document.createElement('div');
    nav.className = 'v42-bottom-nav';
    nav.innerHTML = '<div class="v42-nav-item active"><span class="ico">⌂</span>בית</div><div class="v42-nav-item"><span class="ico">◷</span>היסטוריה</div><div class="v42-nav-item"><span class="ico">▥</span>דיווחים</div><div class="v42-nav-item"><span class="ico">⚙</span>הגדרות</div>';
    document.body.appendChild(nav);
  }

  const updateV42 = () => {
    const state = readLocalState();
    if (!state.activeStart) return;
    const start = new Date(Number(state.activeStart));
    const now = new Date();
    const elapsed = now.getTime() - start.getTime();
    const h = Math.floor(elapsed / 3600000);
    const m = Math.floor((elapsed % 3600000) / 60000);
    const rate = Number(state.rate || 0);
    const pay = rate * (elapsed / 3600000);
    const pad = n => String(n).padStart(2,'0');
    const days = ['יום א׳','יום ב׳','יום ג׳','יום ד׳','יום ה׳','יום ו׳','שבת'];
    const set = (id,val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
    set('v42Date', `${pad(start.getDate())}/${pad(start.getMonth()+1)}/${start.getFullYear()}`);
    set('v42Day', days[start.getDay()]);
    set('v42Hours', `${pad(start.getHours())}:${pad(start.getMinutes())} - עכשיו`);
    set('v42Pay', `₪${pay.toFixed(2)}`);
    set('v42Duration', `${h}:${pad(m)}`);
  };
  updateV42();
  setInterval(updateV42, 30000);
}

function readLocalState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch (_) { return {}; }
}
function isIos() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
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
applyUiV42();
updateNotificationHelp();
setInterval(refreshIfNeeded, 2500);
window.addEventListener('focus', refreshIfNeeded);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshIfNeeded(); });
setTimeout(refreshIfNeeded, 600);
