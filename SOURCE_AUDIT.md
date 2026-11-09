# Source Audit

- Input source package: user-provided `2_chatgpt.zip` and the subsequent `CCD_Message_Centre_Update_2026-11-04.zip` source update.
- The source package was unpacked and the complete frontend plus `Code.gs` were used as the implementation base.
- Existing page filenames and Apps Script endpoint configuration were retained; the endpoint is internally consistent but must be verified against the active Apps Script deployment before publishing.
- `nfc.html`, `nfc.css` and `nfc.js` are included as the new NFC approval flow.
- No test `.js` files are part of the public Pages upload list; they remain under `tests/` for local validation.
- The current `Code.gs` is included at the release root for copy into the existing bound Apps Script project.
- Existing spreadsheet tabs are preserved. New tabs are auto-created when missing; see `DATABASE_COMPATIBILITY.md`.
- The package contains complete source files, not partial snippets. See `RELEASE_MANIFEST.md` for the file inventory.

The source audit does not establish that this package matches the exact bytes currently deployed to Cloudflare Pages or the active Apps Script deployment. The live project must be backed up and checked before replacing production.
