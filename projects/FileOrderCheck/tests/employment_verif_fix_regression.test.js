#!/usr/bin/env node
// Regression test for the 2026-06-22 paystub-detection fix on Herrera (FN+FP), with the
// same fix validated across Canizales and Aldridge. Two coupled changes:
//
//  1) NEW DOCS entry `clarification_record` (Clarification / Telephone Verification Record).
//     A FLOATING insert (File Checklist.xlsx row 37: "should go directly behind the
//     information being clarified") — conditions:[] so the questionnaire never declares it,
//     and NO `order` so it is excluded from the order-sequence check. Its keywords took over
//     'phone verif'/'telephone verif' from employment_verif (which were mis-grabbing the TDHCA
//     Telephone Verification/Clarification Record as employment verification — Herrera p31/32),
//     plus the two real-world titles 'telephone verification' / 'clarification record' (the
//     latter is the Bonner Carrington variant — Canizales p23, Aldridge p18).
//
//  2) employment_verif 3-part paystub hybrid. Payroll providers don't self-identify
//     consistently, so no single fingerprint generalizes across the three files:
//       - Aldridge (Tesla "Pay Statement")     → existing 'pay statement' keyword (unchanged).
//       - Canizales ("Payment Statement")       → NEW 'payment statement' keyword. Occurs ONLY
//         on its 4 real paystub pages; substring matching does NOT bridge
//         'pay statement'→'payment statement', which is why it was missed. Its real paystub
//         (p20) now wins ahead of the p23 Clarification Record that 'paystub' used to grab.
//       - Herrera (payroll-table, no self-id)   → NEW allOf ['gross pay','net pay','period end'].
//         The old allOf required 'pay rate' (only Aldridge has it, and Aldridge matches by
//         title anyway), so it never helped. The new fingerprint co-occurs on all 4 Herrera
//         stub pages and on NEITHER Income Calc Worksheet (Herrera p26 has none of the three;
//         Aldridge p19 has gross+period but lacks net pay).
//
//  3) p41/p33 canary: the 'pay stub' the Income/Asset Verifications divider lists in prose
//     (Canizales p41, Aldridge p33, Herrera p44) is benign — isChecklistPage already skips
//     those pages. Asserted dormant so an accidental skip-rule regression is caught.
//
// Tracks SHIPPING behavior: extracts the real normalize/kwHit/isChecklistPage/matchDoc and the
// two real DOCS entries out of the HTML. Driven by the real Herrera/Canizales/Aldridge OCR.
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
const empDoc  = eval('(' + extract(/\{ id: 'employment_verif',[\s\S]*?allOf: \[[^\]]*\] \}/, "'employment_verif' entry") + ')');
const clarDoc = eval('(' + extract(/\{ id: 'clarification_record',[\s\S]*?\] \}/, "'clarification_record' entry") + ')');

const ocr = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'appanswers', name + '.ocr.json'), 'utf8')).pageTexts;
const HERRERA = 'CCSR 1302 Herrera FF', CANIZALES = 'CCSR 3102 Canizales FF', ALDRIDGE = 'CCSR 3205 Aldridge Move In';

let passed = 0, failed = 0;
const assert = (cond, msg) => { if (cond) { passed++; console.log('  ✓', msg); } else { failed++; console.log('  ✗', msg); } };

// ── 1. Keyword / allOf shape ─────────────────────────────────────────────────
console.log('employment_verif keyword + allOf shape:');
assert(empDoc.keywords.includes('pay statement'), "keeps 'pay statement' (Aldridge)");
assert(empDoc.keywords.includes('payment statement'), "adds 'payment statement' (Canizales)");
assert(empDoc.keywords.indexOf('phone verif') === -1 && empDoc.keywords.indexOf('telephone verif') === -1,
  "'phone verif' / 'telephone verif' removed (moved to clarification_record)");
assert(JSON.stringify(empDoc.allOf) === JSON.stringify(['gross pay', 'net pay', 'period end']),
  "allOf is ['gross pay','net pay','period end'] (was ['employee','pay rate','period end'])");
assert(empDoc.allOf.indexOf('pay rate') === -1, "old 'pay rate' allOf term dropped");

console.log('\nclarification_record entry shape:');
assert(clarDoc.id === 'clarification_record' && Array.isArray(clarDoc.conditions) && clarDoc.conditions.length === 0,
  'new entry exists with conditions:[] (never auto-required — questionnaire never declares it)');
assert(!('order' in clarDoc),
  'carries NO `order` (floating insert — excluded from the order-sequence check)');
assert(['telephone verification', 'clarification record', 'phone verif', 'telephone verif']
       .every(k => clarDoc.keywords.includes(k)),
  'keywords cover both titles + the two moved phone-verif tokens');

// ── 2. Paystub detection on all three real files ─────────────────────────────
console.log('\nemployment_verif → the REAL paystub on each file (fresh matchDoc):');
{
  const m = matchDoc(empDoc, ocr(HERRERA));
  assert(m && m.page === 27, `Herrera → p27 real payroll-table paystub via allOf (was p31 clarification FP) (got ${JSON.stringify(m)})`);
  assert(m && m.keyword === 'gross pay + net pay + period end', 'Herrera match is the structural allOf fingerprint');
}
{
  const m = matchDoc(empDoc, ocr(CANIZALES));
  assert(m && m.page === 20 && m.weak === false && m.keyword === 'payment statement',
    `Canizales → p20 real "Payment Statement" STRONG, ahead of p23 (was p23 clarification FP) (got ${JSON.stringify(m)})`);
}
{
  const m = matchDoc(empDoc, ocr(ALDRIDGE));
  assert(m && m.page === 20 && m.weak === false && m.keyword === 'pay statement',
    `Aldridge → p20 Tesla "Pay Statement" STRONG (unchanged-correct) (got ${JSON.stringify(m)})`);
}

// ── 3. Clarification split: the FP pages now match the NEW entry, not employment_verif ──
console.log('\nclarification_record → the Telephone/Clarification pages (not employment_verif):');
{
  const m = matchDoc(clarDoc, ocr(HERRERA));
  assert(m && m.page === 31 && m.weak === false,
    `Herrera → p31 Telephone Verification/Clarification Record (got ${JSON.stringify(m)})`);
}
{
  const m = matchDoc(clarDoc, ocr(CANIZALES));
  assert(m && m.page === 23 && m.weak === false && m.keyword === 'clarification record',
    `Canizales → p23 Bonner Carrington Clarification Record (got ${JSON.stringify(m)})`);
}
{
  const m = matchDoc(clarDoc, ocr(ALDRIDGE));
  assert(m && m.page === 18 && m.weak === false && m.keyword === 'clarification record',
    `Aldridge → p18 Clarification Record (got ${JSON.stringify(m)})`);
}

// ── 4. allOf fingerprint negative controls — the adjacent Income Calc Worksheets ──
// The ICWs sit one page before the paystubs and carry overlapping income vocabulary
// (Aldridge p19 even has 'gross pay' AND 'period end'). The fingerprint must NOT fire on
// them. Tested at the allOf level: a single 'paystub' keyword may still weak-body-hit an ICW
// (pre-existing, harmless — the real paystub's allOf match is preferred), but the structural
// allOf itself must require all three terms and find them on neither ICW.
console.log('\nallOf structural fingerprint is clean against both ICW worksheets:');
const hasAll = (terms, text) => terms.every(t => normalize(text).includes(normalize(t)));
assert(hasAll(empDoc.allOf, ocr(HERRERA)[26]),  'Herrera p27 (real paystub) satisfies allOf (positive control)');
assert(!hasAll(empDoc.allOf, ocr(HERRERA)[25]), 'Herrera p26 (ICW worksheet) does NOT satisfy allOf');
assert(!hasAll(empDoc.allOf, ocr(ALDRIDGE)[18]),'Aldridge p19 (ICW worksheet, has gross+period but no net pay) does NOT satisfy allOf');
// And on the isolated ICW page, matchDoc must not report a STRONG paystub nor the allOf join.
{
  const m = matchDoc(empDoc, [ocr(HERRERA)[25]]);
  assert(!m || (m.weak === true && m.keyword !== empDoc.allOf.join(' + ')),
    `Herrera p26 ICW alone → no STRONG and no allOf match (got ${JSON.stringify(m)})`);
}

// ── 5. p41/p33 'pay stub' divider canary — benign, already skipped ───────────
console.log('\nIncome/Asset Verifications divider "pay stub" stays dormant (isChecklistPage skips it):');
assert(isChecklistPage(ocr(CANIZALES)[40]), 'Canizales p41 divider is skipped (its "pay stub" prose never matches)');
assert(isChecklistPage(ocr(ALDRIDGE)[32]),  'Aldridge p33 divider is skipped');
assert(isChecklistPage(ocr(HERRERA)[43]),   'Herrera p44 divider is skipped');

// ── 6. Order-sequence exclusion for the no-`order` floating doc ───────────────
// Mirrors the live order check (File Checklist Validator.html ~L1668-1685): it filters on
// `d.required && d.foundPage !== null` then sorts by `.order`. A never-required doc with no
// `order` must (a) be excluded, (b) never poison the numeric sort with NaN, (c) never be
// flagged out-of-order. clarification_record is never in state.required (questionnaire never
// emits it), so required:false here reproduces the live path.
console.log('\nno-`order` floating doc is excluded from the order-sequence check:');
{
  const evaluated = [
    { id: 'employment_verif', order: 22, required: true,  foundPage: 20 },
    { id: 'clarification_record', /* no order */ required: false, foundPage: 23 },
    { id: 'tic', order: 2, required: true, foundPage: 5 },
  ];
  const requiredFound = evaluated
    .filter(d => d.required && d.foundPage !== null)
    .sort((a, b) => a.order - b.order);
  for (let i = 0; i < requiredFound.length; i++) {
    const doc = requiredFound[i];
    doc.outOfOrder = i > 0 && doc.foundPage < requiredFound[i - 1].foundPage;
  }
  assert(!requiredFound.some(d => d.id === 'clarification_record'),
    'clarification_record is excluded from requiredFound (required:false)');
  assert(requiredFound.every(d => Number.isFinite(d.order)),
    'sort operates only on numeric orders — no NaN poisoning from the no-order doc');
  assert(JSON.stringify(requiredFound.map(d => d.id)) === JSON.stringify(['tic', 'employment_verif']),
    'remaining required docs sort cleanly by order');
  const clar = evaluated.find(d => d.id === 'clarification_record');
  assert(clar.outOfOrder === undefined,
    'clarification_record never receives an out-of-order flag');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
