# Frontend / Apps Script API Mapping

Frontend callers use JSON request bodies or URL-encoded `postData` form payloads, depending on the page. The Apps Script `doPost(e)` parser accepts both formats, including URL-encoded request bodies, to handle the previous `Unexpected token 'p' / postData=%` parsing failure. The active endpoint is recorded in `RELEASE_CONFIG.md`.

## Main actions

| Action | Purpose | Access |
|---|---|---|
| `adminAuth`, `getAdminData` | Google identity verification and Admin dashboard data | Admin |
| `getMessageTemplates`, `saveMessageTemplate` | Read/edit shared dynamic templates | Admin; edits require `ADMIN_SECURITY_PIN` |
| `sendOwnerEmail`, `logWhatsAppDraft` | Send owner email / prepare owner WhatsApp draft | Admin; requires PIN |
| `getCommunicationStatus` | Communication history | Admin |
| `getPriceHistory` | Admin price history | Admin |
| `setShopLifecycle` / `deleteStore` | Suspend, archive, restore (delete alias is soft archive) | Admin + PIN |
| `setShopServices` | Enable/disable Phase 1 and Phase 2 | Admin + PIN |
| `setShopDashboardTheme` | Save one of 20 dashboard themes | Admin + PIN |
| `setMerchantAccessPin` | Save hashed 6–12 digit shopkeeper PIN | Admin + PIN |
| `setRegistrationRequestStatus` | Approve/reject public registration requests | Admin |
| `setStoreRegistrationStatus` | Approve only legacy PENDING shop rows | Admin; cannot suspend/archive/restore |
| `registerStore`, `registrationLookup`, `getRegistrationStatus` | Mobile-first public registration, duplicate lookup and status | Public; lookup rate-limited |
| `getStoreConfig` | Public Desk/Shop config or authenticated Merchant config | Server enforces client type, service phase and merchant session |
| `customerCheckin` | Desk customer lookup/check-in | Public; Phase 1 required for check-in |
| `nfcStart`, `nfcDecision` | NFC repeat-visit approval | Public start; shop-scoped Merchant session for decision |
| `verifyMerchantPin`, `getMerchantData` | Merchant login and dashboard data | Merchant |
| `logMerchantWhatsAppDraft` | Prepare customer WhatsApp follow-up with consent check | Merchant + Phase 1 |
| `updateMerchantPricing`, `updateStoreStatus`, `updateMerchantProfile`, `updateMerchantPromo` | Shop Website/Pricing updates | Merchant + Phase 2 |
| `getCustomerDashboardData` | Customer Hub | Email OTP verification followed by a short-lived customer session; rate-limited |

## Service phase enforcement

- `DESK` config and `customerCheckin` require Phase 1.
- `SHOP`/default public config and direct `doGet` shop requests require Phase 2.
- `MERCHANT_BOOTSTRAP` returns only safe bootstrap fields when either phase is enabled.
- `MERCHANT` config requires a valid shop-scoped merchant session.
- Merchant pricing, public status, promo and profile updates require Phase 2.
- Merchant customer data, approvals and communication history are returned only when Phase 1 is enabled.

## Template placeholders

- Owner: `{{ownerName}}`, `{{shopName}}`, `{{shopId}}`, `{{ownerEmail}}`, `{{ownerMobile}}`, `{{deskUrl}}`, `{{shopUrl}}`, `{{merchantUrl}}`, `{{registrationStatus}}`.
- Customer: `{{customerName}}`, `{{customerEmail}}`, `{{customerMobile}}`, `{{totalVisits}}`, `{{visitDate}}`, `{{shopName}}`, `{{shopUrl}}`.
- Shop contact: `{{shopName}}`, `{{shopId}}`, `{{shopUrl}}`.
- System backup: `{{year}}`, `{{backupTitle}}`, `{{backupUrl}}`, `{{ownerName}}`.

## Response conventions

- Success: `{ "status": "success", ... }`.
- Failure: `{ "status": "error", "message": "..." }`.
- Email `messageStatus`: `SENT` or `FAILED`.
- WhatsApp `messageStatus`: `PREPARED`; never claim it was sent by the platform.


## New actions

- `verifyAdminSession` — validates a current Super Admin session token for the Cloudflare media Worker; returns only role and email on success.
- `updateStoreContent` now accepts `media` (JSON array) and `layoutStyle` (text) in addition to existing content fields. Merchant session endpoints for pricing, promotion and public contact updates reject writes under the Admin-only storefront access model.
