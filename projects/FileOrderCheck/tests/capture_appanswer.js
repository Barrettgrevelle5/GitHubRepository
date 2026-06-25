#!/usr/bin/env node
// Produce the APP's present/outOfOrder/missing answer for a PDF, using the REAL
// detection code extracted from "File Checklist Validator.html" (DOCS, normalize,
// kwHit, isChecklistPage, TITLE_ZONE, matchDoc, isRequired) plus the exact order
// logic from renderResults(). Input: tests/appanswers/<stem>.ocr.json (from
// capture_ocr.py). Output: tests/appanswers/<stem>.appanswer.json.

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const html = fs.readFileSync(path.join(ROOT, 'File Checklist Validator.html'), 'utf8');

function extract(re, label) {
  const m = html.match(re);
  if (!m) throw new Error('Could not extract ' + label);
  return m[0];
}

// Pull the real source out of the HTML so we test shipping behavior, not a copy.
const DOCS = eval('(' + extract(/const DOCS = \[[\s\S]*?\n\];/, 'DOCS').replace(/^const DOCS = /, '').replace(/;$/, '') + ')');
eval(extract(/function normalize\(s\)\s*\{[\s\S]*?\n\}/, 'normalize'));
eval(extract(/function kwHit\([\s\S]*?\n\}/, 'kwHit'));
eval(extract(/function isChecklistPage\([\s\S]*?\n\}/, 'isChecklistPage'));
eval(extract(/const TITLE_ZONE = \d+;/, 'TITLE_ZONE').replace('const TITLE_ZONE', 'globalThis.TITLE_ZONE'));
eval(extract(/function matchDoc\([\s\S]*?\n  return allOfMatch \|\| weakMatch;\n\}/, 'matchDoc'));

const ocr = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

// Rebuild the app's `state.profile` from the captured checklist profile, then run
// the real isRequired() against it (extracted, since it reads `state`).
globalThis.state = {
  profile: {
    program: ocr.profile.program,
    income: new Set(ocr.profile.income || []),
    conditions: new Set(ocr.profile.conditions || []),
  },
  required: new Set(),
};
// Required-ness now comes from the questionnaire (state.required), not doc.conditions.
// Headless, we model "a questionnaire whose answers match the FILE APPROVAL CHECKLIST
// cover page" — the faithful stand-in TESTER.md prescribes when no fixture profile is
// supplied. That declared set is exactly isRequiredByConditions() over the checklist
// profile (the same mapping docsImpliedByChecklist uses), so we populate state.required
// from it and then exercise the REAL isRequired() (which reads state.required) below.
eval(extract(/function isRequiredByConditions\([\s\S]*?\n  return false;\n\}/, 'isRequiredByConditions'));
eval(extract(/function isRequired\(doc, \{[\s\S]*?\n\}/, 'isRequired'));
for (const doc of DOCS) {
  if (isRequiredByConditions(doc)) globalThis.state.required.add(doc.id);
}
eval(extract(/const HEADING_ZONE = \d+;/, 'HEADING_ZONE').replace('const HEADING_ZONE', 'globalThis.HEADING_ZONE'));
eval(extract(/function isHeadingMatch\([\s\S]*?\n\}/, 'isHeadingMatch'));
eval(extract(/function crossCheck\(evaluated, pages\)\s*\{[\s\S]*?\n  return \{ direction1, direction2 \};\n\}/, 'crossCheck'));

const pages = ocr.pageTexts;

// Mirror renderResults(): evaluate each doc, then the predecessor-based order check.
// Present-scan is UN-GATED (matchDoc runs on all docs) — matches the shipping app.
const evaluated = DOCS.map(doc => {
  const required = isRequired(doc);
  const match = matchDoc(doc, pages);
  return {
    id: doc.id, name: doc.name, order: doc.order, conditions: doc.conditions, keywords: doc.keywords, required,
    matchedKw: match ? match.keyword : null,
    foundPage: match ? match.page : null,
    weakMatch: match ? match.weak : false,
  };
});

const requiredFound = evaluated
  .filter(d => d.required && d.foundPage !== null)
  .sort((a, b) => a.order - b.order);

for (let i = 0; i < requiredFound.length; i++) {
  const doc = requiredFound[i];
  if (i === 0) { doc.outOfOrder = false; continue; }
  const prev = requiredFound[i - 1];
  if (doc.foundPage < prev.foundPage) { doc.outOfOrder = true; doc.expectedAfter = prev; }
  else { doc.outOfOrder = false; }
}

// User-facing "found" set = required docs that matched. Non-required docs always
// render as "not applicable" in the UI even when the un-gated scan matches them, so
// they must NOT appear here; Direction-2 advisories surface the present-but-not-
// required case instead. Keeps the oracle comparison faithful to what the app shows.
const present = evaluated
  .filter(d => d.required && d.foundPage !== null)
  .map(d => ({ id: d.id, name: d.name, page: d.foundPage, weak: d.weakMatch }));
const outOfOrder = evaluated
  .filter(d => d.outOfOrder)
  .map(d => ({ id: d.id, name: d.name, page: d.foundPage, expectedAfter: d.expectedAfter ? d.expectedAfter.name : null }));
const missing = evaluated
  .filter(d => d.required && d.foundPage === null)
  .map(d => ({ id: d.id, name: d.name }));

const { direction1, direction2 } = crossCheck(evaluated, pages);
const advisories = {
  direction1: direction1.map(d => ({ id: d.id, name: d.name })),
  direction2: direction2.map(d => ({ id: d.id, name: d.name, page: d.foundPage })),
};

const answer = {
  pdf: ocr.pdf, pages: ocr.pages, checklist_page: ocr.checklist_page,
  profile: ocr.profile, present, outOfOrder, missing, advisories,
};

const stem = path.basename(process.argv[2]).replace(/\.ocr\.json$/, '');
const outPath = path.join(ROOT, 'tests', 'appanswers', stem + '.appanswer.json');
fs.writeFileSync(outPath, JSON.stringify(answer, null, 2));
console.log(outPath);
console.log(`present=${present.length} outOfOrder=${outOfOrder.length} missing=${missing.length} profile=${JSON.stringify(ocr.profile)}`);
console.log(`advisories: dir1(required,zero-trace)=${JSON.stringify(advisories.direction1.map(d=>d.id))} dir2(strong-present,not-required)=${JSON.stringify(advisories.direction2.map(d=>d.id))}`);
