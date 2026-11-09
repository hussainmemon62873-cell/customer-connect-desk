# Release Configuration

## Active Apps Script Web App URL embedded in frontend callers

`https://script.google.com/macros/s/AKfycbyoFCx6UgGKFmgDxkQePZOuWhWEGqNn5wro0qXfGvb8d31hhTkzZKjMFnCDB9z93wmi/exec`

This is the URL supplied for the current deployment. It is configured in `admin.js`, `merchant.js`, `desk.js`, `customer.js`, `register.js`, `shop.js`, `nfc.js`, the inline script in `index.html`, and the Cloudflare Worker `GAS_URL` setting in `wrangler.toml`.

## Cloudflare Pages base URL

`https://customer-connect-desk.pages.dev`

Verify the live Cloudflare Pages domain. If a custom domain is used, update `BASE_DOMAIN` in `admin.js` and `merchant.js`, and `PUBLIC_BASE_URL` near the top of `Code.gs` consistently.

## Google Identity Services

The OAuth Client ID is kept consistent between `Code.gs`, `admin.html` and `index.html`. Confirm the actual Cloudflare Pages origin is listed in the OAuth client's Authorized JavaScript origins.

## Required Script Properties

| Property | Requirement |
|---|---|
| `ADMIN_SECURITY_PIN` | **Required.** Use a strong private passphrase/PIN (prefer 8+ characters). Needed for Admin theme changes, service switches, lifecycle actions, message template edits/sends and merchant PIN changes. Never place it in frontend files or GitHub. |
| `SUPER_ADMIN_EMAIL` | Use only if the existing locked Super Admin identity is configured through Script Properties. The existing Master-Sheet T2 lock is also supported. |
| `ADMIN_SETUP_PASSWORD` | Only for the initial Super Admin lock procedure if the existing project has not been initialized. Do not embed it in source. |

## Message template keys

- `OWNER_STATUS` — owner email and owner WhatsApp draft.
- `CUSTOMER_VISIT` — customer visit email and merchant WhatsApp follow-up.
- `SHOP_CONTACT` — public shop website WhatsApp contact message.
- `SYSTEM_BACKUP` — annual backup notification email.

Templates are stored in `MessageTemplates`. Admin opens **Messages & templates** once to seed defaults. Saved edits are used by later sends. Customer email requires `EmailOptIn=YES` in `CustomerProfiles`.

## Communication status semantics

- `SENT`: Apps Script `MailApp.sendEmail()` returned without throwing. This is **not** inbox delivery confirmation.
- `FAILED`: the send call threw an error.
- `SKIPPED_CONSENT`: customer email was not sent because EmailOptIn was not recorded.
- `PREPARED`: WhatsApp draft is ready/opened; a person must press Send in WhatsApp.
- `DELIVERED`: not implemented; no delivery-receipt provider is connected.

## Shop service setup

`ShopServices` is fail-closed. A missing row means both services are disabled. After deployment, Admin must enable the required Phase 1 and Phase 2 flags per shop from Admin → Shops → Edit website/theme. Phase 2 combines public Shop Website and Pricing. The Admin **View Website** action enables Phase 2 with the Admin security PIN before opening the public shop.

## New/auto-created spreadsheet tabs

The backend creates the following tabs with headers if missing: `RegistrationRequests`, `StoreLifecycle`, `MessageTemplates`, `CustomerProfiles`, `ShopServices`, `NFC_Sessions`, `ApprovalRequests`, `CommunicationsLog`, `SecurityEvents`. Existing tabs are not renamed or reordered. `PriceHistory`, `Master-Sheet`, `Master-Customers`, `Visits`, `StoreContent`, `StoreSettings`, `StorePolicies` and `AuditLog` remain in use.

## Apps Script deployment

Update the existing Apps Script project with the complete `Code.gs`, save, authorize MailApp/UrlFetch when prompted, then edit the existing Web App deployment to publish a new version. Preserve the project's current execute-as and access settings. Do not create a new unrelated Apps Script project unless the spreadsheet binding and deployment URL are intentionally changed.

## CCD subdomain and media upgrade

- Platform root: `https://ccd.dev`
- Admin: `https://admin.ccd.dev`
- Registration: `https://register.ccd.dev`
- Tenant public site: `https://<shopId>.ccd.dev/`
- Tenant Desk: `https://<shopId>.ccd.dev/desk`
- Tenant merchant dashboard: `https://<shopId>.ccd.dev/merchant`
- Tenant NFC approval: `https://<shopId>.ccd.dev/nfc`
- Media public origin: `https://media.ccd.dev`
- Wildcard Worker source: `worker.js`
- Wrangler config: `wrangler.toml`
- R2 binding: `MEDIA_BUCKET` → `ccd-public-media`
- Worker variables: `PAGES_ORIGIN`, `PUBLIC_MEDIA_BASE`, `GAS_URL`

The Worker and R2 bucket must be deployed/configured in the user's Cloudflare account. The ZIP contains source and setup instructions only; it does not deploy DNS, Worker routes, R2, or Apps Script changes.

## Admin-only storefront content

Storefront content, media, pricing, promotional content, public contact/review details and reusable message templates are Admin-only. Merchant operational functions remain available. The Apps Script backend rejects merchant update requests for storefront pricing, promo and contact details.
