# CCD SEO / AI / Social file map

All files below are included in the release ZIP.

## Cloudflare Pages project root

| File | Public URL after deployment | Purpose |
|---|---|---|
| `platform.html` | `https://ccd.dev/` | Crawlable public CCD home page with platform information and structured data. |
| `platform.css` | `/platform.css` | Responsive visual styling for the public platform page and policy page. |
| `adsense.js` | `/adsense.js` | Optional AdSense loader. It stays off until a real approved publisher ID and real ad-slot IDs are provided. |
| `sitemap.xml` | `https://ccd.dev/sitemap.xml` | Static Pages fallback. On the custom domain, the Worker intercepts this URL and serves the live sitemap index. |
| `robots.txt` | `https://ccd.dev/robots.txt` | Static Pages fallback only. On the custom domain, the Worker serves the live crawler policy. |
| `acceptable-use.html` | `https://ccd.dev/acceptable-use` | Public platform acceptable-use policy. |
| `llms.txt` | `https://ccd.dev/llms.txt` | Concise factual overview for AI tools that choose to read it. |
| `llms-full.txt` | `https://ccd.dev/llms-full.txt` | Expanded factual platform and capability reference for AI tools that choose to read it. |
| `assets/ccd-social-preview.png` | `https://ccd.dev/assets/ccd-social-preview.png` | Default 1200 × 630 Open Graph / social share image. |

## Dynamic Worker / Apps Script files

| File | Purpose |
|---|---|
| `worker.js` | Serves apex and tenant pages, dynamic robots and sitemap routes, server-side SEO metadata, JSON-LD and social preview tags. |
| `wrangler.toml` | Cloudflare Worker routes, Pages origin, public media origin and R2 bucket binding. |
| `Code.gs` | Adds public SEO snapshot and paginated public shop-directory actions backed by the existing Google Sheets workbook. |
| `shop.html`, `shop.js` | Tenant storefront markup and professional share action. `shop.js` respects public content visibility when building browser metadata/share text. |

## What gets indexed

- `https://ccd.dev/` — public platform page.
- `https://ccd.dev/acceptable-use` — public policy page.
- `https://{shop-id}.ccd.dev/` — only ACTIVE stores with the public website feature enabled, and only the Admin/business-approved public fields.

## What must not be indexed or published

Admin, registration, merchant, customer, Desk, NFC and check-in operational pages; customer names, phone/email, DOB, visit history, owner/admin private identity, authentication tokens, PINs, OTPs, hidden content, spreadsheet data or internal notes.

## Important notes

- `llms.txt` is not a Google ranking technique. Google says its Search systems ignore it for Search ranking/inclusion. It is optional documentation for AI tools that decide to read it.
- Google AI Overviews / AI Mode are controlled through normal Google Search crawl/indexing and the property's Search generative AI setting in Search Console. Google-Extended is a separate Gemini Apps / Vertex grounding/training control and is disallowed by default in this release.
- A sitemap supports discovery but does not guarantee indexing. Search engines and AI systems decide what they crawl, include or cite.
- Meta / WhatsApp / LinkedIn previews are created from server-side Open Graph / Twitter metadata. After deployment, refresh links in the Meta Sharing Debugger: https://developers.facebook.com/tools/debug/ .
- No AdSense publisher ID, ad-slot ID, Search Console verification token, legal business identity or contact address has been fabricated.
- This is source-only. Pages, Worker, DNS, Apps Script, Search Console and social preview caches must be updated/verified in their respective accounts.
