#!/usr/bin/env node
// Regression tests for the Feature A <-> Feature B cross-check (Task 3).
// Extracts the REAL crossCheck/isHeadingMatch/HEADING_ZONE/normalize/kwHit out of
// the HTML so the test tracks shipping behavior. Covers BOTH directions plus the
// false-flag guards that keep the un-gated present-scan from flooding advisories.

const fs = require('fs');
const path = require('path');
const ROOT = path.dirname(__dirname);
const html = fs.readFileSync(path.join(ROOT, 'File Checklist Validator.html'), 'utf8');

function extract(re, label) {
  const m = html.match(re);
  if (!m) throw new Error('Could not extract ' + label);
  return m[0];
}
eval(extract(/function normalize\(s\)\s*\{[\s\S]*?\n\}/, 'normalize'));
eval(extract(/function kwHit\([\s\S]*?\n\}/, 'kwHit'));
eval(extract(/const HEADING_ZONE = \d+;/, 'HEADING_ZONE').replace('const HEADING_ZONE', 'globalThis.HEADING_ZONE'));
eval(extract(/function isHeadingMatch\([\s\S]*?\n\}/, 'isHeadingMatch'));
eval(extract(/function crossCheck\(evaluated, pages\)\s*\{[\s\S]*?\n  return \{ direction1, direction2 \};\n\}/, 'crossCheck'));

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓ ' + msg); }
  else { failed++; console.log('  ✗ ' + msg); }
}

// Real page fixtures (verbatim-style slices) keyed by 1-based page in `pages`.
const pSpecialNeeds =     // a genuine Special Needs Cert — title in the heading zone
  'Texas Department of Housing and Community Affairs\nSpecial Needs Certification\n' +
  'Property Name: Cypress Creek Stoney Ridge   TDHCA File#: 21460\nYou have applied for a unit ...';
const pZeroIncome =       // Zero Income Cert: "unemployment"/"pension" appear DEEP, not in heading
  'Bonner Carrington\nZero Income Certification\nApplicant / Resident:\n' +
  'I certify I receive no income from: wages, self-employment, ' +
  'a long preamble of qualifying clauses that pushes the enumerated sources well past the ' +
  'heading band before listing unemployment, pension, rental income, and other sources here.';
const pChildSupportCert = // Child Support Cert present (corroborating sibling for payment_history)
  'Bonner Carrington\nChild Support / Alimony Certification\nPlease check the options that apply ...';

const pages = [pSpecialNeeds, pZeroIncome, pChildSupportCert];

// ── Direction 1: RETIRED (dormant) as of 2026-06-22 ─────────────────────────────
// dir1 (checklist-required, zero file trace) is gated off behind CROSSCHECK_DIR1_ENABLED
// in crossCheck() — redundant with auditChecklistVsQuestionnaire's dirB now the
// questionnaire owns required-ness, and it never fired on real fixtures. These assertions
// lock in the DORMANT state: the scenarios below WOULD have produced a dir1 flag when it
// was live, so asserting they now yield nothing is the canary that catches an accidental
// re-enable. The original live behaviour is preserved in git (commit ce7e1df) for revival.
console.log('Direction 1 (RETIRED — asserting dormant):');
assert(/const CROSSCHECK_DIR1_ENABLED = false;/.test(html),
  'CROSSCHECK_DIR1_ENABLED is present and set to false (dir1 retired dormant)');
{
  // CANARY: this scenario (required, no match, no present sibling) USED to flag dir1.
  // With dir1 dormant it must be empty; a non-empty result means dir1 was re-enabled
  // without updating this suite.
  const evaluated = [
    { id: 'marital_sep', name: 'Marital Sep', required: true, foundPage: null, weakMatch: false,
      conditions: ['marital_separation'], keywords: ['marital sep'] },
  ];
  const { direction1 } = crossCheck(evaluated, pages);
  assert(direction1.length === 0,
    'dormant dir1: required doc with no match + no sibling is NOT flagged (was: flagged live)');
}
{
  // The other historical dir1 scenarios (sibling corroboration; weak-trace suppression)
  // also collapse to empty while dormant — kept so their inputs survive for revival.
  const sibling = [
    { id: 'payment_history', name: 'Payment History', required: true, foundPage: null, weakMatch: false,
      conditions: ['child_support'], keywords: ['payment history'] },
    { id: 'child_support_cert', name: 'Child Support Cert', required: true, foundPage: 3, weakMatch: false,
      conditions: ['child_support'], keywords: ['child support'] },
  ];
  const weakTrace = [
    { id: 'tips', name: 'Tips', required: true, foundPage: 2, weakMatch: true,
      conditions: ['tips'], keywords: ['tips and commission'] },
  ];
  assert(crossCheck(sibling, pages).direction1.length === 0
      && crossCheck(weakTrace, pages).direction1.length === 0,
    'dormant dir1: sibling-corroboration and weak-trace scenarios also produce no flags');
}

// ── Direction 2: strong + heading-zone + not required => flag ───────────────────
console.log('\nDirection 2 (present but not required):');
{
  // special_needs: strong match on its real page (heading), not required (dropped glyph).
  const evaluated = [
    { id: 'special_needs', name: 'Special Needs Certification', required: false, foundPage: 1, weakMatch: false,
      conditions: ['special_needs'], keywords: ['special needs', 'special needs cert', 'tdhca special'] },
  ];
  const { direction2 } = crossCheck(evaluated, pages);
  assert(direction2.length === 1 && direction2[0].id === 'special_needs',
    'strong heading-zone match on a not-required doc is flagged');
}
{
  // HEADING-ZONE GUARD: a non-required doc whose keyword only appears DEEP in the
  // title zone of a different doc (Zero Income Cert lists "unemployment") must NOT flag.
  const evaluated = [
    { id: 'unemployment', name: 'Unemployment Benefits Verification', required: false, foundPage: 2, weakMatch: false,
      conditions: ['unemployment'], keywords: ['unemployment', 'ui benefit'] },
  ];
  const { direction2 } = crossCheck(evaluated, pages);
  assert(direction2.length === 0,
    'over-broad keyword buried past the heading band is NOT flagged (FP guard)');
}
{
  // A non-required doc with only a weak match must NOT flag.
  const evaluated = [
    { id: 'pension_verif', name: 'Pension Verif', required: false, foundPage: 2, weakMatch: true,
      conditions: ['pension'], keywords: ['pension'] },
  ];
  const { direction2 } = crossCheck(evaluated, pages);
  assert(direction2.length === 0, 'weak match on a not-required doc is NOT flagged');
}
{
  // A required doc that is strongly present must NOT raise a Direction-2 flag.
  const evaluated = [
    { id: 'special_needs', name: 'Special Needs Certification', required: true, foundPage: 1, weakMatch: false,
      conditions: ['special_needs'], keywords: ['special needs'] },
  ];
  const { direction2 } = crossCheck(evaluated, pages);
  assert(direction2.length === 0, 'required + present doc raises no Direction-2 flag');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
