# TDHCA Extraction Agent

## Purpose

This repo extracts hardcoded TDHCA underwriting report values from PDFs into one-row Excel files, then validates the extracted row against the human-made aggregator workbook.

## Workflow

The user manually controls the run.

Main files:
- `scripts/extract.py` extracts values from a PDF and writes `agent_output/<app_number>_extracted.xlsx`.
- `scripts/validate.py` compares the extracted workbook against the ground-truth workbook in `ground_truth/`.
- `scripts/manual_run.py` is where the user manually changes the current PDF path and application number.

Do not run a full batch unless the user explicitly asks.

## Field Mapping

Use `field_mapping/column_map.md` as the source-of-truth column map.

Do not read files in `field_mapping/examples/` unless the user specifically asks to debug an example or compare against that example.

## Claude Role

Claude Code should not manually extract rows unless asked.

Claude Code should:
1. Read the validation report.
2. Identify which parser section caused the mismatch.
3. Fix the extraction logic in `scripts/extract.py`.
4. Re-run only the current PDF through `scripts/manual_run.py`.
5. Stop after producing or reviewing the validation result.

Do not hardcode app-specific values into `extract.py` unless creating an explicit temporary test case.

## Critical Extraction Rules

- If a PDF contains both an Addendum/Amendment Memo and a full Underwriting Report/Application Summary, extract from the full Underwriting Report/Application Summary unless the user explicitly asks for amendment values.
- When a table has Applicant / Prior Report / TDHCA or Underwritten columns, use TDHCA / Underwritten values unless the field explicitly says Applicant.
- LIHTC Units = sum of income-restricted AMI unit counts only. Do not include MR, EO, or market-rate rows.
- Market Units = MR/EO unit count only.
- Validate when possible: LIHTC Units + Market Units = Total Units.
- Acquisition Cost = the dollar total labeled Acquisition, Land Acquisition, or Acquisition Cost in the Development Cost Summary / Itemized Basis table.
- Do not use appraised value, land-as-vacant value, per-acre cost, per-unit cost, eligible basis, or adjusted basis as Acquisition Cost.
- Columns 83-98 are required extraction fields where listed. Do not skip them as formula columns.