import admin from 'firebase-admin';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT secret');
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(raw);
} catch (err) {
  console.error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const messaging = admin.messaging();
const now = Date.now();
const collection = db.collection('activeShifts');

const snapshot = await collection.where('notificationSent', '==', false).get();
let checked = 0;
let sent = 0;
let cleaned = 0;

for (const document of snapshot.docs) {
  checked++;
  const data = document.data() || {};
  const startedAtMs = Number(data.startedAtMs || 0);
  const remindAtMs = Number(data.remindAtMs || (startedAtMs + (8 * 60 + 30) * 60 * 1000));
  const token = data.token;

  if (!startedAtMs || !token || now < remindAtMs) continue;

  try {
    await messaging.send({
      token,
      data: {
        title: 'שכחת לסגור את המשמרת?',
        body: 'עברו 8 שעות ו־30 דקות מאז תחילת המשמרת. אם כבר סיימת, אל תשכח לסגור אותה.',
        tag: 'forgotten-shift-8h30',
        url: 'https://liadbenaharon.github.io/shift-clock/'
      },
      webpush: {
        headers: {
          TTL: '3600',
          Urgency: 'high'
        },
        fcmOptions: {
          link: 'https://liadbenaharon.github.io/shift-clock/'
        }
      }
    });

    await document.ref.update({
      notificationSent: true,
      notifiedAtMs: Date.now(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    sent++;
  } catch (err) {
    const code = err && err.code ? String(err.code) : '';
    console.error(`Failed sending reminder for ${document.id}:`, code || err);

    if (
      code.includes('registration-token-not-registered') ||
      code.includes('invalid-registration-token') ||
      code.includes('invalid-argument')
    ) {
      await document.ref.delete().catch(() => {});
      cleaned++;
    }
  }
}

console.log(JSON.stringify({ checked, sent, cleaned, at: new Date(now).toISOString() }));
