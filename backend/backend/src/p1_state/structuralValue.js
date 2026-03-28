const { SV_TIERS } = require('./constants');

// ── P1.1  G.21  structural_value_ranker ──────────────────
// Returns structural value tier (1-4) for a unit.
// Precomputed from dependency graph (P0.2).
// w1=0.7 (transitive reach), w2=0.3 (depth)

function getSVTier(unitId) {
  if (SV_TIERS.tier1.includes(unitId)) return 1;
  if (SV_TIERS.tier2.includes(unitId)) return 2;
  if (SV_TIERS.tier3.includes(unitId)) return 3;
  return 4;
}

// Normalized structural value score (0-1, higher = more central)
function getSVScore(unitId) {
  const tier = getSVTier(unitId);
  const scores = { 1: 1.0, 2: 0.7, 3: 0.4, 4: 0.1 };
  return scores[tier];
}

module.exports = { getSVTier, getSVScore };
