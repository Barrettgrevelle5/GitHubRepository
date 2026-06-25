#!/usr/bin/env node
// Regression test for the 2026-06-18 county_appraisal (DOCS id 'appraisal') false-POSITIVE
// fix (FP cluster #2). TESTER's full-file Herrera run flagged it as falsely "present" on an
// approved file where it is absent. Root cause: the keyword 'appraisal district' body-matched
// the institution list on the TDHCA RELEASE AND CONSENT FORM ("...Public Housing Agencies —
// Appraisal Districts — Insurance Carrier...") — present identically on Herrera p10 /
// Canizales p9 / Aldridge p8. ('cad', a collision-prone short token, was also removed.)
// Fix: drop the colliding standalone phrase, fingerprint a genuine County Appraisal District
// print-out via allOf co-occurrence (district name + valuation line), keep specific title
// phrases. Driven by the REAL Herrera OCR fixture.
const fs = require('fs');
const path = require('path');
const ROOT = path.dirname(__dirname);
const html = fs.readFileSync(path.join(ROOT, 'File Checklist Validator.html'), 'utf8');
function extract(re, label) { const m = html.match(re); if (!m) throw new Error('extract ' + label); return m[0]; }

eval(extract(/function normalize\(s\)\s*\{[\s\S]*?\n\}/, 'normalize'));
eval(extract(/function kwHit\([\s\S]*?\n\}/, 'kwHit'));
eval(extract(/function isChecklistPage\([\s\S]*?\n\}/, 'isChecklistPage'));
eval(extract(/const TITLE_ZONE = \d+;/, 'TITLE_ZONE').replace('const TITLE_ZONE', 'globalThis.TITLE_ZONE'));
eval(extract(/function matchDoc\([\s\S]*?\n  return allOfMatch \|\| weakMatch;\n\}/, 'matchDoc'));
const caDoc = eval('(' + extract(/\{ id: 'appraisal',[\s\S]*?\] \}/, "'appraisal' DOCS entry") + ')');

const ocr = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'appanswers', name + '.ocr.json'), 'utf8')).pageTexts;

let passed = 0, failed = 0;
const assert = (cond, msg) => { if (cond) { passed++; console.log('  ✓', msg); } else { failed++; console.log('  ✗', msg); } };

console.log('county_appraisal FP cleared on all three approved files (no genuine CAD doc present):');
for (const name of ['CCSR 1302 Herrera FF', 'CCSR 3102 Canizales FF', 'CCSR 3205 Aldridge Move In']) {
  const m = matchDoc(caDoc, ocr(name));
  assert(m == null, `${name} → no match (was weak 'appraisal district' on the consent form) (got ${JSON.stringify(m)})`);
}

console.log('\nconsent-form institution list alone must not match (root cause):');
const consentList =
  'TEXAS DEPARTMENT OF HOUSING AND COMMUNITY AFFAIRS\nRELEASE AND CONSENT FORM\n' +
  'Bank and other Financial Institutions  Utility Providers  Previous Landlords\n' +
  'Public Housing Agencies — Appraisal Districts  Insurance Carrier\n' + 'x'.repeat(500);
assert(matchDoc(caDoc, [consentList]) == null,
  '"Appraisal Districts" in a consent-form institution list → no match (no co-occurring valuation)');

console.log('\nno over-narrowing — genuine CAD print-out still matches (positive controls):');
const cadPrintout =
  'TRAVIS CENTRAL APPRAISAL DISTRICT\nProperty Tax Record 2026\nOwner Name: Jane Doe\n' +
  'Property ID: R12345  Legal Description: LOT 4 BLK A\nMarket Value: $312,000  Appraised Value: $298,000\n' + 'x'.repeat(400);
const c = matchDoc(caDoc, [cadPrintout]);
assert(c && c.keyword.includes('appraisal district') && c.keyword.includes('market value'),
  'real CAD print-out (district name + Market Value) → allOf co-occurrence match (got ' + JSON.stringify(c) + ')');
const titled = 'County Appraisal Print Out\nTravis County\n' + 'x'.repeat(700);
const t = matchDoc(caDoc, [titled]);
assert(t && t.weak === false,
  'doc titled "County Appraisal Print Out" → STRONG title match (got ' + JSON.stringify(t) + ')');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
