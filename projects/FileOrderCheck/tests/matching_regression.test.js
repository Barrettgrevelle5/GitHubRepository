#!/usr/bin/env node
// Regression tests for the cross-reference false-positives found by the TESTER.md
// oracle on the real case files (Herrera/Canizales/Aldridge). Fixtures are the actual
// OCR text from those pages. Extracts the REAL detection code out of the HTML so the
// test tracks shipping behavior, not a copy.

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const html = fs.readFileSync(path.join(ROOT, 'File Checklist Validator.html'), 'utf8');

function extract(re, label) {
  const m = html.match(re);
  if (!m) throw new Error('Could not extract ' + label);
  return m[0];
}

const DOCS = eval('(' + extract(/const DOCS = \[[\s\S]*?\n\];/, 'DOCS').replace(/^const DOCS = /, '').replace(/;$/, '') + ')');
eval(extract(/function normalize\(s\)\s*\{[\s\S]*?\n\}/, 'normalize'));
eval(extract(/function kwHit\([\s\S]*?\n\}/, 'kwHit'));
eval(extract(/function isChecklistPage\([\s\S]*?\n\}/, 'isChecklistPage'));
eval(extract(/const TITLE_ZONE = \d+;/, 'TITLE_ZONE').replace('const TITLE_ZONE', 'globalThis.TITLE_ZONE'));
eval(extract(/function matchDoc\([\s\S]*?\n  return allOfMatch \|\| weakMatch;\n\}/, 'matchDoc'));

const doc = id => DOCS.find(d => d.id === id);

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓ ' + msg); }
  else { failed++; console.log('  ✗ ' + msg); }
}

// ── Real OCR fixtures (verbatim slices from the captured page OCR) ──────────────
const zeroIncomeCert =        // Herrera p24 — lists "commissions, tips, bonuses" in prose
  'BONNER CARRINGTON\nZero Income Certification\nApplicant / Resident:\n' +
  '1. I hereby certify that I do not individually receive income from any of the following sources:\n' +
  'Wages from employment (including commissions, tips, bonuses, fees, etc.);\n' +
  'Income from operation of business;\n';

const tipsAffidavit =         // a real Tips and Commissions Affidavit title page
  'BONNER CARRINGTON\nTips and Commissions Affidavit\n' +
  'I hereby certify that I receive tips and/or commissions as part of my employment ...';

const application =           // Herrera p12 — TAA Rental Application ("marital status")
  'TEXAS APARTMENT ASSOCIATION\nRental Application for Residents and Occupants\n' +
  'Each co-resident and each occupant over 18 must submit a separate Application.\n' +
  'Full name  Former name  Gender  Birthdate  Marital status: separated\n';

const maritalSepCert =        // a real Marital Separation Certification (OCR spells "Maritial")
  'BONNER CARRINGTON\nMaritial Separation Certification\n' +
  'I certify that I am married but living separately from my spouse ...';

const childSupportCert =      // Canizales p25 / Aldridge p26 — cross-references "payment history"
  'BONNER CARRINGTON\nChild Support / Alimony Certification\n' +
  'Please check only the options below that apply to you.\n' +
  '2. There IS a court-ordered support agreement. (I have provided a payment history to this property).';

const agForm =                // Canizales p26 / Aldridge p27 — the real AG 9L001 report
  'MC: NM 0040S\nCentral File Maintenance\nP.O. BOX 12048\nAUSTIN, TX 78711-2048\n' +
  'KEN PAXTON\nATTORNEY GENERAL of TEXAS\nCHILD SUPPORT DIVISION\n' +
  'Recipient Name: CANIZALES\nCHILD SUPPORT INCOME VERIFICATION REPORT\n';

console.log('tips (was strong FP on Zero Income Cert):');
assert(matchDoc(doc('tips'), [zeroIncomeCert]) == null, 'no match on Zero Income Cert prose ("commissions, tips, bonuses")');
{ const m = matchDoc(doc('tips'), [tipsAffidavit]);
  assert(m && m.weak === false && m.page === 1, 'real Tips & Commissions Affidavit still detected (strong)'); }

console.log('\nmarital_sep (was weak FP on Application):');
assert(matchDoc(doc('marital_sep'), [application]) == null, 'no match on Application "marital status"');
{ const m = matchDoc(doc('marital_sep'), [maritalSepCert]);
  assert(m && m.weak === false && m.page === 1, 'real Marital Separation Cert still detected (OCR "Maritial")'); }

console.log('\npayment_history (was FP/off-by-one on Child Support Cert):');
assert(matchDoc(doc('payment_history'), [childSupportCert]) == null, 'no match on Child Support Cert cross-reference');
{ const m = matchDoc(doc('payment_history'), [childSupportCert, agForm]);
  assert(m && m.weak === false && m.page === 2, 'real AG 9L001 report detected on its own page (strong), not the cert page'); }

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
