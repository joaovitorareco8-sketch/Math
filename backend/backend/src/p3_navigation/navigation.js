const {
  MASTERY_THRESHOLD, RETENTION_THRESHOLD, NEW_LIMIT,
  FLUENCY_SCOPE,
} = require('../p1_state/constants');
const { getSVScore } = require('../p1_state/structuralValue');
const { getUnitState, isBaseStable } = require('../p1_state/studentState');
const { masteryCheckFromLog } = require('../p2_assessment/evidenceAndDiagnosis');
const curriculum = require('../db/curriculum');

// ── P3.1  G.8  advance_gate ──────────────────────────────

async function canAdvance(studentId, unitId) {
  const deps  = curriculum.getDeps(unitId);
  const state = await getUnitState(studentId, unitId);
  const baseOk = await isBaseStable(studentId, unitId, deps);

  if (!baseOk) {
    return { open: false, reason: 'UNSTABLE_BASE', failingDeps: deps };
  }
  if (!state.masteryLevel || state.masteryLevel < MASTERY_THRESHOLD) {
    return {
      open: false,
      reason: 'INSUFFICIENT_EVIDENCE',
      current: state.masteryLevel,
      required: MASTERY_THRESHOLD,
    };
  }
  if (state.retentionScore !== null &&
      state.retentionScore < RETENTION_THRESHOLD) {
    return {
      open: false,
      reason: 'RETENTION_DECAYED',
      current: state.retentionScore,
      required: RETENTION_THRESHOLD,
    };
  }
  return { open: true };
}

// ── P3.2  G.7  session_planner ───────────────────────────

async function buildSessionPlan(studentId, sessionSize = 10) {
  const units      = curriculum.getAllUnits();
  const scored     = [];

  for (const unitId of units) {
    const state  = await getUnitState(studentId, unitId);
    const gate   = await canAdvance(studentId, unitId);
    const sv     = getSVScore(unitId);
    const score  = computeScore(state, gate, sv);
    const type   = classifyCandidateType(state);
    scored.push({ unitId, score, type, state });
  }

  scored.sort((a,b) => b.score - a.score);

  const plan     = [];
  let newCount   = 0;

  for (const candidate of scored) {
    if (plan.length >= sessionSize) break;
    if (candidate.type === 'new' && newCount >= NEW_LIMIT) continue;
    if (!loadAcceptable(plan, candidate)) continue;

    plan.push({ unitId: candidate.unitId, type: candidate.type });
    if (candidate.type === 'new') newCount++;
  }

  return plan;
}

function computeScore(state, gate, sv) {
  const PRIORITY_BOOST = 5;

  if (!gate.open && gate.reason === 'UNSTABLE_BASE') {
    return 1 * sv + PRIORITY_BOOST * (gate.failingDeps?.length ?? 1);
  }
  if (state.retentionScore !== null &&
      state.retentionScore < RETENTION_THRESHOLD) {
    const decay = RETENTION_THRESHOLD - state.retentionScore;
    return 2 * sv + decay * 10;
  }
  if (state.masteryLevel !== null &&
      state.masteryLevel < MASTERY_THRESHOLD &&
      gate.open) {
    return 3 * sv + state.masteryLevel;
  }
  if (state.masteryLevel === null && gate.open) {
    return 4 * sv;
  }
  return 0;
}

function classifyCandidateType(state) {
  if (state.masteryLevel === null)                                   return 'new';
  if (state.retentionScore < RETENTION_THRESHOLD)                    return 'review';
  if (state.masteryLevel < MASTERY_THRESHOLD)                        return 'consolidate';
  return 'maintenance';
}

// CLT load model — REQUIRES_CALIBRATION: element_interactivity per unit
function loadAcceptable(plan, candidate) {
  const noveltyFactor = candidate.state.masteryLevel === null ? 1.5 : 1.0;
  const itemLoad      = 1 * noveltyFactor; // element_interactivity placeholder
  const currentLoad   = plan.reduce((sum, p) => {
    const nf = p.type === 'new' ? 1.5 : 1.0;
    return sum + nf;
  }, 0);
  return (currentLoad + itemLoad) <= 7; // Miller proxy
}

// ── P3.3  G.9  intervention_selector ─────────────────────

const INTERVENTION_PROTOCOLS = {
  B7_1: 'base_reinforcement',
  B7_2: 'execution_consolidation',
  B7_3: 'fluency_development',
  B7_4: 'transfer_promotion',
  B7_5: 'integration_promotion',
  B7_6: 'progress_preservation',
};

function selectIntervention(routedAction) {
  if (!routedAction || !routedAction.intervention) return null;
  return {
    unitId:    routedAction.unitId,
    protocol:  INTERVENTION_PROTOCOLS[routedAction.intervention],
    protocolId: routedAction.intervention,
    cause:     routedAction.cause,
  };
}

// ── P3.4  G.10  regression_controller ────────────────────

function buildRegressionPlan(unitId, cause, deps) {
  if (cause === 'MISSING_PREREQUISITE') {
    const failing = deps?.[0] ?? null;
    return { regressTo: failing, resetUnit: false, preserveEvidence: true };
  }
  if (cause === 'CONCEPTUAL_GAP') {
    return { regressTo: unitId, resetLevel: 'L1', resetUnit: false, preserveEvidence: true };
  }
  // LOW_AUTOMATIZATION, TRANSFER_NOT_DEVELOPED, INTEGRATION_NOT_DEVELOPED
  return { regressTo: null, resetUnit: false, preserveEvidence: true };
}

module.exports = {
  canAdvance,
  buildSessionPlan,
  selectIntervention,
  buildRegressionPlan,
  classifyCandidateType,
};
