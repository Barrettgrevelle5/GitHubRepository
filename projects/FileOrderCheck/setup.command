#!/bin/bash
# BC File Checker — First-time setup
# Double-click this file to install everything needed.

cd "$(dirname "$0")"

echo ""
echo "========================================"
echo "  BC File Checker — Setup"
echo "========================================"
echo ""

# ── Check for Homebrew ───────────────────────────────────────────────────────
if ! command -v brew &>/dev/null; then
  echo "Installing Homebrew (you may be prompted for your Mac password)..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Add brew to PATH for Apple Silicon Macs
  eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || true
  eval "$(/usr/local/bin/brew shellenv)" 2>/dev/null || true
else
  echo "✓ Homebrew is already installed"
fi

echo ""

# Homebrew provides Tesseract and Poppler (both native programs). If Homebrew still
# isn't on PATH — the install was declined, or there was no network — skip the brew
# steps instead of spraying "command not found: brew" errors. The verification block
# at the end then reports Tesseract/Poppler as missing in plain English.
if command -v brew &>/dev/null; then
  # ── Install Tesseract OCR ──────────────────────────────────────────────────
  if ! command -v tesseract &>/dev/null; then
    echo "Installing Tesseract OCR..."
    brew install tesseract
  else
    echo "✓ Tesseract is already installed"
  fi

  # ── Install Poppler (needed to convert PDF pages to images) ────────────────
  if ! command -v pdftoppm &>/dev/null; then
    echo "Installing Poppler..."
    brew install poppler
  else
    echo "✓ Poppler is already installed"
  fi
else
  echo "⚠ Homebrew is not available, so Tesseract and Poppler can't be installed"
  echo "  automatically. Once Homebrew is installed, run setup.command again."
fi

echo ""

# ── Install Python packages ──────────────────────────────────────────────────
# Use `python3 -m pip` (NOT a bare `pip3`) so the packages land in the SAME
# interpreter that run.command / app.py use. On Macs with both system Python and
# Homebrew Python, a bare `pip3` can install into a different python3, and the app
# then fails to import them even though "pip" reported success.
echo "Installing Python packages..."
python3 -m pip install -r requirements.txt 2>/dev/null \
  || python3 -m pip install -r requirements.txt --break-system-packages

echo ""

# ── Verify everything actually installed ─────────────────────────────────────
# Re-check all four dependencies so "Setup complete!" only prints when the file is
# genuinely ready. A failed brew/pip step (e.g. no network) is reported here in
# plain English instead of surfacing later as an OCR crash mid-use.
problems=0
note_problem() { echo "  ✗ $1"; problems=1; }

echo "Verifying installation..."
if command -v python3 &>/dev/null; then echo "  ✓ Python 3"
  else note_problem "Python 3 is missing — install it from python.org, then run setup.command again."; fi
if python3 -c "import flask, pytesseract, pdf2image, PIL, rapidfuzz" 2>/dev/null; then echo "  ✓ Python packages"
  else note_problem "Python packages did not install — run setup.command again, or: python3 -m pip install -r requirements.txt"; fi
if command -v tesseract &>/dev/null; then echo "  ✓ Tesseract"
  else note_problem "Tesseract is missing — run setup.command again, or: brew install tesseract"; fi
if command -v pdftoppm &>/dev/null || command -v pdftocairo &>/dev/null; then echo "  ✓ Poppler"
  else note_problem "Poppler is missing — run setup.command again, or: brew install poppler"; fi

echo ""
echo "========================================"
if [ "$problems" -eq 0 ]; then
  echo "  Setup complete!"
  echo "  Double-click 'run.command' to start."
else
  echo "  Setup did NOT fully complete."
  echo "  Fix the items marked ✗ above, then run setup.command again."
fi
echo "========================================"
echo ""
read -rp "Press Enter to close this window..."
