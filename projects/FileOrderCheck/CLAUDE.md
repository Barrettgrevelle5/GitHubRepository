# CLAUDE.md — FileOrderCheck

## What this is
A local compliance tool for **Bonner Carrington** (Texas affordable-housing property
management, TDHCA programs). A property manager answers a short intake **questionnaire**
declaring the household's situation, then drops the applicant's **combined, scanned PDF**
case file into the tool before sending it to a compliance officer. The tool OCRs the file
and answers:

1. **Which documents are *required*** for this household — declared by the **questionnaire**
   (boolean intake flow; see `RequiredDocs_DecisionTree.md`), **cross-checked** against the
   FILE APPROVAL CHECKLIST cover page's checked boxes for agreement.
2. **Which required documents are *present*, and are they in the correct order** in the
   combined PDF.

It is OCR-only and runs entirely on localhost. No data leaves the machine.

## Architecture status (questionnaire shipped)
The target pipeline below is **implemented**. As of the 2026-06-22 audit, the questionnaire
UI is fully built and wired as the **startup gate**: loading `/` runs `renderQuestionnaire()`
immediately (HTML startup), the adaptive boolean flow lives in `walkQuestionnaire()`, and its
output populates `state.required`, which `isRequired()` consumes as the sole source of
required-ness. The checklist cover page has been demoted to an audit input (see Feature A).
This section previously said the questionnaire "does not exist yet" — that is no longer true;
the code matches the target. Still verify against the actual code before assuming any *newer*
change landed, but the questionnaire pivot itself is done.

## New pipeline (target order of events)
```
Questionnaire (declares required-ness)
   → OCR whole document (every page, up front)
   → Check checklist cover page's checked boxes against the questionnaire's declared
     set — audit/cross-check, NOT the source of required-ness (flag mismatches)
   → Check for missing required files
   → Check file order
   → Finished (additional feature may be added later)
```
**Startup behavior:** loading `http://127.0.0.1:5050` must immediately present the
questionnaire, before any file upload UI. The questionnaire runs first, always.

This replaces the old flow where the checklist page was located/parsed first and was
itself the source of truth for required-ness.

## Stack & how to run
- **Backend:** Flask (`app.py`), serves on `http://127.0.0.1:5050`. Run: `python3 app.py`
  (opens a browser tab automatically).
- **OCR:** `pdf2image` (poppler) + `pytesseract` (Tesseract). No PDF text layer is
  assumed — every file is treated as scanned images.
- **Frontend:** a single static HTML file with inline JS, served at `/`. Note: `app.py`
  serves it as **`File Checklist Validator.html`** (with spaces, see the `index()` route).
  The working copy may also exist as `File_Checklist_Validator.html`; confirm the actual
  filename before editing and keep the served name in sync.
- **Platform:** macOS, system Python. Installs use `pip install ... --break-system-packages`.
- **Repo path:** `~/Desktop/ClaudeRepositorys/MainRepository/projects/FileOrderCheck`

## Architecture — three pieces (do not conflate them)

### Questionnaire (implemented, startup-gated) — "Which docs SHOULD be required"
Adaptive boolean intake flow the property manager completes before upload. Declares the
required-document set authoritatively (an explicit human answer, not an inference from
OCR'd content). It is fully built and wired as the startup gate: loading `/` runs
`renderQuestionnaire()`, the adaptive boolean flow lives in `walkQuestionnaire()`, and its
output populates `state.required`, which `isRequired()` consumes as the sole source of
required-ness. Spec lives in `RequiredDocs_DecisionTree.md`. Per the design principles
there: boolean-only, conservative-default-over-ask, per-household-member loop for
income/employment/student questions, questionnaire declares / scan audits. (Open policy
questions — the ⚠ items in `RequiredDocs_DecisionTree.md` — remain open.)

### Feature A — "Does the checklist page AGREE with the questionnaire" (backend, `app.py`)
**Role changed.** Feature A no longer declares required-ness — the questionnaire does.
Feature A's job is now to locate the FILE APPROVAL CHECKLIST cover page (it is **not**
always page 1), read which boxes are checked, and **cross-check that checkbox state
against the questionnaire's declared-required set**, flagging disagreement (same
advisory pattern as the existing Feature A↔B cross-check: required-but-checklist-shows-
unchecked, or checked-but-questionnaire-says-not-required). *(The checklist↔file `crossCheck`
this pattern derives from was itself consolidated 2026-06-22 to its "present in file, not
required" direction (dir2) only; its "required, zero file trace" direction (dir1) is now
dormant code, superseded by this audit's dirB now that the questionnaire owns required-ness.
See the resolved note under Known constraints.)* The underlying mechanics are unchanged:
- `CHECKLIST_ANCHORS` — weighted invariant template phrases (pillars w5, field labels
  w2, line items w1). Used only to *locate* the checklist page; never to detect document
  presence.
- `score_checklist_page(text)` — rapidfuzz fuzzy match (ratio ≥80) with a **structural
  gate**: a page needs ≥2 of 3 pillar anchors to be a candidate.
- `locate_checklist_page(pdf_bytes, max_pages=10, threshold=0.55, early_exit=0.85)` —
  low-DPI (150) one-page-at-a-time locate pass that short-circuits early, then runs the
  expensive dual-DPI parse on only the located page. Returns `page_index=None` →
  `needs_manual_review` when nothing qualifies.
- `detect_checklist_profile(text)` + `_is_checked(text, keywords)` — parse which
  checkboxes are checked on the located page. These handle Tesseract's messy checkbox
  character reads (checked ☑ → `@ | ~ [ ] { }`, digits, lone letters; unchecked ☐ →
  `O/o` or nothing). **These functions are about checkbox STATE, not about whether a
  document physically appears in the file, and (now) not about declaring required-ness
  either — only about auditing it.**
- Endpoints: `POST /api/scan-checklist` (locate + profile), `POST /api/ocr` (OCR all
  pages, SSE progress stream).

### Feature B — "Which docs are present / in order" (frontend JS in the HTML)
Scans the OCR text of every page to detect which of the 44 known TDHCA documents appear
and whether they are in the expected order. Unchanged by this pivot.
- `DOCS[]` — the 44 roster documents plus one floating non-roster detector
  (`clarification_record`, see below), each `{ id, name, conditions, order?, keywords[],
  note?, allOf? }`. `keywords` are matched against page OCR; `allOf` requires several terms
  to co-occur on a page (used where titles vary, e.g. paystubs). `order` is optional — a
  floating doc omits it (see `clarification_record`).
- `normalize(s)` — lowercase, map `[_-.]`→space, collapse whitespace, trim. **Gotcha:
  this strips leading/trailing spaces and punctuation, so keyword variants that relied
  on padding for word-boundary protection (e.g. `' tic'`, `'tic.'`) all collapse to the
  bare token.**
- `isChecklistPage(pageText)` — pages to skip entirely because they *list* every doc by
  name (the checklist cover, and — as of the fix — auditor transmittal cover letters).
- `TITLE_ZONE = 600` — chars from the top of a page treated as the "title zone."
- `matchDoc(doc, pages)` — returns the best hit: a keyword in the **title zone** is a
  **strong** match (`weak:false`, "this page IS the document"); a keyword only in body
  text is a **weak** match (`weak:true`, "verify manually", cross-reference risk).
- **Paystub detection (`employment_verif`) — 3-part hybrid (2026-06-22).** Payroll providers
  don't self-identify consistently, so no single keyword/`allOf` generalizes. The three real
  fixtures use three different vocabularies and **none names itself "paystub"**: Aldridge
  (Tesla "Pay Statement") matches the `pay statement` keyword; Canizales ("Payment Statement")
  needed a *separate* `payment statement` keyword — `normalize` substring matching does **not**
  bridge `pay statement`→`payment statement`, and the word occurs only on its 4 real paystub
  pages; Herrera (Baker/Triangle payroll-table) has **no self-identifying title at all** — its
  header is a `GROSS PAY / NET PAY / PERIOD END` column row — so it needs the *structural
  fingerprint* `allOf: ['gross pay','net pay','period end']` instead of a title keyword. The old
  `allOf: ['employee','pay rate','period end']` was dead: only Aldridge has `pay rate` (and it
  matches by title anyway). The fingerprint is verified clean against both adjacent Income
  Calculation Worksheets (Herrera p26 has none of the three; Aldridge p19 has gross+period but
  lacks `net pay`), **but it is tuned to these three formats — a fourth provider that mangles or
  omits those terms could still slip through**, same caveat as the rest of the keyword work.
  (`employment_verif_fix_regression.test.js`)
- **`clarification_record` — new floating doc (2026-06-22).** Covers both the TDHCA "Telephone
  Verification/Clarification Record" and the Bonner Carrington "Clarification Record" — the Work
  Number fallback / manual phone-verification path (real but disfavored). Split out of
  `employment_verif`, whose `phone verif`/`telephone verif` tokens used to mis-grab this form as
  employment verification (Herrera p31/32) and whose `paystub` keyword mis-grabbed the
  clarification record's prose (Canizales p23) — both masked the real paystubs. It is
  `conditions: []` with **no `order`**: per `File Checklist.xlsx` row 37, clarifications "go
  directly behind the information being clarified", i.e. they *float* behind whatever they
  clarify rather than occupy a fixed roster position. With no `order` it is excluded from the
  order-sequence check (which filters on required+found); the not-required render falls back to
  `—` for its item number.
- `isRequired(doc)` — **wired (2026-06-22 audit).** Evaluates against the questionnaire's
  declared set (`state.required`), not `doc.conditions`, and hard-fails (throws) on an
  empty/undefined set rather than silently falling back. Tests opt into the legacy
  condition-based path with `isRequired(doc, { useConditionsFallback: true })`. See the
  "Required-ness source (wired)" note under Known constraints.

## OCR debug visibility (new requirement)
Need to inspect what Tesseract actually extracted per page, to debug scan-quality issues
(misreads, dropped glyphs, displaced text) without re-running the full pipeline.
- **One `.txt` file per PDF**, not one file per page.
- All pages concatenated into that single file, **clearly delimited** with a page-start
  marker (e.g. `--- PAGE 7 ---`) so it's obvious where each page begins/ends.
- This should hook into the existing OCR pass (`/api/ocr` / wherever `pytesseract` is
  invoked) rather than re-OCRing separately — write the dump as a side effect of the OCR
  that's already happening.
- Treat this as PII the same way `_debug_ocr` already is (see Known constraints below) —
  local-only, not for network exposure.

## Validation agent (TESTER.md)
This project ships with an independent test oracle defined in **`TESTER.md`**. It is a
separate subagent — not part of the app — that you deploy to verify the app actually
works before you treat it as done.

**What it does:** given a real case-file PDF, it reads the PDF directly (no OCR), matches
each page against the blank templates in `ComplianceForms/`, and uses `File Checklist.xlsx`
for the document roster and canonical order. It independently answers the same three
questions the app answers — which documents are present, what's out of order, what's
missing — then loads the app's answer and produces a report showing both side by side,
flagging every disagreement with a root-cause category.

**Why it's separate:** its verdict is only meaningful because it shares **no mechanism**
with the app. It must never reuse `matchDoc`, `kwHit`, `normalize`, `isChecklistPage`,
`TITLE_ZONE`, the `DOCS` keyword lists, or any OCR. When deploying it, preserve that
independence — do not let it "borrow" the app's detection code to save effort.

**When to deploy it:**
- Whenever you believe the app is at or near a final/shippable state.
- After any change to the detection pipeline — `matchDoc`, `DOCS`, `normalize`, `kwHit`,
  `isChecklistPage`, `TITLE_ZONE`, or the OCR/profile flow — before declaring the change
  good.
- **Once the questionnaire ships:** the tester's independent answer should be compared
  against the questionnaire-declared required set, not the old checklist-derived one.
  Update `TESTER.md`'s required-ness source accordingly when that lands.
- Against real case-file PDFs (not just unit fixtures), since the failure modes here are
  about real scans: cover letters, cross-references, multi-page docs, varying titles.

**How to use the result:** the agent emits a report and a verdict — PASS / FAIL / REVIEW.
- **FAIL** (an app false positive/negative, or an order/missing error tracing to one)
  blocks "final" status — fix and re-run.
- **REVIEW** (only tester-uncertainty or genuinely ambiguous pages) is not an app failure;
  surface it to Barrett for a human glance.
- **PASS** means present-map, order, and missing all agree.

Read `TESTER.md` for the full operating spec before deploying it.

## Domain glossary (brief)
- **TDHCA** — Texas Dept. of Housing & Community Affairs (the regulator).
- **LIHTC / HTC / BOND / HOME** — affordable-housing program designations; drive which
  docs are required.
- **TIC** — Tenant Income Certification (a specific document). Beware: "TIC & Lease" /
  "T&L" / "FYQA" on cover letters refer to a *review process*, not the TIC document.
- **HOH** — Head of Household. **UA** — Utility Allowance. **ICW** — Income Calculation
  Worksheet.

## Known constraints, gotchas & open items
- **Short abbreviations are collision-prone — but `kwHit` already guards them.** Short
  single-token keywords (`tic`, `icw`, `ssa`, `ssdi`, `hap`, `cad`) would match as
  substrings, but `kwHit` applies a `\b…\b` word boundary to space-free tokens of length
  ≤4, so e.g. `hap` does **not** match inside "perhaps" (verified 2026-06-22) and `cad`
  does not match inside "decade". The earlier "`hap` hits perhaps" / "`cad` hits decade"
  warning predates that word-boundary guard and is **no longer a live risk**. (Longer or
  multi-word keywords still use substring matching, so a *phrase* like `section 8` can
  still over-match — see the resolved FP notes below.) `hap` was nonetheless dropped from
  `section8_verif` in the 2026-06-22 pass as redundant, not because of the "perhaps"
  collision.
- **Title-zone ≠ document title on prose pages.** The title-zone heuristic assumes the
  top of a page is a heading. Cover letters and emails put cross-references in their
  intro prose, which lands inside `TITLE_ZONE` and false-positives as a strong match.
  Such pages should be skipped, not scanned.
- **Over-broad `matchDoc` keywords → phantom "found" docs (open tripwire).** Some keyword
  lists match generic prose or doc-listing cover pages, producing false-positive STRONG
  matches that pollute both the order check and the checklist↔file advisory. *Fixed
  (Herrera FF, minimal pass — see `tests/order_check_fp_regression.test.js`):*
  `minor_children_docs` (`custody`/`minor child`/`dependent child` hit the Child Support
  Cert), `multiple_adult_cert` (`co-applicant` hit lease pages), `bank_statement` (matched
  the "Income and/or Asset Verifications" divider → now skipped via `isChecklistPage`).
  **ALL 7 NOW RESOLVED** (2026-06-22 FP-tightening pass, one change at a time, each with a
  dedicated regression test driven by the real Herrera/Canizales/Aldridge OCR fixtures).
  The empirical root causes differed from the original guesses in two cases — investigate
  before assuming. Final state per doc:
  - `social_security` — *real cause:* bare `social security`/`social sec` strong-matched the
    "Social Security #" field label on the TAA Rental Application. *Fix:* keyed on agency
    header `social security administration`. (`social_security_fp_regression.test.js`)
  - `county_appraisal` (`appraisal`) — *real cause:* `appraisal district` body-matched the
    institution list on the TDHCA Release & Consent form; `cad` collision-prone. *Fix:* dropped
    those; `allOf: ['appraisal district','market value']`. (`county_appraisal_fp_regression.test.js`)
  - `profit_loss` — *real cause:* bare `loss` strong-matched lease boilerplate ("reimburse us
    for **loss**, damage…", Herrera p52 / Canizales p49). *Fix:* dropped bare `profit`/`loss`;
    keywords `['profit and loss','profit & loss','profit and loss statement','p&l','p & l']`.
    (`profit_loss_fp_regression.test.js`)
  - `section8_verif` — *real cause:* **bare `section 8`** body-matched Utility Allowance
    schedules ("…utility allowances section 8 voucher holders…") and HUD program refs
    ("…hud section 8 moderate rehabilitation…") — **NOT** the `hap`/"perhaps" collision the
    old docs implied (that is independently neutralized by `kwHit`'s `\bhap\b` boundary —
    see the short-abbreviation note above). *Fix:* dropped bare `section 8`/`section8` + the
    redundant `hap`; keywords `['households with section 8','section 8 verif','tdhca section
    8','voucher verif']`. (`section8_verif_fp_regression.test.js`)
  - `unemployment` — *real cause (STRONG):* bare `unemployment` strong-matched the income-source
    enumeration on a Zero Income Cert / ICW ("…death benefits; unemployment or disability
    payments…", Herrera p24) and the Non-Employed Cert ("i do not receive unemployment
    compensation", p25); `unemployment benefit` matched the Application income grid. *Fix:*
    dropped both bare tokens; keywords `['unemployment benefits verification','unemployment
    verif','ui benefit']` + `allOf: ['unemployment','texas workforce commission']`.
    (`unemployment_fp_regression.test.js`)
  - `court_order` — *real cause (STRONG):* `court order`/`court ord` matched the Child Support /
    Alimony Cert prose ("there is a court ordered support agreement" / "there is no court order
    requiring support", Canizales p25 / Aldridge p26); the `court ord` stem also over-reached to
    "court ord**inance**". *Fix:* dropped both; keywords `['order in suit','order affecting the
    parent-child','it is ordered','ordered adjudged']` + `allOf: ['court order','it is ordered']`
    (re-admits a literally-titled "Court Order" only when the decree co-occurs).
    (`court_order_fp_regression.test.js`)
  - `tax_return` — *real cause (WEAK/latent):* bare `tax return` weak-matched IRS Form 4506
    consent language, the Application asset grid, and the joint-return eligibility question; bare
    `schedule c`/`1040` are short-token over-broad (`schedule c` hits "schedule cleaning", `1040`
    hits "$1040"). No strong live FP on the 3 files (tax_return not required on any), but the
    breadth would strong-mask a real gap on a self-employed/gig household (absent from the fixture
    set). *Fix:* keywords `['income tax return','form 1040','schedule c (form 1040)','profit or
    loss from business']`. (`tax_return_fp_regression.test.js`)
  Genuine detection for docs with no example in the 3-file set (CAD, P&L, section 8, court order,
  unemployment, tax return) is proven via **synthetic positive controls** in each test, since no
  real instance exists to assert against. (Root cause of the 2024 "out of order on an approved
  file" reports: these phantoms, not the order comparator and not `DOCS.order` — `order` matched
  `File Checklist.xlsx`.)
- **`student_eligibility` is a true positive, not an FP — but an open required-ness question.**
  Investigated during the 2026-06-22 pass after it surfaced in the checklist↔file crossCheck card
  on all three files. It correctly **strong-matches the genuine TDHCA "CERTIFICATION OF STUDENT
  ELIGIBILITY" form** on its real page (Herrera p21, Canizales p16, Aldridge p15) — `matchDoc` is
  behaving correctly; the keywords were left untouched. It appears in the crossCheck card only
  because the cert form is filed by essentially **every** household (each member certifies student
  status either way), while the checklist's conditional "student" checkbox is checked **only** for
  a qualifying student — so "present in file + box unchecked" is the normal state, not a misread.
  **Open question for a future required-ness/card phase:** should `student_eligibility` be a
  **baseline always-required doc** rather than `conditions: ['student']`? Not resolved here — just
  documented.
- **`isChecklistPage` divider phrase may not be invariant.** The skip rule for the
  "Income and/or Asset Verifications" divider keys on Bonner-Carrington-specific wording
  (`income and/or asset verifications`, `acceptable forms of verification`). Unconfirmed
  across other audit firms/formats — same caution as the template-phrase invariance notes;
  re-verify before onboarding a new property/format.
- **OCR is noisy.** Checkbox glyphs, displaced characters across two-column layouts, and
  low-DPI artifacts are expected. Matching must stay OCR-tolerant.
- **Security / privacy:** `_debug_ocr` in `/api/scan-checklist` returns raw OCR text
  (PII) — fine locally, a risk if ever networked. The new per-PDF OCR dump file is the
  same category of risk. `app.run(debug=True)` is for local dev only; never expose to a
  network.
- **Untested paths flagged earlier:** the `None`/manual-review locate path, deep
  checklists (>10 pages), and whether `early_exit=0.85` can false-positive on
  recert/transfer pages that echo template language.
- **Required-ness source (wired):** `isRequired(doc)` reads `state.required` — the
  questionnaire's declared set of doc ids — as the sole source of truth. It hard-fails
  (throws) on an empty/undefined set rather than silently falling back, since the startup
  gate makes the questionnaire mandatory; tests opt into the legacy condition-based logic
  via `isRequired(doc, { useConditionsFallback: true })`. `doc.conditions` is retained
  **not** because `isRequired` uses it, but because the checklist↔questionnaire audit's
  condition→doc mapping (`docsImpliedByChecklist`) and the checklist↔file `crossCheck`
  (`condSiblings`) still depend on it.
- **`conditions: []` means two different things on the two required-ness paths — caveat for
  the `clarification_record` floating doc.** On the **live** path, `isRequired(doc)` reads
  `state.required` (the questionnaire's set), so a doc the questionnaire never declares is
  never required — which is exactly why `clarification_record` is `conditions: []` and stays
  not-required in the app. But the **legacy** `isRequiredByConditions(doc)` treats an empty
  `conditions` array as **baseline-always-required** (`if (!doc.conditions || length === 0)
  return true`), the opposite. This is **benign today**: the only consumer of that path is the
  checklist↔file `crossCheck`, and its sole live direction (dir2) fires on `!required`, so a
  `conditions: []` doc is simply never surfaced there — and dir1 (which *would* mis-treat it as
  required-but-missing) is dormant. **Worth surfacing in case dir1 is ever revived:** a revived
  dir1 would treat `clarification_record` as a required doc and could flag it missing on files
  that lack a clarification record. If that revival happens, give the floating doc a
  never-satisfied sentinel condition instead of `[]`.
- **Two advisory cards — RESOLVED (2026-06-22, commit `f82523c`).** Results still render BOTH
  the checklist↔file `crossCheck` card and the `auditChecklistVsQuestionnaire` card, but
  `crossCheck` was **consolidated to its dir2 direction only** ("a document is physically
  present in the file but the checklist marks it not-required"). dir1 ("checklist-required,
  zero file trace") is **retired dormant** — gated behind an in-function
  `CROSSCHECK_DIR1_ENABLED = false` (flag-gated, *not* deleted, so a future edge case can
  revive it; `crosscheck_regression.test.js` asserts it stays dormant so an accidental
  re-enable is caught). *Why keep dir2 and not just delete the whole card:* dir2 is the only
  signal with an **independent file-evidence axis** — it catches a present document that BOTH
  the checklist box and the questionnaire missed. Concrete justification: on Aldridge, a
  genuine **Attorney General payment-history** doc (p27) is present, but neither the checklist
  (no court-order box) nor the questionnaire (no court order declared) marks it required, so
  the checklist↔questionnaire audit stays silent — only dir2 surfaces it. No comparison of the
  two human *declarations* (checklist vs. questionnaire) could ever produce that signal. *Why
  retire dir1:* with the questionnaire now the source of required-ness, dir1's "required per
  the **checklist**" basis is superseded by `auditChecklistVsQuestionnaire`'s dirB (required
  per the questionnaire but checklist box unchecked); dir1 never fired on the real fixtures.
  The stale inline "no longer rendered" comment is also fixed — the card **is** rendered, now
  dir2-scoped.

## Working conventions
- **Minimal change first.** Prefer the smallest fix that addresses the root cause;
  preserve the existing weak/strong + `allOf` matching design.
- **Be concise and technically rigorous.** No filler.
- **Add a regression test** with any matching/detection fix, using real OCR fixtures.
- **Show the diff** and call out anything that needs human verification rather than
  silently guessing (e.g. whether a phrase is invariant across all audit firms).
