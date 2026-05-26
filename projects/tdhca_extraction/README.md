# TDHCA Underwriting Report Extraction

Automated extraction of structured data from Texas Department of Housing and Community Affairs (TDHCA) Underwriting Report PDFs into a standardized Excel aggregator.

## What This Does

The TDHCA Real Estate Analysis Division publishes underwriting reports for housing tax credit (HTC) applications — typically 15-20 page PDFs per deal. Each report contains property identification, unit mix, financing structure, development costs, and pro forma projections.

This project extracts ~60 data fields from those PDFs and populates them into a single Excel aggregator spreadsheet, matching the format used by the office for manual entry.

## Folder Structure

```
tdhca_extraction/
├── source_pdfs/        → Raw UW Report PDFs downloaded from TDHCA
├── ground_truth/       → Office's manually completed aggregator (DO NOT MODIFY)
├── field_mapping/      → Column-to-PDF mapping and validation templates
├── agent_output/       → Agent-extracted rows (safe to delete and re-run)
├── validation/         → Comparison reports (agent vs ground truth)
└── scripts/            → Extraction, validation, and batch processing scripts
```

## Workflow

### Phase 1: Validate on Known Deals
1. Place a TDHCA UW Report PDF in `source_pdfs/`
2. Run `scripts/extract.py` to produce a row in `agent_output/`
3. Run `scripts/validate.py` to compare against `ground_truth/`
4. Review the diff report in `validation/`
5. Target: **95%+ field match rate** before moving to Phase 2

### Phase 2: Scale to New Deals
1. Place new PDFs (deals not yet in the aggregator) in `source_pdfs/`
2. Run `scripts/batch_extract.py` to process all new PDFs
3. Spot-check a sample of outputs manually
4. Append validated rows to the aggregator

## Key Files

| File | Purpose |
|------|---------|
| `ground_truth/TDHCA_UW_Report_Aggregator.xlsx` | Office's completed spreadsheet — the benchmark |
| `field_mapping/TDHCA_26416_Mapping_and_Validation.xlsx` | Maps each Excel column to its PDF source location |
| `scripts/extract.py` | Reads one PDF, outputs one extracted row |
| `scripts/validate.py` | Diffs agent output against ground truth |

## Important Notes

- The aggregator file must be saved as `.xlsx` (not `.xlsb`) for Python compatibility
- ~80 of the 140 columns are Excel formulas — only ~60 need to be extracted from the PDF
- The agent should never write to `ground_truth/`
- Common false mismatches: name truncation, whitespace differences, rounding
- Property tax is often $0 for deals with tax exemptions — this is correct, not missing data
