#!/usr/bin/env node
// Regression test for the 2026-06-22 profit_loss false-POSITIVE fix (FP pass, item 1/5).
// The crossCheck demo on the real case files exposed profit_loss as falsely "present" on
// approved files with no new_business household. Root cause: the bare single-token
// keywords 'profit' / 'loss' — 'loss' strong-matched LEASE legal boilerplate
// ("...reimburse us for loss, damage, consequential damages...") inside the TITLE_ZONE of
// a lease page (Herrera p52 / Canizales p49). Fix: drop the bare tokens, keep the specific
// title phrases ('profit and loss', 'profit & loss', 'p&l', 'p & l'). The only fixture
// pages carrying "profit and loss" are the SKIPPED Income/Asset Verifications divider, so
// the phrase itself never false-positives. No genuine P&L doc exists in the 3-file set
// (no new_business household), so real-doc detection is proven via a synthetic control —
// same approach as county_appraisal. Driven by the REAL Herrera/Canizales OCR fixtures.
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
const plDoc = eval('(' + extract(/\{ id: 'profit_loss',[\s\S]*?\] \}/, "'profit_loss' DOCS entry") + ')');

const ocr = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'appanswers', name + '.ocr.json'), 'utf8')).pageTexts;

let passed = 0, failed = 0;
const assert = (cond, msg) => { if (cond) { passed++; console.log('  ✓', msg); } else { failed++; console.log('  ✗', msg); } };

console.log('profit_loss FP cleared on all three approved files (no new_business household → no genuine P&L):');
for (const name of ['CCSR 1302 Herrera FF', 'CCSR 3102 Canizales FF', 'CCSR 3205 Aldridge Move In']) {
  const m = matchDoc(plDoc, ocr(name));
  // A residual WEAK body hit would be harmless (non-required + body-only), but the flagged
  // FP was a STRONG (title-zone) lease match — assert no STRONG match anywhere.
  assert(!m || m.weak === true,
    `${name} → no STRONG profit_loss match (was 'loss' on a lease page) (got ${JSON.stringify(m)})`);
}

console.log('\nlease boilerplate alone must not strong-match (root cause):');
const leasePage =
  'RESIDENTIAL LEASE CONTRACT\nSpecial Provisions\n' +
  'You must promptly pay or reimburse us for loss, damage, consequential damages, ' +
  'government fines, or cost of repairs.\n' + 'x'.repeat(600);
assert(matchDoc(plDoc, [leasePage]) == null,
  'lease "reimburse us for loss, damage" boilerplate → no match');

console.log('\nverification-divider phrase stays suppressed (skipped page, not a doc):');
const assetDivider =
  'BONNER\nCARRINGTON\n\nIncome and/or Asset Verifications\n\n' +
  'Acceptable forms of verification include a tax return including schedule c, or a ' +
  'profit and loss statement with anticipated income.\n' + 'x'.repeat(400);
assert(matchDoc(plDoc, [assetDivider]) == null,
  '"profit and loss statement" on the skipped Income/Asset Verifications divider → no match');

console.log('\nno over-narrowing — genuine P&L statement still strong-matches (synthetic controls):');
const pl1 = 'Profit and Loss Statement\nJane Doe Consulting LLC\nJanuary–December 2025\n' +
  'Total Revenue: $84,000  Total Expenses: $31,200  Net Profit: $52,800\n' + 'x'.repeat(500);
const g1 = matchDoc(plDoc, [pl1]);
assert(g1 && g1.weak === false,
  'doc titled "Profit and Loss Statement" → STRONG title match (got ' + JSON.stringify(g1) + ')');
const pl2 = 'Profit & Loss\nAcme LLC  Cash Basis\nFor the year ended Dec 31, 2025\n' + 'x'.repeat(500);
const g2 = matchDoc(plDoc, [pl2]);
assert(g2 && g2.weak === false,
  'doc titled "Profit & Loss" → STRONG title match (got ' + JSON.stringify(g2) + ')');
const pl3 = 'P&L Statement\nSmith Trucking\nYTD 2025\n' + 'x'.repeat(500);
const g3 = matchDoc(plDoc, [pl3]);
assert(g3 && g3.weak === false,
  'doc titled "P&L Statement" → STRONG title match (got ' + JSON.stringify(g3) + ')');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
