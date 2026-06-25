# FileOrderCheck Test Report
File: CCSR 1302 Herrera FF.pdf   Pages: 57   Run: 2026-06-18T16:49:28Z   App build: 3cd5300
SCOPE: partial (docs: marital_sep, payment_history, student_eligibility, special_needs)
Verdict: REVIEW (partial scope)

## Summary
Present (scoped):  app 2 / tester 2   |  agree 2
Out of order:      n/a (scoped re-check; ordering not evaluated)
Missing:           app 0 / tester 0   |  agree 0
Required-ness:     1 disagreement (special_needs)
Mismatches: 1  (FALSE_POS 0, FALSE_NEG 0, PAGE 0, ORDER 0, MISSING 0, AMBIG 0, UNCERTAIN 0, REQUIRED-NESS 1 → REVIEW)

Independence: pages read directly as rendered images (pdftoppm, no OCR); no .ocr.json /
ocr_debug / app detection code consumed. Identification by visual match against the four
loaded ComplianceForms templates.

## Document-by-document

| Document | Required (p3 box) | App (page / status) | Tester (page / status) | Match | Category | Note |
|----------|-------------------|---------------------|------------------------|-------|----------|------|
| Marital Separation Certification | no (box UNCHECKED) | not required, not present, no advisory | absent in scope; p3 box unchecked | ✓ | — | agree — correctly not-required, not-missing |
| Payment History or AG 9L001 | no (box UNCHECKED; p33 Sec 2 not selected) | not required, not present, no advisory | absent in scope; p3 box unchecked; p33 Section 2 (court-ordered) NOT selected | ✓ | — | agree — correctly not-required |
| Certification of Student Eligibility | yes (box CHECKED) | p21 / present (strong), required | p21 / present (matches template) | ✓ | — | agree — required + present |
| Special Needs Certification | yes (box CHECKED) | p22 / present (direction2 advisory only); NOT in required set | p22 / present (matches template); p3 box CHECKED → should be required | ✗ | REQUIRED-NESS (REVIEW) | App sees it PRESENT (advisory), so not a presence FN. App's p3 checkbox read missed the checked Special Needs box (dropped-glyph OCR limitation), leaving it out of the required set. |

## Out-of-order comparison
Not evaluated — scoped re-check. Out-of-scope docs are excluded from ordering by design.

## Missing comparison
App missing:    (none in scope)
Tester missing: (none in scope) — both scoped required docs (student_eligibility,
special_needs) are physically present in the file (p21, p22), so neither is missing
regardless of the required-ness read.
Disagreements:  none on missing.

## Divergence detail

REQUIRED-NESS / special_needs — REVIEW (not FAIL):
- Page evidence: p22 is the TDHCA "Special Needs Certification" form — title block, the
  bulleted special-need category list, the YES/NO "Special Need?" prompt, and the dual
  Household Signature / Date blocks all match `TDHCA Special Needs Certification.pdf`.
  Household "Yvon Herrera", Cypress Creek Stoney Ridge, Unit 2302, signed and dated. This
  is the actual form, not a mention. → PRESENT at p22.
- p3 checklist cover (high-res crop, left column): the "Special Needs Certification" box
  is CHECKED (☑). Per the required-ness input contract, that makes special_needs a
  required doc for this household.
- App: lists special_needs only as a direction2 "present-but-not-required" advisory at
  p22, and did NOT include it in the required set. So the app DOES see the document
  present — there is no presence false-negative. The disagreement is purely on
  required-ness: the app's checklist checkbox parser failed to register the checked p3
  Special Needs box (the known Tesseract dropped-glyph misread limitation on this file).
- Why REVIEW, not FAIL: TESTER hard-fails only on APP_FALSE_POSITIVE / APP_FALSE_NEGATIVE
  or an order/missing error tracing to one. The presence call is correct on both sides;
  the document is present so it cannot be "missing"; the only gap is a checkbox-state
  read driving required-ness, which is a known OCR limitation flagged for a human glance.

## Three-fix confirmation (independent)
1. Marital Separation leading-'1' misread: p3 Marital Separation box reads UNCHECKED to
   the tester, and the form is absent from the file → app's not-required/not-present is
   correct. Fix holds.
2. payment_history requires court-ordered support (Cert Section 2): p33 Section 2 ("There
   IS a court-ordered support agreement / I have provided a payment history") is NOT
   selected — all its Name/Amount/checkbox fields blank; only Section 1 (biological
   parent of a resident child, "David Herrera") is filled. p3 Payment History box is
   UNCHECKED. → payment_history correctly not-required. Fix holds.
3. Checked Student Eligibility box detected: p3 "Certification of Student Eligibility" box
   is CHECKED, and the actual form is present at p21 → app correctly lists it required +
   present (strong). Fix holds.

## Reproducibility
- How run: scoped re-check. Pages rendered directly to PNG via `pdftoppm` (poppler), no
  OCR. Visual identification against templates only.
- Image detail: low/standard (120 dpi page reads). One escalation: p3 and p33 re-rendered
  at 300 dpi and cropped to the checklist document-list band / Section 1-3 band to read
  individual checkbox state reliably — escalation limited to those two pages, not the run.
- Scope: partial (docs: marital_sep, payment_history, student_eligibility, special_needs).
  Pages read: p3 (checklist cover), p21, p22, p33. No other pages read.
- Templates read once: Marital Separation Certification 2.14.2025, Child
  Support-Alimony Certification 5.28.2024, Certification of Student Eligibility 3.1.2024,
  TDHCA Special Needs Certification. Not reloaded mid-run.
- App answer consumed: tests/appanswers/CCSR 1302 Herrera FF.appanswer.json (profile
  conditions [student, assets_under_50k]; income [employed, zero_income, non_employed,
  child_support]; special_needs and profit_loss in advisories.direction2).
