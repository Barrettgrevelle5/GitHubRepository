#!/usr/bin/env node
// Regression test for the 2026-06-22 pension_verif false-POSITIVE fix (Herrera oracle follow-up).
// CONFIRMED LIVE FP, STRONG on all three files. Investigation on the real case files:
//   - bare 'pension' STRONG-matched the income-type ENUMERATION on the Certification of Zero
//     Income ("...retirement funds, pensions, or death benefits...", Herrera p24), the TIC's
//     "Soc. Security/Pensions" column header (Canizales p5), and the Income Calculation Summary
//     "(B) Social Security/Pension" (Canizales p18). It also hit the Income/Asset Verifications
//     divider ("social security and pension award letters", Aldridge p33 — already skipped).
//     None is an actual Pension/Retirement Benefit Verification document.
// This is the SAME root-cause family as the unemployment FP: a bare income-type token matching
// an enumeration. Fix mirrors that precedent: drop the bare token, keep the specific multi-word
// phrases, and add an allOf co-occurrence ['pension','award letter'] to re-admit a genuine
// pension/retirement AWARD LETTER whose title varies. 'award letter' only co-occurs with
// 'pension' on the SKIPPED Income/Asset dividers, so the allOf is FP-free on every live page. No
// pension household exists in the set, so genuine detection is proven via synthetic controls —
// same approach as county_appraisal / unemployment. Driven by the REAL fixtures.
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
const penDoc = eval('(' + extract(/\{ id: 'pension_verif',[\s\S]*?allOf: \[[^\]]*\] \}/, "'pension_verif' entry") + ')');

const ocr = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'appanswers', name + '.ocr.json'), 'utf8')).pageTexts;

let passed = 0, failed = 0;
const assert = (cond, msg) => { if (cond) { passed++; console.log('  ✓', msg); } else { failed++; console.log('  ✗', msg); } };

console.log('bare token dropped:');
assert(penDoc.keywords.indexOf('pension') === -1,
  "bare 'pension' is no longer a keyword (matched the Zero Income enumeration + TIC column)");

console.log('\npension_verif FP cleared on all three approved files (no pension household):');
for (const name of ['CCSR 1302 Herrera FF', 'CCSR 3102 Canizales FF', 'CCSR 3205 Aldridge Move In']) {
  const m = matchDoc(penDoc, ocr(name));
  assert(m == null, `${name} → no match (was STRONG 'pension' on Zero Income / TIC / Income-Calc) (got ${JSON.stringify(m)})`);
}

console.log('\nroot-cause sources must not match (real triggering text):');
const zeroIncomeEnum =
  'BONNER CARRINGTON\nZero Income Certification\nApplicant / Resident: Linda Herrera\n' +
  'I hereby certify that I do not individually receive income from any of the following sources:\n' +
  'Social Security payments, annuities, insurance policies, retirement funds, pensions, or death ' +
  'benefits; Unemployment or disability payments; Public assistance payments.\n' + 'x'.repeat(300);
assert(matchDoc(penDoc, [zeroIncomeEnum]) == null,
  'Zero Income Cert enumerating "retirement funds, pensions, or death benefits" → no match');
const ticColumn =
  'INCOME CERTIFICATION\nPART III. GROSS ANNUAL INCOME\n' +
  '(A) Employment/Wages   (B) Soc. Security/Pensions   (C) Public Assistance   (D) Other Income\n' + 'x'.repeat(400);
assert(matchDoc(penDoc, [ticColumn]) == null,
  'TIC "Soc. Security/Pensions" column header → no match');
const incomeCalcSummary =
  'Income Calculation Summary\nINCOME INFORMATION\n(A) Employment or Wages   (B) Social Security/Pension\n' + 'x'.repeat(400);
assert(matchDoc(penDoc, [incomeCalcSummary]) == null,
  'Income Calculation Summary "Social Security/Pension" header → no match');

console.log('\nallOf marker safety — "pension"+"award letter" only co-occur on the SKIPPED divider:');
const divider =
  'BONNER CARRINGTON\nIncome and/or Asset Verifications\nAcceptable forms of verification include the ' +
  'last three (3) consecutive pay stubs, social security and pension award letters, most current bank ' +
  'statement.\n' + 'x'.repeat(300);
assert(matchDoc(penDoc, [divider]) == null,
  'Income/Asset divider ("pension award letters") → no match (page skipped; allOf never fires here)');

console.log('\nno over-narrowing — genuine pension verification still matches (synthetic controls):');
const benefitStmt =
  'Statement of Pension Benefits\nMonthly pension benefit: $1,840   Annual retirement distribution: $22,080\n' + 'x'.repeat(400);
const g1 = matchDoc(penDoc, [benefitStmt]);
assert(g1 && g1.weak === false,
  'a "Statement of Pension Benefits" → STRONG title match (got ' + JSON.stringify(g1) + ')');
// allOf-only path: a bare "Pension Award Letter" whose body carries no specific phrase — the
// co-occurrence of 'pension' + 'award letter' is what admits it.
const awardLetter =
  'STATE TEACHERS RETIREMENT SYSTEM\nThis award letter confirms your pension. ' +
  'Your gross monthly amount is $1,840 effective 01/2026.\n' + 'x'.repeat(400);
const g2 = matchDoc(penDoc, [awardLetter]);
assert(g2 && penDoc.allOf.every(t => g2.keyword.includes(t)),
  'bare "Pension Award Letter" (no specific phrase) → allOf co-occurrence match (got ' + JSON.stringify(g2) + ')');
// Guard: 'pension' alone (no 'award letter', no specific phrase) must NOT match — proves the
// allOf, not a sneaked-back bare token, is what admits it.
assert(matchDoc(penDoc, ['Notice\nThis page mentions a pension once and nothing else relevant.\n' + 'x'.repeat(400)]) == null,
  "'pension' alone (no 'award letter') → no allOf match");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
