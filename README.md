# Customer Connect Desk — Updated Complete Source Package

This package contains the full Cloudflare Pages frontend, the Google Apps Script backend, local mock tests and deployment/audit documentation for Customer Connect Desk (CCD).

## Architecture

- **Frontend:** static HTML, CSS and browser JavaScript hosted at Cloudflare Pages; the included Cloudflare Worker handles wildcard subdomains and R2 media delivery/upload.
- **Backend:** the existing Google Apps Script Web App (`Code.gs`).
- **Database:** the existing Google Spreadsheet; existing legacy tabs and headers are preserved.
- **Admin identity:** Google Identity Services; the backend verifies the ID token against Google's token-info endpoint.
- **Merchant identity:** shop-scoped 30-minute server-side session; a custom 6–12 digit merchant PIN is mandatory and set by Admin. The last-four-mobile fallback is disabled.
- **Customer communication:** email and WhatsApp templates are centrally editable in Admin. Email is sent through `MailApp` only when the customer has explicitly opted into email. WhatsApp is a prefilled draft; the user must tap Send.
- **Customer profile privacy:** the legacy `checkUser` route requires server-verified Google identity; a phone number alone cannot retrieve a saved profile. Public Desk lookup reports only whether a profile exists and requires the returning customer to re-enter their registered name.

## Complete source inventory

| Area | Files |
|---|---|
| Main Google sign-in/check-in | `index.html` (inline CSS/JS) |
| Admin | `admin.html`, `admin.css`, `admin.js` |
| Merchant dashboard | `merchant.html`, `merchant.css`, `merchant.js` |
| Customer Desk | `desk.html`, `desk.css`, `desk.js` |
| Customer Hub | `customer.html`, `customer.css`, `customer.js` |
| Merchant registration | `register.html`, `register.css`, `register.js` |
| Public shop website | `shop.html`, `shop.css`, `shop.js` (Admin-selectable General, Salon, Restaurant, Retail and Professional layouts) |
| NFC repeat-visit approval | `nfc.html`, `nfc.css`, `nfc.js` |
| Apps Script backend | `Code.gs` |

## Included workflows

1. **Registration:** the first screen asks for mobile only, then asks for email. An exact phone/email match returns the existing status. Partial conflicts (phone, email, shop name or requested slug) are stored in `RegistrationRequests` for Admin review and are not automatically rejected. Admin can approve using the requested or a revised shop ID.
2. **Shop lifecycle:** Admin can Suspend, Archive (reversible soft-delete) and Restore shops. These operations require the Admin security PIN, preserve tenant tabs and customer/visit history, and write `StoreLifecycle` and `SecurityEvents` audit records.
3. **Twenty dashboard themes:** Admin selects one of 20 coordinated themes per shop. Theme choice is persisted in `StoreSettings` and applied to the merchant navbar, page background, cards, text, controls and accent colours.
4. **Shop services:** Phase 1 (Customer Connect, visits and follow-ups) and Phase 2 (Shop Website + Pricing) are independently controlled by Admin. The backend fails closed if no service row exists. Public page/config/API routes and merchant write actions enforce the service flags.
5. **NFC approval:** repeat visits within 25 minutes require shopkeeper approval. Requests expire after five minutes, are shop-scoped, survive customer reloads without duplicate creation, and show countdowns on the customer and merchant pages.
6. **Dynamic communications:** `OWNER_STATUS`, `CUSTOMER_VISIT`, `SHOP_CONTACT` and `SYSTEM_BACKUP` templates are stored in `MessageTemplates`. Admin can edit and reuse them. Customer email requires explicit EmailOptIn stored in `CustomerProfiles`.
7. **Message status:** `SENT` means Apps Script accepted the MailApp request; it does not prove inbox delivery. `FAILED` means the send call threw. `SKIPPED_CONSENT` means no email was sent because consent was not recorded. WhatsApp is `PREPARED` until a person presses Send in WhatsApp.
8. **Merchant dashboard:** shows recent-visit approvals, customer communications status, read-only pricing view; storefront pricing is Admin-managed, and the saved dashboard theme. The old Open Desk button is removed; new QR/NFC tags use `https://<slug>.ccd.dev/nfc` (legacy query links remain supported).
9. **Price history:** Admin has a Price history tab showing shop, item, previous/new price, date/time, actor and source.
10. **Security:** Google-verified Super Admin sessions, Admin PIN gates, mandatory salted/peppered merchant PINs, email OTP for Customer Hub, hashed registration-status tokens, shop-bound 30-minute merchant sessions, ten-minute customer sessions, field allow-lists, Desk PII minimization, rate limits, generic public errors, Worker upload validation and server-side tenant/service checks.

## Run local checks

From the release root:

```bash
bash tests/run_checks.sh
```

The suite checks Apps Script/browser JavaScript syntax, static HTML/CSS/API integration, theme-ID consistency and mocked backend workflows. The current hardened suite contains **123 in-memory backend assertions**. It does not contact or modify the production spreadsheet, real Apps Script deployment, Gmail, Google Identity or WhatsApp.

## Important deployment requirements

1. Back up the live Apps Script source and spreadsheet before replacing anything.
2. Set `ADMIN_SECURITY_PIN` in Apps Script → Project Settings → Script Properties before using theme, service, lifecycle, message-template or merchant-PIN controls.
3. Deploy a new version of the existing Apps Script Web App. Preserve the existing deployment access/execute-as settings.
4. Verify the Web App URL in Apps Script → Deploy → Manage deployments. The source is internally consistent with the URL in `RELEASE_CONFIG.md`, but the active deployment URL has not been live-tested in this environment.
5. **ShopServices is fail-closed.** After deployment, Admin must explicitly enable Phase 1 and/or Phase 2 for each shop. If both are off or no row exists, the merchant dashboard and public service routes are blocked.
6. Before enabling merchant access, set a custom 6–12 digit merchant PIN for every shop in Admin. The last-four-mobile fallback is disabled; a shop without a configured PIN cannot unlock its dashboard.
7. Admin should open Messages & templates once after deployment; this seeds the default shared templates. Review and save the wording before live sends.
8. Confirm the actual Cloudflare Pages domain and Google OAuth authorized origins.

See `DEPLOYMENT_INSTRUCTIONS.md` for the exact sequence and `TEST_REPORT.md` for what has and has not been verified.

## 8 November 2026 security hardening

This release applies Apper-inspired security principles to the existing Apps Script/Sheets backend: server-side role checks, tenant-bound merchant sessions, field-level public response allow-lists, OTP-gated Customer Hub, high-entropy registration status tokens, rate limits and authenticated media uploads. Google Sheets does not provide database-native row-level security; Apps Script is the enforcement layer and spreadsheet Editor access must remain restricted. See `SECURITY_AUDIT.md` and `docs/APPER_SECURITY_MODEL_REVIEW.md`.

Customer Hub now requires a one-time code sent to the email address already on the customer record. Customers without a valid saved email cannot sign in until their profile is corrected. Merchant login now requires a unique 6–12 digit PIN set by Admin; old last-four-mobile fallback is removed. Preserve `CCD_AUTH_PEPPER` in Script Properties.

## Verification boundary

This is a complete source package prepared for deployment. Local syntax, static integration and mocked backend tests pass. **It is not live end-to-end verified.** Real Google authentication, Apps Script permissions, spreadsheet headers, Gmail delivery, WhatsApp handoff, QR/NFC camera scans, Cloudflare publication, browser rendering and production load have not been tested here. Do not describe the system as 100% production-verified until the post-deployment acceptance checklist is completed.


## 7 November 2026 upgrade

This release adds an Admin-only storefront media studio (image/video URLs and direct R2 upload), public gallery/video rendering, a wildcard subdomain Cloudflare Worker router, clean tenant paths (`/<shopId>` host root, `/desk`, `/merchant`, `/customer`, `/nfc`), and server-side enforcement of Admin-only storefront content edits. See `CCD_UPGRADE_IMPLEMENTATION.md` before deployment. The Worker/R2/DNS configuration must be deployed separately; the ZIP does not change live Cloudflare or Apps Script services.

## 8 November 2026 — MPlus premium experience and marketplace design

This upgrade adds a shared MPlus branded loading overlay to all eight pages, an Admin/Merchant/Customer/Desk/NFC/registration/storefront premium responsive styling layer, 13 business-category presets, and a Store Experience Studio. Admin can choose Communication Only, Website + Communication, or Menu/Catalogue Only, choose a category, apply a recommended navigation preset or edit per-shop navigation labels and supported destinations. Public navigation is responsive and only displays destinations with published content.

The package also includes a complete target design for a catalogue and **enquiry-only** marketplace: customer enquiry submission and tracking, merchant Yes/No/Available Later/Custom replies, original-language messages, dashboard notifications, and an asynchronous notification outbox. The corresponding API contract and PostgreSQL target schema are in `docs/CCD_MARKETPLACE_ARCHITECTURE.md` and `database/ccd_marketplace_schema_postgres.sql`.

**Feature boundary:** this release does not yet implement catalogue CRUD, public enquiry submission/tracking, merchant enquiry inbox/replies, global reusable navigation template CRUD, dynamic content-block/page-builder APIs, or the PostgreSQL/Hyperdrive connection. The current Menu Only view is still the existing Admin-managed price-list/catalogue shell, not a stock-backed marketplace. Do not describe those future capabilities as live until their APIs are implemented, deployed and load-tested.

The existing Sheets workbook remains untouched by the package. The PostgreSQL schema is a target for a separate staging database; follow `docs/CCD_DATABASE_MIGRATION_PLAN.md` before any production migration. See `docs/CCD_RELEASE_STATUS_2026-11-08.md` for a precise applied-versus-planned list.
