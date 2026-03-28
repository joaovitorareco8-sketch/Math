const { FAST_THRESHOLD_MS, MASTERY_THRESHOLD, RETENTION_THRESHOLD, WEAKENING_THRESHOLD } = require('../p1_state/constants');

// ── P6.2  G.20  calibration_feedback_generator ───────────
// Triggers: CT.1–CT.5

function detectTrigger(unitId, evidence, recentLog, state) {
  // CT.1: fast but wrong
  if (evidence.latencyMs &&
      evidence.latencyMs < FAST_THRESHOLD_MS &&
      evidence.outcome === 'incorrect') {
    return 'CT1';
  }

  // CT.2: correct in trained format, wrong in new format
  const trainedFormats = new Set(
    recentLog.filter(e => ['L2','L3'].includes(e.demandLevel) && e.outcome === 'correct')
             .map(e => e.format)
  );
  const recentCorrectTrained = recentLog.slice(0,5)
    .filter(e => trainedFormats.has(e.format) && e.outcome === 'correct').length;
  const recentWrongNew = recentLog.slice(0,3)
    .filter(e => !trainedFormats.has(e.format) && e.outcome === 'incorrect').length;
  if (recentCorrectTrained >= 3 && recentWrongNew >= 2) return 'CT2';

  // CT.3: correct guided, wrong autonomous
  const guidedCorrect = recentLog
    .filter(e => e.demandLevel === 'L2' && e.outcome === 'correct').length;
  const freeIncorrect = recentLog
    .filter(e => e.demandLevel === 'L3' && e.outcome === 'incorrect').length;
  if (guidedCorrect >= 3 && freeIncorrect >= 2) return 'CT3';

  // CT.4: retention surprise
  if (state.retentionScore !== null &&
      state.retentionScore < RETENTION_THRESHOLD &&
      state.masteryLevel   >= MASTERY_THRESHOLD) {
    return 'CT4';
  }

  // CT.5: correct but slow in fluency scope
  if (evidence.conceptualCorrect && evidence.fluent === false) return 'CT5';

  return null;
}

const CALIBRATION_MESSAGES = {
  CT1: {
    type:    'warning',
    message: 'Resposta rápida mas incorreta: velocidade sem domínio não conta.',
    action:  'Revise o conceito antes de tentar novamente.',
  },
  CT2: {
    type:    'insight',
    message: 'Acerto no formato conhecido, erro em formato novo: domínio ainda vinculado ao formato treinado.',
    action:  'Pratique em formatos diferentes.',
  },
  CT3: {
    type:    'insight',
    message: 'Executa com suporte mas não sem ele: domínio ainda não é autônomo.',
    action:  'Pratique sem consultar modelo ou pista.',
  },
  CT4: {
    type:    'warning',
    message: 'Conteúdo dominado anteriormente mas enfraquecido: domínio precisa de manutenção.',
    action:  'Revisão necessária antes de avançar.',
  },
  CT5: {
    type:    'info',
    message: 'Resposta correta mas lenta: compreensão presente, automatização ainda em desenvolvimento.',
    action:  'Continue praticando para reduzir latência.',
  },
};

function generateCalibrationFeedback(trigger, unitId) {
  if (!trigger) return null;
  return {
    trigger,
    unitId,
    ...CALIBRATION_MESSAGES[trigger],
    unitLink: `/student/unit/${unitId}`, // deep link to micro view
  };
}

module.exports = { detectTrigger, generateCalibrationFeedback };
