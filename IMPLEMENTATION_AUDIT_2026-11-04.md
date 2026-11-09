> **Historical audit — superseded.** The complete 5 November 2026 implementation and validation status is in `IMPLEMENTATION_AUDIT_2026-11-05.md`, `TEST_REPORT.md` and `RELEASE_MANIFEST.md`. The earlier gaps listed here were addressed in the later release.

# Customer Connect Desk — source audit and message-centre update

## Source baseline
- Input: `2_chatgpt.zip` (`CCD_Final_Release/`)
- Apps Script backend: `Code.gs` (59,757-byte input snapshot before this update)
- Frontend: admin, merchant, desk, customer, register, shop pages and shared landing page.
- The ZIP's `RELEASE_CONFIG.md` specifies Apps Script deployment URL `AKfycbwHdc...`; this has not been independently confirmed against Apps Script → Deploy → Manage deployments.
- This is a source-code review and mocked test run, not a live Cloudflare/Google Apps Script deployment test.

## Implemented in this update
1. Admin sidebar now has a separate **Messages & templates** workspace.
2. Reusable `EMAIL` and `WHATSAPP` templates are persisted in `MessageTemplates` and can be edited for later sends.
3. Template variables are resolved per shop: `{{ownerName}}`, `{{shopName}}`, `{{shopId}}`, `{{ownerEmail}}`, `{{ownerMobile}}`, `{{deskUrl}}`, `{{shopUrl}}`, `{{merchantUrl}}`, `{{registrationStatus}}`.
4. Owner email sending uses the saved template, records `SENT` only after `MailApp.sendEmail()` returns without throwing, and records `FAILED` when the call throws.
5. WhatsApp opens a prefilled `wa.me` draft and records `PREPARED`; it does not claim to have sent the message.
6. Admin can view per-shop communication history/status in the dashboard.
7. Template edits and owner-message actions require an authenticated Super Admin session and a separately configured `ADMIN_SECURITY_PIN` Script Property.
8. `MessageTemplates` and `CommunicationsLog` sheets are created when the feature is first used; existing sheets and legacy headers are not renamed or reordered.
9. Added six mock tests for template persistence, PIN rejection, dynamic placeholder rendering, email status, WhatsApp prepared status and communication history.

## Status semantics
- `SENT`: Apps Script `MailApp.sendEmail()` accepted the send request (no exception). It is **not** proof of inbox delivery.
- `FAILED`: Apps Script send call threw an error.
- `PREPARED`: WhatsApp draft was opened/prepared. The user must manually press Send in WhatsApp.
- `DELIVERED`: not implemented because no delivery receipt provider is connected.

## Verified locally
- Apps Script syntax check: PASS.
- Browser JavaScript syntax check: PASS.
- Static HTML/CSS/JS reference audit: PASS for the checks in `tests/audit_project.py`.
- Backend mocked workflow tests: **47/47 PASS** (40 original + 7 new message-centre checks).
- API action-to-handler static audit: no missing backend handlers detected by the included audit.

## Not implemented / not proven in this package
These must not be treated as complete merely because the included legacy tests pass:
- 20 editable Admin-managed merchant dashboard colour palettes and their persistence/application.
- PIN-protected Suspend / Archive / Restore lifecycle (the existing `deleteStore` only writes `CANCELLED`; there is no restore action or separate archived flag).
- Full registration duplicate/conflict workflow described in the project brief (the current backend still rejects several phone/email/slug conflicts rather than preserving a pending Admin-review request).
- The full NFC session + five-minute approval workflow and its expiry/reload/idempotency requirements.
- Phase 1 / Phase 2 service gates, including server-side blocking of all direct website/pricing routes when Phase 2 is disabled.
- Complete owner/customer communication preferences and consent checks for every automated customer email; the existing customer check-in email path sends whenever an email is present.
- Full admin-to-owner message send history for every channel/template type and reliable email delivery receipts.
- Real Google Identity token verification, actual Admin account access, live Apps Script permissions, sheet schema compatibility in the production spreadsheet, MailApp quota/authorization, and WhatsApp app launch on target devices.

## Important security/deployment notes
- Set `ADMIN_SECURITY_PIN` in Apps Script Project Settings → Script Properties before using template editing or owner-message actions. Never place the PIN in frontend code or GitHub.
- Deploy a new Apps Script version after updating `Code.gs`.
- The test harness mocks Google token verification and MailApp; it does not call Google's live identity endpoint or send real email.
- Do not label email as delivered. Do not label WhatsApp as sent until an actual sender confirms it in WhatsApp (and no provider callback is connected).
- Existing merchant PIN is based on the last four mobile digits in the legacy code and is not strong authentication; this update does not fix that weakness.
- The project remains **not deployment-ready** until the outstanding requirements above are implemented and the deployment checklist is completed against the real spreadsheet and Apps Script deployment.
