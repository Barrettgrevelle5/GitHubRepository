#!/usr/bin/env node
// Regression tests for the Part-3 Feature-A role-flip:
//   (1) isRequired() reads the QUESTIONNAIRE's declared set (state.required), not
//       doc.conditions / the checklist — with a fallback only when no questionnaire ran.
//   (2) auditChecklistVsQuestionnaire() flags checklist↔questionnaire disagreement in
//       two directions, skips docs the checklist has no checkbox for, and reports
//       "not located" (null) when no checklist page was found.
// Extracts the REAL functions out of the HTML so the test tracks shipping behavior.

const fs = require('fs');
const path = require('path');
const ROOT = path.dirname(__dirname);
const html = fs.readFileSync(path.join(ROOT, 'File Checklist Validator.html'), 'utf8');

function extract(re, label) {
  const m = html.match(re);
  if (!m) throw new Error('Could not extract ' + label);
  return m[0];
}
// Hoist to global so the eval'd functions can see each other and `state`/`DOCS`.
eval(extract(/const DOCS = \[[\s\S]*?\n\];/, 'DOCS').replace('const DOCS', 'globalThis.DOCS'));
eval(extract(/function isRequiredByConditions\([\s\S]*?\n\}/, 'isRequiredByConditions')
      .replace('function isRequiredByConditions', 'globalThis.isRequiredByConditions = function'));
eval(extract(/function isRequired\(doc[\s\S]*?\n\}/, 'isRequired')
      .replace('function isRequired', 'globalThis.isRequired = function'));
eval(extract(/const CHECKLIST_FLAGS = new Set\(\[[\s\S]*?\]\);/, 'CHECKLIST_FLAGS')
      .replace('const CHECKLIST_FLAGS', 'globalThis.CHECKLIST_FLAGS'));
eval(extract(/function docsImpliedByChecklist\([\s\S]*?\n\}/, 'docsImpliedByChecklist')
      .replace('function docsImpliedByChecklist', 'globalThis.docsImpliedByChecklist = function'));
eval(extract(/function auditChecklistVsQuestionnaire\([\s\S]*?\n\}/, 'auditChecklistVsQuestionnaire')
      .replace('function auditChecklistVsQuestionnaire', 'globalThis.auditChecklistVsQuestionnaire = function'));

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓ ' + msg); }
  else { failed++; console.log('  ✗ ' + msg); }
}
const doc = id => DOCS.find(d => d.id === id);

// ── isRequired reads the questionnaire's declared set ──────────────────────────
console.log('isRequired() ← questionnaire (state.required):');
{
  globalThis.state = {
    profile: { program: null, income: new Set(), conditions: new Set() },
    required: new Set(['household_cert', 'special_needs']),
  };
  assert(isRequired(doc('special_needs')) === true,  'doc in state.required is required');
  assert(isRequired(doc('employment_verif')) === false, 'doc NOT in state.required is not required');
  // Baseline doc (conditions: []) is required ONLY because the questionnaire added it,
  // NOT because conditions are empty — prove the conditions path is no longer consulted.
  assert(isRequired(doc('tic')) === false, 'baseline doc absent from state.required is not auto-required');
}

// ── Empty state.required is a HARD FAIL (not a silent fallback) ────────────────
console.log('\nEmpty state.required hard-fails unless fallback is opted into:');
{
  globalThis.state = {
    profile: { program: 'HTC', income: new Set(['employed']), conditions: new Set() },
    required: new Set(),   // questionnaire bypassed → bug in production
  };
  let threw = false;
  try { isRequired(doc('tic')); } catch (e) { threw = true; }
  assert(threw, 'empty state.required without fallback flag → isRequired throws (loud, not silent)');

  // Tests opt into legacy condition-based behavior explicitly.
  assert(isRequired(doc('tic'), { useConditionsFallback: true }) === true,
    'fallback flag → baseline doc required via conditions');
  assert(isRequired(doc('employment_verif'), { useConditionsFallback: true }) === true,
    'fallback flag → conditions/pills drive required-ness');
  assert(isRequired(doc('special_needs'), { useConditionsFallback: true }) === false,
    'fallback flag → unset condition not required');
}

// ── Audit: two-direction disagreement ─────────────────────────────────────────
console.log('\nauditChecklistVsQuestionnaire() directions:');
{
  globalThis.state = {
    profile: { program: null, income: new Set(), conditions: new Set() },
    required: new Set(['application','supp_app','household_cert','tic','release_consent',
                       'rights','income_calc','tenant_selection_plan','employment_verif','asset_cert']),
    checklistProfile: { program: 'HTC', income: ['social_security'], conditions: ['special_needs'] },
  };
  const a = auditChecklistVsQuestionnaire();
  const idsA = a.dirA.map(d => d.id).sort();
  const idsB = a.dirB.map(d => d.id).sort();
  assert(JSON.stringify(idsA) === JSON.stringify(['asset_cert','employment_verif']),
    'dirA = required by questionnaire but checklist box unchecked');
  assert(JSON.stringify(idsB) === JSON.stringify(['social_security','special_needs']),
    'dirB = checked on checklist but questionnaire says not required');
}

// ── Audit: agreement → no flags; baseline & non-auditable docs never flag ──────
console.log('\nAudit suppression (agreement / non-auditable docs):');
{
  globalThis.state.checklistProfile = { program: 'HTC', income: ['employed'], conditions: ['assets_under_50k'] };
  const a = auditChecklistVsQuestionnaire();
  assert(a.dirA.length === 0 && a.dirB.length === 0, 'matching checklist raises no flags');

  // immigration_docs (conditions ['non_citizen']) has NO checklist checkbox: even when
  // required by the questionnaire and absent from the checklist, it must NOT flag dirA.
  globalThis.state.required = new Set(['immigration_docs']);
  globalThis.state.checklistProfile = { program: 'HTC', income: [], conditions: [] };
  const b = auditChecklistVsQuestionnaire();
  assert(!b.dirA.some(d => d.id === 'immigration_docs'),
    'doc with no checklist checkbox (immigration) is not flagged as "checklist unchecked"');
  assert(!b.dirA.some(d => d.id === 'tic') && !b.dirB.some(d => d.id === 'tic'),
    'baseline doc (no conditions) never appears in the audit');
}

// ── Audit: no checklist located → null (UI shows "not located") ───────────────
console.log('\nNo checklist located:');
{
  globalThis.state.checklistProfile = null;
  assert(auditChecklistVsQuestionnaire() === null, 'null checklistProfile → audit returns null');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
