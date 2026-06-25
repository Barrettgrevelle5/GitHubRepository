# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for the FULLY BUNDLED FileOrderCheck.app.
#
# Bundles everything an office Mac needs so users install nothing (no Homebrew,
# Python, Tesseract, Poppler, or pip):
#   - the served UI  (File Checklist Validator.html)
#   - the Tesseract OCR binary  (+ its dylib closure, collected by PyInstaller)
#   - Poppler's pdftoppm / pdftocairo  (+ dylib closure) for pdf2image
#   - Tesseract language data (tessdata/eng.traineddata)
#
# Native binaries are located on the BUILD machine via PATH / known Homebrew dirs.
# At RUNTIME, launch.py points pytesseract / pdf2image / TESSDATA_PREFIX at the
# bundled copies, so /opt/homebrew is never consulted on a coworker's Mac.
import os
import shutil

PROJECT_DIR = os.path.abspath(os.getcwd())


def _require(path, what):
    if not path or not os.path.exists(path):
        raise SystemExit(
            f"build error: could not find {what} ({path!r}). "
            f"Install it on this build machine (brew install tesseract poppler) and retry."
        )
    return path


# ── Locate native binaries on the build machine ─────────────────────────────
# pdf2image needs BOTH pdfinfo (page count) and pdftoppm/pdftocairo (rasterize);
# omitting pdfinfo yields a misleading "Is poppler installed and in PATH?" error.
tesseract_bin  = _require(shutil.which('tesseract'), 'tesseract binary')
pdfinfo_bin    = _require(shutil.which('pdfinfo'),   'pdfinfo binary (pdf2image page count)')
pdftoppm_bin   = _require(shutil.which('pdftoppm'),  'pdftoppm binary')
pdftocairo_bin = shutil.which('pdftocairo')  # optional second rasterizer

# ── Locate tessdata (must contain eng.traineddata) ──────────────────────────
tessdata_dir = os.environ.get('TESSDATA_PREFIX')
if not tessdata_dir or not os.path.exists(os.path.join(tessdata_dir, 'eng.traineddata')):
    for cand in ('/opt/homebrew/share/tessdata', '/usr/local/share/tessdata'):
        if os.path.exists(os.path.join(cand, 'eng.traineddata')):
            tessdata_dir = cand
            break
_require(os.path.join(tessdata_dir or '', 'eng.traineddata'), 'eng.traineddata (tessdata)')

# Native executables go to the bundle root (dest '.') so PyInstaller places their
# dylibs as siblings and rewrites load paths to find them.
binaries = [
    (tesseract_bin, '.'),
    (pdfinfo_bin, '.'),
    (pdftoppm_bin, '.'),
]
if pdftocairo_bin and os.path.exists(pdftocairo_bin):
    binaries.append((pdftocairo_bin, '.'))

datas = [
    (os.path.join(PROJECT_DIR, 'File Checklist Validator.html'), '.'),
    (tessdata_dir, 'tessdata'),
]

# app.py imports pytesseract/pdf2image/PIL lazily inside route functions; list them
# explicitly so PyInstaller definitely bundles them.
hiddenimports = ['app', 'flask', 'pytesseract', 'pdf2image', 'PIL', 'rapidfuzz']


a = Analysis(
    ['launch.py'],
    pathex=[PROJECT_DIR],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='FileOrderCheck',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,            # windowed .app — no Terminal window
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,         # build for the host arch (arm64 here)
    codesign_identity=None,   # unsigned prototype; signing/notarization is a later pass
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name='FileOrderCheck',
)

app = BUNDLE(
    coll,
    name='FileOrderCheck.app',
    icon=None,
    bundle_identifier='com.bonnercarrington.fileordercheck',
    info_plist={
        'CFBundleName': 'FileOrderCheck',
        'CFBundleDisplayName': 'FileOrderCheck',
        'NSHighResolutionCapable': True,
        'LSMinimumSystemVersion': '11.0',
    },
)
