const { db } = require('../db/firestore');
const {
  MASTERY_THRESHOLD, RETENTION_THRESHOLD,
  MIN_RETENTION_INTERVAL_DAYS,
  TRANSFER_SCOPE, INTEGRATION_SCOPE,
} = require('../p1_state/constants');
const { getUnitState, isBaseStable } = require('../p1_state/studentState');
const curriculum = require('../db/curriculum');

// ── P7.1  G.22  conclusion_evaluator ─────────────────────

async function unitConcluded(studentId, unitId) {
  const state = await getUnitState(studentId, unitId);
  const deps  = curriculum.getDeps(unitId);

  // Criterion 1: mastery
  if (!state.masteryLevel || state.masteryLevel < MASTERY_THRESHOLD) {
    return { pass: false, reason: 'INSUFFICIENT_MASTERY', current: state.masteryLevel };
  }

  // Criterion 2: retention after interval
  const verified = await retentionVerified(studentId, unitId);
  if (!verified) {
    return { pass: false, reason: 'RETENTION_NOT_VERIFIED' };
  }

  // Criterion 3: transfer if in scope
  if (TRANSFER_SCOPE.includes(unitId) && !state.transferDemonstrated) {
    return { pass: false, reason: 'TRANSFER_NOT_DEMONSTRATED' };
  }

  // Criterion 4: integration if in scope
  if (INTEGRATION_SCOPE.includes(unitId) && !state.integrationDemonstrated) {
    return { pass: false, reason: 'INTEGRATION_NOT_DEMONSTRATED' };
  }

  // Criterion 5: base stable
  const baseOk = await isBaseStable(studentId, unitId, deps);
  if (!baseOk) {
    return { pass: false, reason: 'UNSTABLE_BASE' };
  }

  return { pass: true };
}

async function retentionVerified(studentId, unitId) {
  const minMs = MIN_RETENTION_INTERVAL_DAYS * 86400000;

  // Find first mastery timestamp
  const evidenceSnap = await db
    .collection('students').doc(studentId)
    .collection('units').doc(unitId)
    .collection('evidence')
    .orderBy('timestamp', 'asc')
    .get();

  const log = evidenceSnap.docs.map(d => d.data());
  let firstMasteryTs = null;

  let correct = 0;
  for (const e of log) {
    if (e.outcome === 'correct') correct++;
    else correct = 0;
    if (correct >= 3) { firstMasteryTs = e.timestamp; break; }
  }

  if (!firstMasteryTs) return false;

  // Check for review after interval
  const reviewsAfter = log.filter(e =>
    e.type === 'review' &&
    e.timestamp > firstMasteryTs + minMs &&
    e.outcome === 'correct'
  );
  return reviewsAfter.length >= 1;
}

// Reopen unit when evidence contradicts conclusion
async function reopenUnit(studentId, unitId, reason) {
  await db
    .collection('students').doc(studentId)
    .collection('units').doc(unitId)
    .set({
      concluded: false,
      reopenLog: require('firebase-admin').firestore.FieldValue.arrayUnion({
        timestamp: Date.now(),
        reason,
      }),
    }, { merge: true });
}

module.exports = { unitConcluded, retentionVerified, reopenUnit };
