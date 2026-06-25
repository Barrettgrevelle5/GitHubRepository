#!/usr/bin/env node
// Regression test for the 2026-06-22 rental_worksheet false-POSITIVE fix (Herrera oracle follow-up).
// CONFIRMED LIVE FP, STRONG on Herrera. Investigation on the real case files:
//   - bare 'rental income' STRONG-matched the income-type ENUMERATION on the Certification of
//     Zero Income ("Rental income from real or personal property", Herrera p24). Canizales/Aldridge
//     carried only weak body hits of the same token. None is an actual Rental Payment Worksheet.
// Same root-cause family as the pension_verif / unemployment FPs: a bare income-type token
// matching an enumeration. Fix: drop the bare token; the remaining phrases ('rental payment' /
// 'rent(al) worksheet') specifically title the genuine Rental Payment Worksheet, so no allOf is
// needed (unlike pension, whose title varies). 'rental income affidavit' is retained (multi-word,
// FP-free). No rental household in the set, so genuine detection is proven via a synthetic control
// — same approach as county_appraisal / pension_verif. Driven by the REAL fixtures.
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
const rwDoc = eval('(' + extract(/\{ id: 'rental_worksheet',[\s\S]*?\] \}/, "'rental_worksheet' entry") + ')');

const ocr = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'appanswers', name + '.ocr.json'), 'utf8')).pageTexts;

let passed = 0, failed = 0;
const assert = (cond, msg) => { if (cond) { passed++; console.log('  ✓', msg); } else { failed++; console.log('  ✗', msg); } };

console.log('bare token dropped:');
assert(rwDoc.keywords.indexOf('rental income') === -1,
  "bare 'rental income' is no longer a keyword (matched the Zero Income enumeration)");

console.log('\nrental_worksheet FP cleared on all three approved files (no rental household):');
for (const name of ['CCSR 1302 Herrera FF', 'CCSR 3102 Canizales FF', 'CCSR 3205 Aldridge Move In']) {
  const m = matchDoc(rwDoc, ocr(name));
  assert(m == null, `${name} → no match (was STRONG 'rental income' on the Zero Income Cert) (got ${JSON.stringify(m)})`);
}

console.log('\nroot-cause source must not match (real triggering text):');
const zeroIncomeEnum =
  'BONNER CARRINGTON\nZero Income Certification\nApplicant / Resident: Linda Herrera\n' +
  'I hereby certify that I do not individually receive income from any of the following sources:\n' +
  'Wages from employment; Income from operation of business; Rental income from real or personal ' +
  'property; Interest or dividends from assets.\n' + 'x'.repeat(300);
assert(matchDoc(rwDoc, [zeroIncomeEnum]) == null,
  'Zero Income Cert enumerating "Rental income from real or personal property" → no match');

console.log('\nno over-narrowing — genuine Rental Payment Worksheet still strong-matches (synthetic control):');
const g1 = matchDoc(rwDoc, ['Rental Payment Worksheet\nMonthly rent received: $1,200   Property: 123 Main St\n' + 'x'.repeat(400)]);
assert(g1 && g1.weak === false,
  'a doc titled "Rental Payment Worksheet" → STRONG title match (got ' + JSON.stringify(g1) + ')');
const g2 = matchDoc(rwDoc, ['RENT WORKSHEET\nGross monthly rent collected from tenant: $950\n' + 'x'.repeat(400)]);
assert(g2 && g2.weak === false,
  'a "Rent Worksheet" variant → STRONG title match (got ' + JSON.stringify(g2) + ')');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
