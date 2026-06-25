#!/usr/bin/env node
// Regression tests for the 2026-06-18 required-ness fixes, extracted from the
// shipping HTML (no reimplementation):
//   Bug 2 — payment_history is required only for COURT-ORDERED child support
//           (cert Section 2), not for every child-support household.
//   Bug 3 — the checklist's checked 'Certification of Student Eligibility' box
//           requires ONLY student_eligibility; the situational sub-docs
//           (student_verif / student_financial / covered_costs) are decoupled from
//           the coarse 'student' condition and declared by the questionnaire's
//           granular sub-questions instead.
const fs = require('fs');
const path = require('path');
const ROOT = path.dirname(__dirname);
const html = fs.readFileSync(path.join(ROOT, 'File Checklist Validator.html'), 'utf8');
function extract(re, label) { const m = html.match(re); if (!m) throw new Error('extract ' + label); return m[0]; }

const DOCS = eval('(' + extract(/const DOCS = \[[\s\S]*?\n\];/, 'DOCS').replace(/^const DOCS = /, '').replace(/;$/, '') + ')');
globalThis.state = { profile: { program: null, income: new Set(), conditions: new Set() } };
eval(extract(/function isRequiredByConditions\([\s\S]*?\n  return false;\n\}/, 'isRequiredByConditions'));
// Questionnaire block: DOC_BY_ID + BASELINE_DOCS + boolQ + Q_STOP + walkQuestionnaire.
eval(extract(/const DOC_BY_ID = [\s\S]*?return \{ required, uncertain, visited, members, program, pending, complete: pending === null \};\n\}/, 'walkQuestionnaire'));

let passed = 0, failed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log('  ✓', msg); } else { failed++; console.log('  ✗', msg); } };
const prof = (income = [], conditions = [], program = null) =>
  ({ program, income: new Set(income), conditions: new Set(conditions) });

// Auto-drive the questionnaire: answer every prompt with `overrides[key]` if present,
// else the first choice (program) / 'no' (boolean). Robust to the tree's exact shape.
function runQ(overrides) {
  const qa = {};
  for (let i = 0; i < 500; i++) {
    const r = walkQuestionnaire(qa);
    if (r.complete) return r.required;
    const k = r.pending.key;
    if (k in overrides) qa[k] = overrides[k];
    else if (r.pending.type === 'choice') qa[k] = r.pending.options[0].value;
    else qa[k] = 'no';
  }
  throw new Error('questionnaire did not converge');
}

console.log('Bug 2 — payment_history gated on court order (conditions model):');
check(isRequiredByConditions(DOCS.find(d => d.id === 'payment_history'), prof(['child_support'])) === false,
      "child support but NO court order => payment_history NOT required");
check(isRequiredByConditions(DOCS.find(d => d.id === 'payment_history'), prof([], ['new_court_order'])) === true,
      "court order present => payment_history required");
check(isRequiredByConditions(DOCS.find(d => d.id === 'child_support_cert'), prof(['child_support'])) === true,
      "child_support_cert still required by child support (unchanged)");

console.log('\nBug 2 — payment_history gated on court order (questionnaire walk):');
{
  const noCourt = runQ({ q4_1_m0: 'yes', q4_8_m0: 'yes', q4_8a_m0: 'no' });
  const court   = runQ({ q4_1_m0: 'yes', q4_8_m0: 'yes', q4_8a_m0: 'yes' });
  check(noCourt.has('child_support_cert') && !noCourt.has('payment_history'),
        "child support, no court order => cert required, payment_history NOT");
  check(court.has('payment_history') && court.has('court_order'),
        "child support WITH court order => payment_history + court_order required");
}

console.log('\nBug 3 — checklist student box requires only student_eligibility:');
check(isRequiredByConditions(DOCS.find(d => d.id === 'student_eligibility'), prof([], ['student'])) === true,
      "student flag => student_eligibility required");
for (const id of ['student_verif', 'student_financial', 'covered_costs']) {
  check(isRequiredByConditions(DOCS.find(d => d.id === id), prof([], ['student'])) === false,
        `student flag does NOT require ${id} (decoupled from coarse checklist trigger)`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
