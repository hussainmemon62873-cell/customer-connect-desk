# CCD Backend Security Review — 8 November 2026

## Review basis

The Apper Builder account search returned no existing CCD project to inspect directly. The comparison therefore uses Apper's published security model: database-level row access controls, independently enforced role/profile permissions, explicit public-data field limits, authenticated server-side functions and server-held secrets. See `docs/APPER_SECURITY_MODEL_REVIEW.md`.

CCD remains on its existing Cloudflare Pages + Cloudflare Worker (media routing) + Google Apps Script + Google Spreadsheet architecture. This package does **not** connect to Apper, migrate the workbook, or create a new database.

## Controls implemented in this source release

### Authentication and session boundaries

- **Super Admin:** Google ID token is verified server-side for issuer, OAuth audience, verified email and expiration. The approved Admin identity is locked in the existing Master-Sheet configuration. Admin API calls require a server-issued session token with a 30-minute CacheService lifetime.
- **Sensitive Admin actions:** require the separate `ADMIN_SECURITY_PIN` Script Property and constant-time comparison. Failed attempts are rate limited and logged to `SecurityEvents`.
- **Merchant:** no last-four-mobile fallback remains. The shop owner must use a 6–12 digit merchant PIN configured by Super Admin. New hashes use a per-shop random salt and HMAC-SHA-256 with the private `CCD_AUTH_PEPPER` Script Property. Previously configured custom PIN hashes are upgraded on successful login. Merchant sessions are shop-bound, expire after 30 minutes and are rejected after shop suspension/archive or deactivation of both service phases.
- **Customer Hub:** phone + last-four PIN is removed. The customer must enter the registered mobile and the email already on file, receive a six-digit email OTP, and verify it. OTPs are one-use, ten-minute challenges with a maximum of five verification attempts; OTP requests are capped at three per phone/email pair and five per email in the rate window. Customer sessions expire after ten minutes and are held server-side in CacheService; the frontend keeps the token in memory only.
- **Registration status:** status lookup no longer accepts only shop ID + email. New public applications receive a high-entropy status token once; only its HMAC hash is stored in `RegistrationRequests`. Status lookup requires both request ID and secret token. Existing duplicate responses no longer reveal shop ID or approval status.

### Tenant isolation and field minimization

- Merchant API access is derived from the server-side merchant session's ShopId. Client-provided ShopId cannot switch the tenant for a merchant session.
- Shop lifecycle and Phase 1/Phase 2 flags are checked server-side, not just in the UI.
- Public Store/Desk bootstrap responses are allow-listed. The Desk lookup no longer returns a customer's full name, masked email, DOB flag, visit count or communication preferences based only on a phone number.
- Returning Desk customers must re-enter the saved name and explicitly confirm it; the backend compares the normalized value before recording a return visit. Existing customer email/DOB are immutable through the public Desk API. This is a low-assurance on-premise check-in, not proof of phone ownership.
- Desk responses no longer return full customer profile objects or private owner name/mobile fields. Shop data returned to Desk uses the `DESK` field allow-list.
- Duplicate check-in responses do not return customer PII.
- Customer Hub private profile data is available only with a valid server-side customer session.

### Abuse controls and application responses

- Public Desk profile lookups are rate limited per shop/phone key; public registration lookups and submissions are rate limited by hashed identifiers.
- Merchant PIN attempts are rate limited per shop; Admin PIN failures are rate limited per Admin identity.
- Public responses are generic where possible to reduce account/registration enumeration.
- Unexpected Apps Script exceptions are logged server-side and return a generic error message. They do not return stack traces or internal exception details to public clients.
- Apps Script write actions use the script lock to serialize critical Spreadsheet updates and idempotency checks.

### Media Worker

- Upload requires an allow-listed browser origin, an Admin bearer session verified by Apps Script, and a valid existing active shop ID.
- Upload types are allow-listed (JPEG, PNG, WebP, GIF, MP4, WebM), file signatures are checked, and the file size is capped at 25 MB.
- Object names are generated server-side under the shop prefix. The Worker does not accept an arbitrary R2 key from the browser.
- Static and upload responses receive security headers; public media intentionally permits cross-origin reads so public storefront pages can render it.
- R2 is public-read for storefront media. Do not put customer IDs, documents, invoices or other private files in the public media bucket.

## Important boundary compared with Apper

Apper can enforce access at the database layer and independently through its server-side profile/permission layer. Google Sheets does **not** provide equivalent per-row or per-field RLS. In CCD, Apps Script is the enforcement boundary: all user-facing reads/writes must go through the guarded API. Anyone with Editor access to the underlying spreadsheet or bound Apps Script project can bypass these application checks. Restrict those editor permissions to trusted administrators, do not expose the Spreadsheet to merchants/customers, and do not share the Apps Script project with untrusted users.

This is an Apper-inspired security hardening of CCD's existing backend, not an installation of Apper's security engine.

## Required operator actions before deployment

1. Back up the entire production spreadsheet and existing Apps Script project. Test on a copy first.
2. Set a unique, strong `ADMIN_SECURITY_PIN` in Apps Script Script Properties (recommend 8+ digits; do not reuse a merchant PIN). The previously configured value must not be copied into frontend code, Sheets, GitHub or this document.
3. Preserve the auto-generated `CCD_AUTH_PEPPER` Script Property once the new backend has created it. Never delete, rotate or share it casually: existing HMAC merchant PIN hashes depend on it.
4. Set a separate 6–12 digit PIN for **every** shop in Admin → merchant access PIN. Shops without a custom PIN are deliberately unable to log in after this release; the last-four-mobile fallback has been removed.
5. Ensure every Customer Hub user has a valid email saved on their existing customer profile. Customers with missing/incorrect email need a trusted profile-correction process before they can use OTP login.
6. Authorize `MailApp` when prompted and test a customer OTP using a non-production customer profile. Email send acceptance is not inbox delivery confirmation.
7. Restrict Google Spreadsheet and Apps Script Editor access to trusted operators. Use protected ranges only as an additional guard, not a replacement for editor access control.
8. Confirm the deployed Apps Script URL, Google OAuth client authorized origins, Cloudflare Worker route, R2 binding, `GAS_URL`, `PAGES_ORIGIN`, `PUBLIC_MEDIA_BASE` and Worker origin allow-list.
9. Deploy first to a staging Pages origin and test Admin, merchant, Customer Hub, Desk, registration, media uploads, cross-shop isolation and shop suspension.

## Residual risks / not verified live

1. **No native Sheet RLS:** server-side Apps Script checks protect normal API traffic, but spreadsheet editors can see/edit every tab. This is weaker than a database-enforced tenant boundary.
2. **CacheService is best-effort:** OTP challenges, short-lived sessions and rate counters use Google CacheService; cache eviction/quotas can cause re-authentication or weaken rate-window precision. It is not a durable distributed rate limiter.
3. **No trusted client IP in the Apps Script web app:** IP-based WAF/rate limiting is not available in this direct Apps Script path. A future API gateway should own public endpoints if traffic/abuse justifies it.
4. **Desk identity remains low assurance:** re-entering the saved name reduces accidental disclosure but is not equivalent to OTP or possession of the mobile. Use Customer OTP or shopkeeper approval for high-assurance identity changes and sensitive workflows.
5. **Email OTP dependency:** customers without a verified email cannot use Customer Hub until their record is corrected. MailApp quotas, spam filtering and actual inbox delivery must be tested in production.
6. **Admin PIN strength:** Apps Script accepts the configured value; the operator must set a strong unique value and protect Script Properties.
7. **Pepper continuity:** losing or replacing `CCD_AUTH_PEPPER` invalidates merchant HMAC hashes and pending registration-status token hashes that depend on it. Securely back up the script configuration using an approved secret-management process.
8. **No live pen test or load test:** Google OAuth, live workbook headers, Apps Script quotas, Cloudflare deployment, R2 ACL behaviour, concurrency and production latency have not been verified from this workspace.
9. **WhatsApp:** the current workflow creates a prefilled WhatsApp draft. It does not automatically send or confirm delivery.

## Local verification status

`bash tests/run_checks.sh` passes in the prepared local workspace. This validates source syntax, static page/API structure and 123 deterministic mocked Apps Script/Sheets assertions. It is not a production penetration test or live deployment verification.


## Additional legacy profile lookup hardening

The legacy `checkUser` / `checkCustomerStatus` route now rejects phone-only profile access and requires a Google ID token verified by the backend against the saved customer email. If a mobile number is supplied, it must match the profile linked to that verified email. The public root check-in UI now displays existing-profile information only after that verified-email lookup; mobile-only existence checks disclose no saved profile fields.
