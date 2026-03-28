// ── Curriculum dependency map (P0.2) ─────────────────────
// Minimal dependency graph for gate and regression logic.
// Expand as P0 is fully specified.

const DEPS = {
  // KA — no deps
  'KA.1': [], 'KA.2': [], 'KA.3': [], 'KA.4': [], 'KA.5': [],
  'KA.6': ['KA.1'], 'KA.7': ['KA.3'], 'KA.8': ['KA.1','KA.3'],
  'KA.9': ['KA.1'], 'KA.10': ['KA.1'],

  // KB — depends on KA
  'KB.1': ['KA.1','KA.2'], 'KB.2': ['KB.1'], 'KB.3': ['KB.1'],
  'KB.4': ['KA.1'], 'KB.5': ['KB.1'], 'KB.6': ['KB.1'],
  'KB.7': ['KB.1'], 'KB.8': ['KB.1'], 'KB.9': ['KA.8'],
  'KB.10': ['KB.1'], 'KB.11': ['KB.8'],

  // KC — depends on KA, KB
  'KC.1': ['KA.1'], 'KC.2': ['KC.1'], 'KC.3': ['KC.1'],
  'KC.7': ['KB.1'], 'KC.8': ['KC.7'],
  'KC.10': ['KE.4'],
  'KC.11': ['KC.3'], 'KC.13': ['KB.8'], 'KC.14': ['KC.13'],
  'KC.15': ['KC.13'], 'KC.17': ['KC.13'], 'KC.18': ['KC.13'],
  'KC.20': ['KC.18'], 'KC.21': ['KC.20'],
  'KC.26': ['KF.8'], 'KC.28': ['KC.26'],

  // KD — depends on KB
  'KD.1': ['KB.1'], 'KD.2': ['KB.1'], 'KD.3': ['KD.1'],
  'KD.4': ['KB.1'], 'KD.5': ['KD.2'], 'KD.6': ['KD.3'],
  'KD.7': ['KD.2'], 'KD.9': ['KB.1'], 'KD.10': ['KB.1'],
  'KD.14': ['KD.10'], 'KD.15': ['KD.14'], 'KD.16': ['KD.15'],
  'KD.19': ['KD.15','KE.4'],

  // KE — depends on KA, KB, KD
  'KE.1': ['KA.9'], 'KE.4': ['KE.1'], 'KE.7': ['KE.4'],
  'KE.8': ['KE.4','KD.16'], 'KE.9': ['KE.4'],
  'KE.10': ['KE.4'], 'KE.11': ['KE.4'], 'KE.12': ['KE.10'],
  'KE.13': ['KE.12'], 'KE.14': ['KE.12'], 'KE.15': ['KE.14'],
  'KE.16': ['KE.12','KE.14'], 'KE.18': ['KE.16'],
  'KE.19': ['KE.16'], 'KE.21': ['KE.4'],

  // KF — depends on KC, KE
  'KF.1': ['KB.8'], 'KF.2': ['KB.6'], 'KF.3': ['KB.7'],
  'KF.4': ['KF.2'], 'KF.6': ['KF.4'], 'KF.7': ['KF.6'],
  'KF.8': ['KC.13','KB.11'], 'KF.9': ['KF.8'],
  'KF.10': ['KF.8'], 'KF.11': ['KF.8'],

  // KG — depends on KC, KD, KE
  'KG.1': ['KA.6'], 'KG.5': ['KB.4'], 'KG.7': ['KB.3'],
  'KG.9': ['KG.1'], 'KG.10': ['KE.9'], 'KG.11': ['KC.3'],
  'KG.12': ['KB.2'], 'KG.14': ['KC.8','KE.8'],
  'KG.15': ['KG.14'], 'KG.16': ['KA.4'],

  // KH — integration nodes, depend on multiple blocks
  'KH.1': ['KE.8','KD.15','KD.19'],
  'KH.2': ['KD.14','KE.8'],
  'KH.3': ['KF.4','KC.20'],
  'KH.4': ['KF.9','KC.13'],
  'KH.5': ['KG.14','KC.8'],
  'KH.6': ['KA.6','KG.15'],
  'KH.7': ['KC.8','KG.15'],
  'KH.8': ['KH.7','KF.8'],
  'KH.9': ['KH.5','KH.4'],
};

const ALL_UNITS = Object.keys(DEPS);

const BLOCKS = {
  'BLK.A': ALL_UNITS.filter(u => u.startsWith('KA')),
  'BLK.B': ALL_UNITS.filter(u => u.startsWith('KB')),
  'BLK.C': ALL_UNITS.filter(u => u.startsWith('KC')),
  'BLK.D': ALL_UNITS.filter(u => u.startsWith('KD')),
  'BLK.E': ALL_UNITS.filter(u => u.startsWith('KE')),
  'BLK.F': ALL_UNITS.filter(u => u.startsWith('KF')),
  'BLK.G': ALL_UNITS.filter(u => u.startsWith('KG')),
  'BLK.H': ALL_UNITS.filter(u => u.startsWith('KH')),
};

function getDeps(unitId) {
  return DEPS[unitId] ?? [];
}

function getAllUnits() {
  return ALL_UNITS;
}

function getBlock(blockId) {
  return BLOCKS[blockId] ?? [];
}

module.exports = { getDeps, getAllUnits, getBlock, BLOCKS, DEPS };
