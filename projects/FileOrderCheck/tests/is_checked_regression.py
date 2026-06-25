#!/usr/bin/env python3
"""Regression tests for app._is_checked (Feature A checkbox-state reader).

Covers the 2026-06-16 fix: a lone leading '0' is an empty box (unchecked), like
'O'/'o' — NOT a checked-box digit artifact. Guards the existing checked-digit
behavior ('2', '4') so the fix didn't over-broaden.
"""
import os, sys
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)
from app import _is_checked

passed = failed = 0
def check(cond, msg):
    global passed, failed
    if cond: passed += 1; print('  ✓', msg)
    else: failed += 1; print('  ✗', msg)

# The real Herrera p3 misread: empty box OCRs as '0' before the doc title.
check(_is_checked('0 Tips and Commissions Affidavit (If applicable)', ['Tips and Commissions Affidavit']) is False,
      "leading '0' => unchecked (Herrera '0 Tips' empty box)")
check(_is_checked('O Tips and Commissions Affidavit', ['Tips and Commissions Affidavit']) is False,
      "leading 'O' still unchecked")

# Checked-digit family must still register as checked (the reason isdigit exists).
check(_is_checked('2] Employment Verification', ['Employment Verification']) is True,
      "'2]' still checked (symbol rule)")
check(_is_checked('4 Employment Verification', ['Employment Verification']) is True,
      "lone '4' still checked (digit artifact)")

# Checked symbols and unchecked letter-box unchanged.
check(_is_checked('@ Special Needs Certification', ['Special Needs Certification']) is True,
      "'@' still checked")
check(_is_checked('o Special Needs Certification', ['Special Needs Certification']) is False,
      "'o' still unchecked")

# 2026-06-18 Bug 1: a lone leading '1' is an empty-box stroke / list number, NOT a
# checked-box fill. The real Herrera p3 misread that flagged marital_sep as required.
check(_is_checked('1 Maritial Separation Certification (if applicable)', ['Maritial Separation Certification']) is False,
      "lone '1' => unchecked (Herrera '1 Maritial Separation' empty box)")
check(_is_checked('1 Marital Separation Certification', ['Marital Separation Certification']) is False,
      "lone '1' => unchecked (correct spelling too)")
# Must NOT regress a multi-char checked glyph that merely ENDS in '1'.
check(_is_checked('21 Household Certification', ['Household Certification']) is True,
      "'21' still checked (Herrera p3 genuinely-checked Household Cert — only LONE '1' flips)")
# Other lone digits stay checked (the reason isdigit() exists); only '1' is the stroke.
check(_is_checked('2 Application', ['Application']) is True, "lone '2' still checked")
check(_is_checked('3 Certification of Zero Income', ['Certification of Zero Income']) is True,
      "lone '3' still checked")

# 2026-06-18 Bug 3a: an item with MULTIPLE distinct boxes is checked if ANY is checked.
# A found-but-unchecked first keyword must NOT mask a later checked keyword (the Herrera
# 'student' miss: 'Student Verification' unchecked at line-start masked the checked
# '4 Certification of Student Eligibility' two lines above).
HERRERA_STUDENT = ("4 Certification of Student Eligibility O Home Ownership Documents\n"
                   "TDHCA HOME Student Eligibility Certification (If HOME unit) County Appraisal\n"
                   "Student Verification O Mortgage Statement")
check(_is_checked(HERRERA_STUDENT, ['Student Verification', 'Certification of Student Eligibility']) is True,
      "student: unchecked 'Student Verification' no longer masks checked 'Certification of Student Eligibility'")
# OR must not over-broaden: if EVERY box is unchecked, still unchecked.
check(_is_checked("O Certification of Student Eligibility\nO Student Verification",
                  ['Student Verification', 'Certification of Student Eligibility']) is False,
      "student: both boxes unchecked => unchecked (OR did not over-broaden)")

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
