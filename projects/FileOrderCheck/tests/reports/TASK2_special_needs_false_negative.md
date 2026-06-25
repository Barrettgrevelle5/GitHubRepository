# Task 2 — Special Needs false negative (Herrera p3 checklist box)

**Date:** 2026-06-16 · **File:** CCSR 1302 Herrera FF · **Status:** investigation only, nothing applied.

## What happens
On Herrera, the **Special Needs Certification** checklist box (cover page p3) is genuinely
**CHECKED** (confirmed by eye from the rendered page — see `/tmp/herrera_p3_crop2.png`), and
the Special Needs Certification document is **physically present on p22** (tester oracle).
Yet the app reports neither: `special_needs` is absent from the household profile *and* from
`present[]`. This is the one dangerous error class — a required document the app could let slip.

## Evidence: the glyph is dropped at every DPI
Re-OCR of the checklist page at 150/200/250/300 DPI (`tests/investigate_special_needs.py`):

```
[150] 'Special Needs Certification O Listing Contract ( If applicable)'
[200] 'Special Needs Certification Listing Contract ( If applicable)'
[250] 'Special Needs Certification O Listing Contract ( If applicable)'
[300] 'Special Needs Certification O Listing Contract ( If applicable)'
```

In every read the line **starts at the label** — the checkbox glyph before "Special Needs" is
never captured. (The `O` that appears is the *right-column* "Listing Contract" box, after the
label.) **The existing dual-DPI pass does not and cannot recover this** — even 300 DPI drops it.
You cannot glyph-tune a glyph the OCR never produced.

## The deeper cause is architectural, not just OCR
`_is_checked` returns unchecked → `isRequired(special_needs)` is false → and the app
**only runs `matchDoc` on required docs** (`renderResults`, mirrored at
`tests/capture_appanswer.js:45`: `const match = required ? matchDoc(doc, pages) : null`).
So the present-scan never even looks for Special Needs. Proof it *would* find it if asked:
calling `matchDoc(special_needs, pages)` directly returns `{page:22, weak:false}` — a clean
strong title-zone match. The detector is fine; the app just never asks because the checkbox
read gated it out.

**Consequence:** a Feature A checkbox miss is currently *silent and self-sealing* — Feature B
can't correct it because B never independently scans for non-required docs.

## Why "blank glyph → manual review" alone is the wrong fix
An **empty** box and a **checked-but-dropped** box look identical to OCR: both yield no glyph.
Most boxes on the checklist are unchecked, and OCR drops their empties too. So a blanket
"no glyph in front of the label ⇒ flag for manual review" rule would flag the majority of
every checklist's lines — noise that destroys the tool's value. Blank-prefix is not a usable
signal on its own.

## Recommended options (propose, don't apply)

1. **Feature A↔B cross-check (preferred, low-risk).** See `TASK3_cross_check_design.md`.
   If Feature B finds a roster document physically present that Feature A says is *not*
   required, soft-flag it ("present in file but checklist box reads unchecked — verify cover
   page"). This catches **exactly** the Herrera Special Needs case: B finds the cert on p22,
   A says not required → flag. It degrades gracefully (a flag, never a hard pass/fail) and
   needs no OCR-glyph tuning. **Requires** Feature B to scan all roster docs, not only
   required ones (the architectural change above).

2. **Image-level checkbox detection (real fix, larger).** Crop each checklist line's
   leading box region and classify checked/empty by pixel density / contour, instead of
   inferring state from OCR'd text glyphs. This is the only way to *reliably* tell a checked
   box from an empty one, but it's a meaningful new component and must be validated across
   files/firms before trusting it.

3. **Manual-review-on-disagreement (not blanket).** Only escalate to a human when option 1's
   cross-check fires — i.e. presence/checkbox disagree — never on blank glyphs alone.

## Recommendation
Pursue **option 1** (Task 3 cross-check) as the near-term safety net; consider option 2 only
if false negatives persist after the cross-check is in place. Do **not** force Special Needs
checked, and do **not** adopt blanket blank-glyph review.
