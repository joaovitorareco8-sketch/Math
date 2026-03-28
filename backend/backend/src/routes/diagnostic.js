const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db }  = require('../db/firestore');
const { generateItem, TEMPLATES } = require('../p2_assessment/itemGeneration');
const { recordEvidence } = require('../p2_assessment/evidenceAndDiagnosis');
const { getUnitState }   = require('../p1_state/studentState');
const curriculum = require('../db/curriculum');

// Sample 1 item per block for diagnostic
const DIAGNOSTIC_UNITS = [
  'KA.1','KB.1','KC.8','KD.2','KE.4','KF.2','KG.1','KH.1',
];

// POST /diagnostic/start
// Body: { studentId }
// Returns: { diagnosticId, firstItem }
router.post('/start', async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId) return res.status(400).json({ error: 'studentId required' });

    const diagnosticId = uuidv4();
    await db.collection('students').doc(studentId)
      .collection('diagnostics').doc(diagnosticId)
      .set({
        units:        DIAGNOSTIC_UNITS,
        currentIndex: 0,
        complete:     false,
        createdAt:    Date.now(),
      });

    // Mark student as in diagnostic
    await db.collection('students').doc(studentId)
      .set({ inDiagnostic: true, streak: 0 }, { merge: true });

    const firstItem = await getDiagnosticItem(studentId, DIAGNOSTIC_UNITS[0]);
    res.json({ diagnosticId, firstItem });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /diagnostic/answer
// Body: { studentId, diagnosticId, item, response }
// Returns: { nextItem, diagnosticComplete, initialPlan }
router.post('/answer', async (req, res) => {
  try {
    const { studentId, diagnosticId, item, response } = req.body;
    if (!studentId || !diagnosticId || !item || !response) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Record evidence — marks as diagnostic type for recovery/learning distinction
    const evidence = await recordEvidence(studentId, item.unitId, item, {
      ...response,
      isDiagnostic: true,
    });

    // Advance index
    const diagRef = db.collection('students').doc(studentId)
      .collection('diagnostics').doc(diagnosticId);
    const diagSnap = await diagRef.get();
    const diagData = diagSnap.data();
    const nextIndex = (diagData.currentIndex ?? 0) + 1;
    const complete  = nextIndex >= diagData.units.length;

    await diagRef.set({ currentIndex: nextIndex, complete }, { merge: true });

    if (!complete) {
      const nextUnitId = diagData.units[nextIndex];
      const nextItem   = await getDiagnosticItem(studentId, nextUnitId);
      return res.json({ nextItem, diagnosticComplete: false });
    }

    // Diagnostic complete — bootstrap state and generate initial plan
    await db.collection('students').doc(studentId)
      .set({ inDiagnostic: false, diagnosticComplete: true }, { merge: true });

    const { buildSessionPlan } = require('../p3_navigation/navigation');
    const initialPlan = await buildSessionPlan(studentId);

    res.json({ diagnosticComplete: true, initialPlan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

async function getDiagnosticItem(studentId, unitId) {
  const state = await getUnitState(studentId, unitId);
  return generateItem(unitId, state, []);
}

module.exports = router;
