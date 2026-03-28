// ── P1 CONSTANTS ─────────────────────────────────────────
// All thresholds marked REQUIRES_CALIBRATION have
// literature-justified baselines. Do not treat as validated.

const MASTERY_THRESHOLD  = 0.85;   // REQUIRES_CALIBRATION per cluster
const RETENTION_THRESHOLD = 0.75;  // REQUIRES_CALIBRATION
const WEAKENING_THRESHOLD = 0.82;  // REQUIRES_CALIBRATION
const MIN_EVIDENCE        = 8;     // REQUIRES_CALIBRATION per cluster
const MIN_TIMED_EVIDENCE  = 3;
const MIN_CONSISTENCY     = 0.85;  // REQUIRES_CALIBRATION
const MIN_VARIETY         = 3;
const MIN_LEVELS          = 2;
const RETENTION_WINDOW_DAYS = 14;
const FAST_THRESHOLD_MS   = 1500;  // REQUIRES_CALIBRATION per item type
const NEW_LIMIT           = 2;
const PROJECTION_WINDOW_DAYS = 3;
const MIN_RETENTION_INTERVAL_DAYS = 3;

// Structural value tiers (from P1.1 ranker output)
const SV_TIERS = {
  tier1: ['KA.1','KA.2','KA.3','KA.8','KB.1','KC.8','KD.10','KD.12','KE.1','KE.4'],
  tier2: ['KD.14','KC.13','KF.8','KE.16','KG.14','KD.15','KD.16','KD.17'],
  tier3: ['KC.20','KC.21','KF.4','KE.10','KG.3'],
  tier4: [] // KH.* and terminals — populated from unit list
};

// Fluency scope — units where timed evidence matters
const FLUENCY_SCOPE = [
  ...Array.from({length:15}, (_,i) => `KB.${i+1}`),
  ...Array.from({length:8},  (_,i) => `KC.${i+1}`),
  ...Array.from({length:9},  (_,i) => `KD.${i+1}`),
  'KE.10','KE.11','KE.12','KE.13','KE.14','KE.15','KE.16',
];

// Transfer scope — units requiring transfer demonstration
const TRANSFER_SCOPE = [
  ...Array.from({length:11}, (_,i) => `KF.${i+1}`),
  ...Array.from({length:15}, (_,i) => `KG.${i+1}`),
  ...Array.from({length:9},  (_,i) => `KH.${i+1}`),
];

// Integration scope
const INTEGRATION_SCOPE = Array.from({length:9}, (_,i) => `KH.${i+1}`);

// Power function decay beta per SV tier (REQUIRES_CALIBRATION)
const BETA_BY_TIER = { 1: 0.45, 2: 0.35, 3: 0.35, 4: 0.25 };

// Default unit difficulty for SM-2 EF (REQUIRES_CALIBRATION)
const DEFAULT_UNIT_DIFFICULTY = 0.5;

module.exports = {
  MASTERY_THRESHOLD,
  RETENTION_THRESHOLD,
  WEAKENING_THRESHOLD,
  MIN_EVIDENCE,
  MIN_TIMED_EVIDENCE,
  MIN_CONSISTENCY,
  MIN_VARIETY,
  MIN_LEVELS,
  RETENTION_WINDOW_DAYS,
  FAST_THRESHOLD_MS,
  NEW_LIMIT,
  PROJECTION_WINDOW_DAYS,
  MIN_RETENTION_INTERVAL_DAYS,
  SV_TIERS,
  FLUENCY_SCOPE,
  TRANSFER_SCOPE,
  INTEGRATION_SCOPE,
  BETA_BY_TIER,
  DEFAULT_UNIT_DIFFICULTY,
};
