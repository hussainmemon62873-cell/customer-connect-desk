# Code Changelog — 5 November 2026

- Added 20 coordinated shopkeeper dashboard themes and persisted per-shop theme selection.
- Added PIN-protected suspend, reversible archive and restore lifecycle controls with audit trail.
- Added hashed custom 6–12 digit merchant PIN support; legacy last-four fallback remains for shops not yet configured.
- Added Admin-controlled Phase 1 and Phase 2 service flags with server-side enforcement and fail-closed defaults.
- Added a safe merchant bootstrap response and authenticated Merchant config path to prevent client-type spoofing.
- Added Phase 2 Admin View Website action; it enables Phase 2 with the Admin PIN before opening the public shop.
- Added registration mobile-first flow, phone/email exact-match lookup, conflict flags, idempotency and Admin request approval/rejection.
- Added NFC repeat-visit approval flow, 25-minute window, five-minute server expiry, reload idempotency, terminal result handling and countdowns.
- Added shared editable OWNER_STATUS, CUSTOMER_VISIT, SHOP_CONTACT and SYSTEM_BACKUP templates.
- Routed owner/customer/public shop WhatsApp content through saved templates; WhatsApp is logged as PREPARED only.
- Routed customer and owner email content through saved templates; added SENT/FAILED/SKIPPED_CONSENT communication logging and dashboard visibility.
- Added explicit customer EmailOptIn UI and CustomerProfiles persistence; masked email/DOB on phone-only Desk lookup.
- Added Merchant communication status panel and Admin Price history tab.
- Removed Merchant Open Desk button; QR/NFC Studio now creates `nfc.html?shop=<slug>` links.
- Added SecurityEvents logging, Admin/Merchant/Customer PIN attempt limits, merchant session invalidation, CacheService invalidation and LockService coverage.
- Hardened Apps Script body parsing for JSON and URL-encoded `postData` payloads.
- Added static integration checks and 102 mocked backend assertions.


## 7 November 2026 — Admin-only storefront and subdomain/media upgrade

- Added Admin storefront layout presets: General, Salon/Beauty, Restaurant/Cafe, Retail and Professional Services.
- Added Admin media studio for image/video URLs, direct R2 uploads, captions, visibility, ordering and deletion.
- Added public Gallery rendering for images and HTML5 videos.
- Added `media` and `layoutStyle` content keys in the existing StoreContent sheet.
- Added Cloudflare Worker wildcard subdomain routing and clean tenant paths.
- Added Admin session verification for Worker upload authorization and R2 object serving.
- Switched newly generated shop, desk, merchant and NFC URLs to `<shopId>.ccd.dev`. Legacy `?shop=` links remain supported.
- Enforced Admin-only storefront pricing, offer and contact updates server-side; merchant operations remain available.
- Updated mock coverage to 103 backend assertions.

## 8 November 2026 — MPlus premium experience / marketplace architecture

- Added MPlus logo asset, shared animated loading overlay and shared responsive premium styling across all eight pages.
- Added 13 category selections and category-specific storefront tokens/styles, including salon, restaurant, retail, grocery, electronics, clinic, education, home services, automotive, real estate, organic and professional services.
- Added Admin Store Experience Studio with three store modes, category-based navigation presets and per-shop custom navigation labels/order/destinations.
- Added initial mode/category controls to Admin-created stores and registration approval; persists these settings in the existing StoreContent positional model without changing existing sheet headers.
- Improved public navigation to filter unavailable/unpublished sections and apply the selected category labels; the Admin's first banner can supply the hero image.
- Added PostgreSQL target schema, tenant-safe relationships, catalogue/enquiry data model, API contract and staged migration plan. These are architecture deliverables only; Worker/PostgreSQL APIs are not connected in this release.
- Fixed initial StoreContent sheet creation when missing, registration mode persistence and the registration loader completion path.


## 8 November 2026 — Apper-inspired backend security hardening

- Removed merchant last-four-mobile fallback; require Admin-configured 6–12 digit PINs with per-shop salt + HMAC-SHA-256 and Script Property pepper.
- Added Customer Hub email OTP and ten-minute customer sessions; removed Customer Hub last-four PIN access.
- Registration approval status requires a high-entropy status token; only HMAC hash is stored.
- Reduced Admin/Merchant sessions to 30 minutes; added rate limits and generic public error responses.
- Reduced public Desk lookup data, required returning-name confirmation, removed private owner/customer data from public responses, and added lookup rate limiting.
- Hardened Worker upload origin/session/shop checks and security headers.
- Closed the legacy `checkUser` / `checkCustomerStatus` phone-only profile disclosure path; verified Google email is required and an optional supplied mobile must match.
- Updated the root check-in UI so public phone lookup reports only profile existence; returning profile details appear only after verified Google email lookup.
- Preserved the existing Google Spreadsheet and tab schemas.
