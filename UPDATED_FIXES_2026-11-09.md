# CCD update notes — 2026-11-09

## Applied changes
- Replaced the previous Apps Script deployment URL with the user-supplied active URL in all eight frontend callers: admin.js, merchant.js, desk.js, customer.js, register.js, shop.js, nfc.js, and the inline script in index.html.
- Set `GAS_URL` in `wrangler.toml` to the same supplied URL.
- Updated `RELEASE_CONFIG.md` to document the supplied endpoint and its locations.
- Updated `API_MAPPING.md` to describe the JSON and URL-encoded `postData` request formats and the Customer Hub email-OTP session flow implemented by the backend.
- Extended `tests/run_checks.sh` to syntax-check `nfc.js` and `brand-loader.js` as well.
- Regenerated `FRONTEND_STATIC_AUDIT.json` and `FILE_CHECKSUMS.sha256`.

## Verification
- `bash tests/run_checks.sh` completed successfully.
- Apps Script syntax check passed.
- Browser JavaScript syntax checks passed, including NFC and shared brand loader.
- Static frontend/backend audit passed.
- Marketplace schema structural audit passed.
- All 123 in-memory Apps Script / Sheets mock tests passed.

## Important limitation
These checks validate the supplied source package locally. They do not prove that the live Apps Script deployment, Cloudflare Pages deployment, Cloudflare Worker, R2 bucket, OAuth settings, Script Properties, or live spreadsheet permissions are configured correctly. Deploy the matching `Code.gs` as a new Apps Script version and verify the live flows before treating production as error-free.
