#!/usr/bin/env node
// Regression test for the 2026-06-22 batch fix of the FIVE WEAK phantom FPs surfaced by the
// Herrera oracle run (lower-stakes — weak matches don't feed the order check or dir2 advisory —
// so they are batched into one file with per-doc sections rather than 5 separate files).
// Each is a keyword hitting text inside another form's body, not a title block:
//   1. self_employ_affidavit — bare 'self employ'/'self-employ' matched "Sales from self-employed
//      resources" on the Zero Income Cert enumeration (Herrera p24). Same family as pension/rental.
//   2. student_financial — 'financial assist'/'student financial' matched the "Student Financial
//      Assistance" line item in the Supplemental Application income grid (Herrera p20).
//   3. mortgage — bare 'mortgage' matched "Mortgage Note Held" (Supplemental asset grid, p20) and
//      "recorded mortgages" (lease boilerplate, p54).
//   4. social_security — bare 'ssi' matched garbled RIS table text (p4); 'ssa' collided with the
//      applicant name "Vané|ssa" (accented-e breaks \b, Canizales p36); 'social security
//      administration' weak-hit the Release & Consent agency list (p10); and 'disability benefit'
//      STRONG-matched a Tesla/Sedgwick employer short-term-disability ("Short-Term Disability
//      Benefits") approval letter on Aldridge p24. Fixed via page-level exclude markers
//      ('release and consent', 'short-term disability') that suppress non-SSA contexts WITHOUT
//      narrowing the keywords — so a genuine SSA award that says "disability benefits" still matches.
//   5. live_in_aide_affidavit — bare 'live in aide'/'live-in aide' matched the Tenant Selection
//      Plan boilerplate "Live-in aides are subject to the same criminal criteria" (p45).
// Fixes follow the established pattern: drop the bare/over-broad token; keep/replace with the
// specific title phrase; add allOf (self_employ, live_in_aide) or exclude (social_security) only
// where needed. No genuine instance of any of these docs exists in the three fixtures, so genuine
// detection is proven via synthetic positive controls. Driven by the REAL fixtures.
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
eval(extract(/const DOCS = \[[\s\S]*?\n\];/, 'DOCS').replace('const DOCS', 'globalThis.DOCS'));
const byId = Object.fromEntries(DOCS.map(d => [d.id, d]));

const ocr = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'appanswers', name + '.ocr.json'), 'utf8')).pageTexts;
const FILES = ['CCSR 1302 Herrera FF', 'CCSR 3102 Canizales FF', 'CCSR 3205 Aldridge Move In'];
const PAD = 'x'.repeat(400);

let passed = 0, failed = 0;
const assert = (cond, msg) => { if (cond) { passed++; console.log('  ✓', msg); } else { failed++; console.log('  ✗', msg); } };
const noStrong = m => !m || m.weak === true;

// ── 1. self_employ_affidavit ─────────────────────────────────────────────────
console.log('self_employ_affidavit:');
{
  const d = byId.self_employ_affidavit;
  assert(d.keywords.indexOf('self employ') === -1 && d.keywords.indexOf('self-employ') === -1,
    "bare 'self employ'/'self-employ' dropped (matched Zero Income 'self-employed resources')");
  for (const f of FILES) assert(matchDoc(d, ocr(f)) == null, `${f} → no match`);
  const zero = 'BONNER CARRINGTON\nZero Income Certification\nApplicant / Resident: Linda Herrera\n' +
    'h. Periodic allowances from persons not living in my household; i. Sales from self-employed ' +
    'resources (Avon, Mary Kay, Shaklee, etc.); j. Any other source.\n' + PAD;
  assert(matchDoc(d, [zero]) == null, 'Zero Income "Sales from self-employed resources" → no match');
  const g1 = matchDoc(d, ['Self-Employment Affidavit\nI certify my self-employed business income.\n' + PAD]);
  assert(g1 && g1.weak === false, 'genuine "Self-Employment Affidavit" → STRONG title match');
  const g2 = matchDoc(d, ['Affidavit of Self-Employed Income\nName: Jane Doe   Business: consulting\n' + PAD]);
  assert(g2 && d.allOf.every(t => g2.keyword.includes(t)), 'title-variant "Affidavit of Self-Employed Income" → allOf match');
}

// ── 2. student_financial ─────────────────────────────────────────────────────
console.log('\nstudent_financial:');
{
  const d = byId.student_financial;
  assert(d.keywords.indexOf('financial assist') === -1 && d.keywords.indexOf('student financial') === -1,
    "'financial assist'/'student financial' dropped (matched the Supplemental income grid line item)");
  for (const f of FILES) assert(matchDoc(d, ocr(f)) == null, `${f} → no match`);
  const grid = 'Supplemental Rental Application\nAFDC/TANF  Yes  No  $___   ' +
    'Student Financial Assistance  Yes  No  $___   Other  Yes  No\n' + PAD;
  assert(matchDoc(d, [grid]) == null, 'Supplemental grid "Student Financial Assistance" line → no match');
  const g = matchDoc(d, ['Student Financial Assistance Verification\nScholarship/grant this year: $4,000\n' + PAD]);
  assert(g && g.weak === false, 'genuine "Student Financial Assistance Verification" → STRONG title match');
}

// ── 3. mortgage ──────────────────────────────────────────────────────────────
console.log('\nmortgage:');
{
  const d = byId.mortgage;
  assert(d.keywords.indexOf('mortgage') === -1, "bare 'mortgage' dropped (matched grid + lease boilerplate)");
  for (const f of FILES) assert(matchDoc(d, ocr(f)) == null, `${f} → no match`);
  const grid = 'Supplemental Rental Application — Assets\nReal Estate or Home  Yes  No  $___   ' +
    'Mortgage Note Held  Yes  No  $___   Whole Life Insurance  Yes  No\n' + PAD;
  assert(matchDoc(d, [grid]) == null, 'Supplemental asset grid "Mortgage Note Held" → no match');
  const lease = 'LEASE\nYour Lease is subordinate to existing and future recorded mortgages, unless the owner.\n' + PAD;
  assert(matchDoc(d, [lease]) == null, 'lease "recorded mortgages" boilerplate → no match');
  const g = matchDoc(d, ['Monthly Mortgage Statement\nPrincipal balance: $182,400   Payment due: $1,310\n' + PAD]);
  assert(g && g.weak === false, 'genuine "Mortgage Statement" → STRONG title match');
}

// ── 4. social_security ───────────────────────────────────────────────────────
console.log('\nsocial_security (all three fixtures cleared, incl. the Aldridge p24 employer-STD FP):');
{
  const d = byId.social_security;
  assert(d.keywords.indexOf('ssi') === -1 && d.keywords.indexOf('ssa') === -1,
    "bare 'ssi'/'ssa' dropped (garbled RIS text + the 'Vané|ssa' name collision)");
  assert(Array.isArray(d.exclude) && d.exclude.indexOf('release and consent') !== -1
      && d.exclude.indexOf('short-term disability') !== -1,
    "exclude ['release and consent','short-term disability'] (skips the agency list + employer STD letter)");
  for (const f of FILES) assert(matchDoc(d, ocr(f)) == null,
    `${f} → no match (Herrera p4 ssi + R&C; Canizales "Vanessa" ssa; Aldridge p24 employer STD all cleared)`);
  // root-cause controls
  const ris = 'RENTAL INFORMATION SCHEDULE\nSection 8 Voucher Holders Effective Date 06/01/2025\n# of Bedrooms SSi SSC\n' + PAD;
  assert(matchDoc(d, [ris]) == null, 'RIS garbled "SSi" table text → no match');
  const relConsent = 'TEXAS DEPARTMENT OF HOUSING AND COMMUNITY AFFAIRS\nRELEASE AND CONSENT FORM\n' +
    'I authorize release from: the Social Security Administration, state unemployment agencies, banks.\n' + PAD;
  assert(matchDoc(d, [relConsent]) == null, 'Release & Consent agency list ("Social Security Administration") → no match (excluded)');
  const vanessa = 'Asset Summary\nApplicant: Vanessa Canizales   Email: ales85@yahoo.com\n' + PAD;
  assert(matchDoc(d, [vanessa]) == null, '"Vanessa" name → no match (bare ssa dropped)');
  // employer-STD root-cause control: a Tesla/Sedgwick "Short-Term Disability Benefits" approval
  // letter must NOT match — 'disability benefit' would hit it, but the 'short-term disability'
  // exclude marker skips the page. This is the Aldridge p24 FP reproduced synthetically.
  const std = 'TESLA sedgwick\nAPPROVAL\nHello: You are approved for your time away from work.\n' +
    'Short-Term Disability Benefits\nSTD Approved Dates: April 20, 2026 through June 21, 2026.\n' + PAD;
  assert(matchDoc(d, [std]) == null,
    'employer/TPA "Short-Term Disability Benefits" (Tesla/Sedgwick) → no match (excluded, not SSA)');
  // genuine SSA detection preserved (exclusion does not narrow the keywords):
  const ssi = matchDoc(d, ['SOCIAL SECURITY ADMINISTRATION\nSupplemental Security Income Benefit Verification\nMonthly: $943\n' + PAD]);
  assert(ssi && ssi.weak === false, 'genuine SSA "Supplemental Security Income Benefit Verification" → STRONG title match');
  // a genuine SSDI award that uses the words "disability benefits" still matches — proving we did
  // NOT narrow 'disability benefit' (no false-negative on the real SSA document).
  const ssdi = matchDoc(d, ['SOCIAL SECURITY ADMINISTRATION\nNotice of Award — Disability Benefits\nYour SSDI monthly benefit is $1,510.\n' + PAD]);
  assert(ssdi && ssdi.weak === false,
    'genuine SSA "Notice of Award — Disability Benefits" (SSDI) → STRONG title match (keyword not narrowed)');
}

// ── 5. live_in_aide_affidavit ────────────────────────────────────────────────
console.log('\nlive_in_aide_affidavit:');
{
  const d = byId.live_in_aide_affidavit;
  assert(d.keywords.indexOf('live in aide') === -1 && d.keywords.indexOf('live-in aide') === -1,
    "bare 'live in aide'/'live-in aide' dropped (matched the Tenant Selection Plan prose)");
  for (const f of FILES) assert(noStrong(matchDoc(d, ocr(f))), `${f} → no STRONG match`);
  const tsp = 'TENANT SELECTION PLAN\nBankruptcy and civil judgments posted in the last seven years.\n' +
    'Note: Live-in aides are subject to the same criminal criteria as the Applicant.\n' + PAD;
  assert(matchDoc(d, [tsp]) == null, 'TSP "Live-in aides are subject to the same criminal criteria" → no match');
  const g1 = matchDoc(d, ['Live-in Care Attendant Affidavit\nThe attendant resides in the unit.\n' + PAD]);
  assert(g1 && g1.weak === false, 'genuine "Live-in Care Attendant Affidavit" → STRONG title match');
  const g2 = matchDoc(d, ['Live-In Aide Self Affidavit\nI am a live-in aide and sign this affidavit.\n' + PAD]);
  assert(g2 && d.allOf.every(t => g2.keyword.includes(t)), '"Live-In Aide Self Affidavit" (title the phrases miss) → allOf match');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
