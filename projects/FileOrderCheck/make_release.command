#!/bin/bash
# FileOrderCheck — Build a clean office-distribution release (maintainer tool).
#
# Produces dist/FileOrderCheck_<date>/  (a clean folder) and a matching .zip that
# contain ONLY the files an office user needs to install and run the app.
#
# This is an ALLOWLIST build: nothing is copied unless it is named in RELEASE_FILES
# below, so development, test, oracle, and PII/scratch files cannot leak into a
# release even by accident. A post-build SAFETY SCAN then re-checks the staging
# folder and ABORTS (no zip produced) if any known-sensitive pattern is present.
#
# This script is for Barrett (the maintainer). It is NOT shipped to office users
# and is not part of the release itself.

set -euo pipefail
cd "$(dirname "$0")"

# ── The ONLY files that ship — everything an office user needs, nothing else ──
#   app.py                        - the local Flask server
#   File Checklist Validator.html - the served UI (self-contained, inline JS/CSS)
#   requirements.txt              - Python packages for setup.command
#   setup.command                 - one-time installer
#   run.command                   - daily launcher
#   OFFICE_INSTALL.md             - install / daily-use instructions
RELEASE_FILES=(
  "app.py"
  "File Checklist Validator.html"
  "requirements.txt"
  "setup.command"
  "run.command"
  "OFFICE_INSTALL.md"
)

STAMP="$(date +%Y%m%d)"
RELEASE_NAME="FileOrderCheck_${STAMP}"
DIST_DIR="dist"
STAGE="${DIST_DIR}/${RELEASE_NAME}"

echo ""
echo "Building office release: ${RELEASE_NAME}"
echo ""

# Start from a clean slate so a re-run never reuses stale staged files.
rm -rf "${STAGE}" "${DIST_DIR}/${RELEASE_NAME}.zip"
mkdir -p "${STAGE}"

# ── Copy ONLY the allowlisted files (abort if any is missing) ────────────────
for f in "${RELEASE_FILES[@]}"; do
  if [ ! -f "${f}" ]; then
    echo "ERROR: required release file is missing: ${f}" >&2
    echo "Aborting — not producing a partial release." >&2
    rm -rf "${STAGE}"
    exit 1
  fi
  cp -p "${f}" "${STAGE}/"
  echo "  + ${f}"
done

# Keep the launchers double-clickable inside the release.
chmod +x "${STAGE}/setup.command" "${STAGE}/run.command"

# ── Safety scan: refuse to ship anything sensitive ───────────────────────────
# Belt-and-suspenders over the allowlist: walk the staged tree and abort if any
# dev / oracle / PII / scratch pattern appears. Matches by file/dir name.
echo ""
echo "Safety scan..."
FORBIDDEN_NAMES=(
  ".git" ".gitignore" ".claude" "tests" "ocr_debug" "CaseFiles_Compliance"
  "ComplianceForms" "__pycache__" ".pytest_cache" ".DS_Store" "oldclaude.md"
  "CLAUDE.md" "TESTER.md" "RequiredDocs_DecisionTree.md" "make_release.command"
)
leak=0
while IFS= read -r path; do
  base="$(basename "$path")"
  # Pattern-based sensitive names (PII dumps, bytecode, office lock files, sheets).
  case "$base" in
    *.pyc|*.ocr.json|ocr.log|"~$"*|*.xlsx|*.pdf)
      echo "  ✗ LEAK: ${path}"; leak=1 ;;
  esac
  # Exact dev/oracle names.
  for bad in "${FORBIDDEN_NAMES[@]}"; do
    if [ "$base" = "$bad" ]; then echo "  ✗ LEAK: ${path}"; leak=1; fi
  done
done < <(find "${STAGE}" -mindepth 1)

if [ "${leak}" -ne 0 ]; then
  echo ""
  echo "ERROR: sensitive files found in the staging folder (see ✗ above)." >&2
  echo "Aborting — no zip produced." >&2
  rm -rf "${STAGE}"
  exit 1
fi
echo "  ✓ clean — only office-needed files present"

# ── Zip it ───────────────────────────────────────────────────────────────────
echo ""
( cd "${DIST_DIR}" && zip -r -X "${RELEASE_NAME}.zip" "${RELEASE_NAME}" >/dev/null )

echo "Built:"
echo "  folder: ${STAGE}/"
echo "  zip:    ${DIST_DIR}/${RELEASE_NAME}.zip"
echo ""
echo "Contents:"
( cd "${STAGE}" && find . -mindepth 1 | sed 's#^\./#  #' | sort )
echo ""
echo "Send the .zip to the office user. They unzip it, run setup.command once,"
echo "then use run.command (or a Desktop alias to it)."
echo ""

# If launched by double-click, keep the window open so the output is readable.
if [ -t 0 ]; then
  read -rp "Press Enter to close this window..."
fi
