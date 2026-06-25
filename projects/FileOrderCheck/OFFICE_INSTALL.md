# FileOrderCheck — Office Install & Launch (macOS)

A plain-English setup guide for getting FileOrderCheck running for an office user
who does **not** use Terminal. FileOrderCheck is a **local-only** tool: it runs on
the user's own Mac, and **no PDFs or data ever leave the machine**.

This pass covers the simple **double-click launcher** path. A fully packaged,
signed installer is **not** done yet — see "Future packaging" at the bottom.

---

## What FileOrderCheck needs

It depends on four things. The one-time installer (`setup.command`) installs all
of them; you normally never install these by hand.

| Requirement | Why it's needed | Installed by |
|---|---|---|
| **Python 3** | runs the local app (`app.py`) | `setup.command` (or python.org) |
| **Python packages** — flask, pytesseract, pdf2image, Pillow, rapidfuzz | web server + OCR + checklist matching | `setup.command` → `pip3 install -r requirements.txt` |
| **Tesseract** | the OCR engine that reads text off scanned PDF pages | `setup.command` → `brew install tesseract` |
| **Poppler** (`pdftoppm` / `pdftocairo`) | turns PDF pages into images so they can be OCR'd | `setup.command` → `brew install poppler` |

Tesseract and Poppler are **native programs**, not Python packages — that detail
matters for packaging later (see below).

---

## First-time setup (once per Mac)

1. Open the FileOrderCheck folder in Finder.
2. **Double-click `setup.command`.**
   - A Terminal window opens and installs Homebrew (if needed), Tesseract,
     Poppler, and the Python packages.
   - You may be prompted for the Mac password once (Homebrew install).
   - At the end it **verifies all four requirements** and prints a checklist.
   - Wait until it says **"Setup complete!"**, then press Enter to close. If it
     instead says **"Setup did NOT fully complete,"** fix the items it marks `✗`
     (usually: no internet during install) and double-click `setup.command` again.
3. If macOS blocks the file with *"cannot be opened because it is from an
   unidentified developer,"* right-click `setup.command` → **Open** → **Open**
   (you only have to do this the first time).

> The same Gatekeeper right-click → **Open** trick applies to `run.command` the
> first time it's launched.

---

## Daily use

1. **Double-click `run.command`.**
2. It first checks that Python, the Python packages, Tesseract, and Poppler are
   all present:
   - If anything is missing, it prints a plain-English list of what to install
     and **does not start the app**. The fix is almost always: double-click
     `setup.command`, then double-click `run.command` again.
   - If everything is present, it starts the local app and your **browser opens
     automatically to `http://127.0.0.1:5050`**, showing the **questionnaire
     first** (the startup gate).
3. Fill out the questionnaire, then drop in the combined scanned PDF when prompted.
4. When finished, **close the Terminal window** to stop the tool.

> If FileOrderCheck is **already running** and you double-click the launcher again,
> it won't start a second copy — it just reopens the browser to the running
> instance. To fully stop the tool, close its Terminal window.

### Putting the launcher on the Desktop

`run.command` must stay **inside** the FileOrderCheck folder (it launches the app
that lives next to it). To get a Desktop double-click without moving it:

1. Right-click `run.command` → **Make Alias**.
2. Drag the new alias onto the Desktop (rename it e.g. **"FileOrderCheck"**).
3. Double-click that alias any time to launch.

Do **not** copy `run.command` itself to the Desktop — a copy would look for the
app in the wrong folder and fail. Use an **alias**.

---

## Privacy — everything stays local

- The app binds to `127.0.0.1` (this Mac only). It is not exposed to the office
  network or the internet.
- Applicant PDFs are OCR'd **on this machine**; nothing is uploaded.
- **These folders/files can contain applicant PII (SSNs, names, raw OCR text).
  Do not email, upload, or share them casually:**
  - `ocr_debug/` — per-PDF raw OCR text dumps (local debug aid)
  - `tests/reports/` — oracle/validation reports generated during testing
  - any `*.txt` OCR dump or `tests/ocr.log`
- These are already excluded from version control via `.gitignore`. Keep them on
  the local machine; delete them when no longer needed.

---

## How Barrett creates the office zip (maintainer only)

To send FileOrderCheck to an office user, build a clean release zip — never zip the
whole repo (it contains tests, oracle specs, real case files, and OCR dumps that
must not leave this machine).

1. In the project folder, **double-click `make_release.command`** (or run
   `./make_release.command`).
2. It builds, under `dist/`:
   - `dist/FileOrderCheck_<date>/` — a clean folder, and
   - `dist/FileOrderCheck_<date>.zip` — the same folder zipped.
3. It ships **only** what an office user needs: `app.py`,
   `File Checklist Validator.html`, `requirements.txt`, `setup.command`,
   `run.command`, and `OFFICE_INSTALL.md`. This is an **allowlist** — nothing else
   is copied. A safety scan then re-checks the staged folder and **aborts without
   producing a zip** if anything sensitive (`.git`, `tests/`, `ocr_debug/`,
   `CaseFiles_Compliance/`, `ComplianceForms/`, `*.xlsx`, `*.pdf`, `*.ocr.json`,
   `__pycache__`, etc.) somehow appears.
4. Send **`dist/FileOrderCheck_<date>.zip`** to the office user. They unzip it, run
   `setup.command` once, then use `run.command` (or a Desktop alias to it).

`dist/` is git-ignored, so generated releases are never committed. `make_release.command`
itself is a maintainer tool and is intentionally **not** included in the release.

---

## Future packaging (research notes — NOT implemented yet)

The current path still requires Homebrew/Terminal under the hood via
`setup.command`. The likely next steps toward a true "give them an app" install:

- **PyInstaller** — bundle `app.py` + the Python packages into a single
  double-clickable **`.app`** (macOS) / **`.exe`** (Windows). Removes the need for
  a separate Python install and `pip`.
- **pywebview wrapper** — instead of opening a browser tab, host the UI in a real
  native app window. Nicer for non-technical users; can be combined with
  PyInstaller.
- **Code signing / notarization** — required to avoid the Gatekeeper
  "unidentified developer" warning on macOS. Out of scope for this pass.

**Critical caveat for any of the above:** Tesseract and Poppler are **native
binary dependencies**, not Python code. PyInstaller will *not* automatically pull
them in. A real installer must either **bundle the `tesseract` and
`pdftoppm`/`pdftocairo` binaries** (plus Tesseract's language data) inside the
package and point the app at them, or install them as a prerequisite. This is the
main reason a packaged build is more than a one-line PyInstaller command, and why
it's deferred to a later pass.
