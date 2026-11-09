# CCD Implementation Audit — 5 November 2026

## Source basis

This release is based on the user-provided `2_chatgpt.zip` plus the subsequent Message Centre update source. It is not based on an older pre-main ZIP as a substitute for the current source. Existing source files were retained and updated in place; `nfc.html`, `nfc.css` and `nfc.js` are included as the NFC approval page.

## Implemented in this release

| Requirement | Result |
|---|---|
| 20 coordinated dashboard themes | Implemented in Admin editor; stored per shop; same IDs validated in Admin, Merchant and backend. |
| PIN-protected Suspend | Implemented; merchant sessions revoked on next API call. |
| PIN-protected reversible Delete/Archive | Implemented as soft archive; data/tenant sheet retained. |
| PIN-protected Restore | Implemented; preserves suspended state if archived while suspended, then restores prior state. |
| Merchant custom PIN | Implemented; 6–12 digits, hashed in StoreSettings; legacy last-four fallback until set. |
| Dynamic owner email + WhatsApp | Implemented with `OWNER_STATUS` shared template. Admin saves before send. |
| Dynamic customer email + WhatsApp | Implemented with `CUSTOMER_VISIT` shared template; customer email requires EmailOptIn. |
| Dynamic public shop WhatsApp contact | Implemented with `SHOP_CONTACT` template. |
| Dynamic annual backup email | Implemented with `SYSTEM_BACKUP` template. |
| Email status | `SENT` on MailApp acceptance, `FAILED` on exception, `SKIPPED_CONSENT` when consent absent; button state updates in Admin. |
| WhatsApp status | `PREPARED` only; actual send remains manual in WhatsApp. |
| Merchant communication status | Implemented in Merchant dashboard. |
| Mobile-first registration | Implemented: mobile → email pair lookup → shop details. |
| Duplicate/conflict review | Implemented: exact pair returns existing status; partial conflicts create PENDING request for Admin; no automatic rejection. |
| Admin registration requests | Implemented with conflict flags, approve/reject, approved slug override. |
| Phase 1 / Phase 2 | Implemented and enforced server-side; missing service rows fail closed. |
| Admin View Website action | Implemented; asks for Admin PIN and enables Phase 2 before opening shop page. |
| NFC repeat visit approval | Implemented with 25-minute window, five-minute expiry, reload idempotency, shop-scoped decision and countdowns. |
| Price history Admin view | Implemented. |
| Desk button removal | Removed from Merchant dashboard. QR/NFC Studio links to `nfc.html`. |
| Customer email consent | Implemented in Desk UI and `CustomerProfiles`; no email without explicit consent. |
| Security audit log | Implemented for sensitive Admin, Merchant PIN and NFC actions. |
| Cache/locking | Cache invalidation and LockService serialization implemented for key paths. |
| API form-encoded parser | Supports JSON and `postData=` form-encoded bodies. |

## Local validation

Run `bash tests/run_checks.sh`. The report includes Apps Script/browser JavaScript syntax checks, static HTML/CSS/API integration checks, 20-theme ID consistency and mocked backend tests. See `TEST_REPORT.md` and `FRONTEND_STATIC_AUDIT.json`.

## Not live-verified

This environment did not deploy to Apps Script or Cloudflare and did not make real Gmail/WhatsApp sends. Google OAuth is tested with mocked token-info responses, not a real Google ID token. Real spreadsheet headers, script properties, deployment URL, permissions, quotas, browser layout, camera/NFC scans and production traffic must be verified with the acceptance checklist in `DEPLOYMENT_INSTRUCTIONS.md`.

## Important operator actions

- Set `ADMIN_SECURITY_PIN` in Script Properties.
- Verify the active Apps Script URL against `RELEASE_CONFIG.md`.
- Admin must open Messages & templates to seed defaults.
- Admin must enable Phase 1 and/or Phase 2 per shop; missing rows default disabled.
- Set a custom merchant PIN for every shop.
- Confirm customer email consent before any email send.
