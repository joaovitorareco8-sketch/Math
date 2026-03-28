const express  = require('express');
const router   = express.Router();
const { db }   = require('../db/firestore');
const { getUnitState, projectRetention } = require('../p1_state/studentState');
const { checkWeakening, getRevisionsDue } = require('../p4_retention/retention');
const { MASTERY_THRESHOLD, RETENTION_THRESHOLD, WEAKENING_THRESHOLD,
        FLUENCY_SCOPE, TRANSFER_SCOPE } = require('../p1_state/constants');
const curriculum = require('../db/curriculum');

// GET /student/state?studentId=xxx
// Returns full student meta + curriculum summary
router.get('/state', async (req, res) => {
  try {
    const { studentId } = req.query;
    if (!studentId) return res.status(400).json({ error: 'studentId required' });

    const meta = await getStudentMeta(studentId);
    res.json(meta);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /student/unit/:unitId?studentId=xxx
// Returns micro state for one unit (P6.1 STUDENT_VIEW)
router.get('/unit/:unitId', async (req, res) => {
  try {
    const { unitId }   = req.params;
    const { studentId } = req.query;
    if (!studentId) return res.status(400).json({ error: 'studentId required' });

    const state = await getUnitState(studentId, unitId);
    const deps  = curriculum.getDeps(unitId);

    // Build per-level scores from evidence
    const snap = await db
      .collection('students').doc(studentId)
      .collection('units').doc(unitId)
      .collection('evidence')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();
    const log = snap.docs.map(d => d.data());

    const levelScore = (level) => {
      const subset = log.filter(e => e.demandLevel === level);
      if (!subset.length) return null;
      return subset.filter(e => e.outcome === 'correct').length / subset.length;
    };

    const projectedRetention = projectRetention(
      state.retentionScore ?? state.masteryLevel,
      state.lastSeen,
      unitId,
      Date.now() + 7 * 86400000
    );

    const view = {
      unitId,
      mastery: {
        level:    state.masteryLevel,
        label:    masteryLabel(state.masteryLevel),
        evidence: log.length,
      },
      fluency: {
        adequate:  state.fluencyAdequate,
        inScope:   FLUENCY_SCOPE.includes(unitId),
        label:     fluencyLabel(unitId, state),
        note: (state.masteryLevel >= MASTERY_THRESHOLD &&
               !state.fluencyAdequate &&
               FLUENCY_SCOPE.includes(unitId))
          ? 'Domínio conceitual presente, automatização ainda em desenvolvimento.'
          : null,
      },
      recognitionVsProduction: {
        recognition: levelScore('L1'),
        production:  levelScore('L3'),
        note: (levelScore('L1') >= 0.8 && (levelScore('L3') ?? 0) < MASTERY_THRESHOLD)
          ? 'Reconhece mas ainda não executa com autonomia.'
          : null,
      },
      guidedVsAutonomous: {
        guided:    levelScore('L2'),
        autonomous: levelScore('L3'),
        note: (levelScore('L2') >= 0.8 && (levelScore('L3') ?? 0) < MASTERY_THRESHOLD)
          ? 'Executa com suporte mas ainda não de forma autônoma.'
          : null,
      },
      localVsIntegrated: {
        local:       state.masteryLevel,
        transfer:    levelScore('L4'),
        integration: levelScore('L5'),
        note: (state.masteryLevel >= MASTERY_THRESHOLD && !state.transferDemonstrated &&
               TRANSFER_SCOPE.includes(unitId))
          ? 'Domínio local presente, transferência ainda não demonstrada.'
          : null,
      },
      dependencies: {
        requires: deps,
        stable:   [], // populated below
        failing:  [],
      },
      revisionNeed: {
        nextReview:          state.nextReview,
        overdue:             state.nextReview && state.nextReview < Date.now(),
        projectedRetention,
        note: (!state.nextReview || state.nextReview > Date.now())
          ? (projectedRetention && projectedRetention < WEAKENING_THRESHOLD
              ? 'Retenção em queda, revisão recomendada.'
              : null)
          : 'Revisão vencida.',
      },
    };

    // Resolve dep states
    for (const depId of deps) {
      const depState = await getUnitState(studentId, depId);
      if (depState.masteryLevel >= MASTERY_THRESHOLD) {
        view.dependencies.stable.push(depId);
      } else {
        view.dependencies.failing.push(depId);
      }
    }
    if (view.dependencies.failing.length > 0) {
      view.dependencies.note =
        `Dificuldades em ${view.dependencies.failing.join(', ')} afetam esta unidade.`;
    }

    res.json(view);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /student/curriculum?studentId=xxx
// Returns macro view (P6.1 CURRICULUM_VIEW)
router.get('/curriculum', async (req, res) => {
  try {
    const { studentId } = req.query;
    if (!studentId) return res.status(400).json({ error: 'studentId required' });

    const units   = curriculum.getAllUnits();
    const blocks  = curriculum.BLOCKS;
    const blockSummaries = [];

    for (const [blockId, blockUnits] of Object.entries(blocks)) {
      const states = await Promise.all(
        blockUnits.map(u => getUnitState(studentId, u))
      );
      const mastered  = states.filter(s => s.masteryLevel >= MASTERY_THRESHOLD).length;
      const fragile   = states.filter(s =>
        s.retentionScore !== null && s.retentionScore < WEAKENING_THRESHOLD
      ).length;
      const progress  = mastered / blockUnits.length;

      let status = 'inactive';
      if (fragile > 0)         status = 'fragile';
      else if (progress === 1) status = 'mastered';
      else if (progress > 0)   status = 'in_progress';

      blockSummaries.push({ blockId, progress, status, mastered, total: blockUnits.length });
    }

    const meta = await getStudentMeta(studentId);
    const weakening     = await checkWeakening(studentId, units);
    const revisionsDue  = await getRevisionsDue(studentId, units);

    res.json({
      blocks: blockSummaries,
      weakening,
      revisionsDue,
      streak: meta.streak,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── Helpers ───────────────────────────────────────────────

async function getStudentMeta(studentId) {
  const snap = await db.collection('students').doc(studentId).get();
  return snap.exists ? snap.data() : { studentId, streak: 0, lastSeen: null };
}

function masteryLabel(level) {
  if (level === null)           return 'não iniciado';
  if (level < 0.5)              return 'iniciado';
  if (level < MASTERY_THRESHOLD) return 'em progresso';
  return 'dominado';
}

function fluencyLabel(unitId, state) {
  if (!FLUENCY_SCOPE.includes(unitId)) return 'fluência não exigida aqui';
  if (state.fluencyAdequate === null)  return 'não avaliado';
  return state.fluencyAdequate ? 'fluente' : 'em desenvolvimento';
}

module.exports = router;
