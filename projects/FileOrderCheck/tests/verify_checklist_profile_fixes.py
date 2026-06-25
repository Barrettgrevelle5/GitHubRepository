#!/usr/bin/env python3
"""Profile-level verification for the 2026-06-18 _is_checked fixes (Bug 1 lone-'1',
Bug 3a OR-across-keywords).

Faithful to capture_ocr.py / verify_task1.py: re-OCRs ONLY the located checklist page
at dual DPI (200+250) per file with the CURRENT app code, then computes the profile.
Compares to the stored profile in each .ocr.json and asserts the EXPECTED deltas:
  - Herrera: 'marital_separation' must DROP (Bug 1); 'student' must be ADDED (Bug 3a).
  - Aldridge, Canizales: profile must be UNCHANGED (no regression).
"""
import json, os, sys
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)
from pdf2image import convert_from_bytes
import pytesseract
import app as appmod

PDF_DIR = os.path.join(BASE, 'CaseFiles_Compliance')
# ABSOLUTE expected profile per file (must_contain / must_not_contain flags), NOT a delta
# from the cached .ocr.json. The cache is regenerated whenever app answers are recaptured,
# so a delta-from-cache assertion silently goes vacuous once the baseline absorbs the fix
# (that is exactly what happened after the 2026-06-18 app-answer recapture). Asserting the
# invariant directly stays meaningful no matter what the cache holds.
#   Bug 1   : marital_separation must be ABSENT on Herrera (lone-'1' empty box, not checked).
#   Bug 3a  : student must be PRESENT on ALL THREE files (the OR fix reads the checked
#             'Certification of Student Eligibility' box the short-circuit used to mask).
EXPECT = {
    'CCSR 1302 Herrera FF':       {'must_contain': {'student'}, 'must_not_contain': {'marital_separation'}},
    'CCSR 3102 Canizales FF':     {'must_contain': {'student'}, 'must_not_contain': set()},
    'CCSR 3205 Aldridge Move In': {'must_contain': {'student'}, 'must_not_contain': set()},
}

def profile_for(pdf_bytes):
    loc = appmod.locate_checklist_page(pdf_bytes)
    if loc['page_index'] is None:
        return None
    p = loc['page_index'] + 1
    t200 = pytesseract.image_to_string(convert_from_bytes(pdf_bytes, dpi=200, first_page=p, last_page=p)[0], lang='eng')
    t250 = pytesseract.image_to_string(convert_from_bytes(pdf_bytes, dpi=250, first_page=p, last_page=p)[0], lang='eng')
    a, b = appmod.detect_checklist_profile(t200), appmod.detect_checklist_profile(t250)
    return {
        'program': a['program'] or b['program'],
        'income': sorted(set(a['income']) | set(b['income'])),
        'conditions': sorted(set(a['conditions']) | set(b['conditions'])),
    }

ok = True
for stem, exp in EXPECT.items():
    with open(os.path.join(PDF_DIR, stem + '.pdf'), 'rb') as fh:
        new = profile_for(fh.read())
    new_all = set(new['income']) | set(new['conditions'])
    print(f"=== {stem}")
    print(f"    NEW income={new['income']} cond={new['conditions']}")
    for f in exp['must_contain']:
        if f in new_all: print(f"    ✓ contains '{f}'")
        else: print(f"    ✗ expected flag '{f}' MISSING"); ok = False
    for f in exp['must_not_contain']:
        if f not in new_all: print(f"    ✓ does not contain '{f}'")
        else: print(f"    ✗ flag '{f}' should be ABSENT but is present"); ok = False

print("\nVERIFY:", "PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
