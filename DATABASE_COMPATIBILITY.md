# Database Compatibility and Sheet Mapping

The backend remains bound to the existing `Customer Connect Desk - FY 2026-27` spreadsheet. Existing legacy tabs are read/written in place; the code does not rename, reorder or migrate their headers.

## Existing tabs retained

| Tab | Use / compatibility note |
|---|---|
| `Master-Sheet` | Canonical shop registry. Existing legacy column positions are preserved. Registration status remains column 12; the unusual legacy N/O values for open/closed and closing time are not renamed or reordered. |
| `Master-Customers` | Canonical cross-shop customer identity/visit aggregate. Existing key and column structure is retained. |
| `Visits` | Existing visit history retained. Existing `FormattedPhone` cells may contain `#ERROR!`; phone matching uses normalized phone values, not that formula column. |
| One tenant tab per shop | Existing tenant visit/check-in rows remain in place. The established A:L layout is not changed. |
| `StoreContent` | Public website content and pricing data. Existing rows remain. |
| `StoreSettings` | Per-shop settings, including the selected `dashboardTheme` and hashed `merchantPinHash`. |
| `StorePolicies` | Existing global/store policy data retained. |
| `PriceHistory` | Existing price-change history. Admin read-only history view reads the existing column order. |
| `AuditLog` | Existing general audit data retained. |

## New or auto-created tabs

The backend creates a tab with the following header if it is missing. If the tab already exists, it is used without renaming its header row.

### `RegistrationRequests`

`RequestId, ShopIdRequested, ShopName, Tagline, OwnerName, OwnerEmail, OwnerMobile, PrimaryColor, BgColor, CardBg, TextColor, ReviewUrl, MapEmbedUrl, ClosingTime, Status, ConflictFlags, CreatedAt, UpdatedAt, ReviewedBy, ReviewedAt, ApprovedShopId, IdempotencyKey`

Public registration requests are stored here until an Admin explicitly approves/rejects them. The idempotency key is hashed. Conflict flags are visible to Admin, not returned to the applicant.

### `StoreLifecycle`

`ShopId, LifecycleStatus, PreviousStatus, ChangedAt, ChangedBy, Reason`

Records suspend/archive/restore history. Archive is a soft-delete; tenant and customer data are preserved.

### `MessageTemplates`

`TemplateKey, Channel, Subject, Body, Enabled, UpdatedAt, UpdatedBy`

Default keys: `OWNER_STATUS`, `CUSTOMER_VISIT`, `SHOP_CONTACT`, `SYSTEM_BACKUP`. Templates are shared across shops and are editable from Admin → Messages & templates.

### `CustomerProfiles`

`CustomerKey, Phone, Name, Email, DOB, FirstShopId, TotalVisits, LastVisitTimestamp, WhatsAppOptIn, EmailOptIn, CreatedAt, UpdatedAt, ProfileStatus, PreferredLanguage, DataSource`

`Master-Customers` remains the canonical customer identity table. `CustomerProfiles` stores supplementary consent, including explicit `EmailOptIn`. Email is sent only when the stored consent is YES.

### `ShopServices`

`ShopServiceId, ShopId, CustomerConnectEnabled, WebsitePricingEnabled, CreatedByUserId, CreatedAt, UpdatedByUserId, UpdatedByName, UpdatedAt, EnabledAt, DisabledAt, AdminNotes`

Missing shop rows default to both services disabled. Phase 1 and Phase 2 are independently controlled. Phase 2 combines the public website and pricing features.

### `NFC_Sessions`

`SessionId, ShopId, TokenHash, CreatedAt, ExpiresAt, SessionStatus, CustomerKey, MobileHash, ApprovalRequestId, LastStep, LastSeenAt, ConsumedAt, IdempotencyKey, SourcePage`

Stores the shop-scoped NFC session lifecycle. Mobile matching uses a hash; no customer email/DOB is stored in this tab.

### `ApprovalRequests`

`RequestId, ShopId, CustomerKey, CustomerNameSnapshot, MobileNumber, MobileHash, NFCSessionId, RequestCreatedAt, ExpiresAt, Status, RespondedAt, RespondedByUserId, RespondedByName, DecisionReason, IdempotencyKey, LastUpdatedAt, RequestSource`

Stores five-minute shopkeeper approval requests. Merchant actions are scoped to the merchant session's shop.

### `CommunicationsLog`

`CommunicationId, ShopId, CustomerKey, VisitId, Channel, MessageType, RecipientSnapshot, ConsentStatus, ConsentCapturedAt, TemplateKey, MessageStatus, ProviderMessageId, QueuedAt, SentAt, DeliveredAt, FailedAt, ErrorCode, ErrorDetails, AttemptCount, LastAttemptAt`

`SENT` means MailApp accepted the request; `FAILED` means the send call threw; `SKIPPED_CONSENT` means no email was sent; `PREPARED` means a WhatsApp draft was created. `DELIVERED` is not currently produced.

### `SecurityEvents`

If missing, created with: `EventId, Timestamp, ActorEmail, ActorRole, ShopId, EventType, Outcome, Details, Source`. If an existing SecurityEvents header uses alternate names, the logger maps recognized header aliases and appends only to the existing sheet.

## Data integrity safeguards

- No destructive migration of existing Master-Sheet, Master-Customers, Visits or tenant tabs is performed.
- Soft-delete/archive does not delete a shop's tenant tab or customer history.
- Registration approval checks for an existing shop ID before writing; an Admin can choose a different approved slug.
- Price changes continue to append to `PriceHistory`.
- Customer EmailOptIn is supplementary and does not alter the `Master-Customers` header.
- `ShopServices` fails closed; Admin must enable services intentionally.

## 8 November experience settings compatibility

- Store mode, category and per-shop navigation are stored as additional content keys in the existing `StoreContent` tab (`experienceMode`, `categoryKey`, `layoutStyle`, `navigation`). The backend reads/writes the established positional content fields; the release does not rename, reorder or rewrite existing header cells.
- If `StoreContent` is missing entirely, the updated backend creates it with the content-key/value header format expected by the current `readStoreContent`/`upsertStoreContent` helpers. Existing tabs are reused without header changes.
- New product, enquiry, enquiry-message, notification-outbox and page/block data are **not** added to Google Sheets in this release. They belong to the PostgreSQL target schema under `database/` and are not live until a separate database/Worker implementation is deployed.
