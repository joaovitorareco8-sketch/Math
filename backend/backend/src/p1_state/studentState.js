const { db } = require('../db/firestore');
const {
  MASTERY_THRESHOLD, MIN_EVIDENCE, MIN_TIMED_EVIDENCE,
  MIN_CONSISTENCY, MIN_VARIETY, MIN_LEVELS,
  RETENTION_WINDOW_DAYS, BETA_BY_TIER, DEFAULT_UNIT_DIFFICULTY,
} = require('./constants');
const { getSVTier } = require('./structuralValue');

// ── P1.2  G.6  student_state_model ───────────────────────

// Get unit state from Firestore
async function getUnitState(studentId, unitId) {
  const doc = await db
    .collection('students').doc(studentId)
    .collection('units').doc(unitId)
    .get();
  return doc.exists ? doc.data() : createEmptyUnitState(unitId);
}

function createEmptyUnitState(unitId) {
  return {
    unitId,
    masteryLevel:           null,
    fluencyAdequate:        null,
    retentionScore:         null,
    transferDemonstrated:   false,
    integrationDemonstrated: false,
    lastSeen:               null,
    nextReview:             null,
    reviewCount:            0,
    concluded:              false,
    reopenLog:              [],
    lastClassification:     null,
    evidenceLog:            [],   // stored separately for large logs
  };
}

// Update unit state after new evidence
async function updateUnitState(studentId, unitId, evidence) {
  const ref = db
    .collection('students').doc(studentId)
    .collection('units').doc(unitId);

  // Append evidence to subcollection (avoids doc size limits)
  await ref.collection('evidence').add(evidence);

  // Recompute state
  const evidenceSnap = await ref.collection('evidence')
    .orderBy('timestamp', 'desc')
    .limit(50)
    .get();
  const log = evidenceSnap.docs.map(d => d.data());

  const masteryLevel   = computeMastery(log);
  const retentionScore = computeRetention(log, unitId);
  const fluencyAdequate = computeFluencyAdequate(log);

  const update = {
    masteryLevel,
    retentionScore,
    fluencyAdequate,
    lastSeen: Date.now(),
  };

  await ref.set(update, { merge: true });
  return { ...update, unitId };
}

// ── COMPUTE_MASTERY ───────────────────────────────────────
function computeMastery(log) {
  if (log.length < MIN_EVIDENCE) return null;

  const recent    = log.slice(0, MIN_EVIDENCE);
  const correct   = recent.filter(e => e.outcome === 'correct').length;
  const consistency = correct / MIN_EVIDENCE;
  if (consistency < MIN_CONSISTENCY) return consistency;

  const variety = new Set(log.map(e => e.format)).size;
  const levels  = new Set(log.map(e => e.demandLevel)).size;

  if (variety < MIN_VARIETY) return consistency * 0.8;
  if (levels  < MIN_LEVELS)  return consistency * 0.9;

  return consistency;
}

// ── COMPUTE_RETENTION ─────────────────────────────────────
function computeRetention(log, unitId) {
  const windowMs = RETENTION_WINDOW_DAYS * 86400000;
  const cutoff   = Date.now() - windowMs;
  const recent   = log.filter(e => e.timestamp > cutoff);

  if (recent.length === 0) {
    // Project from last known score using power decay
    const lastScore = log[0]?.retentionSnapshot ?? null;
    if (!lastScore || !log[0]?.timestamp) return null;
    return projectRetention(lastScore, log[0].timestamp, unitId, Date.now());
  }

  return computeMastery(recent) ?? null;
}

// ── POWER FUNCTION RETENTION PROJECTION ──────────────────
// retention(t) = last_score * (t + 1)^(-beta)
// t in days since last practice
// REQUIRES_CALIBRATION: beta per unit
function projectRetention(lastScore, lastSeenMs, unitId, atMs) {
  if (!lastScore) return null;
  const t    = (atMs - lastSeenMs) / 86400000; // days
  const tier = getSVTier(unitId);
  const beta = BETA_BY_TIER[tier] ?? 0.35;
  return lastScore * Math.pow(t + 1, -beta);
}

// ── FLUENCY (continuous, power law) ──────────────────────
// Returns true if current_latency <= 2 * min_observed_latency
// REQUIRES_CALIBRATION per fluency unit
function computeFluencyAdequate(log) {
  const timedLog = log.filter(e => e.timed && e.latencyMs);
  if (timedLog.length < 3) return null;

  const latencies = timedLog.map(e => e.latencyMs);
  const minObs    = Math.min(...latencies);
  const current   = latencies[0]; // most recent
  return current <= 2 * minObs;
}

// ── BASE_STABLE ───────────────────────────────────────────
async function isBaseStable(studentId, unitId, deps) {
  for (const depId of deps) {
    const state = await getUnitState(studentId, depId);
    if (!state.masteryLevel || state.masteryLevel < MASTERY_THRESHOLD) {
      return false;
    }
  }
  return true;
}

module.exports = {
  getUnitState,
  updateUnitState,
  createEmptyUnitState,
  computeMastery,
  projectRetention,
  computeFluencyAdequate,
  isBaseStable,
};
