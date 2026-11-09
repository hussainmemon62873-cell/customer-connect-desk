# Release Manifest

## Existing application runtime source files — 23 required

- `Code.gs`
- `index.html`
- `admin.html`, `admin.css`, `admin.js`
- `merchant.html`, `merchant.css`, `merchant.js`
- `desk.html`, `desk.css`, `desk.js`
- `customer.html`, `customer.css`, `customer.js`
- `register.html`, `register.css`, `register.js`
- `shop.html`, `shop.css`, `shop.js`
- `nfc.html`, `nfc.css`, `nfc.js`

## New Cloudflare runtime files

- `worker.js` — wildcard subdomain router, authenticated media upload and R2 public object serving
- `wrangler.toml` — Worker route and R2 binding configuration
- `CCD_UPGRADE_IMPLEMENTATION.md` — subdomain, R2, media editor and Admin-only access setup

## Validation and operator documents

- `README.md`
- `RELEASE_CONFIG.md`
- `DEPLOYMENT_INSTRUCTIONS.md`
- `DATABASE_COMPATIBILITY.md`
- `API_MAPPING.md`
- `SECURITY_AUDIT.md`
- `SECURITY_MIGRATION_CHECKLIST.md`
- `docs/APPER_SECURITY_MODEL_REVIEW.md`
- `IMPLEMENTATION_AUDIT_2026-11-05.md`
- `SOURCE_AUDIT.md`
- `TEST_REPORT.md`
- `FRONTEND_STATIC_AUDIT.json`
- `CODE_CHANGELOG.md`
- `GITHUB_COMMIT_INSTRUCTIONS.md`
- `IMPLEMENTATION_AUDIT_2026-11-04.md` (historical, superseded)
- `FILE_CHECKSUMS.sha256`
- `tests/audit_project.py`
- `tests/backend_mock_test.js`
- `tests/run_checks.sh`

## Deployment mapping

- Copy the 22 frontend runtime files (HTML/CSS/JS including `index.html`) to the existing Cloudflare Pages root. Deploy `worker.js` separately with `wrangler.toml`; do not upload Worker code as a Pages asset.
- Copy `Code.gs` into the existing spreadsheet-bound Apps Script project and deploy a new version of the existing Web App.
- Do not upload `tests/` or audit files to the public Pages root.

## Version

CCD Complete Source Update — 7 November 2026

## 8 November 2026 premium experience / marketplace design additions

### New Pages runtime assets
- `brand-loader.css` — shared MPlus splash overlay styling.
- `brand-loader.js` — shared loader lifecycle and reduced-motion/failsafe behaviour.
- `premium-ui.css` — shared responsive design layer and category presentation profiles.
- `assets/mplus-logo.png` — the MPlus logo/tagline asset used by the loading overlay.

### New design/schema/test files
- `docs/CCD_MARKETPLACE_ARCHITECTURE.md`
- `docs/CCD_DATABASE_MIGRATION_PLAN.md`
- `docs/CCD_RELEASE_STATUS_2026-11-08.md`
- `database/ccd_marketplace_schema_postgres.sql`
- `database/README.md`
- `tests/audit_marketplace_schema.py`

Version: **CCD Premium Experience + Apper-Inspired Security Hardening — 8 November 2026**.
