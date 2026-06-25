#!/usr/bin/env node
// Regression test for the 2026-06-22 section8_verif false-POSITIVE fix (FP pass, item 2/5).
// section8_verif was on CLAUDE.md's deferred-FP list for the short-token 'hap' collision.
// Investigation on the real case files found TWO things:
//   1. 'hap' is NOT the live collision — kwHit's \bhap\b word boundary already prevents
//      'hap' from matching inside "perhaps" (asserted below). The CLAUDE.md warning predates
//      that word-boundary fix. 'hap' is dropped anyway (collision-prone short token that adds
//      nothing to this doc's title detection — same rule as dropping 'cad').
//   2. The real over-broad keyword was bare 'section 8', which body-matched UTILITY ALLOWANCE
//      schedules ("...utility allowances section 8 voucher holders...") and HUD program refs
//      ("...hud section 8 moderate rehabilitation...") on all three approved files — neither
//      is the Income Verification for Households with Section 8 document.
// Fix: drop bare 'section 8'/'section8' + 'hap', keep the specific verif phrases, add the
// distinctive title phrase 'households with section 8'. No section 8 household exists in the
// 3-file set, so genuine detection is proven via synthetic controls — same approach as
// county_appraisal / profit_loss. Driven by the REAL Herrera/Canizales/Aldridge OCR fixtures.
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
const s8Doc = eval('(' + extract(/\{ id: 'section8_verif',[\s\S]*?\] \}/, "'section8_verif' DOCS entry") + ')');

const ocr = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'appanswers', name + '.ocr.json'), 'utf8')).pageTexts;

let passed = 0, failed = 0;
const assert = (cond, msg) => { if (cond) { passed++; console.log('  ✓', msg); } else { failed++; console.log('  ✗', msg); } };

console.log("'hap' short-token collision is already neutralized by kwHit word boundary:");
assert(kwHit('perhaps maybe later', 'hap') === false,
  "'hap' does NOT match inside 'perhaps' (\\bhap\\b word boundary)");
assert(s8Doc.keywords.indexOf('hap') === -1,
  "'hap' is no longer a section8_verif keyword (dropped)");
assert(s8Doc.keywords.indexOf('section 8') === -1 && s8Doc.keywords.indexOf('section8') === -1,
  "bare 'section 8'/'section8' are no longer section8_verif keywords (dropped)");

console.log('\nsection8_verif FP cleared on all three approved files (no section 8 household):');
for (const name of ['CCSR 1302 Herrera FF', 'CCSR 3102 Canizales FF', 'CCSR 3205 Aldridge Move In']) {
  const m = matchDoc(s8Doc, ocr(name));
  assert(m == null,
    `${name} → no match (was weak 'section 8' on a Utility Allowance / HUD page) (got ${JSON.stringify(m)})`);
}

console.log('\nover-broad sources must not match (root causes):');
const uaSchedule =
  'HOUSING AUTHORITY UTILITY ALLOWANCES\nEffective 01/01/2026\n' +
  'Section 8 voucher holders: see schedule below for tenant-paid utility deductions.\n' + 'x'.repeat(500);
assert(matchDoc(s8Doc, [uaSchedule]) == null,
  'Utility Allowance schedule mentioning "section 8 voucher holders" → no match');
const hudRef =
  'NOTICE OF RENTAL ASSISTANCE\nFederal HUD Section 8 Moderate Rehabilitation Program\n' +
  'This unit participates in the program referenced above.\n' + 'x'.repeat(500);
assert(matchDoc(s8Doc, [hudRef]) == null,
  'HUD "Section 8 Moderate Rehabilitation" program reference → no match');

console.log('\nverification-divider / checklist listing stays suppressed (skipped page):');
const checklistCover =
  'FILE APPROVAL CHECKLIST\n' +
  'Income Verification for Households with Section 8 under $50,000 Asset Certification\n' + 'x'.repeat(400);
assert(matchDoc(s8Doc, [checklistCover]) == null,
  '"...Households with Section 8" listed on the skipped FILE APPROVAL CHECKLIST cover → no match');

console.log('\nno over-narrowing — genuine Section 8 verification still strong-matches (synthetic controls):');
const g1 = matchDoc(s8Doc, ['Income Verification for Households with Section 8\nTexas Department of Housing\n' + 'x'.repeat(500)]);
assert(g1 && g1.weak === false,
  'doc titled "Income Verification for Households with Section 8" → STRONG title match (got ' + JSON.stringify(g1) + ')');
const g2 = matchDoc(s8Doc, ['TDHCA Section 8 Verification\nForm Rev. 1.24.22\nHousehold: Jane Doe\n' + 'x'.repeat(500)]);
assert(g2 && g2.weak === false,
  'doc titled "TDHCA Section 8 Verification" → STRONG title match (got ' + JSON.stringify(g2) + ')');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
