#!/usr/bin/env python3
"""Task 1 verification gate: does adding '0' to the unchecked-box set change any
file's detected profile?

Faithful to capture_ocr.py: re-OCRs ONLY the located checklist page at dual DPI
(200+250) per file — not the whole document — then computes the profile with the
CURRENT _is_checked. Compares to the stored (old-logic) profile in the cached
.ocr.json. Also lists every checklist keyword line whose prefix ends in '0', since
those are the ONLY lines the change can flip.
"""
import json, os, sys
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)
from pdf2image import convert_from_bytes
import pytesseract
import app as appmod

PDF_DIR = os.path.join(BASE, 'CaseFiles_Compliance')
FILES = ['CCSR 1302 Herrera FF', 'CCSR 3102 Canizales FF', 'CCSR 3205 Aldridge Move In']

def profile_eq(a, b):
    return (a['program'] == b['program']
            and sorted(a['income']) == sorted(b['income'])
            and sorted(a['conditions']) == sorted(b['conditions']))

any_flip = False
for stem in FILES:
    cached = json.load(open(os.path.join(BASE, 'tests', 'appanswers', stem + '.ocr.json')))
    old = cached['profile']
    pdf_path = os.path.join(PDF_DIR, stem + '.pdf')
    with open(pdf_path, 'rb') as fh:
        pdf_bytes = fh.read()
    loc = appmod.locate_checklist_page(pdf_bytes)
    if loc['page_index'] is None:
        print(f"=== {stem}: no checklist page located")
        continue
    p = loc['page_index'] + 1
    t200 = pytesseract.image_to_string(convert_from_bytes(pdf_bytes, dpi=200, first_page=p, last_page=p)[0], lang='eng')
    t250 = pytesseract.image_to_string(convert_from_bytes(pdf_bytes, dpi=250, first_page=p, last_page=p)[0], lang='eng')
    p200 = appmod.detect_checklist_profile(t200)
    p250 = appmod.detect_checklist_profile(t250)
    new = {
        'program': p200['program'] or p250['program'],
        'income': list(dict.fromkeys(p200['income'] + p250['income'])),
        'conditions': list(dict.fromkeys(p200['conditions'] + p250['conditions'])),
    }
    same = profile_eq(old, new)
    if not same:
        any_flip = True
    print(f"=== {stem} (checklist p{p})  {'NO CHANGE' if same else '*** PROFILE CHANGED ***'}")
    print(f"    OLD: prog={old['program']} income={sorted(old['income'])} cond={sorted(old['conditions'])}")
    print(f"    NEW: prog={new['program']} income={sorted(new['income'])} cond={sorted(new['conditions'])}")
    # Lines ending in '0' before any text — the only lines the change can affect.
    for dpi, t in (('200', t200), ('250', t250)):
        for line in t.splitlines():
            s = line.rstrip()
            stripped = s.lstrip()
            if stripped[:1] == '0' and len(stripped) > 2 and stripped[1] in ' \t':
                print(f"    [dpi{dpi}] leading-0 line: {s!r}")

print()
print("RESULT:", "FAIL — a profile flipped, DO NOT SHIP" if any_flip
      else "PASS — no checked box on Aldridge/Canizales reads as '0'; change is safe")
sys.exit(1 if any_flip else 0)
