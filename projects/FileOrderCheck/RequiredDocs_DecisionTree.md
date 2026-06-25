# FileOrderCheck — Required-Document Decision Tree (intake questionnaire)

**Purpose.** Replace the (sometimes-wrong) checklist cover page as the source of
required-ness. Before the PDF is uploaded, the property manager answers a short,
adaptive set of **boolean** questions. Each answer activates document requirements and
reveals the next relevant question. The file scan then audits the answers.

## How to read this
- Each node is a **yes/no question**. `Y →` and `N →` show where each answer goes.
- **`+DOC`** means "this answer adds that document to the required set."
- Nesting = the question is only asked if you reached it (adaptive flow).
- This is a draft scaffold. ⚠ marks rules I inferred from general LIHTC/TDHCA knowledge
  that you should confirm against the QAP / HUD 4350.3 / your firm's policy.

## Design principles (decide these before building)
1. **Boolean only.** Every question is a button, not a text box. Branch on the click.
2. **Adaptive, not a flat wall.** Only ask what's reachable. A manager who sees 40
   questions answers "no" to everything; a 6-deep relevant flow gets answered honestly.
3. **Conservative default = OVER-ask.** Any "Not sure / Maybe" button resolves toward
   *requiring* the doc ("required — verify"), never toward skipping it. Under-asking
   passes a non-compliant file; over-asking costs a reviewer a minute.
4. **Per-member loop.** Income/student/employment questions repeat **per household
   member**, not once per household. The flow asks "Add another household member?" and
   re-runs the person-level branch. (This is the single biggest structural point — most
   missed documents come from asking household-level when the truth is member-level.)
5. **Questionnaire declares; scan audits.** The answers produce the required set; the
   PDF scan produces the present set; contradictions get flagged (Task-3 pattern).

---

## SECTION 0 — Baseline (always required, no question asked)
These attach to every file regardless of answers:
- **+Application**
- **+Supplemental Application** ⚠ (confirm always-required vs program-specific)
- **+Household Certification**
- **+Tenant Income Certification (TIC)**
- **+Tenant Release and Consent**
- **+Tenant Rights and Resource Acknowledgment**
- **+Income Calculation Worksheet**
- **+Tenant Selection Plan** ⚠ (property-level doc — confirm it belongs in each tenant file)

---

## SECTION 1 — Program & subsidy
**Q1.1 — Which program funds this unit?**  *(this can be a 3-way button set, the one
non-boolean exception, OR three yes/no gates)*
- **HTC / LIHTC** → no extra baseline
- **BOND** → ⚠ confirm any bond-specific docs
- **HOME** → flag household for HOME-specific student rule (see Section 3)

**Q1.2 — Does the household hold a Section 8 / Housing Choice Voucher?**
- Y → **+Income Verification for Households with Section 8**
- N → continue

---

## SECTION 2 — Household composition
<!-- Q2.1 ("more than one adult?") removed 2026-06-18 (Bug 5): there is no Multiple Adult
     Household Certification in File Checklist.xlsx. Adult count adjusts the RIS income
     threshold (out of this tool's scope), it does not add a required document. -->

**Q2.2 — Are there any minor children (under 18) in the household?**
- Y → **+Minor Children — Birth Certificates / Custody Docs**
  - **Q2.2a — Is custody shared / contested / court-involved?**
    - Y → **+Court Order** (custody) ⚠ (or fold into the custody-docs requirement)
    - N → continue
- N → continue

**Q2.3 — Is any adult member married but separated, or is a spouse NOT on the lease?**
- Y → **+Marital Separation Certification**
- N → continue

**Q2.4 — Is there a live-in care attendant (a non-household aide who lives in the unit)?**
- Y → **+Live-in Care Attendant Affidavit** AND **+Live-in Attendant Verification**
  - (attendant income is excluded — these document that)
- N → continue

**Q2.5 — Does the unit / household qualify under a disability or special-needs set-aside,
or is special-needs status being claimed?**
- Y → **+Special Needs Certification**
- N → continue

**Q2.6 — Is any household member a non-U.S. citizen / non-eligible-immigration-status?**
⚠ (LIHTC generally has NO citizenship requirement; HOME and other layered subsidies may —
confirm whether this question even applies to your programs before including it.)
- Y → **+Immigration Status Documentation**
- N → continue

---

## SECTION 3 — Student status  *(ask per member, or "is ANY member a student?")*
**Q3.1 — Is any household member a full-time student (now or 5+ months this year)?**
- Y → **+Certification of Student Eligibility** AND **+Student Verification**
  - **Q3.1a — Is this a HOME-funded unit?** (carried from Q1.1)
    - Y → **+TDHCA HOME Student Eligibility Certification** ⚠
  - **Q3.1b — Does the student receive financial aid / scholarships / grants?**
    - Y → **+Student Financial Assistance Verification**
      - **Q3.1b-i — Does aid exceed tuition & required fees (excess counts as income)?** ⚠
        - Y → **+Documentation of Covered Costs**
        - N → continue
    - N → continue
  - ⚠ Note the full-time-student-household rule: a household of ALL full-time students is
    generally ineligible unless an exception applies (married/joint return, single parent,
    former foster, TANF, job-training). Consider a follow-up to capture which exception.
- N → continue

---

## SECTION 4 — Income (PER MEMBER LOOP — repeat for each adult)
Run this block for each adult member. "This member" = the person being asked about.
**Confirmed from form review:** Zero Income and Non-Employed are independent axes, not
alternatives. Zero Income Certification certifies *no income from any source whatsoever*
(wages, business, rental, interest/dividends, SS/pension, unemployment/disability, public
assistance, alimony/child support/gifts, self-employment, catch-all). Non-Employed
Certification certifies *current job status* specifically, and explicitly contemplates
income existing or arriving (its branches 2 and 3 disclose anticipated income or a
current job ending soon) — so a member can be non-employed with income, or have zero
income without the Non-Employed form ever being relevant. They are asked separately.

**Q4.1 — Does this member have ANY income of any kind (from any source)?**
- N → **+Certification of Zero Income**
  - → skip 4A/4B for this member, continue to Q4.1b
- Y → continue to 4A/4B (Q4.2 onward)

**Q4.1b — Is this member currently employed (working a job right now)?**
- N → **+Non-Employed Certification**
  - **Q4.1b-i — Which describes this member?** *(maps to the form's 3 checkboxes — pick
    one, not boolean, but kept here since it's a direct sub-branch)*
    - Not employed, no intent to seek work in the foreseeable future, no unemployment
      comp/benefits → form branch 1 (last employer/date only)
    - Not employed, but expects to become employed soon → form branch 2 → capture
      **anticipated income** and feed it into the **Income Calculation Worksheet**
      ⚠ (confirm: does anticipated income count toward current certification income, or
      only get re-verified at next recert?)
    - Currently employed but will be unemployed by move-in/certification → form branch 3
      → capture estimated last day + funding sources; ⚠ confirm this branch coexists with
      **+Employment Verification or Paystubs** for the still-active job rather than
      replacing it
- Y → continue (no Non-Employed form needed; proceed through 4A as normal)

If a member answers Y to Q4.1 (has income) and N to Q4.1b (not currently employed), both
**Certification of Zero Income is NOT required** (they have income) and **Non-Employed
Certification IS required** — e.g., someone living on Social Security or child support
alone. Continue to 4B for that member; skip 4A (no current employer to verify).

### 4A — Earned / employment income
**Q4.2 — Is this member employed by an employer (W-2 wages)?**
- Y → **+Employment Verification or Paystubs**
  - **Q4.2a — Is the employer a school / school district?**
    - Y → **+School Employee Questionnaire**
  - **Q4.2b — Does this job include tips and/or commissions?**
    - Y → **+Tips and Commissions Affidavit**
- N → continue

**Q4.3 — Does this member do gig / platform work (Uber, DoorDash, Instacart, etc.)?**
- Y → **+Gig Income Verification (Platform Printouts)**
- N → continue

**Q4.4 — Is this member self-employed / a business owner / 1099 contractor?**
- Y → **+Self-Employment Affidavit** AND **+Tax Return with Schedule C, E, or F** AND
  **+Profit and Loss Statement**
- N → continue

### 4B — Benefits / unearned income
**Q4.5 — Does this member receive Social Security, SSI, or SSDI?**
- Y → **+Social Security Verification (SSI / SSDI)**
- N → continue

**Q4.6 — Does this member receive a pension, retirement distribution, or annuity?**
- Y → **+Pension / Retirement Benefit Verification**
- N → continue

**Q4.7 — Does this member receive unemployment benefits?**
- Y → **+Unemployment Benefits Verification**
- N → continue

**Q4.8 — Does this member receive child support or alimony (or is entitled to it)?**
- Y → **+Child Support / Alimony Certification** AND **+Payment History or AG 9L001**
  - **Q4.8a — Is there a court order for the support?**
    - Y → **+Court Order**
    - N → continue  ⚠ (if no order, the certification covers non-receipt)
- N → continue

**Q4.9 — Does this member receive recurring monetary gifts / regular help from someone
outside the household?**
- Y → **+Recurring Gift Affidavit**
- N → continue

→ **Add another household member?** Y → repeat Section 4. N → Section 5.

---

## SECTION 5 — Assets  *(household-level)*
**Confirmed:** Asset Certification (under $50,000) is the self-cert ceiling — the $50k
figure governs, not the general $5,000 LIHTC convention. The two paths are mutually
exclusive: total assets ≤ $50,000 → self-certify on the Asset Certification form alone;
> $50,000 → bank statements / third-party verification only, no certification filed.

**Q5.0 — Are the household's total assets over $50,000?**
- N → **+Asset Certification (under $50,000)** only → skip to Q5.3
- Y → **+Bank Statement or Bank Verification** (covers all accounts; no certification
  form filed) → continue to Q5.1/Q5.2 to determine *which* third-party docs apply

**Q5.1 — Does the household have any bank/financial accounts (checking, savings, cash
beyond de minimis)?**
- Y → confirm Bank Statement or Bank Verification (already required if Q5.0 = Y; if
  Q5.0 = N this is informational only, covered by the certification)
- N → continue

**Q5.2 — Does any member own real property (a home, land, rental property)?**
- Y → **+Home Ownership Documents** AND **+County Appraisal Print Out**
  - **Q5.2a — Is the property mortgaged?**
    - Y → **+Mortgage Statement**
  - **Q5.2b — Is the property currently listed for sale?**
    - Y → **+Listing Contract**
  - **Q5.2c — Is the property rented out (produces rental income)?**
    - Y → **+Rental Payment Worksheet**
- N → continue

**Q5.3 — Has any member disposed of an asset for less than fair-market value in the last
2 years?** ⚠
- Y → asset-disposal handling (likely folds into Asset Certification) — confirm if a
  separate doc exists
- N → continue

---

## REVERSE INDEX — every document → its trigger (completeness check)
Use this to confirm all 44 are reachable and nothing is orphaned.

| # | Document | Triggered by |
|---|----------|--------------|
| 1 | Household Certification | Baseline |
| 2 | Tenant Income Certification (TIC) | Baseline |
| 3 | Tenant Release and Consent | Baseline |
| 4 | Tenant Rights and Resource Acknowledgment | Baseline |
| 5 | Application | Baseline |
| 6 | Supplemental Application | Baseline ⚠ |
| 7 | Live-in Care Attendant Affidavit | Q2.4 Y |
| 8 | Live-in Attendant Verification | Q2.4 Y |
| 9 | Marital Separation Certification | Q2.3 Y |
| 10 | Immigration Status Documentation | Q2.6 Y ⚠ |
| 11 | Minor Children — Birth Certs / Custody | Q2.2 Y |
| ~~12~~ | ~~Multiple Adult Household Certification~~ | removed 2026-06-18 (Bug 5) — not in checklist; affects RIS income threshold, not docs |
| 13 | Certification of Student Eligibility | Q3.1 Y |
| 14 | TDHCA HOME Student Eligibility Certification | Q3.1 Y + HOME (Q1.1) ⚠ |
| 15 | Student Verification | Q3.1 Y |
| 16 | Special Needs Certification | Q2.5 Y |
| 17 | Income Calculation Worksheet | Baseline |
| 18 | Income Verification for Households w/ Section 8 | Q1.2 Y |
| 19 | Certification of Zero Income | Q4.1 N (per member) |
| 20 | Non-Employed Certification | Q4.1b N (per member) |
| 21 | Unemployment Benefits Verification | Q4.7 Y |
| 22 | Employment Verification or Paystubs | Q4.2 Y |
| 23 | School Employee Questionnaire | Q4.2a Y |
| 24 | Gig Income Verification (Platform Printouts) | Q4.3 Y |
| 25 | Tips and Commissions Affidavit | Q4.2b Y |
| 26 | Social Security Verification (SSI / SSDI) | Q4.5 Y |
| 27 | Pension / Retirement Benefit Verification | Q4.6 Y |
| 28 | Recurring Gift Affidavit | Q4.9 Y |
| 29 | Self-Employment Affidavit | Q4.4 Y |
| 30 | Tax Return with Schedule C, E, or F | Q4.4 Y |
| 31 | Profit and Loss Statement | Q4.4 Y |
| 32 | Child Support / Alimony Certification | Q4.8 Y |
| 33 | Payment History or AG 9L001 | Q4.8 Y |
| 34 | Court Order | Q4.8a Y or Q2.2a Y |
| 35 | Student Financial Assistance Verification | Q3.1b Y |
| 36 | Documentation of Covered Costs | Q3.1b-i Y ⚠ |
| 37 | Home Ownership Documents | Q5.2 Y |
| 38 | County Appraisal Print Out | Q5.2 Y |
| 39 | Mortgage Statement | Q5.2a Y |
| 40 | Listing Contract | Q5.2b Y |
| 41 | Rental Payment Worksheet | Q5.2c Y |
| 42 | Asset Certification (under $50,000) | Q5.0 N |
| 43 | Bank Statement or Bank Verification | Q5.0 Y (mutually exclusive w/ #42) |
| 44 | Tenant Selection Plan | Baseline ⚠ |

---

## Open questions for your audit (the ⚠ items, collected)
1. **Baseline membership** — are Supplemental Application and Tenant Selection Plan truly
   always-in-file, or property/program-specific?
2. ~~Zero income vs. non-employed~~ — **RESOLVED.** Confirmed via form review: independent
   axes, not alternatives. Zero Income = no income from any source (form covers wages,
   business, rental, interest, SS/pension, unemployment, public assistance, support/gifts,
   self-employment, catch-all). Non-Employed = current job status, and its own branches
   explicitly contemplate anticipated or ending income. See Section 4 Q4.1/Q4.1b.
3. **Program splits** — what does BOND require that HTC doesn't? Is the HOME student
   cert (#14) the only HOME-specific add, or are there others?
4. **Immigration (#10)** — does any of your programs actually require citizenship/status
   docs, or should Q2.6 be dropped?
5. ~~Asset threshold~~ — **RESOLVED.** $50,000 is the self-cert ceiling (not the general
   $5,000 LIHTC convention). ≤ $50k → Asset Certification (under $50,000) only; > $50k →
   bank statements/third-party verification only. Mutually exclusive — see Section 5 Q5.0.
6. **Student-household exceptions** — do you need to capture the all-full-time-student
   eligibility exceptions as their own branch?
7. **Court order (#34)** — reused by custody (Q2.2a) and support (Q4.8a); confirm it's the
   same document/requirement in both.
8. **Anything missing entirely** — a scenario or document the 44-list doesn't cover yet.
9. ⚠ *(new, raised during Section 4 rework)* Does anticipated income from Non-Employed
   form branch 2 get counted in the current Income Calculation Worksheet, or only
   re-verified at the next recertification?
10. ⚠ *(new)* Non-Employed form branch 3 (currently employed, ending soon) — confirm this
    coexists with Employment Verification/Paystubs for the still-active job rather than
    replacing it.
