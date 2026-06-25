#!/usr/bin/env node
// Regression test for the 2026-06-18 bank_statement false-NEGATIVE fix (Bug 4).
// Herrera's account statement (UFCU, p35) is titled "ACCOUNT STATEMENT" — the literal
// phrase "bank statement" never appears on the doc itself (only on the skipped checklist
// / asset-divider covers). matchDoc therefore missed it. Fix = add the 'account statement'
// keyword variant. This test drives matchDoc with the REAL Herrera OCR page text from the
// stored fixture (no reimplementation) and asserts a STRONG title-zone hit on p35, plus
// guards against title-zone false positives on the other two case files.
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
const bankDoc = eval('(' + extract(/\{ id: 'bank_statement',[\s\S]*?\] \}/, "'bank_statement' DOCS entry") + ')');

const ocr = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'appanswers', name + '.ocr.json'), 'utf8')).pageTexts;

let passed = 0, failed = 0;
const assert = (cond, msg) => { if (cond) { passed++; console.log('  ✓', msg); } else { failed++; console.log('  ✗', msg); } };

console.log('bank_statement (Bug 4 — real Herrera fixture):');
const herrera = ocr('CCSR 1302 Herrera FF');
const h = matchDoc(bankDoc, herrera);
assert(h && h.page === 35 && h.weak === false,
  'Herrera "ACCOUNT STATEMENT" p35 → STRONG title-zone match (got ' + JSON.stringify(h) + ')');

console.log('\nno title-zone false positive on the other two files:');
for (const name of ['CCSR 3102 Canizales FF', 'CCSR 3205 Aldridge Move In']) {
  const m = matchDoc(bankDoc, ocr(name));
  // A weak (body) hit is acceptable (Canizales p36 IS a genuine account statement);
  // a STRONG hit would mean a divider/cover page leaked into the title zone — that is
  // the regression we are guarding against.
  assert(!m || m.weak === true,
    `${name} → no STRONG bank_statement match (got ${JSON.stringify(m)})`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
