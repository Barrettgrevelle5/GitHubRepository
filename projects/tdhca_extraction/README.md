# TDHCA Extraction Manual Workflow

## Folder Setup

Put the current PDF here:

`source_pdfs/active/`

Put the human aggregator workbook here:

`ground_truth/`

Generated extraction files go here:

`agent_output/`

Validation reports go here:

`validation/`

Manual notes go here:

`validation_notes/`

## Running One PDF

Open:

`scripts/manual_run.py`

Change:

```python
PDF_PATH = "/full/path/to/current/pdf.pdf"
APP_NUMBER_FOR_VALIDATION = "24076"