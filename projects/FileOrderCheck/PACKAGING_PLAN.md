# FileOrderCheck — macOS App Packaging Plan

This documents the path from the current folder/launcher distribution to a true
double-clickable `FileOrderCheck.app`, so office users never touch Terminal.

## DECISION (2026-06-23) — fully bundled `.app`, not Homebrew-hybrid
The Homebrew-hybrid `.app` (rely on a one-time Homebrew/Tesseract/Poppler install)
is **rejected as the office-user path**: coworkers must not install Homebrew,
Python, Tesseract, Poppler, or use Terminal. The target is a **fully bundled**
`FileOrderCheck.app` that ships Python, the Python packages, the served HTML, and
the Tesseract + Poppler native binaries + tessdata inside the bundle.

**A working fully-bundled prototype now exists** (see "Prototype results" below).
The folder/zip path (`make_release.command` / `setup.command` / `run.command`)
remains intact as a fallback and is unaffected.

## Where we are now
- `make_release.command` ships a 6-file folder: `app.py`,
  `File Checklist Validator.html`, `requirements.txt`, `setup.command`,
  `run.command`, `OFFICE_INSTALL.md`.
- `setup.command` installs **Homebrew → Tesseract + Poppler**, then the Python
  packages via `python3 -m pip`.
- `run.command` checks deps, then `python3 app.py` (Flask on `127.0.0.1:5050`,
  opens a browser tab; the HTML renders the questionnaire first).
- Local-only by mandate: PDFs, OCR text, and the `ocr_debug/` dumps may contain
  PII and must never leave the machine.

## What a Mac app has to solve (independent of option)
These are the load-bearing facts that shape both options:

1. **Resource path under a frozen bundle.** `app.py:21` sets
   `BASE_DIR = os.path.dirname(os.path.abspath(__file__))` and `app.py:27` serves
   the HTML from it. Inside a PyInstaller bundle, `__file__` resolves into the
   app's bundled-resource area (`sys._MEIPASS`), **not** a folder the user can see.
   The HTML must be bundled as a data file and located via `sys._MEIPASS` when
   `getattr(sys, "frozen", False)` is true.
2. **PII write location.** `app.py:85` writes `ocr_debug/` next to `BASE_DIR`.
   Inside a `.app` that path is **read-only / ephemeral** (and wrong). PII output
   must move to a user-writable, **non-cloud-synced** location (see PII section).
3. **No Werkzeug reloader in a frozen app.** `app.py:532` runs `debug=True`, which
   enables the reloader. The reloader re-execs the interpreter — inside a `.app`
   that relaunches the whole bundle. Frozen mode must run `debug=False,
   use_reloader=False`.
4. **Native binaries are not Python.** `pytesseract` shells out to the `tesseract`
   binary; `pdf2image` shells out to `pdftoppm`/`pdftocairo` (Poppler). PyInstaller
   bundles **Python** and Python wheels, **not** these native CLIs or their dylib
   closures and data files. This is the single biggest packaging problem and the
   main fork between "fully Terminal-free" and "hybrid."
5. **Gatekeeper.** An unsigned, un-notarized `.app` emailed/zipped to another Mac
   carries `com.apple.quarantine` and is blocked on first launch.

> **Note on the "don't touch app.py" constraint.** Items 1–3 require small,
> **mechanical** changes to `app.py` (resource-path resolution, debug-dump
> directory, and the frozen-mode `app.run` flags). They do **not** touch
> compliance logic, OCR logic, `DOCS[]`, `matchDoc`, `isRequired`,
> `walkQuestionnaire`, checklist parsing, tests, or the oracle. They are
> deployment plumbing. **They still need Barrett's explicit sign-off before any
> implementation pass**, because the standing rule is "don't change app behavior."
> The cleanest way to minimize even these: add a thin frozen-mode entrypoint
> (`launch.py` / `main_app.py`) that sets the resource base, PII dir, and run
> flags, and imports the Flask `app` object — leaving `app.py`'s `__main__`
> (dev path) untouched. Recommended.

---

## Option 1 — PyInstaller `.app` that starts Flask + opens the browser

The app boots the existing Flask server and opens the user's default browser to
`http://127.0.0.1:5050`, exactly like `run.command` does today — just without
Terminal or a separate Python install.

| Question | Answer |
|---|---|
| **Files/scripts needed** | `FileOrderCheck.spec` (PyInstaller spec: `datas` for the HTML, `binaries`/`datas` for Tesseract+Poppler if bundling, `hiddenimports` as needed, a `BUNDLE` block for the `.app`); a thin frozen entrypoint `launch.py`; a maintainer `build_app.command`; optional `FileOrderCheck.icns`; an entitlements plist if signing. |
| **Must `app.py` change?** | **Minimally, yes** — resource path (item 1), PII dir (item 2), frozen `app.run` flags (item 3). Best done in `launch.py` so `app.py` proper is barely touched. None of it is compliance/OCR/detection logic. |
| **How the HTML is bundled** | Added to the spec's `datas`; at runtime, when frozen, serve it from `sys._MEIPASS` instead of `BASE_DIR`. It's self-contained (no external CSS/JS/assets), so nothing else front-end needs bundling. |
| **Tesseract & Poppler** | Two sub-paths: **(A, hybrid)** keep them Homebrew-installed; the app finds them on `PATH` (set `pytesseract.pytesseract.tesseract_cmd` / pass `poppler_path`). Simple, but still needs a one-time dep install. **(B, full)** bundle the `tesseract` and `pdftoppm`/`pdftocairo` binaries **plus** their dylib closure (libpoppler, freetype, fontconfig, jpeg, png, …), Tesseract's `tessdata` (`eng.traineddata`, via `TESSDATA_PREFIX`), and a fontconfig config. Fully Terminal-free but high effort and the main risk area. |
| **Can Python packages be bundled?** | **Yes.** flask, pdf2image (pure Python), pytesseract (pure Python), Pillow and rapidfuzz (compiled wheels) all bundle via PyInstaller's standard hooks. The Python side is the easy part. |
| **Homebrew still needed?** | Sub-path A: **yes** (for Tesseract/Poppler only; Python no longer needed). Sub-path B: **no**. |
| **PII/debug folders** | Relocate `ocr_debug/` (and any OCR `.txt` dumps) to `~/Library/Application Support/FileOrderCheck/` — user-writable, **not** iCloud-synced. Avoid `~/Documents` and `~/Desktop` (Desktop & Documents iCloud sync could exfiltrate PII off-device). The `.gitignore` no longer protects these (the `.app` isn't a repo), so document local-only handling for the new path. |
| **Gatekeeper/signing** | Unsigned ⇒ blocked on first open on each Mac. On older macOS, right-click → **Open** bypasses once; on macOS 15 (Sequoia) the user must go to **System Settings → Privacy & Security → Open Anyway**. Real fix: **Apple Developer ID signing ($99/yr) + notarization + staple**; with bundled native binaries (sub-path B) **every embedded binary/dylib must be signed** under the hardened runtime. |
| **Risks / failure points** | Poppler dylib closure + fontconfig (sub-path B) is fragile; arch mismatch (arm64 vs x86_64 — Homebrew deps are arch-specific, universal2 is hard); reloader/subprocess behavior if item 3 is missed; `tessdata`/`TESSDATA_PREFIX` not found ⇒ OCR returns empty; antivirus/quarantine on emailed zips; app size grows (Poppler + tessdata are tens of MB). |

---

## Option 2 — PyInstaller + **pywebview** native window

Same Flask backend, but the UI is hosted in a native macOS window (WKWebView)
instead of a browser tab. Closing the window quits the app.

| Question | Answer |
|---|---|
| **Files/scripts needed** | Everything in Option 1, **plus** a `main_webview.py` entrypoint (start Flask in a background thread, then `webview.create_window("FileOrderCheck", "http://127.0.0.1:5050")` / `webview.start()`), and build-time deps **pywebview + pyobjc**. |
| **Must `app.py` change?** | The Flask app itself: **no**. But the external `webbrowser.open` (`app.py:516-519`) must be **suppressed** in webview mode (we don't want a browser tab *and* a window). Cleanest: don't run `app.py`'s `__main__`; `main_webview.py` imports the `app` object and serves it, so `app.py` stays untouched. |
| **How the HTML is bundled** | Identical to Option 1 (served by Flask over localhost; WKWebView just points at `127.0.0.1:5050`). No change to how the HTML is packaged. |
| **Tesseract & Poppler** | Identical to Option 1 (A hybrid / B full). Unaffected by the UI choice. |
| **Can Python packages be bundled?** | Yes — same as Option 1, plus **pyobjc**, which is heavier and occasionally finicky to bundle (PyInstaller has pywebview/pyobjc hooks, but it's more surface area). |
| **Homebrew still needed?** | Same as Option 1 (depends on A vs B). |
| **PII/debug folders** | Same as Option 1 — `~/Library/Application Support/FileOrderCheck/`. |
| **Gatekeeper/signing** | Same as Option 1, with a slightly larger binary to sign/notarize (pyobjc/WKWebView). |
| **Risks / failure points** | All of Option 1's, **plus WKWebView behavioral unknowns specific to THIS app**: (a) **drag-and-drop of a PDF** into the page — WKWebView does not allow file drops by default; needs explicit config, and may simply not work. (b) **file-picker** `<input type=file>` — generally works in WKWebView but must be verified. (c) **SSE / `EventSource`** — `/api/ocr` streams progress; WKWebView supports `EventSource`, but the OCR progress stream must be tested end-to-end. (d) pyobjc bundling/signing weight. The nicer end-state UX, but more ways to break, and the breakage hits the app's core upload interaction. |

---

## PII handling (applies to both options) — important
- New writable location: **`~/Library/Application Support/FileOrderCheck/`** (create on first run). Local, per-user, not cloud-synced by default.
- **Do not** default PII output to `~/Documents` or `~/Desktop` — both can be
  iCloud-synced, which would copy applicant PII off the machine. This is a net
  **privacy improvement** opportunity over today's "next to the binary" dump.
- Keep `app.run(host='127.0.0.1')` (localhost-only) — never bind `0.0.0.0`.
- Document that the new PII folder is the user's responsibility to clear; it is no
  longer covered by the repo `.gitignore`.

## Gatekeeper / distribution reality
- **Cheapest, no-cost path:** unsigned `.app` + a one-time **right-click → Open**
  (or Settings → Privacy & Security → Open Anyway on Sequoia). Acceptable for a
  handful of known office Macs; document it with screenshots.
- **Proper path:** Apple Developer ID ($99/yr) → `codesign` (hardened runtime,
  all embedded binaries) → `notarytool` submit → `stapler staple`. Removes the
  warning entirely. Required if this goes beyond a few trusted machines.

---

## Recommendation — implementation path

**Option 1 (Flask + browser), fully bundled. Built and working. Defer Option 2.**

Per the DECISION above, the Homebrew-hybrid intermediate step is **skipped as a
user-facing goal** — the prototype goes straight to a fully self-contained bundle:

1. **Fully bundled `.app` (DONE, prototype).** `launch.py` + `FileOrderCheck.spec`
   + `build_app.command` bundle Python, the Python packages, the HTML, and the
   Tesseract + Poppler binaries (with dylib closure) + tessdata. `launch.py` points
   `pytesseract`/`pdf2image`/`TESSDATA_PREFIX` at the bundled copies. No Homebrew at
   runtime. See "Prototype results."
2. **Then Option 2 (pywebview)** as a later UX polish pass — only after PDF
   **drag-drop**, **file-picker**, and **SSE OCR progress** are verified in
   WKWebView. If any misbehave, the browser-tab model stays the safer shipping
   choice. pywebview adds pyobjc bundling + WebKit risk on top of the (now-solved)
   native-binary problem.
3. **Signing/notarization** is the final polish (see Gatekeeper) — **not** required
   for this prototype, which ships unsigned.

## Prototype results (2026-06-23, this machine)
Built `dist/FileOrderCheck.app` via `build_app.command` (PyInstaller 6.21.0,
Python 3.14.5, arm64). Validated:

- **Self-contained native closure.** 51 bundled Mach-O files scanned → **0**
  `/opt/homebrew` or `/usr/local` references. Bundled `tesseract` / `pdfinfo` /
  `pdftoppm` / `pdftocairo` run under `PATH=/usr/bin:/bin`. Dylibs (libpoppler,
  libtesseract, libleptonica, liblcms2, libfreetype, libfontconfig, …) are bundled
  and load paths rewritten to `@rpath`.
- **App boots homebrew-free.** Launched with a Homebrew-free PATH → Flask serves
  `127.0.0.1:5050`, the served HTML contains `renderQuestionnaire`/`walkQuestionnaire`
  (questionnaire shows first), and the log shows **`Debug mode: off`** (frozen ⇒
  `debug=False`, `use_reloader=False`).
- **End-to-end OCR works.** A synthetic test PDF through `/api/ocr` returned the
  correct text via the bundled Tesseract+Poppler+tessdata, and the PII debug dump
  was written to **`~/Library/Application Support/FileOrderCheck/ocr_debug/`** — not
  inside the read-only bundle.

### Build/runtime gotchas found (and fixed/where to watch)
- **`pdfinfo` is required, not just `pdftoppm`.** `pdf2image` calls `pdfinfo` for the
  page count; omitting it yields a misleading *"Is poppler installed and in PATH?"*
  error. Now bundled (fixed in the spec).
- **`TMPDIR` must be set.** `pdf2image`/`pytesseract` use `tempfile`. A real macOS
  GUI double-click always sets `TMPDIR`; only a hard-stripped env (`env -i` with no
  `TMPDIR`) breaks OCR. Not a packaging defect, but worth knowing for any headless
  re-test.
- **No window = no obvious quit (addressed).** `console=False` gives a clean
  double-click with no Terminal, but the browser-tab model leaves no window to close;
  closing the tab leaves the Flask server running headless. A **frozen-only,
  loopback-only Quit control** now addresses this: a small "Quit FileOrderCheck"
  button is injected into the served page in frozen mode and POSTs to a `/shutdown`
  route (127.0.0.1 only, 404 in dev) that exits the process. Option 2 (pywebview)
  would still be the cleaner long-term answer (a real window whose close quits).

### App lifecycle UX (audited 2026-06-23)
- **First launch:** browser opens reliably to `127.0.0.1:5050`, questionnaire first.
- **Second double-click while running:** macOS LaunchServices reactivates the single
  instance — **no duplicate process and no port-bind crash** — but nothing visible
  happens (the existing tab isn't refocused, no new tab). Minor rough edge; a clean
  refocus would need an AppKit reopen handler (pyobjc / Option 2), so it's left as-is.
- **Quit:** previously only SIGTERM via Activity Monitor / Force Quit worked (the
  process runs Flask, not an NSApplication loop, so the Dock icon is unresponsive to
  AppleScript `quit`). The new in-page Quit button is the supported user path.
- **Silent launch failure when port 5050 is busy (FIXED 2026-06-23).** If 5050 was
  already in use (a stale/duplicate instance, or another program), `app.run` raised
  "Address already in use" and the process exited — but under `console=False` that
  traceback is invisible (not even in the unified log), so the user just saw "nothing
  loads / browser never opens". `launch.py` now (1) detects an already-serving port and,
  after **verifying via an HTTP GET that the marker `BC File Approval Checker` /
  `renderQuestionnaire` is present** (so an unrelated app on 5050 is never mistaken for
  us), reopens the existing FileOrderCheck instead of crashing on a duplicate bind; if
  the port is held by a **non-FileOrderCheck** service it does NOT open the browser to it
  but shows an `osascript` dialog ("another app is already using port 5050…") and exits,
  (2) gates the browser-open on the server actually being ready (PyInstaller cold start
  can exceed the old fixed 1.5 s sleep, so the tab used to open onto an unbound port),
  and (3) logs startup/failures to `~/Library/Application Support/FileOrderCheck/launch.log`
  so a frozen-app failure is diagnosable instead of silent. We deliberately do **not**
  fall back to an alternate port — `app.py`, the UI, and the docs all assume
  `127.0.0.1:5050`. `app.py` and dev behavior are unchanged.

## What still might fail on another Mac
- **Architecture.** Built for **arm64** (Apple Silicon). It will **not** run on an
  Intel Mac. A separate x86_64 build (or a universal2 build with universal native
  deps) is needed for Intel coworkers. Confirm the office hardware.
- **Gatekeeper / quarantine.** Unsigned; an emailed/zipped `.app` carries
  `com.apple.quarantine` and is blocked on first launch (right-click → Open, or
  Settings → Privacy & Security → Open Anyway). PyInstaller's ad-hoc `--deep` sign
  also warns on xattr "detritus" — harmless for the prototype, resolved by real
  signing later.
- **macOS version skew.** Bundled dylibs target the build OS; very old macOS on a
  coworker machine could mismatch. `LSMinimumSystemVersion` is set to 11.0 as a
  starting assumption — verify.
- **Fonts.** Poppler's text rendering uses fontconfig/freetype (bundled), but no
  fontconfig *config* is shipped; scanned-image PDFs (the real input) don't need
  embedded fonts, so this is low-risk but untested on heavily vector PDFs.

## Explicitly out of scope here
No PyInstaller run, no `.spec`, no `app.py` edits, no new dependencies installed —
this is the design only. Implementation waits on Barrett's go-ahead, including
sign-off on the three mechanical `app.py`/entrypoint changes called out above.
