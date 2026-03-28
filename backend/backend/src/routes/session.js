const express  = require('express');
const router   = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db }   = require('../db/firestore');
const { buildSessionPlan } = require('../p3_navigation/navigation');
const { generateItem }     = require('../p2_assessment/itemGeneration');
const { recordEvidence }   = require('../p2_assessment/evidenceAndDiagnosis');
const { getUnitState }     = require('../p1_state/studentState');
const { detectTrigger, generateCalibrationFeedback } = require('../p6_metacognition/calibration');
const { scheduleRevision } = require('../p4_retention/retention');
const { checkWeakening }   = require('../p4_retention/retention');
const { unitConcluded, reopenUnit } = require('../p7_conclusion/conclusion');
const curriculum = require('../db/curriculum');

// POST /session/start
// Body: { studentId }
// Returns: { sessionId, plan: [{unitId, type}], firstItem }
router.post('/start', async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId) return res.status(400).json({ error: 'studentId required' });

    const plan      = await buildSessionPlan(studentId);
    const sessionId = uuidv4();

    // Store session plan in Firestore
    await db.collection('students').doc(studentId)
      .collection('sessions').doc(sessionId)
      .set({ plan, createdAt: Date.now(), currentIndex: 0, complete: false });

    // Generate first item
    const firstUnit  = plan[0];
    const firstItem  = firstUnit
      ? await getNextItem(studentId, firstUnit.unitId)
      : null;

    res.json({ sessionId, plan, firstItem });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /session/answer
// Body: { studentId, sessionId, item, response: { answer, latencyMs, chosenDistractorType } }
// Returns: { feedback, calibration, nextItem, sessionComplete }
router.post('/answer', async (req, res) => {
  try {
    const { studentId, sessionId, item, response } = req.body;
    if (!studentId || !sessionId || !item || !response) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1. Record evidence
    const evidence = await recordEvidence(studentId, item.unitId, item, response);

    // 2. Get updated state
    const state = await getUnitState(studentId, item.unitId);

    // 3. Build feedback
    const correct  = evidence.outcome === 'correct';
    let feedback   = { correct, feedbackText: null };

    if (correct) {
      feedback.feedbackText = item.feedbackCorrect;
    } else {
      const chosen = item.distractors?.find(
        d => d.value === response.answer
      );
      feedback.feedbackText = chosen?.feedback ?? 'Incorreto.';
      feedback.distractorType = chosen?.distractorType ?? null;
    }

    // 4. Detect calibration trigger
    const recentLog = await getRecentLog(studentId, item.unitId, 10);
    const trigger   = detectTrigger(item.unitId, evidence, recentLog, state);
    const calibration = generateCalibrationFeedback(trigger, item.unitId);

    // 5. Schedule revision if correct review
    if (correct && response.isReview) {
      await scheduleRevision(studentId, item.unitId, state.reviewCount ?? 0, 4);
    }

    // 6. Check reopen triggers
    if (state.concluded) {
      if (state.retentionScore < 0.75) {
        await reopenUnit(studentId, item.unitId, 'RETENTION_DECAYED');
      }
    }

    // 7. Advance session index
    const sessionRef = db.collection('students').doc(studentId)
      .collection('sessions').doc(sessionId);
    const sessionSnap = await sessionRef.get();
    const sessionData = sessionSnap.data();
    const nextIndex   = (sessionData.currentIndex ?? 0) + 1;
    const complete    = nextIndex >= sessionData.plan.length;

    await sessionRef.set({ currentIndex: nextIndex, complete }, { merge: true });

    // 8. Get next item
    let nextItem = null;
    if (!complete) {
      const nextUnit = sessionData.plan[nextIndex];
      if (nextUnit) {
        nextItem = await getNextItem(studentId, nextUnit.unitId);
      }
    }

    // 9. Build summary if session complete
    let summary = null;
    if (complete) {
      const units  = sessionData.plan.map(p => p.unitId);
      summary = {
        itemCount:    sessionData.plan.length,
        weakening:    await checkWeakening(studentId, units),
      };
    }

    res.json({ feedback, calibration, nextItem, sessionComplete: complete, summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── Helpers ───────────────────────────────────────────────

async function getNextItem(studentId, unitId) {
  const state      = await getUnitState(studentId, unitId);
  const recentLog  = await getRecentLog(studentId, unitId, 20);
  return generateItem(unitId, state, recentLog);
}

async function getRecentLog(studentId, unitId, limit) {
  const snap = await db
    .collection('students').doc(studentId)
    .collection('units').doc(unitId)
    .collection('evidence')
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map(d => d.data());
}

module.exports = router;
