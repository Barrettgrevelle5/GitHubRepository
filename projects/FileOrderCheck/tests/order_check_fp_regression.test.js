#!/usr/bin/env node
// Regression test for the order-check false-positive fix (Herrera FF investigation).
// Three over-broad matchDoc signals produced phantom "found" docs that polluted the
// out-of-order check on an approved file. We extract the REAL matchDoc/isChecklistPage/
// DOCS entries from the HTML and assert the phantoms are gone WITHOUT killing real
// detection. Page text fixtures are verbatim slices of the actual Herrera OCR.
//
//   p44 — "Income and/or Asset Verifications" divider  → false bank_statement match
//   p33 — Child Support / Alimony Certification         → false minor_children ("custody")
// (The former p14 "co-applicant → false multiple_adult" case was dropped 2026-06-18,
//  Bug 5: multiple_adult_cert is no longer a DOCS entry, so it can no longer match.)

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
eval(extract(/function isChecklistPage\([\s\S]*?\n\}/, 'isChecklistPage'));
eval(extract(/const TITLE_ZONE = \d+;/, 'TITLE_ZONE').replace('const TITLE_ZONE', 'globalThis.TITLE_ZONE'));
eval(extract(/function matchDoc\([\s\S]*?\n  return allOfMatch \|\| weakMatch;\n\}/, 'matchDoc'));

const minorDoc = eval('(' + extract(/\{ id: 'minor_children_docs',[\s\S]*?\] \}/, "minor_children_docs entry") + ')');
const bankDoc  = eval('(' + extract(/\{ id: 'bank_statement',[\s\S]*?\] \}/, "bank_statement entry") + ')');

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓ ' + msg); }
  else { failed++; console.log('  ✗ ' + msg); }
}

// ── Verbatim OCR slices of the false-positive pages (Herrera FF) ───────────────
const p33_childSupport =
  'Al BONNER\nSO? CARRINGTON\n\nChild Support / Alimony Certification\n\n' +
  'This form is to be completed by the adult household member having custody of any minor child or when any of the minor’s parents\n' +
  'are not present in the household, or when household is entitled to alimony.';

const p44_assetVerifDivider =
  'BONNER\nCARRINGTON\n\nIncome and/or Asset Verifications\n\n' +
  'Bonner Carrington requires each applicant to provide proof of income and assets, prior to application approval. Acceptable forms\n' +
  'of verification include but are not limited to the last three (3) consecutive pay stubs, social security and pension award letters, most\n' +
  'current bank statement, interest/dividend from all investments.';

// ── Real document pages (positive controls — tightening must NOT gut detection) ─
const realBirthCert     = 'Birth Certificate\nState of Texas\nChild of record: ' + 'x'.repeat(700);
const realCustodyOrder  = 'Custody Order\nIn the matter of the children ' + 'x'.repeat(700);
const realBankStatement = 'Bank Statement\nWells Fargo  Statement Period 03/01-03/31\nAccount ending 1234 ' + 'x'.repeat(700);

console.log('False positives cleared (no match on the wrong page):');
assert(matchDoc(minorDoc, [p33_childSupport]) == null,
  'minor_children_docs does NOT match the Child Support / Alimony Cert page');
assert(matchDoc(bankDoc,  [p44_assetVerifDivider]) == null,
  'bank_statement does NOT match the Income/Asset Verifications divider');

console.log('\nDivider page skipped by isChecklistPage:');
assert(isChecklistPage(p44_assetVerifDivider) === true,
  '"Income and/or Asset Verifications" divider is treated as a skip page');
assert(isChecklistPage(p33_childSupport) === false, 'Child Support Cert page is NOT skipped');

console.log('\nReal detection preserved (positive controls):');
assert(matchDoc(minorDoc, [realBirthCert]) && matchDoc(minorDoc, [realBirthCert]).weak === false,
  'minor_children_docs still strong-matches a real Birth Certificate');
assert(matchDoc(minorDoc, [realCustodyOrder]) && matchDoc(minorDoc, [realCustodyOrder]).weak === false,
  'minor_children_docs still strong-matches a real Custody Order');
assert(matchDoc(bankDoc, [realBankStatement]) && matchDoc(bankDoc, [realBankStatement]).weak === false,
  'bank_statement still strong-matches a real Bank Statement page');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
