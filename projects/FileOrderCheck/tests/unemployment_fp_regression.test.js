#!/usr/bin/env node
// Regression test for the 2026-06-22 unemployment false-POSITIVE fix (FP pass, item 3/5).
// This was the only CONFIRMED STRONG FP in the pass. Investigation on the real case files:
//   - Bare 'unemployment' STRONG-matched (title zone) the income-source ENUMERATION on a
//     Zero Income Cert / ICW ("...death benefits; unemployment or disability payments...",
//     Herrera p24) and the Non-Employed Cert ("i do not receive unemployment compensation",
//     Herrera p25); it also weak-matched the TDHCA Release & Consent agency list ("state
//     unemployment agencies", Herrera p10 / Canizales p9 / Aldridge p8).
//   - 'unemployment benefit' matched the Application income GRID ("unemployment benefits
//     [yes/no]", Herrera p20 / Canizales p15 / Aldridge p14).
// None is the Unemployment Benefits Verification document. Fix: drop both bare tokens, key on
// the exact title phrase plus an allOf co-occurrence (income type + issuing agency 'texas
// workforce commission') for a genuine TWC statement whose title varies — same approach as
// county_appraisal. 'texas workforce commission' has zero occurrences across all three files,
// so the allOf is FP-free; no unemployment household exists in the set, so genuine detection
// is proven via synthetic controls. Driven by the REAL Herrera/Canizales/Aldridge fixtures.
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
const ueDoc = eval('(' + extract(/\{ id: 'unemployment',[\s\S]*?\] \}/, "'unemployment' DOCS entry") + ')');

const ocr = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'appanswers', name + '.ocr.json'), 'utf8')).pageTexts;

let passed = 0, failed = 0;
const assert = (cond, msg) => { if (cond) { passed++; console.log('  ✓', msg); } else { failed++; console.log('  ✗', msg); } };

console.log('bare collision tokens dropped:');
assert(ueDoc.keywords.indexOf('unemployment') === -1,
  "bare 'unemployment' is no longer a keyword (matched Zero Income / Non-Employed enumeration)");
assert(ueDoc.keywords.indexOf('unemployment benefit') === -1,
  "'unemployment benefit' is no longer a keyword (matched the Application income grid)");

console.log('\nunemployment FP cleared on all three approved files (no unemployment household):');
for (const name of ['CCSR 1302 Herrera FF', 'CCSR 3102 Canizales FF', 'CCSR 3205 Aldridge Move In']) {
  const m = matchDoc(ueDoc, ocr(name));
  // The flagged FP was a STRONG title-zone match (Herrera p24/p25). Assert no STRONG match
  // anywhere; a residual weak body hit would be harmless (non-required + body-only).
  assert(!m || m.weak === true,
    `${name} → no STRONG unemployment match (was 'unemployment' on Zero Income / Non-Employed cert) (got ${JSON.stringify(m)})`);
}

console.log('\nroot-cause sources must not match (real triggering text):');
const zeroIncomeEnum =
  'CERTIFICATION OF ZERO INCOME\nI certify I receive no income from any source, including:\n' +
  'wages, business, interest, retirement funds, pensions, or death benefits; unemployment or ' +
  'disability payments; public assistance.\n' + 'x'.repeat(400);
assert(matchDoc(ueDoc, [zeroIncomeEnum]) == null,
  'Zero Income Cert enumerating "unemployment or disability payments" → no match');
const nonEmployed =
  'NON-EMPLOYED CERTIFICATION\nI am not currently employed. I do not receive unemployment ' +
  'compensation or other benefits at this time.\n' + 'x'.repeat(400);
assert(matchDoc(ueDoc, [nonEmployed]) == null,
  'Non-Employed Cert ("i do not receive unemployment compensation") → no match');
const consentAgencies =
  'TDHCA RELEASE AND CONSENT FORM\nI authorize release from: support and alimony providers, ' +
  'state unemployment agencies, retirement systems, educational institutions.\n' + 'x'.repeat(400);
assert(matchDoc(ueDoc, [consentAgencies]) == null,
  'Release & Consent agency list ("state unemployment agencies") → no match');
const appGrid =
  'RENTAL APPLICATION — Income Sources\nGifts from parents or relatives  Yes  No  $___\n' +
  'Unemployment benefits  Yes  No  $___   Alimony  Yes  No  $___\n' + 'x'.repeat(400);
assert(matchDoc(ueDoc, [appGrid]) == null,
  'Application income grid ("Unemployment benefits  Yes  No") → no match');

console.log('\nno over-narrowing — genuine unemployment verification still matches (synthetic controls):');
const g1 = matchDoc(ueDoc, ['Unemployment Benefits Verification\nTexas Department of Housing\nHousehold: Jane Doe\n' + 'x'.repeat(500)]);
assert(g1 && g1.weak === false,
  'doc titled "Unemployment Benefits Verification" → STRONG title match (got ' + JSON.stringify(g1) + ')');
const g2 = matchDoc(ueDoc, [
  'TEXAS WORKFORCE COMMISSION\nStatement of Benefits Paid\nClaimant: John Roe\n' +
  'Weekly benefit amount for unemployment: $521. Total paid this quarter: $6,773.\n' + 'x'.repeat(400)]);
assert(g2 && g2.keyword.includes('unemployment') && g2.keyword.includes('texas workforce commission'),
  'genuine TWC statement (issuing agency + unemployment) → allOf co-occurrence match (got ' + JSON.stringify(g2) + ')');
// The allOf must NOT fire on "unemployment" alone without the agency (proves it is the
// co-occurrence, not the bare token sneaking back in).
assert(matchDoc(ueDoc, ['Notice\nThis page mentions unemployment once and nothing else relevant.\n' + 'x'.repeat(400)]) == null,
  '"unemployment" alone (no Texas Workforce Commission) → no allOf match');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
