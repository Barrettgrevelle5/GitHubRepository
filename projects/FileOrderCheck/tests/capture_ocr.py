#!/usr/bin/env python3
"""Capture the APP's real OCR + checklist profile for a case-file PDF.

Faithful to the shipping app: reuses app.py's OCR DPI (200), locate_checklist_page,
and detect_checklist_profile — no reimplementation. Emits JSON:
  { pdf, pages, checklist_page, profile:{program,income,conditions}, pageTexts:[...] }
to tests/appanswers/<stem>.ocr.json so the Node step can run DOCS/matchDoc over it.
"""
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)

from pdf2image import convert_from_bytes
import pytesseract
import app as appmod  # the shipping backend — reuse its functions verbatim


def main(pdf_path):
    with open(pdf_path, 'rb') as fh:
        pdf_bytes = fh.read()

    # 1) OCR every page at the app's dpi (matches /api/ocr).
    images = convert_from_bytes(pdf_bytes, dpi=200)
    page_texts = []
    for i, img in enumerate(images):
        page_texts.append(pytesseract.image_to_string(img, lang='eng'))
        print(f"  ocr page {i+1}/{len(images)}", file=sys.stderr)

    # 2) Household profile via the app's checklist locate + dual-DPI parse
    #    (matches /api/scan-checklist).
    loc = appmod.locate_checklist_page(pdf_bytes)
    profile = {'program': None, 'income': [], 'conditions': []}
    checklist_page = None
    if loc['page_index'] is not None:
        p = loc['page_index'] + 1
        checklist_page = p
        imgs_200 = convert_from_bytes(pdf_bytes, dpi=200, first_page=p, last_page=p)
        imgs_250 = convert_from_bytes(pdf_bytes, dpi=250, first_page=p, last_page=p)
        t200 = pytesseract.image_to_string(imgs_200[0], lang='eng')
        t250 = pytesseract.image_to_string(imgs_250[0], lang='eng')
        p200 = appmod.detect_checklist_profile(t200)
        p250 = appmod.detect_checklist_profile(t250)
        profile = {
            'program':    p200['program'] or p250['program'],
            'income':     list(dict.fromkeys(p200['income'] + p250['income'])),
            'conditions': list(dict.fromkeys(p200['conditions'] + p250['conditions'])),
        }

    out = {
        'pdf': os.path.basename(pdf_path),
        'pages': len(page_texts),
        'checklist_page': checklist_page,
        'checklist_confidence': loc['confidence'],
        'profile': profile,
        'pageTexts': page_texts,
    }
    stem = os.path.splitext(os.path.basename(pdf_path))[0]
    out_path = os.path.join(BASE, 'tests', 'appanswers', stem + '.ocr.json')
    with open(out_path, 'w') as fh:
        json.dump(out, fh)
    print(out_path)


if __name__ == '__main__':
    main(sys.argv[1])
