const fs   = require('fs');
const path = require('path');
const {
  MASTERY_THRESHOLD, FLUENCY_SCOPE,
  TRANSFER_SCOPE, INTEGRATION_SCOPE,
} = require('../p1_state/constants');

// ── P2.1  G.1  item_generation_engine ────────────────────
// Load all templates at startup
const TEMPLATES = loadTemplates();

function loadTemplates() {
  const dir = path.join(__dirname, '../templates');
  const templates = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    templates.push(...JSON.parse(raw));
  }
  return templates;
}

// Determine demand level from unit state
function determineLevel(state) {
  const m = state.masteryLevel;
  if (m === null)                       return 'L1';
  if (m < 0.5)                          return 'L1';
  if (m < 0.70)                         return 'L2';
  if (m < MASTERY_THRESHOLD)            return 'L3';
  if (!state.transferDemonstrated &&
      TRANSFER_SCOPE.includes(state.unitId)) return 'L4';
  if (!state.integrationDemonstrated &&
      INTEGRATION_SCOPE.includes(state.unitId)) return 'L5';
  return 'L3'; // maintenance
}

// Select least-used format from evidence log
function selectFormat(evidenceLog, allFormats) {
  const used = evidenceLog.map(e => e.format);
  const counts = {};
  for (const f of allFormats) counts[f] = 0;
  for (const f of used) if (counts[f] !== undefined) counts[f]++;
  return Object.entries(counts).sort((a,b) => a[1]-b[1])[0][0];
}

// Generate item from template by instantiating params
function instantiateTemplate(template, overrideParams = {}) {
  // In production, a param resolver would evaluate expressions.
  // Here we return the template with a seed_example for now,
  // falling back to raw template for testing.
  const example = template.seed_examples?.[0] ?? null;
  if (!example) return buildItemFromTemplate(template, {});
  return buildItemFromTemplate(template, example.params ?? {});
}

function buildItemFromTemplate(template, params) {
  const resolveVars = (str, p) => {
    if (typeof str !== 'string') return str;
    return str.replace(/\{([^}]+)\}/g, (_, key) => p[key] ?? `{${key}}`);
  };

  const question  = resolveVars(template.question, params);
  const correct   = resolveVars(template.correct,  params);
  const distractors = (template.distractors ?? []).map(d => ({
    value:          resolveVars(d.value,    params),
    distractorType: d.distractor_type,
    feedback:       resolveVars(d.feedback, params),
  }));

  return {
    templateId:      template.template_id,
    unitId:          template.unit_id,
    demandLevel:     template.level,
    format:          template.format,
    context:         template.context,
    interaction:     template.interaction,
    timed:           template.timed,
    timeLimit:       template.time_limit,
    methodCue:       template.method_cue,
    transferCondition: template.transfer_condition,
    integrationPairId: template.integration_pair_id,
    unitsRequired:   template.units_required,
    question,
    correct,
    distractors,
    feedbackCorrect: template.feedback_correct
      ? resolveVars(template.feedback_correct, params)
      : null,
  };
}

// Main generation function
function generateItem(unitId, state, evidenceLog = []) {
  const level = determineLevel(state);

  // Filter templates matching unit and level
  const candidates = TEMPLATES.filter(t =>
    t.unit_id === unitId && t.level === level
  );

  if (candidates.length === 0) {
    // Fallback: any level for this unit
    const fallback = TEMPLATES.filter(t => t.unit_id === unitId);
    if (fallback.length === 0) return null;
    return instantiateTemplate(fallback[0]);
  }

  // Prefer least-used format
  const usedFormats = evidenceLog.map(e => e.format);
  const formatCounts = {};
  for (const t of candidates) {
    formatCounts[t.format] = (formatCounts[t.format] ?? 0) +
      usedFormats.filter(f => f === t.format).length;
  }
  const sorted = [...candidates].sort((a,b) =>
    (formatCounts[a.format] ?? 0) - (formatCounts[b.format] ?? 0)
  );

  return instantiateTemplate(sorted[0]);
}

module.exports = { generateItem, determineLevel, TEMPLATES };
