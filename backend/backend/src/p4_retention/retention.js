const { db } = require('../db/firestore');
const {
  RETENTION_THRESHOLD, WEAKENING_THRESHOLD,
  PROJECTION_WINDOW_DAYS, DEFAULT_UNIT_DIFFICULTY,
} = require('../p1_state/constants');
const { getSVTier } = require('../p1_state/structuralValue');
const { projectRetention } = require('../p1_state/studentState');

// ── P4.1  G.11  spaced_revision_scheduler ────────────────
// SM-2 baseline (Wozniak & Gorzelanczyk, 1994)
// NOTE: SM-2 is a baseline, not a complete retention solution.
// REQUIRES_CALIBRATION: unit_difficulty per unit

function getInterval(unitId, n, quality, unitDifficulty) {
  const difficulty = unitDifficulty ?? DEFAULT_UNIT_DIFFICULTY;
  if (n === 1) return 1;
  if (n === 2) return 6;

  const EF = Math.max(
    1.3,
    2.5 - 0.8 * difficulty + 0.28 * quality - 0.02 * quality * quality
  );

  // Recursive: interval(n) = interval(n-1) * EF
  // Iterative to avoid stack issues
  let interval = 6;
  for (let i = 3; i <= n; i++) {
    interval = interval * EF;
  }
  return Math.round(interval);
}

async function scheduleRevision(studentId, unitId, reviewCount, quality) {
  const intervalDays = getInterval(unitId, reviewCount + 1, quality);
  const nextReview   = Date.now() + intervalDays * 86400000;

  await db
    .collection('students').doc(studentId)
    .collection('units').doc(unitId)
    .set({ nextReview, reviewCount: reviewCount + 1 }, { merge: true });

  return nextReview;
}

async function getRevisionsDue(studentId, units) {
  const due = [];
  for (const unitId of units) {
    const snap = await db
      .collection('students').doc(studentId)
      .collection('units').doc(unitId)
      .get();
    if (!snap.exists) continue;
    const data = snap.data();
    if (data.nextReview && data.nextReview <= Date.now()) {
      due.push({ unitId, nextReview: data.nextReview });
    }
  }
  return due.sort((a,b) => a.nextReview - b.nextReview);
}

// ── P4.2  G.12  weakening_detector ───────────────────────

async function checkWeakening(studentId, units) {
  const weakening = [];
  const projectionMs = PROJECTION_WINDOW_DAYS * 86400000;

  for (const unitId of units) {
    const snap = await db
      .collection('students').doc(studentId)
      .collection('units').doc(unitId)
      .get();
    if (!snap.exists) continue;
    const state = snap.data();
    if (!state.masteryLevel || !state.lastSeen) continue;

    const projected = projectRetention(
      state.retentionScore ?? state.masteryLevel,
      state.lastSeen,
      unitId,
      Date.now() + projectionMs
    );

    if (projected !== null && projected < WEAKENING_THRESHOLD) {
      weakening.push({
        unitId,
        current:   state.retentionScore,
        projected,
        urgency:   WEAKENING_THRESHOLD - projected,
      });
    }
  }

  return weakening.sort((a,b) => b.urgency - a.urgency);
}

module.exports = { getInterval, scheduleRevision, getRevisionsDue, checkWeakening };
