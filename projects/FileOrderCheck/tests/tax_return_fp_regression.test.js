#!/usr/bin/env node
// Regression test for the 2026-06-22 tax_return false-POSITIVE fix (FP pass, item 5/5).
// Investigation on the real case files found bare 'tax return' weak-matching THREE
// non-document sources on every file:
//   - IRS Form 4506 consent language ("...request a copy of a tax return if a copy of a tax
//     return is needed...", Herrera p10 / Canizales p9 / Aldridge p8);
//   - the Application asset grid ("cash value... tax return in last 12 months?", p20/p15/p14);
//   - the joint-return eligibility question ("entitled to file a joint tax return?", p21/p16/p15).
// None is an actual IRS return. (These are WEAK body hits, and tax_return is not required on
// any of the three files — so no strong live FP — but the over-breadth would strong-mask a
// real gap on a self-employed/gig household, which the fixture set lacks.) The bare schedule
// letters were the short-token risk ('schedule c' matches "schedule cleaning"; '1040' matches
// "$1040"); on the fixtures they only hit SKIPPED divider/checklist pages. Fix: narrow to
// phrases that identify the actual return — 'income tax return' (FP-free on every non-skipped
// page), 'form 1040' (the IRS form number, not "$1040"), and the Schedule-C fingerprint
// ('schedule c (form 1040)' + 'profit or loss from business'). No self-employed/gig household
// in the set, so genuine detection is proven via synthetic controls — same as county_appraisal.
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
const trDoc = eval('(' + extract(/\{ id: 'tax_return',[\s\S]*?\] \}/, "'tax_return' DOCS entry") + ')');

const ocr = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'appanswers', name + '.ocr.json'), 'utf8')).pageTexts;

let passed = 0, failed = 0;
const assert = (cond, msg) => { if (cond) { passed++; console.log('  ✓', msg); } else { failed++; console.log('  ✗', msg); } };

console.log('over-broad terms dropped:');
assert(trDoc.keywords.indexOf('tax return') === -1,
  "bare 'tax return' is no longer a keyword (matched 4506 consent / asset grid / joint-return prose)");
assert(trDoc.keywords.indexOf('schedule c') === -1 && trDoc.keywords.indexOf('1040') === -1,
  "bare 'schedule c' / '1040' are no longer keywords (matched 'schedule cleaning' / '$1040')");

console.log('\ntax_return phantom matches cleared on all three approved files:');
for (const name of ['CCSR 1302 Herrera FF', 'CCSR 3102 Canizales FF', 'CCSR 3205 Aldridge Move In']) {
  const m = matchDoc(trDoc, ocr(name));
  assert(m == null,
    `${name} → no match (was weak 'tax return' on a 4506 / asset-grid / joint-return page) (got ${JSON.stringify(m)})`);
}

console.log('\nroot-cause sources must not match (real triggering text):');
const form4506 =
  'TDHCA RELEASE AND CONSENT\nThis consent may not be used to request a copy of a tax return. ' +
  'If a copy of a tax return is needed, IRS Form 4506 (“Request for Copy of Tax Return”) must be used.\n' + 'x'.repeat(400);
assert(matchDoc(trDoc, [form4506]) == null,
  'IRS 4506 consent ("request a copy of a tax return") → no match');
const assetGrid =
  'RENTAL APPLICATION — Assets\nLife insurance  Yes  No  $___   Cash value tax return in last 12 months?  Yes  No\n' + 'x'.repeat(400);
assert(matchDoc(trDoc, [assetGrid]) == null,
  'Application asset grid ("tax return in last 12 months?") → no match');
const jointReturn =
  'CERTIFICATION OF STUDENT ELIGIBILITY\nIs the household married and entitled to file a joint tax return?  Yes  No\n' + 'x'.repeat(400);
assert(matchDoc(trDoc, [jointReturn]) == null,
  'joint-return eligibility question ("file a joint tax return?") → no match');
const cleaning =
  'WORK ORDER\nUnit turn: complete the schedule cleaning checklist before move-in.\n' + 'x'.repeat(400);
assert(matchDoc(trDoc, [cleaning]) == null,
  '"schedule cleaning" (the dropped bare-letter over-reach) → no match');

console.log('\nverification divider stays suppressed (skipped page lists "income tax return"):');
const divider =
  'BONNER\nCARRINGTON\n\nIncome and/or Asset Verifications\nAcceptable forms of verification include the ' +
  "previous year's income tax return including schedule c, or a profit and loss statement.\n" + 'x'.repeat(300);
assert(matchDoc(trDoc, [divider]) == null,
  '"income tax return ... schedule c" on the SKIPPED Income/Asset Verifications divider → no match');

console.log('\nno over-narrowing — genuine IRS returns still strong-match (synthetic controls):');
const f1040 = 'Form 1040\nU.S. Individual Income Tax Return\nDepartment of the Treasury—Internal Revenue Service  2025\n' + 'x'.repeat(400);
const g1 = matchDoc(trDoc, [f1040]);
assert(g1 && g1.weak === false,
  'Form 1040 ("U.S. Individual Income Tax Return") → STRONG title match (got ' + JSON.stringify(g1) + ')');
const schedC = 'SCHEDULE C (Form 1040)\nProfit or Loss From Business (Sole Proprietorship)\nName of proprietor: Jane Doe\n' + 'x'.repeat(400);
const g2 = matchDoc(trDoc, [schedC]);
assert(g2 && g2.weak === false,
  'Schedule C (Form 1040) "Profit or Loss From Business" → STRONG title match (got ' + JSON.stringify(g2) + ')');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
