#!/usr/bin/env python3
"""Task 2: investigate the Special Needs FALSE NEGATIVE on Herrera p3.

Dumps the checklist-page OCR at both DPIs (200, 250) around 'Special Needs' and
'Maritial', and reports what _is_checked decides for each, so we can see whether
either DPI recovers the dropped glyph.
"""
import os, sys, re
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)
from pdf2image import convert_from_bytes
import pytesseract
import app as appmod

stem = 'CCSR 1302 Herrera FF'
pdf_path = os.path.join(BASE, 'CaseFiles_Compliance', stem + '.pdf')
pdf_bytes = open(pdf_path, 'rb').read()
loc = appmod.locate_checklist_page(pdf_bytes)
p = loc['page_index'] + 1
print(f"checklist page = p{p}\n")

for dpi in (150, 200, 250, 300):
    img = convert_from_bytes(pdf_bytes, dpi=dpi, first_page=p, last_page=p)[0]
    t = pytesseract.image_to_string(img, lang='eng')
    print(f"================ DPI {dpi} ================")
    for label in ('Special Needs', 'Maritial', 'Marital', 'Tips and Commission'):
        for m in re.finditer(re.escape(label), t, re.IGNORECASE):
            ls = t.rfind('\n', 0, m.start()); ls = ls + 1 if ls >= 0 else 0
            le = t.find('\n', m.start()); le = le if le >= 0 else len(t)
            line = t[ls:le]
            decided = appmod._is_checked(t, [re.escape(label)])
            print(f"  [{label}] checked={decided}  line={line!r}")
    print()
