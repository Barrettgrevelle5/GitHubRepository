# TDHCA UW Report Extraction — Agent Instructions

## Your Role

You extract structured data from TDHCA Underwriting Report PDFs and populate rows in an Excel aggregator. Each PDF is one deal. Each deal becomes one row.

## Before You Start

1. Read `field_mapping/TDHCA_26416_Mapping_and_Validation.xlsx` — Sheet 1 ("Field Mapping") is your schema
2. Understand the aggregator structure by reviewing `ground_truth/TDHCA_UW_Report_Aggregator.xlsx` — row 3 has column headers
3. Never write to `ground_truth/` — that folder is read-only reference

## Extraction Rules

### Where to Find Data in the PDF

The TDHCA UW Reports follow a consistent template. Key pages:

- **Page 1** (Application Summary): Application #, development name, city/county, region, area, population, set-aside, activity, program type, unit distribution, income distribution, pro forma indicators, cost summary, related parties
- **Page 2** (Capitalization): Debt sources, equity sources, cash flow debt/grants, deferred developer fee, bond reservation, conditions
- **Page 3** (Development Identification): Address, zip, building type, low-income election, analysis purpose, set-asides
- **Pages 7-8** (Site & Building): Building configuration, total NRA, site acreage, density, year constructed, scattered site, appraised value, flood zone
- **Page 10** (Operating Summary): NOI, debt service, net cash flow, DCR, breakeven occupancy, expense ratio, development cost evaluation
- **Pages 14-15** (Sources & Conclusions): Permanent sources detail, bond info, gap analysis, credit allocation, deferred developer fee amount
- **Page 16** (Unit Mix/Rent Schedule): Unit counts by bedroom and income level, LIHTC vs market rate units
- **Page 17** (Stabilized Pro Forma): All revenue lines, all expense lines with per-unit and per-SF breakdowns
- **Page 18** (Development Budget): Itemized costs — acquisition, site work, building cost, contingency, contractor fee, soft costs, financing, developer fee, reserves
- **Page 19** (Proposed Sources): Full debt/equity/grant detail with terms, rates, amounts

### Fields to Extract (Hardcoded — ~60 fields)

These come directly from the PDF. Enter the value as-is:

| Columns | Category |
|---------|----------|
| 2-19 | Identification (date, app#, name, developer, guarantor, contractor, lender, equity, city, county, region, area, population, set-aside, activity, 4%/9%, LIHTC units, market units) |
| 21-22 | Physical (total NRA SF, site acreage) |
| 24-25 | Site (year constructed, scattered site) |
| 26-32 | Financing (construction loan principal & rate, perm loan 1 term/amort/rate/principal, DCR) |
| 33-36 | Financing — Loan 2 (if exists; leave blank if not) |
| 38-43 | Sources (total soft sources, soft fund source name, equity price, total equity, income from operations, deferred developer fee) |
| 53-61 | Development costs (acquisition, site work, building cost, contingency, contractor fee, soft costs, financing costs, developer fee, reserves) |
| 83-85 | Revenue (potential gross rent, other income, vacancy/concessions) |
| 87-93 | Expenses (G&A bundle, management, payroll, R&M, utilities, insurance, property tax) |
| 95 | Replacement reserves |
| 98 | Hard debt service |

### Fields to SKIP (Formula — ~80 fields)

These are calculated by Excel formulas already in the aggregator. Do NOT populate:

- Column 20 (Total Units) — formula: LIHTC + Market
- Column 23 (Density) — formula: Units / Acres
- Column 37 (Total Debt) — formula
- Columns 44-52 (per-unit and PSF calculations) — formulas
- Column 62 (Total Development Cost) — formula: sum of cost components
- Columns 63-82 (per-unit and PSF cost breakdowns) — formulas
- Column 86 (EGI) — formula
- Columns 94, 96-97, 99 (operating subtotals/NOI/NCF) — formulas
- Columns 100-140 (all ratios, per-unit operating, % of EGI) — formulas

### Special Handling

**Column 17 (Program Type):**
- "FHTC (4% Credit)" → enter `0.04`
- "9% HTC" → enter `0.09`

**Column 84 (Other Income):**
- Sum these lines from the Pro Forma: Covered Parking & Garages + Storage + Fees & Miscellaneous

**Column 87 (G&A + Compliance bundle):**
- Sum these lines: General & Administrative + TDHCA Compliance Fees + Bond Trustee Fees + Utility Allowance Consultant Fees + Fees/Telephone/Internet/Cable

**Column 91 (Utilities):**
- Sum: Electric/Gas + Water, Sewer & Trash

**Column 85 (Vacancy):**
- Enter as a negative number

**Column 43 (Deferred Developer Fee):**
- Use the amount from the Conclusions section (page 15), NOT the total developer fee

**Column 93 (Property Taxes):**
- If the deal has a tax exemption (100% PILOT), enter `0` — this is correct

## Output Format

Write extracted data to `agent_output/` as an `.xlsx` file named by application number (e.g., `26416_extracted.xlsx`). The file should have:
- Row 1: Column headers (matching aggregator column names)
- Row 2: Extracted values

## Validation

After extracting, run `scripts/validate.py` to compare your output against `ground_truth/`. Review any mismatches before proceeding. Acceptable mismatches:
- Name variations ("RBC Capital Markets Corporation" vs "RBC Capital Markets")
- Whitespace differences ("Acquisition/Rehab" vs "Acquisition/ Rehab")
- Rounding differences under $10

Flag for human review:
- Dollar amount differences over $1,000
- Missing fields that should have data
- Any mismatch in unit counts or interest rates
