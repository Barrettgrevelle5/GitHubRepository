#!/usr/bin/env node
// Regression test for the TIC false-positive fix in "File Checklist Validator.html".
// The matching helpers live inside an inline <script> in the HTML, so we extract the
// exact source of normalize/kwHit/isChecklistPage/matchDoc and the 'tic' DOCS entry
// from the file and eval them here — keeps the test honest against the real code.

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'File Checklist Validator.html'), 'utf8');

function extract(re, label) {
  const m = html.match(re);
  if (!m) throw new Error(`Could not extract ${label} from HTML`);
  return m[0];
}

const normalizeSrc       = extract(/function normalize\(s\)\s*\{[\s\S]*?\n\}/, 'normalize');
const kwHitSrc           = extract(/function kwHit\([\s\S]*?\n\}/, 'kwHit');
const isChecklistPageSrc = extract(/function isChecklistPage\([\s\S]*?\n\}/, 'isChecklistPage');
const titleZoneSrc       = extract(/const TITLE_ZONE = \d+;/, 'TITLE_ZONE');
const matchDocSrc        = extract(/function matchDoc\([\s\S]*?\n  return allOfMatch \|\| weakMatch;\n\}/, 'matchDoc');
const ticDocSrc          = extract(/\{ id: 'tic',[\s\S]*?\] \}/, "'tic' DOCS entry");

eval(normalizeSrc);
eval(kwHitSrc);
eval(isChecklistPageSrc);
eval(titleZoneSrc.replace('const TITLE_ZONE', 'globalThis.TITLE_ZONE'));
eval(matchDocSrc);
const ticDoc = eval('(' + ticDocSrc + ')');

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓ ' + msg); }
  else { failed++; console.log('  ✗ ' + msg); }
}

// ── Fixtures ────────────────────────────────────────────────────────────────
const fixtureA_coverEmail =
  'Karen A Graham & Associates\n' +
  'This household is approved for move in on or before 6/20/2026. ' +
  'If your property requires a TIC & Lease or First Year Quality Assurance review, ' +
  'please submit the T&L/FYQA package to our audit team. ' +
  'This application review is based on documentation presented only.';

const fixtureB_ticForm =
  'TENANT INCOME CERTIFICATION (TIC)\n' +
  'Effective Date: 06/20/2026\n' +
  'Part II - Gross Annual Income\n' +
  'Household Member ' + 'x'.repeat(800); // push body past the title zone

console.log('matchDoc / tic:');

// Fixture A alone — must NOT detect TIC
const a = matchDoc(ticDoc, [fixtureA_coverEmail]);
assert(a == null, 'cover email alone → no TIC match (got ' + JSON.stringify(a) + ')');

// Fixture B alone — must detect TIC, strong (weak:false), page 1
const b = matchDoc(ticDoc, [fixtureB_ticForm]);
assert(b && b.weak === false && b.page === 1, 'TIC form alone → strong match on page 1 (got ' + JSON.stringify(b) + ')');

// Fixture A then B — must still detect TIC strong, on page 2 (A skipped)
const ab = matchDoc(ticDoc, [fixtureA_coverEmail, fixtureB_ticForm]);
assert(ab && ab.weak === false && ab.page === 2, 'cover email + TIC form → strong match on page 2 (got ' + JSON.stringify(ab) + ')');

console.log('\nkwHit boundaries:');
assert(kwHit(normalize('perhaps not'), normalize('hap')) === false, "'hap' rejected inside 'perhaps'");
assert(kwHit(normalize('over a decade ago'), normalize('cad')) === false, "'cad' rejected inside 'decade'");
assert(kwHit(normalize('the icw worksheet'), normalize('icw')) === true, "'icw' accepted as a whole word");

console.log('\nisChecklistPage:');
assert(isChecklistPage(fixtureA_coverEmail) === true, 'auditor cover email is treated as a skip page');
assert(isChecklistPage(fixtureB_ticForm) === false, 'TIC form is NOT skipped');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
