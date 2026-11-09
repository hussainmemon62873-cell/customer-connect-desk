# Test Report — 8 November 2026

## Result

**123 / 123 mocked backend assertions passed.** All syntax, static frontend/backend and marketplace-schema structural checks passed.

Run command:

```bash
bash tests/run_checks.sh
```

The script runs:

1. Apps Script backend syntax parse (`node --check` against `Code.gs`).
2. Browser JavaScript and Cloudflare Worker syntax parse for the shipped JavaScript files.
3. Static frontend/backend audit: required source files, HTML IDs, duplicate IDs, asset references, CSS brace balance, inline handler references, API action routing, Apps Script URL consistency, Google Identity Client ID consistency, theme IDs and MPlus loader presence on all eight pages.
4. In-memory Apps Script/Sheets mock workflow tests.
5. Marketplace SQL structural audit for the 25-table target schema, tenant-scoped relationships, enquiry-only workflow and supporting indexes.

No production spreadsheet or live Cloudflare deployment is accessed or modified by this test suite. The suite does not perform a penetration test, OAuth live check, MailApp delivery test or load test.

## Mocked backend coverage

The 123 deterministic assertions cover:

- Google ID-token success path and rejection of a wrong OAuth audience.
- JSON and URL-encoded `postData` parsing, including the previous `postData=%` failure shape.
- Admin registry, message-template seeding and persistence.
- First-time/returning customer lookup, idempotent check-in, central customer profile and tenant/central visit writes.
- Legacy `checkUser` phone-only PII disclosure is rejected; verified Google email is required and a supplied phone must match the verified profile.
- Customer EmailOptIn persistence, no-send without consent, dynamic customer email, `SENT` and `FAILED` logging; Customer Hub email OTP issue/verification, wrong-code and expiry rejection, generic non-enumerating response, per-profile/email throttling and no tokenless profile access.
- Desk lookup PII minimization (no saved name/email/preferences/visit total), no private owner contacts, rate-limited phone lookups, returning-name verification and no write on lookup throttling.
- Registration mobile-first lookup, hashed secret status tokens, rejection of phone/email-only status discovery, duplicate-response minimization, throttled submissions, conflict request creation, Admin visibility and approval.
- Phase 1/Phase 2 fail-closed behaviour, client-type spoof protection, Admin-only storefront pricing/promo/contact update enforcement, merchant operational status and existing-session denial when both phases are disabled.
- Public Desk config field allow-list and public owner-email masking.
- Store content including image/video media JSON, review redirect and price-history writes/reads; Admin session verification for Worker uploads.
- Merchant PIN login with salted/peppered HMAC, denial of the last-four fallback, Admin PIN-gated PIN setup, short-lived sessions and session invalidation on suspend.
- Dynamic OWNER_STATUS, CUSTOMER_VISIT, SHOP_CONTACT and SYSTEM_BACKUP template seeding/editing; owner email `SENT`/`FAILED`; WhatsApp `PREPARED`.
- Merchant communication history, dashboard theme persistence, invalid Admin PIN rejection and SecurityEvents logging.
- Suspend, archive, restore, data preservation and legacy status endpoint restrictions.
- NFC repeat-visit window, expiry, pending reload idempotency, shop-scoped merchant approval, rejection/expiry terminal states and customer reload result.
- Initial store experience/category persistence and custom navigation configuration in the existing StoreContent model.

## Static audit summary

- Required frontend/backend runtime sources: all present.
- Apps Script functions: no duplicate function declarations; one `doPost` router.
- Frontend actions without backend router handlers: 0.
- Missing local assets, duplicate HTML IDs, missing JS element references and missing inline handler functions: 0.
- Apps Script URL callers and Google Identity Client ID: consistent.
- Dashboard theme IDs: Admin, Merchant and backend sets match.
- MPlus loader: present on index, Admin, Merchant, Desk, Customer, Register, Shop and NFC pages.
- Premium responsive stylesheet and PostgreSQL marketplace schema: present.
- Marketplace SQL structural audit: 25 table definitions and required tenant-scoped key/index patterns found.

See `FRONTEND_STATIC_AUDIT.json` for the machine-readable frontend audit. The SQL audit is a source-structure check only; the schema has **not** been applied to a PostgreSQL server.

## Implemented in this release

- MPlus branded, lightweight CSS-animated loading overlay across all eight pages. It uses the supplied logo asset, supports reduced-motion preferences and has a failsafe dismissal. It is not an MP4/video download.
- Shared premium responsive design layer for public shop, Admin, Merchant, Desk, Customer, NFC and registration interfaces.
- Thirteen category presentation profiles and category-based default navigation.
- Admin-created store and registration approval controls for the three experience modes and business category.
- Per-store custom navigation rows and persistence in the existing `StoreContent` storage model.
- Storefront custom navigation hides unsupported/empty/unpublished destinations.
- Existing Admin banner media can be used as the storefront hero image.
- Target PostgreSQL schema, API contract and non-destructive Sheets migration plan.

## Not yet implemented or verified as live features

- Product/service catalogue CRUD and indexed availability APIs.
- Customer enquiry submission, tracking and merchant inbox.
- Merchant Yes/No/Available Later/custom replies and message history.
- Real-time/persisted dashboard notifications and email/WhatsApp dispatch for marketplace enquiries.
- Full global Navigation Template CRUD, nested navigation and visual Page/Content Block Builder.
- PostgreSQL provisioning, Cloudflare Hyperdrive binding, Worker API endpoints and Sheets-to-PostgreSQL migration.
- Automatic image/video palette extraction and generated responsive media variants.

`MENU_ONLY` currently renders the existing pricing/content list as a basic menu-like presentation. It is not yet a stock-backed catalogue or functioning enquiry marketplace. The target SQL schema and API architecture are design artifacts, not deployed database services.

## Not tested live

- Real Google OAuth sign-in/token verification.
- Actual Apps Script deployment, Script Properties, permissions and production spreadsheet header compatibility.
- Real Gmail/WhatsApp delivery or provider delivery receipts.
- Cloudflare Pages/Worker/R2 deployment, cache behaviour and media processing.
- PostgreSQL SQL execution, migrations, query plans, backup restoration or Hyperdrive connectivity.
- Android/iOS rendering on physical devices, camera/QR/NFC scans, production concurrency or load/latency.

No deployment was performed and no existing Google Sheets tabs or rows were changed. The 123 passing assertions are deterministic mock tests, not a claim of production acceptance. Complete the deployment and live acceptance checks in `DEPLOYMENT_INSTRUCTIONS.md` and the migration plan before enabling the new marketplace for customers.
