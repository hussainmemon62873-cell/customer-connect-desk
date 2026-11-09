# CCD Upgrade — Admin-only storefront, media studio and wildcard subdomains

## What changed in this release

- Added an Admin-only media studio to the existing **Edit website / theme** modal.
- Admin can add image/video URLs, captions, visibility, remove items, and upload images/videos directly.
- Added public storefront media rendering for visible image/video entries. The media area appears as a Gallery tab only when there is visible media.
- Added `media` as a JSON content field in the existing `StoreContent` sheet. No new media sheet is required.
- Added an authenticated Cloudflare Worker upload endpoint. It checks the short-lived Super Admin session through the Apps Script backend before accepting an upload, validates allowed MIME types and file signatures, and writes files to R2.
- Added a Cloudflare Worker wildcard-host router. It maps tenant hostnames to the existing Pages project and rewrites clean paths to the existing HTML files.
- Added tenant-host detection in storefront, merchant, desk and NFC frontend scripts. Legacy `?shop=` links remain supported as fallback.
- Changed generated public links to the selected subdomain pattern.
- Enforced the Admin-only storefront content model on the backend. Merchant sessions can no longer update storefront pricing, offers or public contact details. Merchant operational workflows (customer visits, NFC approval and shop open/close status) remain available.
- Added `verifyAdminSession` Apps Script action for Worker-side authorization.

## Public URL model

| URL | Resolves to |
|---|---|
| `https://ccd.dev` | Existing platform landing page (Pages custom domain) |
| `https://www.ccd.dev` | Platform landing page through Worker |
| `https://admin.ccd.dev` | `admin.html` |
| `https://register.ccd.dev` | `register.html` |
| `https://memonlock.ccd.dev/` | `shop.html` for `memonlock` |
| `https://memonlock.ccd.dev/desk` | `desk.html` for `memonlock` |
| `https://memonlock.ccd.dev/merchant` | `merchant.html` for `memonlock` |
| `https://memonlock.ccd.dev/customer` | `customer.html` |
| `https://memonlock.ccd.dev/nfc` | `nfc.html` for `memonlock` |
| `https://media.ccd.dev/<object-key>` | Public media object served from R2 |

The hostname is the tenant ID. Reserved platform hostnames (`www`, `admin`, `register`, `api`, `assets`, `support`, `mail`, `media`) are not treated as shop IDs.

## Cloudflare setup — required before the subdomains work

Cloudflare Pages does not support wildcard custom domains for Pages projects. This release therefore uses a Worker route on a proxied wildcard DNS record; the Worker proxies static requests to the existing Pages origin. See Cloudflare's wildcard DNS and Worker routing documentation.

1. Add `ccd.dev` to the same Cloudflare account/zone that hosts the Pages project.
2. In **Pages → customer-connect-desk → Custom domains**, attach `ccd.dev` to the Pages project. Keep the existing `customer-connect-desk.pages.dev` hostname working as the fallback during migration.
3. In **DNS**, add a wildcard record:
   - Type: `A`
   - Name: `*`
   - IPv4: `192.0.2.1` (Cloudflare's reserved placeholder pattern for proxied Worker routes)
   - Proxy status: **Proxied**
   - Do not add a Pages wildcard custom domain.
4. Deploy `worker.js` as a Cloudflare Worker using the included `wrangler.toml`, or create a Worker manually and attach the route `*.ccd.dev/*` to zone `ccd.dev`.
5. Bind an R2 bucket to the Worker:
   - Binding name: `MEDIA_BUCKET`
   - Bucket name: `ccd-public-media` (or change `wrangler.toml` to your actual bucket name)
6. Set Worker variables:
   - `PAGES_ORIGIN` = `https://customer-connect-desk.pages.dev`
   - `PUBLIC_MEDIA_BASE` = `https://media.ccd.dev`
   - `GAS_URL` = the verified active Apps Script Web App URL from Apps Script → Deploy → Manage deployments
7. In Google Cloud Console → APIs & Services → Credentials, add `https://ccd.dev` and `https://admin.ccd.dev` to the OAuth client Authorized JavaScript origins (keep the existing Pages origin during migration).
8. Confirm the wildcard route is active and the wildcard DNS record is proxied. Test `admin.ccd.dev`, `register.ccd.dev` and one shop subdomain before changing printed QR codes.

## Apps Script deployment

1. Replace the production-bound `Code.gs` with this package's `Code.gs`.
2. Save and update the existing Web App deployment to a **New version**. Preserve the existing execute-as and access settings.
3. Keep the same deployment URL if possible. If it changes, update the Apps Script URL in all frontend callers and set the same URL in the Worker `GAS_URL` variable.
4. No R2 credentials or Admin secrets are placed in `Code.gs`, the browser JavaScript, or this ZIP.

## R2 media upload behavior

- Browser uploads go to `https://admin.ccd.dev/upload`.
- The Admin browser sends its current session token in the Authorization header; the Worker asks Apps Script to validate it using `verifyAdminSession`.
- Allowed formats: JPG, PNG, WebP, GIF, MP4 and WebM.
- Maximum file size: 25 MB per file.
- The Worker verifies basic file signatures before writing the object.
- Object keys are generated by the Worker under `<shopId>/<random-id>.<extension>`; the browser cannot choose an arbitrary R2 object key.
- R2 object URLs are public because the shop's storefront media must be publicly viewable. Do not upload private/customer documents.
- URL mode accepts an existing public HTTP(S) media URL. Prefer HTTPS URLs.

## Admin-only access model

Only the Super Admin can edit storefront identity/content, media, service descriptions, pricing, promotional content, public contact/review details, and reusable email/WhatsApp templates. Merchant dashboard operational functions remain: customer/visit view, NFC approvals, and open/closed status. Merchant attempts to call the blocked storefront-update APIs are rejected server-side; hiding a form alone is not the security control.

## Data compatibility

- Existing sheets and columns are retained.
- `StoreContent` receives a `media` JSON content key per shop, using the existing upsert/read mechanism.
- Existing `banners` remain supported; this release does not migrate or delete them.
- Legacy links such as `shop.html?shop=memonlock` continue to work on the Pages hostname. New Admin-generated links use the `memonlock.ccd.dev` pattern.

## Acceptance checklist after deployment

1. `admin.ccd.dev` opens Admin and Google sign-in works.
2. Admin can edit an existing shop; URL rows, video rows and media upload controls appear.
3. URL mode: add a public image URL and a public MP4/WebM URL, save, then confirm both appear in the shop Gallery tab.
4. Upload mode: upload a small test image and video; confirm the returned `media.ccd.dev` links load and the storefront renders them.
5. Open `memonlock.ccd.dev/`, `/desk`, `/merchant` and `/nfc`; confirm each resolves to the correct shop without a `?shop=` query.
6. Confirm old `shop.html?shop=memonlock` still works.
7. Confirm merchant cannot edit website pricing, promo or public contact details, but can still access customer visits, NFC approval and open/close controls.
8. Confirm `MessageTemplates` remains Admin-editable and customer email consent rules remain unchanged.

## Not verified by local tests

The ZIP can verify JavaScript syntax and mocked Apps Script/Sheets behavior, but it cannot verify your Cloudflare account, DNS, Worker deployment, R2 bucket, live Google OAuth, Apps Script deployment, or live browser rendering. Those require the deployment and acceptance checks above. No live service was changed by creating this ZIP.
