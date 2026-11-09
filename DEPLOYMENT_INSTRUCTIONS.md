# Deployment Instructions — Customer Connect Desk

## Before replacing the live version

1. Download a fresh backup of the current Cloudflare Pages source and the complete Apps Script project.
2. Make a copy of the production spreadsheet. Do not test destructive operations on the live sheet first.
3. Confirm the spreadsheet is still `Customer Connect Desk - FY 2026-27` and the existing tabs/headers match `DATABASE_COMPATIBILITY.md`.
4. Verify the active Apps Script deployment URL. The code package uses the URL listed in `RELEASE_CONFIG.md`; update every frontend caller if the active deployment differs.

## 1. Update the Google Apps Script backend

1. Open the Apps Script project bound to the production spreadsheet.
2. Replace the existing `Code.gs` with the complete `Code.gs` from this package. Do not paste it into a second, unbound Apps Script project.
3. Save the project.
4. Open **Project Settings → Script Properties** and set:
   - `ADMIN_SECURITY_PIN` — required; set a unique strong value (recommend 8+ digits) and keep it private.
   - `CCD_AUTH_PEPPER` — generated automatically by the new backend on first secure PIN/token operation. Once created, preserve it; do not delete or rotate it casually.
   - Confirm `SUPER_ADMIN_EMAIL` / existing Super Admin lock is configured as already used by the project.
   - Confirm `ADMIN_SETUP_PASSWORD` only if the initial Admin lock procedure still requires it.
5. Run an authorized setup/test function only if the project already uses one. When prompted, grant the required Google Sheets, UrlFetch and MailApp permissions.
6. Open **Deploy → Manage deployments**, edit the existing Web App deployment, select **New version**, and deploy. Preserve the current access/execute-as settings used by the live frontend (the previously recorded setup was Execute as the deploying user and access Anyone).
7. Copy the deployment URL and compare it with `RELEASE_CONFIG.md`. If different, replace the URL in all frontend callers before uploading them.

## 2. Publish the frontend to Cloudflare Pages

Upload the complete frontend source files to the same Cloudflare Pages project/root, preserving names and paths:

- `index.html`
- `admin.html`, `admin.css`, `admin.js`
- `merchant.html`, `merchant.css`, `merchant.js`
- `desk.html`, `desk.css`, `desk.js`
- `customer.html`, `customer.css`, `customer.js`
- `register.html`, `register.css`, `register.js`
- `shop.html`, `shop.css`, `shop.js`
- `nfc.html`, `nfc.css`, `nfc.js`

Keep `Code.gs` in Apps Script, not in the public Pages root. Keep the `tests/` folder and audit documents out of the public Pages root unless you deliberately want them publicly accessible. The previous GitHub preference to exclude test JavaScript files from source uploads still applies.

Confirm `BASE_DOMAIN` and all Apps Script URLs match `RELEASE_CONFIG.md`. Confirm the Google OAuth client authorizes the production Pages origin.

## 3. First Admin login and required setup

1. Sign in to Admin with the authorized Google account.
2. Open **Messages & templates** once. This creates/seeds the default `MessageTemplates` rows.
3. Review and save the text for `OWNER_STATUS`, `CUSTOMER_VISIT`, `SHOP_CONTACT` and `SYSTEM_BACKUP`. Use the Admin security PIN when saving.
4. Open **Shops → Edit website / theme** for each existing shop.
5. Choose one of the 20 dashboard themes and save it using the Admin security PIN.
6. Enable the required service phases:
   - **Phase 1 — Customer Connect:** check-ins, customer visit history, NFC approvals and customer follow-ups.
   - **Phase 2 — Shop Website + Pricing:** public shop page, contact/promo content and pricing management. These two features are enabled/disabled together.
7. Set a separate 6–12 digit merchant PIN for every shop in Admin → merchant access PIN. The old last-four-mobile fallback is disabled. A shop without a custom PIN cannot unlock its Merchant Dashboard until the Admin sets one.
8. Save. Repeat for each shop. Missing `ShopServices` rows intentionally mean both phases are disabled.

## 4. Registration requests

1. Open the public `register.html` page.
2. Confirm the first screen asks only for a mobile number; the next screen asks for email; only then does it show shop details.
3. Submit a test request using test contact details.
4. In Admin → Registration requests, confirm the request appears as PENDING.
5. Submit another test request with a reused phone/email/shop name and confirm conflict flags appear only in Admin. The public applicant should not see another shop's private details.
6. Approve using the requested shop ID, or enter a different approved ID if the requested ID is already used. Confirm the shop is created without overwriting existing tenant data.

## 5. NFC acceptance checks

1. From Admin QR/NFC Studio, generate a tag using `https://<shopId>.ccd.dev/nfc` after the Worker route is deployed. Legacy `nfc.html?shop=<shopId>` links remain supported.
2. For a new/older-than-25-minute visit, confirm the customer proceeds to Desk details.
3. For a repeat visit within 25 minutes, confirm the page creates a pending approval and shows a five-minute countdown.
4. Confirm the correct shopkeeper sees the customer name/mobile and matching countdown.
5. Test Approve, Reject, reload while pending, reload after rejection, and expiry. Reload must not create a second pending request or reset the expiry.
6. Remember: an NFC URL/QR can be shared; scanning it does not cryptographically prove the customer is physically inside the shop.

## 6. Communications acceptance checks

1. On the Desk page, opt into email explicitly using the optional email-consent checkbox. Leave it unchecked to verify no customer email is sent.
2. Complete a test check-in with a valid test email and consent. Confirm `CommunicationsLog` records `SENT` only if `MailApp.sendEmail()` returns without throwing.
3. Force a MailApp error in a test environment and confirm the log shows `FAILED` and the dashboard continues to show a Send/retry state.
4. Confirm the merchant dashboard shows customer email and WhatsApp communication statuses.
5. Open an owner WhatsApp draft from Admin. Confirm it is logged `PREPARED`; press Send manually in WhatsApp if you intend to send it.
6. Do not interpret `SENT` as inbox delivery. Delivery receipts are not implemented.

## 7. Lifecycle, themes and pricing acceptance checks

1. Suspend a test shop with the Admin PIN. Confirm the merchant session is invalidated and public service routes are denied.
2. Restore it with the Admin PIN. Confirm its tenant tab, customer records and price history remain.
3. Archive a test shop, then restore it. Confirm archive is reversible and does not delete the underlying sheet.
4. Change the dashboard theme. Confirm navbar, background, cards, controls and text use the selected palette after reload.
5. Change a test item price. Confirm it publishes immediately while Phase 2 is enabled and appears in Admin → Price history with old/new price and timestamp.
6. Disable Phase 2. Confirm public shop URLs, pricing, website settings and status updates are blocked. Phase 1 should remain usable if still enabled.

## 8. Final checks

Run local checks before upload:

```bash
bash tests/run_checks.sh
```

After publishing, test in a private/incognito browser and on an Android phone. Verify Admin Google login, merchant custom PIN, Desk check-in, customer consent, email status, WhatsApp draft, NFC approval, registration conflict review, theme persistence, suspend/archive/restore, Phase 1/Phase 2 restrictions and price history.

## 10. 8 November 2026 security hardening — mandatory checks

1. Use a staging copy of the Google Spreadsheet and bound Apps Script project first. Do not test OTP, registration or PIN migrations against the production workbook until the staging test passes.
2. Set a unique Admin security PIN in Script Properties. Keep it out of HTML, JavaScript, spreadsheet cells and GitHub.
3. After the first secure PIN/token operation, confirm `CCD_AUTH_PEPPER` exists in Script Properties. Back up script properties securely and do not delete/change this pepper after merchants have been configured.
4. In Admin, configure a new 6–12 digit custom merchant PIN for **every** active shop. Merchant login no longer accepts the last four digits of the shop mobile. Test one shop without a PIN and confirm access is denied; then configure its PIN and confirm it unlocks.
5. Customer Hub now requires the mobile number and email already saved in `Master-Customers`, followed by an emailed six-digit OTP. Authorize MailApp. Test a correct code, incorrect code, expired code and a profile with no saved email. Do not re-enable the old last-four PIN route.
6. Public Desk lookup no longer displays the saved customer name, masked email, visit totals or communication preferences. Returning customers re-enter the registered name and confirm; the backend compares it and does not return the private customer object or owner contact details. The legacy `checkUser` / `checkCustomerStatus` endpoint also rejects phone-only access and requires a matching, server-verified Google identity. This kiosk check remains low-assurance and is not proof of mobile ownership.
7. Public registration status requires the `requestId` and high-entropy `statusToken` returned at submission. Do not manually share the token or put it into a public log. New submissions store only the HMAC hash in `RegistrationRequests`.
8. Test cross-shop isolation: sign into Shop A, then attempt to send Shop B's ShopId to merchant APIs. The backend must reject it or continue to use the session's bound Shop A identity. Repeat with suspend/archive and disabled service phases.
9. Verify Worker upload from the approved Admin origin only, using a current Super Admin session and an existing active shop. Test a disallowed origin, wrong MIME/signature, over-25MB file, expired session and unknown/inactive shop.
10. Keep Google Drive spreadsheet and Apps Script Editor permissions restricted to trusted administrators. Spreadsheet editors can bypass the application service layer; Google Sheets has no native row-level security equivalent to Apper's database RLS.
11. Review `SECURITY_AUDIT.md` for residual risks. In particular, CacheService is best-effort, Apps Script has no trusted client-IP rate limit, email delivery is not guaranteed, and no production load/penetration test has run.

## 11. Apper security-model comparison

The CCD hardening adopts the relevant design principles rather than installing Apper's backend: separate identity from role permissions, enforce each operation server-side, bind merchant sessions to one tenant, explicitly allow-list public fields, keep secrets server-side, authenticate private customer access and validate media uploads. The existing Google Spreadsheet remains the database; the Apps Script backend is the enforcement boundary. See `docs/APPER_SECURITY_MODEL_REVIEW.md`.

## Important limitations

- This package has not been deployed to the live Apps Script or Cloudflare environment from this chat.
- Real Google OAuth, Google Sheets permissions, Apps Script quotas, Gmail delivery, Cloudflare cache behaviour and WhatsApp sending require live verification.
- Gmail has no inbox-delivery confirmation in this implementation. WhatsApp is a manual click-to-chat draft, not an automated send.
- Customer Hub uses email OTP; it requires a correct email already saved on the customer record. It has no SMS OTP fallback yet.
- Public Desk lookup returns only whether a profile exists; it does not return the saved name, email, DOB, visit totals or communication preferences. Returning visitors must re-enter their saved name, which is still a low-assurance kiosk check rather than proof of mobile ownership. The legacy `checkUser` / `checkCustomerStatus` API also rejects phone-only profile lookup and requires a matching server-verified Google identity.

## 8. Wildcard subdomains and media upload (new in this release)

Follow `CCD_UPGRADE_IMPLEMENTATION.md` for the exact Cloudflare configuration. In summary, attach `ccd.dev` to the existing Pages project, create a proxied wildcard DNS record, deploy `worker.js` with the `*.ccd.dev/*` route, and bind the `MEDIA_BUCKET` R2 bucket. Set `PAGES_ORIGIN`, `PUBLIC_MEDIA_BASE` and the verified active `GAS_URL` Worker variables. Do not try to attach `*.ccd.dev` as a Pages custom domain; the Worker is the wildcard entry point.

Deploy the updated `Code.gs` before testing uploads because the Worker calls the new `verifyAdminSession` action. Add `https://ccd.dev` and `https://admin.ccd.dev` to the Google OAuth client Authorized JavaScript origins; keep the existing Pages origin while migrating. Then test Admin login, a small media upload, public media retrieval, `https://<shopId>.ccd.dev/`, and the clean `/desk`, `/merchant` and `/nfc` paths.

## 9. Admin-only storefront editing

Storefront content, media, pricing, offers, public contact/review details and reusable message templates are now Admin-managed. Merchant dashboard operational features remain available, including customer visits, NFC approvals and shop open/close status. Merchant storefront update endpoints reject merchant sessions server-side.

## 8. 8 November 2026 premium experience files

The new frontend assets must be deployed with the existing Pages root, preserving their paths:

- `brand-loader.css`
- `brand-loader.js`
- `premium-ui.css`
- `assets/mplus-logo.png`
- Updated `admin.html`, `admin.css`, `admin.js`
- Updated `register.html`, `register.js`
- Updated `shop.html`, `shop.css`, `shop.js`
- Updated `Code.gs` in the existing spreadsheet-bound Apps Script project

Also publish the updated common CSS/loader references in `index.html`, `merchant.html`, `merchant.css`, `merchant.js`, `desk.html`, `desk.css`, `desk.js`, `customer.html`, `customer.css`, `customer.js`, `nfc.html`, `nfc.css` and `nfc.js` as present in this release. Keep `assets/mplus-logo.png` at exactly that relative path.

The SQL file under `database/` and the design documents under `docs/` are not Cloudflare Pages runtime assets. Do not copy them into the public root. The PostgreSQL schema is only for a separate staging database after a database provider and Hyperdrive binding are configured. No PostgreSQL binding or marketplace API should be assumed to exist just because the SQL/documentation is included.

After deploying the Apps Script update, check Admin → Stores → Edit website / Store Experience Studio. Set the mode/category/navigation and save with the Admin security PIN. Service flags remain fail-closed until the PIN-protected activation succeeds. Test each mode using a staging shop before applying it to customer-facing production stores.
