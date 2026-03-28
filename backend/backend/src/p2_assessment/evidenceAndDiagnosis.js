const { db } = require('../db/firestore');
const {
  MIN_EVIDENCE, MIN_CONSISTENCY, MIN_VARIETY, MIN_LEVELS,
  MASTERY_THRESHOLD, FAST_THRESHOLD_MS,
} = require('../p1_state/constants');
const { updateUnitState } = require('../p1_state/studentState');

// ── P2.2  G.2  evidence_aggregation_protocol ─────────────

async function recordEvidence(studentId, unitId, item, response) {
  const evidence = {
    timestamp:             Date.now(),
    demandLevel:           item.demandLevel,
    format:                item.format,
    context:               item.context,
    outcome:               response.answer === item.correct ? 'correct' : 'incorrect',
    timed:                 item.timed,
    latencyMs:             response.latencyMs ?? null,
    chosenDistractorType:  response.chosenDistractorType ?? null, // post-diff addition
    conceptualCorrect:     response.answer === item.correct,
    fluent: item.timed
      ? (response.answer === item.correct &&
         response.latencyMs <= (item.timeLimit * 1000))
      : null,
  };

  await updateUnitState(studentId, unitId, evidence);
  return evidence;
}

function masteryCheckFromLog(log) {
  if (log.length < MIN_EVIDENCE) return false;
  const recent      = log.slice(0, MIN_EVIDENCE);
  const consistency = recent.filter(e => e.outcome === 'correct').length / MIN_EVIDENCE;
  if (consistency < MIN_CONSISTENCY) return false;
  if (new Set(log.map(e => e.format)).size  < MIN_VARIETY) return false;
  if (new Set(log.map(e => e.demandLevel)).size < MIN_LEVELS) return false;
  return true;
}

// ── P2.3  G.3  error_classifier ──────────────────────────
// NOTE: heuristic classification — not causally validated.
// Confounders (fatigue, item quality, reading errors) not modeled.

function classifyErrors(unitId, log, deps) {
  const errors = log.filter(e => e.outcome === 'incorrect');
  if (errors.length === 0) return null;

  return {
    frequency:   classifyFrequency(errors, log),
    scope:       classifyScope(errors, deps),
    type:        classifyType(errors),
    transfer:    classifyTransfer(errors, log),
    integration: classifyIntegration(errors, log),
  };
}

function classifyFrequency(errors, log) {
  const rate = errors.length / log.length;
  return (rate > 0.4 && errors.length >= 3) ? 'recurrent' : 'isolated';
}

function classifyScope(errors, deps) {
  // deps: array of {unitId, masteryLevel}
  const failingDeps = (deps ?? []).filter(
    d => !d.masteryLevel || d.masteryLevel < 0.5
  );
  return failingDeps.length > 0 ? 'structural' : 'local';
}

function classifyType(errors) {
  const conceptual = errors.filter(e =>
    ['L1','L2'].includes(e.demandLevel)
  ).length;
  const fluency = errors.filter(e =>
    e.timed && (e.outcome === 'timeout' || e.latencyMs > 6000)
  ).length;
  return conceptual >= fluency ? 'conceptual' : 'fluency';
}

function classifyTransfer(errors, log) {
  const transferErrors = errors.filter(e => e.demandLevel === 'L4');
  const trainedErrors  = errors.filter(e => ['L2','L3'].includes(e.demandLevel));
  return (transferErrors.length > 0 && trainedErrors.length === 0)
    ? 'transfer_failure'
    : 'trained_format_failure';
}

function classifyIntegration(errors, log) {
  const integrationErrors = errors.filter(e => e.demandLevel === 'L5');
  const unitErrors        = errors.filter(e => ['L2','L3'].includes(e.demandLevel));
  return (integrationErrors.length > 0 && unitErrors.length === 0)
    ? 'integration_failure'
    : 'unit_failure';
}

// ── P2.4  G.4  cause_mapper ──────────────────────────────
// NOTE: decision rule set, not validated causal model.

const CAUSE_MAP = [
  { frequency:'recurrent', scope:'structural', type:'conceptual',              cause:'MISSING_PREREQUISITE'       },
  { frequency:'recurrent', scope:'local',      type:'conceptual',              cause:'CONCEPTUAL_GAP'             },
  { frequency:'recurrent', scope:'local',      type:'fluency',                 cause:'LOW_AUTOMATIZATION'         },
  { frequency:'isolated',  scope:'local',      type:'conceptual',              cause:'ATTENTION_ERROR'            },
  { transfer:'transfer_failure',               cause:'TRANSFER_NOT_DEVELOPED'                                     },
  { integration:'integration_failure',         cause:'INTEGRATION_NOT_DEVELOPED'                                  },
  { frequency:'recurrent', scope:'structural', type:'fluency',                 cause:'BASE_FLUENCY_INSUFFICIENT'  },
];

function mapCause(classification) {
  if (!classification) return null;

  for (const rule of CAUSE_MAP) {
    const match = Object.entries(rule)
      .filter(([k]) => k !== 'cause')
      .every(([k,v]) => classification[k] === v || v === '*');
    if (match) return rule.cause;
  }
  return 'UNKNOWN_CAUSE';
}

// ── P2.5  G.5  action_router ─────────────────────────────

const ACTION_MAP = {
  MISSING_PREREQUISITE:       'B7_1',
  CONCEPTUAL_GAP:             'B7_2',
  LOW_AUTOMATIZATION:         'B7_3',
  TRANSFER_NOT_DEVELOPED:     'B7_4',
  INTEGRATION_NOT_DEVELOPED:  'B7_5',
  BASE_FLUENCY_INSUFFICIENT:  'B7_1',
  ATTENTION_ERROR:            null,
};

function routeAction(unitId, log, deps) {
  const classification = classifyErrors(unitId, log, deps);
  if (!classification) return null;
  const cause      = mapCause(classification);
  const intervention = ACTION_MAP[cause] ?? null;
  return { unitId, cause, classification, intervention };
}

module.exports = {
  recordEvidence,
  masteryCheckFromLog,
  classifyErrors,
  mapCause,
  routeAction,
};
