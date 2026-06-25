#!/bin/bash
# FileOrderCheck — Build the fully bundled macOS app (maintainer tool).
#
# Produces dist/FileOrderCheck.app, a double-clickable app that contains Python,
# the Python packages, the served HTML, and the Tesseract + Poppler native
# binaries and tessdata — so office users install NOTHING.
#
# This is for Barrett (the maintainer); it is not shipped to office users and is
# not part of the office zip (make_release.command).
#
# Requirements on the BUILD machine only: Python 3, PyInstaller, and Homebrew's
# tesseract + poppler (the binaries that get copied into the bundle).

set -euo pipefail
cd "$(dirname "$0")"

# Make Homebrew tesseract/poppler discoverable to the spec's shutil.which() lookups.
eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || true
eval "$(/usr/local/bin/brew shellenv)" 2>/dev/null || true

echo ""
echo "Checking build prerequisites..."
fail=0
need() { echo "  ✗ $1"; fail=1; }
command -v python3 >/dev/null || need "Python 3 not found"
python3 -m PyInstaller --version >/dev/null 2>&1 || need "PyInstaller not installed (python3 -m pip install pyinstaller)"
command -v tesseract >/dev/null || need "tesseract not found (brew install tesseract)"
command -v pdftoppm  >/dev/null || need "pdftoppm not found (brew install poppler)"
if [ "${fail}" -ne 0 ]; then
  echo ""
  echo "Fix the items above and re-run. (These are BUILD-machine requirements only;"
  echo "the resulting .app bundles them so office Macs need none of them.)"
  exit 1
fi
echo "  ✓ python3 / PyInstaller / tesseract / pdftoppm present"

echo ""
echo "Cleaning previous build..."
rm -rf build "dist/FileOrderCheck.app"

echo "Running PyInstaller (this can take a couple of minutes)..."
python3 -m PyInstaller --noconfirm --clean FileOrderCheck.spec

echo ""
if [ -d "dist/FileOrderCheck.app" ]; then
  echo "Built: dist/FileOrderCheck.app"
  echo ""
  echo "Bundled native pieces (quick check):"
  ls -1 "dist/FileOrderCheck.app/Contents/Frameworks/tesseract" 2>/dev/null && echo "  ✓ tesseract"
  ls -1 "dist/FileOrderCheck.app/Contents/Frameworks/pdfinfo"   2>/dev/null && echo "  ✓ pdfinfo"
  ls -1 "dist/FileOrderCheck.app/Contents/Frameworks/pdftoppm"  2>/dev/null && echo "  ✓ pdftoppm"
  ls -1 "dist/FileOrderCheck.app/Contents/Frameworks/File Checklist Validator.html" 2>/dev/null && echo "  ✓ served HTML"
  ls -1 "dist/FileOrderCheck.app/Contents/Frameworks/tessdata/eng.traineddata" 2>/dev/null && echo "  ✓ tessdata/eng.traineddata"
  echo ""
  echo "NOTE: this prototype is UNSIGNED. On another Mac, Gatekeeper will warn on"
  echo "first launch — right-click the app -> Open (or System Settings -> Privacy &"
  echo "Security -> Open Anyway). Signing/notarization is a later pass."
else
  echo "ERROR: build did not produce dist/FileOrderCheck.app" >&2
  exit 1
fi
