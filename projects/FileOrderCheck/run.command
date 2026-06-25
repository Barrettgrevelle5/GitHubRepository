#!/bin/bash
# BC File Checker (FileOrderCheck) — Start the tool
# Double-click this file to open the File Checker in your browser.
#
# Before launching, this checks that everything the tool needs is installed:
#   Python 3, the Python packages, the Tesseract OCR engine, and Poppler's
#   PDF tools. If anything is missing it prints plain-English instructions and
#   stops WITHOUT starting the app, so an office user can see exactly what an
#   admin needs to install. The one-time installer that fixes all of these is
#   setup.command (in this same folder).

cd "$(dirname "$0")"

# Add Homebrew to PATH (needed on Apple Silicon Macs) so brew-installed
# tesseract / poppler are found even from a double-clicked Finder launch.
eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || true
eval "$(/usr/local/bin/brew shellenv)" 2>/dev/null || true

missing=0
report_missing() {
  # $1 = human-readable name of what's missing, $2 = how to fix it
  echo "  ✗ MISSING: $1"
  echo "      Fix:    $2"
  missing=1
}

echo ""
echo "Checking that everything FileOrderCheck needs is installed..."
echo ""

# 1) Python 3 — runs the local app.
if command -v python3 &>/dev/null; then
  echo "  ✓ Python 3"
else
  report_missing "Python 3" \
    "Double-click setup.command in this folder, or install Python 3 from python.org."
fi

# 2) Python packages — flask (web server), pytesseract + pdf2image + Pillow
#    (OCR/PDF), rapidfuzz (checklist matching). Import them exactly as app.py does.
if command -v python3 &>/dev/null \
   && python3 -c "import flask, pytesseract, pdf2image, PIL, rapidfuzz" 2>/dev/null; then
  echo "  ✓ Python packages (flask, pytesseract, pdf2image, Pillow, rapidfuzz)"
else
  report_missing "Python packages (flask, pytesseract, pdf2image, Pillow, rapidfuzz)" \
    "Double-click setup.command, or run: pip3 install -r requirements.txt"
fi

# 3) Tesseract — the OCR engine that reads text off the scanned PDF pages.
if command -v tesseract &>/dev/null; then
  echo "  ✓ Tesseract OCR engine"
else
  report_missing "Tesseract OCR engine (reads text from scanned PDFs)" \
    "Double-click setup.command, or run: brew install tesseract"
fi

# 4) Poppler — pdf2image shells out to pdftoppm/pdftocairo to rasterize PDF pages.
#    Either tool is sufficient, so accept whichever is present.
if command -v pdftoppm &>/dev/null || command -v pdftocairo &>/dev/null; then
  echo "  ✓ Poppler PDF tools (pdftoppm / pdftocairo)"
else
  report_missing "Poppler PDF tools (pdftoppm / pdftocairo — turn PDF pages into images)" \
    "Double-click setup.command, or run: brew install poppler"
fi

echo ""

if [ "$missing" -ne 0 ]; then
  echo "FileOrderCheck cannot start until the items marked ✗ above are installed."
  echo "The easiest fix is to double-click  setup.command  in this same folder,"
  echo "then double-click  run.command  again."
  echo ""
  read -rp "Press Enter to close this window..."
  exit 1
fi

# Don't start a second copy if FileOrderCheck is already running. A duplicate
# `python3 app.py` can't bind 127.0.0.1:5050 and would dump a confusing traceback.
# If the port is already being served, just reopen the browser to the running
# instance. (lsof-guarded so a Mac without lsof simply falls through and launches.)
if command -v lsof &>/dev/null && lsof -nP -iTCP:5050 -sTCP:LISTEN &>/dev/null; then
  echo "FileOrderCheck is already running — opening it in your browser."
  command -v open &>/dev/null && open "http://127.0.0.1:5050"
  echo ""
  read -rp "Press Enter to close this window..."
  exit 0
fi

echo "All requirements found. Starting FileOrderCheck..."
echo "Your browser will open to http://127.0.0.1:5050 (the questionnaire shows first)."
echo "Everything stays on this Mac — no files are sent anywhere."
echo "When you are done, close this window to stop the tool."
echo ""

python3 app.py
