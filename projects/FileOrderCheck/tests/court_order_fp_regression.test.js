#!/usr/bin/env node
// Regression test for the 2026-06-22 court_order false-POSITIVE fix (FP pass, item 4/5).
// CONFIRMED LIVE FP, STRONG on two files. Investigation on the real case files:
//   - "court order(ed)" is standard language on the CHILD SUPPORT / ALIMONY CERTIFICATION
//     ("there is a court ordered support agreement" / "there is no court order requiring
//     support") — STRONG title-zone match on Canizales p25 and Aldridge p26, weak on Herrera
//     p33. It also appears on the Application income grid ("sources of child support: court
//     ordered", Herrera p20 / Canizales p15) and the AG payment registry ("the amount of
//     court ordered dependent", Canizales p26). None is the actual Court Order document.
//   - The 'court ord' stem was strictly broader than 'court order' (matches "court ordered"
//     AND "court ordinance"), firing on the same FP pages with extra collision risk and no
//     benefit — dropped too.
// Fix: drop both bare phrases; key on the operative DECREE language ('it is ordered',
// 'ordered adjudged') plus specific order titles ('order in suit', etc.), plus an allOf
// ['court order','it is ordered'] that re-admits a literally-titled "Court Order" only when
// the decree co-occurs. Every new term has zero occurrences across all three files (the
// decree language never appears on any FP source), so the allOf can't reintroduce the FP. No
// court-order household exists in the set, so genuine detection is proven via synthetic
// controls — same approach as county_appraisal / unemployment. Driven by REAL fixtures.
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
const coDoc = eval('(' + extract(/\{ id: 'court_order',[\s\S]*?\],\n    allOf: \[[^\]]*\] \}/, "'court_order' DOCS entry") + ')');

const ocr = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'appanswers', name + '.ocr.json'), 'utf8')).pageTexts;

let passed = 0, failed = 0;
const assert = (cond, msg) => { if (cond) { passed++; console.log('  ✓', msg); } else { failed++; console.log('  ✗', msg); } };

console.log('bare/stem tokens dropped:');
assert(coDoc.keywords.indexOf('court order') === -1,
  "bare 'court order' is no longer a keyword (matched the Child Support cert prose)");
assert(coDoc.keywords.indexOf('court ord') === -1,
  "'court ord' stem is no longer a keyword (matched 'court ordered' AND 'court ordinance')");

console.log('\ncourt_order FP cleared on all three approved files (no court-order household):');
for (const name of ['CCSR 1302 Herrera FF', 'CCSR 3102 Canizales FF', 'CCSR 3205 Aldridge Move In']) {
  const m = matchDoc(coDoc, ocr(name));
  // The flagged FP was a STRONG title-zone match (Canizales p25 / Aldridge p26). Assert no
  // STRONG match anywhere; a residual weak body hit would be harmless (non-required + body).
  assert(!m || m.weak === true,
    `${name} → no STRONG court_order match (was 'court order' on the Child Support cert) (got ${JSON.stringify(m)})`);
}

console.log('\nroot-cause sources must not match (real triggering text):');
const childSupportCert =
  'CHILD SUPPORT / ALIMONY CERTIFICATION\nCheck one:\n' +
  '2. There is a court ordered support agreement (I have provided a payment history).\n' +
  '3. There is no court order requiring support to be paid.\n' + 'x'.repeat(400);
assert(matchDoc(coDoc, [childSupportCert]) == null,
  'Child Support / Alimony Cert ("there is no court order requiring support") → no match');
const appGrid =
  'RENTAL APPLICATION — Income\nSources of child support: court ordered (regardless if paid)  Yes  No\n' + 'x'.repeat(400);
assert(matchDoc(coDoc, [appGrid]) == null,
  'Application income grid ("court ordered (regardless if paid)") → no match');
const agRegistry =
  'OFFICE OF THE ATTORNEY GENERAL — Payment Registry\nRegistry only case: yes. ' +
  'The amount of court ordered dependent support paid to date.\n' + 'x'.repeat(400);
assert(matchDoc(coDoc, [agRegistry]) == null,
  'AG payment registry ("amount of court ordered dependent") → no match');
// The 'court ord' stem used to also catch this unrelated word — prove it no longer matches.
const ordinance =
  'CITY NOTICE\nThis matter is subject to a municipal court ordinance regarding noise.\n' + 'x'.repeat(400);
assert(matchDoc(coDoc, [ordinance]) == null,
  '"court ordinance" (the dropped-stem over-reach) → no match');

console.log('\nno over-narrowing — genuine court orders still match (synthetic controls):');
const o1 =
  'ORDER IN SUIT AFFECTING THE PARENT-CHILD RELATIONSHIP\nCause No. 2025-FAM-1234\n' +
  'IT IS ORDERED, ADJUDGED AND DECREED that Respondent pay child support of $600/month.\n' + 'x'.repeat(400);
const g1 = matchDoc(coDoc, [o1]);
assert(g1 && g1.weak === false,
  'SAPCR order titled "Order in Suit Affecting the Parent-Child Relationship" → STRONG title match (got ' + JSON.stringify(g1) + ')');
// Titled "Court Order" with the decree in the title zone → detected (strong, via the decree
// keyword landing in the title zone). The genuine doc matches; the mechanism is incidental.
const o2 =
  'COURT ORDER\nIn the matter of support.\nIT IS ORDERED that the obligor remit $450 monthly.\n' + 'x'.repeat(400);
const g2 = matchDoc(coDoc, [o2]);
assert(g2 != null,
  'doc titled "Court Order" with decree language → detected (got ' + JSON.stringify(g2) + ')');
// Exercise the allOf path in isolation: "court order" + "it is ordered" co-occur only in the
// BODY (past the 600-char title zone), so no keyword title-match fires — the allOf is what
// admits the doc, and it carries both required terms in its reported keyword.
const o2b =
  'NOTICE OF FILING\nClerk of the District Court\n' + 'x'.repeat(640) +
  '\nThis court order provides as follows: IT IS ORDERED that the obligor remit $450 monthly.\n' + 'x'.repeat(200);
const g2b = matchDoc(coDoc, [o2b]);
assert(g2b && coDoc.allOf.every(t => g2b.keyword.includes(t)),
  'body-only "court order" + "it is ordered" co-occurrence → allOf match (got ' + JSON.stringify(g2b) + ')');
// Guard: "Court Order" as a title WITHOUT the decree (i.e., the bare phrase) must NOT match —
// proving the allOf, not the dropped bare token, is what admits it.
const o3 = 'COURT ORDER\nThis page references a court order but carries no decree language.\n' + 'x'.repeat(400);
assert(matchDoc(coDoc, [o3]) == null,
  '"court order" title alone (no decree) → no match (bare phrase did not sneak back in)');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
