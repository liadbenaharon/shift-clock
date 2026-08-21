import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithCredential } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDDEElCF6iH35N9TYo7uqW0Oafm_E1E1Sw',
  authDomain: 'shift-clock-19c2d.firebaseapp.com',
  projectId: 'shift-clock-19c2d',
  storageBucket: 'shift-clock-19c2d.firebasestorage.app',
  messagingSenderId: '470768596231',
  appId: '1:470768596231:web:2ac632c55e92a27c9c01a2'
};

const STORAGE_KEY = 'ilShiftTrackerData_v1';
const BACKUP_COLLECTION = 'userBackups';

function isNativeAndroid() {
  const cap = window.Capacitor;
  if (!cap) return false;
  try {
    if (typeof cap.isNativePlatform === 'function' && !cap.isNativePlatform()) return false;
    if (typeof cap.getPlatform === 'function') return cap.getPlatform() === 'android';
  } catch (_) {}
  return /Android/i.test(navigator.userAgent);
}

function getNativeFirebaseAuth() {
  return window.Capacitor?.Plugins?.FirebaseAuthentication || null;
}

function readLocalState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch (_) { return {}; }
}

function setStatus(message, isError = false) {
  const status = document.getElementById('v59CloudStatus');
  if (status) {
    status.textContent = message;
    status.classList.toggle('v59-error', isError);
  }
}

async function nativeGoogleBackup() {
  const btn = document.getElementById('v59GoogleBtn');
  if (btn) btn.disabled = true;
  setStatus('פותח התחברות Google מאובטחת באפליקציה…');

  try {
    const nativeAuth = getNativeFirebaseAuth();
    if (!nativeAuth?.signInWithGoogle) throw new Error('native-auth-plugin-unavailable');

    // Credential Manager can return "No credentials available" on some Android/Samsung setups.
    // Use the legacy Google Sign-In flow, which presents the account chooser reliably.
    const result = await nativeAuth.signInWithGoogle({ useCredentialManager: false });
    const idToken = result?.credential?.idToken;
    const accessToken = result?.credential?.accessToken;
    if (!idToken && !accessToken) throw new Error('native-google-credential-missing');

    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const credential = GoogleAuthProvider.credential(idToken || null, accessToken || null);
    const webResult = await signInWithCredential(auth, credential);
    const user = webResult.user;

    const state = readLocalState();
    const db = getFirestore(app);
    await setDoc(doc(db, BACKUP_COLLECTION, user.uid), {
      uid: user.uid,
      state,
      updatedAt: serverTimestamp(),
      clientUpdatedAtMs: Date.now(),
      source: 'shift-clock-android',
      accountType: 'google'
    }, { merge: true });

    setStatus('✓ מחובר ל-Google — הגיבוי האוטומטי פעיל באפליקציה.');
    if (btn) {
      btn.textContent = '✓ מחובר ל-Google — הגיבוי קבוע';
      btn.disabled = true;
    }
  } catch (err) {
    console.error('Native Google sign-in failed:', err);
    const code = String(err?.code || err?.message || 'unknown');
    let message = `ההתחברות באפליקציה נכשלה (${code}).`;
    if (code.includes('12500') || code.includes('DEVELOPER_ERROR')) message = 'Google Sign-In עדיין לא מאושר לחתימת האפליקציה. צריך לבדוק SHA-1 ו-OAuth ב-Firebase.';
    if (code.includes('cancel') || code.includes('CANCELED')) message = 'ההתחברות ל-Google בוטלה.';
    if (code.includes('No credentials available')) message = 'לא נמצא חשבון Google זמין במכשיר. ודא שיש חשבון Google מחובר למכשיר ונסה שוב.';
    setStatus(message, true);
    if (btn) btn.disabled = false;
  }
}

function installNativeHandler() {
  if (!isNativeAndroid()) return;
  const oldBtn = document.getElementById('v59GoogleBtn');
  if (!oldBtn || oldBtn.dataset.nativeGoogleReady === '1') return;

  const btn = oldBtn.cloneNode(true);
  btn.dataset.nativeGoogleReady = '1';
  btn.disabled = false;
  oldBtn.replaceWith(btn);
  btn.addEventListener('click', nativeGoogleBackup);
  setStatus('האפליקציה מוכנה להתחברות Google מאובטחת.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    installNativeHandler();
    setTimeout(installNativeHandler, 500);
    setTimeout(installNativeHandler, 1500);
  });
} else {
  installNativeHandler();
  setTimeout(installNativeHandler, 500);
  setTimeout(installNativeHandler, 1500);
}

new MutationObserver(installNativeHandler).observe(document.documentElement, { childList: true, subtree: true });
