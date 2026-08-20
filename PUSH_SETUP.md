# Shift Clock – 8:30 forgotten-shift push

Goal: send one push notification 8 hours 30 minutes after a shift starts if it is still active, including when the web app is closed.

## Requirements

- HTTPS deployment (GitHub Pages is fine).
- Android/Samsung: install/open as a PWA and grant notification permission.
- iPhone/iPad: iOS/iPadOS 16.4+; add the site to the Home Screen, launch it from the Home Screen, then grant notification permission from a user gesture.
- A remote push backend/scheduler. A page timer or service worker timer alone cannot guarantee an exact notification while the app is fully closed.

## Repository status

This feature branch contains:

- `manifest.json` for installability.
- `firebase-messaging-sw.js` as the background push receiver.

The remaining integration needs the public Firebase Web configuration + Web Push VAPID public key. Server credentials must be stored only as GitHub/Firebase secrets and must never be committed.

## Desired backend behavior

When a shift starts, persist an active-shift record with `startedAt`, a device/subscription identifier and `notificationSent=false`.

When a shift ends, mark/delete the active-shift record.

The scheduler sends only when:

`now >= startedAt + 8h30m && shift is still active && notificationSent == false`

After a successful send it sets `notificationSent=true`, preventing duplicates.
