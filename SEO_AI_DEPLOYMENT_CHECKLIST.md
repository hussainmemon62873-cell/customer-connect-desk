# CCD Search, AI Discovery, Social Preview & AdSense Deployment Checklist

## Included files

- `platform.html`, `platform.css` — public root landing page for `https://ccd.dev/`.
- `acceptable-use.html` — public acceptable-use policy (shared on the root domain).
- `robots.txt` — Pages.dev fallback only; the Cloudflare Worker generates the live custom-domain bot policy.
- `sitemap.xml` — static fallback; the Worker generates a live sitemap index and paginated tenant sitemap files on `ccd.dev`.
- `llms.txt`, `llms-full.txt` — concise and extended factual information for AI/search systems.
- `adsense.js` — optional, fail-closed AdSense loader. Ads are disabled by default.
- `assets/ccd-social-preview.png` — 1200 × 630 default share card.
- Updated `worker.js`, `wrangler.toml`, `Code.gs`, `shop.html`, `shop.js` — server-side tenant metadata, public SEO directory APIs, public sitemap routing, correct apex routing and share controls.

## Critical deployment sequence

1. Back up the existing Cloudflare Pages project, Worker and spreadsheet-bound Apps Script project.
2. Confirm the actual active Apps Script Web App URL at Apps Script → Deploy → Manage deployments. The URL embedded in the frontend and the Worker `GAS_URL` must match the active deployment. Do not use the placeholder in `wrangler.toml`.
3. Deploy the updated `Code.gs` to the existing Apps Script project as a new version. Preserve the current spreadsheet binding, execute-as setting and access setting.
4. Publish all new/updated Pages files and keep the `assets/` directory structure intact. `platform.html` must exist at the Pages root.
5. Deploy the updated Worker with BOTH routes in `wrangler.toml`: `ccd.dev/*` and `*.ccd.dev/*`. Confirm the apex and wildcard DNS records are proxied and point through the Worker as configured.
6. Configure Worker variables: `PAGES_ORIGIN`, `PUBLIC_MEDIA_BASE` and the verified active `GAS_URL`. Keep the existing R2 binding `MEDIA_BUCKET` and bucket `ccd-public-media`.
7. Test `https://ccd.dev/`, `https://ccd.dev/robots.txt`, `https://ccd.dev/sitemap.xml`, `https://ccd.dev/llms.txt`, `https://ccd.dev/acceptable-use`, and at least one active public shop such as `https://{shop-id}.ccd.dev/`. Also test that Admin, Merchant, Customer, Desk, NFC and registration routes are noindex/private as intended.

## Google Search setup

1. Add `ccd.dev` as a **Domain property** in Google Search Console. Complete ownership verification using the exact DNS TXT value Google provides. No verification token is invented or included in this source package.
2. Submit `https://ccd.dev/sitemap.xml` in Search Console. The Worker returns a sitemap index, then the root and eligible active public tenant sitemap pages.
3. Use URL Inspection on the root page and a few active tenant pages. Check the rendered/crawled HTML, canonical URL, indexability, image access, response code and robots accessibility.
4. In Search Console → Settings → Search generative AI, choose whether to include the property's public links/content in Google AI Overviews and AI Mode. This must be selected by the verified property owner; the source ZIP cannot change this Search Console setting.
5. Ensure real business profiles contain unique, accurate and useful descriptions, category, public services, public offers/prices, genuine images, address/phone only where the business has enabled public contact visibility, and correct maps/review links. Do not add hidden text, keyword stuffing, fake reviews or invented business facts.
6. Structured data is generated only from the public allow-listed information. Validate examples with Google's Rich Results Test / Schema Markup Validator after deployment. Structured data does not guarantee a rich result.
7. Request indexing for the root page and representative active shop pages after the sitemap is submitted. Recheck crawl status and performance reports over time; indexing is controlled by Google and is not guaranteed.

## AI search crawler policy

The custom-domain Worker robots response allows public search/answer crawlers such as Googlebot, Bingbot, OAI-SearchBot, PerplexityBot and Claude-SearchBot. Google AI Overviews and AI Mode use Google's normal Search crawling/indexing controls; Google-Extended is a separate control for Gemini Apps and Vertex AI grounding/training. This release disallows Google-Extended by default to avoid silently permitting those additional uses. If the operator explicitly wants public CCD pages available for Gemini Apps / Vertex AI grounding, change that rule to `Allow: /` after reviewing Google's combined use conditions. This separate choice does not control Google Search inclusion.

Social preview agents (`facebookexternalhit`, `Facebot`, `LinkedInBot`, `Twitterbot`, and WhatsApp's preview fetcher) are allowed to fetch public pages and images. GPTBot and ClaudeBot are disallowed as model-training crawlers, while the separate search crawlers remain allowed. `Content-Signal: search=yes, ai-input=yes, ai-train=no` expresses the publisher's preference where a crawler recognises Content Signals. These signals are machine-readable preferences, not technical access control or a guarantee of third-party compliance.

For Google AI Overviews / AI Mode, verify the site's Search generative AI setting in Search Console and select the inclusion option for links and content. This is a Search Console property setting, not something the source ZIP can switch. Google Search continues to rely on normal crawlability and its Search index; Google says normal SEO fundamentals still apply. `llms.txt` is provided for AI systems that choose to use it, but Google Search says it ignores `llms.txt` for ranking and inclusion.

Private operational routes must remain protected by authentication and must not be included in the sitemap. A robots disallow rule is not an access-control mechanism.

## Meta / WhatsApp / LinkedIn link previews

- The root platform landing page and Acceptable Use page include Open Graph and Twitter/X large-card metadata, image dimensions and image-alt descriptions; they use `assets/ccd-social-preview.png`.
- Each public tenant root is server-rendered by the Worker with shop-specific `title`, meta description, canonical URL, `og:title`, `og:description`, `og:url`, `og:image`, `og:image:alt`, `twitter:*` tags and `LocalBusiness` JSON-LD from the public SEO allow-list. Its visible public banner/gallery image is preferred; the CCD card is the fallback.
- `shop.js` also adds a “Share this shop” control. Mobile browsers use the native share sheet; other browsers use copy/WhatsApp fallback. The shared message includes a professional description and canonical link.
- After deployment, refresh a sample link using Meta Sharing Debugger: https://developers.facebook.com/tools/debug/ . Use “Scrape Again” after changing the title, description or image. Check the final public URL and make sure the image is publicly fetchable.
- Social crawlers do not reliably execute client-side JavaScript before creating previews. This is why the Worker writes tenant metadata into the initial HTML response.

## AdSense setup — deliberately OFF

`adsense.js` exists and is linked only from public platform/shop pages. It does nothing unless `window.CCD_ADSENSE_CONFIG.enabled === true`, the publisher ID matches a real `ca-pub-` ID and a valid slot is mapped to an explicit `data-adsense-slot` element.

Before enabling ads: obtain Google AdSense approval, use the actual publisher ID and real ad-slot IDs, create suitable ad positions on public pages, publish/complete the applicable privacy and consent disclosures, and review Google's programme policies. Do not place ads on Admin, Merchant, Customer Hub, Desk, NFC, registration, login, error or navigation-only views. No publisher ID or ad-slot ID is invented in this package.

## Legal / operator details still required

`acceptable-use.html` is a platform-use draft and expressly notes that it is not a substitute for complete Terms of Service or a Privacy Policy. Before production launch, confirm the legal operator/entity name, registered/business address, support/privacy/grievance contact, data retention, subprocessors, applicable law and complaint procedure with qualified legal review. Do not publish invented entity details.

## Public information to complete in each shop profile

To make each eligible shop page useful in Search and AI answers, the business/Admin should publish accurate, original information in the existing StoreContent / StoreSettings fields: full business name; short tagline; category; a clear home description; an about description; service names and descriptions; public pricing/offers; current, rights-cleared image/gallery assets; and (only when public contact visibility is enabled) a business address, public telephone, map URL and review URL. Keep the fields marked not visible out of the public page. Do not publish customer-level data, private owner contacts, visit logs or internal notes. The Worker and Apps Script expose only the public SEO allow-list.

For the platform page, the public source currently describes only deployed customer check-in, QR/NFC touchpoints, public shop pages, merchant operations and configured communications. Do not add catalogue checkout, customer enquiry workflows, payment processing or inventory claims until those functions are built and deployed.

## Expected outcome and limits

Google says its AI Search features use the same foundational search systems and SEO practices; the llms.txt files are optional documentation for AI tools that choose to read them, not a Google ranking mechanism. These changes make public CCD content technically easier for search engines, AI search crawlers and social preview bots to discover and interpret. They do not guarantee ranking, indexing, ChatGPT/Perplexity/Claude citation, AI Overview inclusion, or a social card on every messaging client. Search engines choose snippets and title links; crawlers may cache previews; robots and Content Signals depend on third-party compliance.
