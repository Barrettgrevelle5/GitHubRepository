#!/usr/bin/env node
// Regression test for the 2026-06-18 social_security false-POSITIVE fix (FP cluster #1).
// TESTER's full-file Herrera run flagged social_security as falsely "present" on an
// approved file where it is absent. Root cause: the bare keywords 'social security' /
// 'social sec' strong-matched the "Social Security #" FIELD LABEL on the TAA Rental
// Application (Herrera p12 / Canizales p11) — the label sits inside TITLE_ZONE so it read
// as a document title. Fix: drop the bare tokens, key on the agency header
// 'social security administration' (heads every genuine SSA benefit/award/verification
// letter; cannot appear in an SSN field). Driven by the REAL Herrera OCR fixture.
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
const ssDoc = eval('(' + extract(/\{ id: 'social_security',[\s\S]*?\] \}/, "'social_security' DOCS entry") + ')');

const ocr = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'appanswers', name + '.ocr.json'), 'utf8')).pageTexts;

let passed = 0, failed = 0;
const assert = (cond, msg) => { if (cond) { passed++; console.log('  ✓', msg); } else { failed++; console.log('  ✗', msg); } };

console.log('social_security FP cleared (real Herrera fixture):');
const herrera = ocr('CCSR 1302 Herrera FF');
const h = matchDoc(ssDoc, herrera);
// The flagged FP was a STRONG (title-zone) match. A residual WEAK body hit is harmless
// (non-required + body-only). The assertion is: no STRONG match anywhere on Herrera.
assert(!h || h.weak === true,
  'no STRONG social_security match on approved Herrera (got ' + JSON.stringify(h) + ')');
// And specifically not the rental-application SSN-field page (p12).
assert(!h || h.page !== 12,
  'social_security does NOT match the TAA Rental Application SSN-field page (p12)');

console.log('\nfield label alone must not strong-match (root cause):');
const appField =
  'ABOUT YOU\nRental Application for Residents and Occupants\nFull name\n' +
  'Social Security # 123-45-6789\nDriver license #\n' + 'x'.repeat(600);
assert(matchDoc(ssDoc, [appField]) == null,
  '"Social Security #" field label alone → no match');

console.log('\nno over-narrowing — genuine SSA letter still strong-matches (positive control):');
const ssaLetter =
  'Social Security Administration\nImportant Information\n\nBenefit Verification Letter\n' +
  'Date: April 1, 2026\n' + 'x'.repeat(700);
const g = matchDoc(ssDoc, [ssaLetter]);
assert(g && g.weak === false,
  'genuine SSA "Social Security Administration / Benefit Verification" letter → STRONG match (got ' + JSON.stringify(g) + ')');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
