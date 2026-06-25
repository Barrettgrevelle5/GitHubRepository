# Task 3 — Feature A ↔ Feature B cross-check (design note)

**Date:** 2026-06-16 · **Status:** design only, nothing implemented.

## The idea
The app has two independent signals it currently never compares:

- **Feature A** — what's *required*, from the checklist cover-page checkboxes
  (`detect_checklist_profile` → household profile).
- **Feature B** — what the file actually *contains / evidences*
  (`matchDoc` over page OCR; plus the income/condition kinds the documents imply).

When they disagree, the disagreement is itself evidence one of them is wrong. A **soft flag**
("verify the cover page") would have auto-caught every checkbox misread we found on Herrera —
without hard-asserting anything — and would have surfaced the Special Needs false negative too.

## Why this needs an architectural change first
Today `renderResults` only runs `matchDoc` for **required** docs
(`tests/capture_appanswer.js:45`). So Feature B produces no signal about non-required docs,
and there's nothing to cross-check against. **Prerequisite:** scan all roster docs for presence
(independently of `isRequired`), then compare. This is cheap — `matchDoc` already runs per-doc;
it's just gated. Keep the required/missing logic exactly as-is for the *primary* output; the
cross-check is an additional advisory pass over the full present-map.

## Two directions, two flags

| # | Condition | Likely meaning | Real example it catches |
|---|-----------|----------------|--------------------------|
| 1 | A says **required**, B finds **no document and no supporting income/condition evidence** anywhere | checkbox **false positive** (box read as checked but empty) | Herrera **tips** (box empty, no Tips affidavit, no tip income) and **marital** (box empty, no separation cert) |
| 2 | B finds a roster **document physically present**, A says **not required** | checkbox **false negative** (checked box's glyph dropped) | Herrera **Special Needs** (cert on p22, box checked but glyph dropped) |

Direction 1 catches the false positives Task 1's `0`-rule doesn't (e.g. the leading-`1`
"Maritial" misread). Direction 2 catches the dropped-glyph false negative from Task 2.

## What counts as "B supports requirement X"
"Supports" must be broader than "the exact document is present," or direction 1 will misfire
whenever a doc is merely missing for a benign reason. Define support as **any** of:

- the roster document for X is present (strong or weak `matchDoc` hit), **or**
- an income/condition kind that *implies* X is evidenced elsewhere in the file
  (e.g. a paystub anywhere ⇒ employment is real ⇒ an "Employment Verification required" box is
  corroborated even if that specific form is mis-detected), **or**
- a sibling document in the same household-evidence group is present.

Direction 1 fires only when **none** of these hold — required, but the file shows *no trace* of
the thing. That's a strong signal the box, not the file, is wrong.

## Presentation — soft flag, never a hard fail
- Render as an advisory band, distinct from the existing "missing (required & not found)" list.
  Wording, direction 1: *"Checklist marks **Tips & Commissions Affidavit** required, but nothing
  in this file supports it — verify the cover-page checkbox."*
  Wording, direction 2: *"**Special Needs Certification** appears on p22, but the checklist box
  reads unchecked — verify the cover-page checkbox."*
- Never auto-flip a checkbox, never convert a flag into a pass/fail. It points a human at the
  one page (the cover) to glance at. Degrades gracefully: worst case is one extra glance.

## False-flag risks (and mitigations)
- **Legit missing doc (direction 1).** A genuinely-required doc that's genuinely absent would
  also have "no supporting evidence" and could be mistaken for a checkbox error. *Mitigation:*
  the flag's wording is "verify the checkbox," not "the box is wrong" — and the existing
  missing-list already covers the genuine-absence case; the cross-check only *adds* the
  "maybe the box is wrong" reading, it doesn't replace it.
- **Weak/cross-reference matches (direction 2).** A weak `matchDoc` hit (body-text mention, not
  a title) could fire a spurious "present but not required" flag. *Mitigation:* gate direction 2
  on **strong** matches only (`weak === false`), since those mean "this page *is* the document."
- **Multi-doc pages / shared evidence.** Over-broad "supports" definitions could suppress real
  direction-1 flags. *Mitigation:* keep the support set explicit and auditable; start
  conservative (document-present OR direct income/condition evidence) and widen only with
  test-file evidence.
- **Noise volume.** If too many advisories appear, officers ignore them. *Mitigation:* both
  directions fire only on hard contradictions (required+zero-trace, or strong-present+not-required),
  which are rare — on our three files this would have produced ~3 flags total, all true.

## Where it would live
A post-pass in `renderResults` (frontend), after the present-map and required/missing lists are
built, reading the same `evaluated[]` array plus an un-gated full-roster present-scan. No backend
change beyond optionally exposing the raw checkbox confidence later. Add regression fixtures from
Herrera (tips/marital should raise direction-1 flags; Special Needs should raise a direction-2
flag) when/if implemented.

## Recommendation
Worth building, small surface area, high safety payoff — it converts today's *silent,
self-sealing* checkbox errors into visible, human-checkable advisories. Sequence: (1) un-gate the
full-roster present-scan, (2) add the two-direction comparison, (3) render as advisories,
(4) add the three Herrera regression fixtures.

> **Status:** IMPLEMENTED 2026-06-16. Un-gated present-scan + two-direction cross-check +
> `HEADING_ZONE`/`isHeadingMatch` guard shipped in `File Checklist Validator.html`; mirrored in
> `tests/capture_appanswer.js`; regression suite `tests/crosscheck_regression.test.js` (7/7).
> Oracle-verified on all three files: exactly 2 advisories, both true. See the latent-risk
> section below — it was discovered *during* implementation and is the most important takeaway.

## ⚠️ Known latent risk: over-broad matchDoc keywords (READ BEFORE TRUSTING THE BACKSTOP)

Un-gating the present-scan did not *introduce* false positives — it **exposed** ones that were
always there. The old "only `matchDoc` required docs" gate was **masking** these FPs, not
preventing them: it simply never scanned the non-required docs whose keywords collide, so the
collisions never surfaced. Three things must be understood together:

**1. The offenders are real and enumerated.** Across the three case files, un-gating produced
~10 strong (title-zone) matches that are keyword collisions, not documents. The matched keyword
lands inside the 600-char `TITLE_ZONE` of a *different* page:

| doc id | colliding keyword | actually matched (wrong) page |
|--------|-------------------|-------------------------------|
| `unemployment` | `unemployment` | Zero Income Cert (lists income sources) |
| `pension_verif` | `pension` | Zero Income Cert |
| `rental_worksheet` | `rental income` | Zero Income Cert |
| `social_security` | `social security` / `social sec` | Rental Application (SSN field) |
| `self_employ_affidavit` | `self employ` | Income & Asset Verifications cover page |
| `tax_return` | `tax return` | Income & Asset Verifications cover page |
| `profit_loss` | `profit` | Income & Asset Verifications cover page |
| `bank_statement` | `bank statement` | Income & Asset Verifications cover page |
| `minor_children_docs` | `custody` | Child Support / Alimony Cert ("having custody of") |
| `multiple_adult_cert` | `co-applicant` | lease / Application body |
| `court_order` | `court order` | Child Support / Alimony Cert (Canizales/Aldridge) |

These were latent the whole time; gating just hid them from view.

**2. `HEADING_ZONE = 100` is now LOAD-BEARING — and it rests on a narrow, three-file margin.**
The cross-check only suppresses these because, on the files we have, every genuine document
title sits in the first **≤67** chars of its page while every colliding mention sits at char
**≥123**. `HEADING_ZONE = 100` lives in that ~67/123 gap. That gap is **measured, not
guaranteed** — it comes from three case files, one property, one scan format, one cover-page
layout (Karen A Graham audit firm, see [[fileordercheck-audit-firm]]). A different letterhead,
a two-column title block, a shifted scan, or an extra header line could push a real title past
100 chars (advisory misses a real problem — degrades gracefully) **or** pull a colliding
mention before 100 chars (a collision re-surfaces as a live FP — does not degrade gracefully).

**3. `HEADING_ZONE` is an INTERIM BACKSTOP, not the fix.** The real remedy is a
**keyword-tightening pass** on the offenders above, using the same pattern that fixed TIC and
tips/marital/payment_history: `exclude` lists for the known cross-reference phrases, and `allOf`
corroboration (require several co-occurring terms) where a single token is too generic
(`profit`, `pension`, `custody`, `co-applicant`, `social security`). Once the keywords are
tightened, the collisions stop being strong matches at all and the backstop stops being
load-bearing. **Do not mistake the backstop for the solution.** `HEADING_ZONE` buys time; it
does not remove the bug.

### The dangerous direction (worse than a stray advisory)
The Direction-2 advisory noise is the *benign* face of this. The dangerous face is in the
**main answer**, for a doc that is **genuinely required**: a required doc whose keyword collides
can strong-match the **wrong page**, and because the app takes the first strong match as "found,"
that:
- **suppresses its "missing" flag** — a required-but-absent document reads as
  *present-and-satisfied* off a keyword collision (e.g. a household that genuinely needs
  `self_employ_affidavit`, with no affidavit filed, would still show it "found" on the
  asset-verif cover page), **and**
- **feeds a wrong page number into the out-of-order computation** — corrupting the order check
  for everything sequenced around it.

This is strictly worse than an extra advisory entry: it is a **false negative on a required
document with order corruption downstream** — the one error class that can let a non-compliant
file pass. The cross-check does **not** protect against this (it only reasons about not-required
docs in Direction 2 and zero-trace docs in Direction 1; a required doc satisfied on the wrong
page looks "present" to it). Only the keyword-tightening pass closes it.

### Tripwire — precondition on new-property onboarding (not a someday item)
**The keyword-tightening pass MUST be completed BEFORE onboarding any property whose case files
have a materially different scan or cover-page format from the current Bonner Carrington / Karen
A Graham layout** (different audit firm, different letterhead/title-block layout, different scan
DPI or column structure). That format change is exactly the condition that can collapse the
67/123 margin and turn the masked collisions into live false positives — including the dangerous
required-doc false-negative above. Until then, the three current files are in-margin and the
backstop holds. Treat this as a hard precondition on onboarding, not an enhancement.
