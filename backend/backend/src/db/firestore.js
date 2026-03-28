const admin = require('firebase-admin');

// Initialize with service account from env
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:    process.env.FIREBASE_PROJECT_ID,
      clientEmail:  process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:   process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

// ── COLLECTIONS ──────────────────────────────────────────
// students/{studentId}
//   .units/{unitId}         ← unit state (mastery, retention, etc.)
//   .sessions/{sessionId}   ← session records
//   .meta                   ← streak, last_seen, etc.

module.exports = { db, admin };
