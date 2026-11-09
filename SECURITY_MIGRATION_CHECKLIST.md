# Security Deployment Checklist — CCD / Google Sheets

## Before deploying

- [ ] Make a copy of the live spreadsheet and export the current Apps Script source.
- [ ] Confirm the new source is bound to the same intended workbook and compare every existing tab/header before deployment.
- [ ] Keep spreadsheet Editor access limited to trusted operators.
- [ ] Set a unique strong `ADMIN_SECURITY_PIN` in Script Properties.
- [ ] Deploy the backend to a staging copy and authorize Apps Script MailApp.
- [ ] After first secure auth, verify `CCD_AUTH_PEPPER` was generated; preserve it securely.

## Existing shop readiness

- [ ] Use Admin to set a custom 6–12 digit merchant PIN for every active shop.
- [ ] Do not rely on the old last-four-mobile login: it is disabled.
- [ ] Confirm every shop has the expected `ShopServices` flags and lifecycle status.

## Customer / registration readiness

- [ ] Confirm Customer Hub customers have a valid email address in `Master-Customers`.
- [ ] Test OTP email, one-use verification, 10-minute expiry and wrong-code handling.
- [ ] Test Desk profile lookup reveals no saved customer PII or owner private contact fields.
- [ ] Test legacy `checkUser` / `checkCustomerStatus`: phone-only access must fail; only a matching verified Google email may retrieve the linked customer profile.
- [ ] Test a returning Desk check-in with the correct name, then a deliberately wrong name.
- [ ] Test registration status with request ID + secure token, and confirm shop ID + email alone are rejected.

## Worker / tenant checks

- [ ] Test a valid Admin media upload for an active shop.
- [ ] Test a bad origin, invalid token, inactive/nonexistent shop, file-signature mismatch and file over the 25 MB limit.
- [ ] Sign in to Shop A and try Shop B API payloads; verify tenant isolation.
- [ ] Suspend/archive a shop and verify existing merchant sessions stop working.
- [ ] Test in mobile Safari/iOS and Android Chrome after deployment.

## Final sign-off

- [ ] Run `bash tests/run_checks.sh` and retain the report.
- [ ] Perform real Google OAuth and MailApp tests in staging.
- [ ] Confirm no existing Sheet tab is renamed/deleted and no existing customer rows are overwritten.
- [ ] Review `SECURITY_AUDIT.md` and consciously accept the residual Google Sheets / CacheService / Apps Script limits.
- [ ] Deploy a new version of the existing Apps Script deployment only after all staging tests pass.
- [ ] Publish the corresponding Pages/Worker files only after confirming runtime URLs and origins.

**No live data migration is part of this release.**
