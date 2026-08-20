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
// TEMPORARY TEST: 5 minutes. Restore to 8h30 after push verification.
const REMINDER_DELAY_MS = 5 * 60 * 1000;

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
    if (firstText) firstText.textContent = '\n        🔔 בדיקת Push: התראה אחרי 5 דקות אם המשמרת עדיין פתוחה\n        ';
    const desc = label.querySelector('div');
    if (desc) {
      desc.textContent = isIos() && !isStandalone()
        ? 'באייפון: יש להוסיף את האתר למסך הבית, לפתוח משם ולאשר התראות.'
        : 'בדיקה זמנית: ההתראה נשלחת ב-Push ויכולה להגיע גם כשהאפליקציה סגורה.';
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

updateNotificationHelp();
setInterval(refreshIfNeeded, 2500);
window.addEventListener('focus', refreshIfNeeded);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshIfNeeded();
});
setTimeout(refreshIfNeeded, 600);
