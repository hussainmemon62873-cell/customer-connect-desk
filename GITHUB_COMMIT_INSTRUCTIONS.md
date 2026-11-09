# GitHub Commit Instructions

Repository: `hussainmemon62873-cell/customer-connect-desk`  
Target branch: `main`

## Runtime source files to replace/add

- `index.html`
- `admin.html`, `admin.css`, `admin.js`
- `merchant.html`, `merchant.css`, `merchant.js`
- `desk.html`, `desk.css`, `desk.js`
- `customer.html`, `customer.css`, `customer.js`
- `register.html`, `register.css`, `register.js`
- `shop.html`, `shop.css`, `shop.js`
- `nfc.html`, `nfc.css`, `nfc.js`

That is 22 frontend runtime files. `Code.gs` is the separate Apps Script backend. Keep it outside the Cloudflare Pages public root, for example under a private source-control folder such as `Apps-Script/Code.gs`, or manage it directly in the bound Apps Script project. The Apps Script editor must receive the complete `Code.gs` file.

## Release documentation

The release includes `README.md`, `API_MAPPING.md`, `DATABASE_COMPATIBILITY.md`, `SECURITY_AUDIT.md`, `TEST_REPORT.md`, `RELEASE_CONFIG.md`, `DEPLOYMENT_INSTRUCTIONS.md`, `IMPLEMENTATION_AUDIT_2026-11-05.md`, `SOURCE_AUDIT.md`, `RELEASE_MANIFEST.md`, `CODE_CHANGELOG.md`, `FRONTEND_STATIC_AUDIT.json`, `FILE_CHECKSUMS.sha256` and the `tests/` directory.

Do not upload `tests/` or audit files into the public Cloudflare Pages root. Do not commit customer data, production spreadsheet exports, OAuth secrets, `ADMIN_SECURITY_PIN`, merchant PINs or passwords.

## Suggested commit sequence

1. Back up current `main` and the live Apps Script project.
2. Compare the 23 required source files and inspect the diff before committing.
3. Confirm the Apps Script URL and Cloudflare domain in `RELEASE_CONFIG.md`.
4. Commit the frontend source and release docs; keep Apps Script source outside the Pages public root.
5. Update the existing bound Apps Script project and deploy a new Web App version separately.
6. Wait for Cloudflare Pages deployment, then follow the live acceptance checklist in `DEPLOYMENT_INSTRUCTIONS.md`.

No GitHub commit, pull request or live deployment is performed by this package-generation process.
