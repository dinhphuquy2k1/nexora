# NEXORA-029 immutable design snapshot — full frontend migration v4

Task ID: NEXORA-029
Plan revision: rev-2026-10-22-frontend-migration-v4
Reviewed baseline: 3df6c6af3d126d02c9fd20a0dbad40a6e3d0a62d

---

## 1. Task Metadata & Classification

- Task identifier: `NEXORA-029`
- Task Title: Full Frontend Migration from Supplied Reference Design
- Classification: `SIGNIFICANT`
- Documentation Impact: `REQUIRED`
- Target Branch & PR: `feat/full-frontend-migration` / [PR #25](https://github.com/dinhphuquy2k1/nexora/pull/25)
- Active revision: `rev-2026-10-22-frontend-migration-v4`
- Snapshot location: `docs/tasks/design-reviews/NEXORA-029-rev-2026-10-22-frontend-migration-v4.md`
- Reviewed Baseline HEAD: `3df6c6af3d126d02c9fd20a0dbad40a6e3d0a62d`
- Approval Authority: `dinhphuquy2k1` (Repository Owner)
- Approval Status: `PENDING_REVIEW`

---

## 2. Requirements & Boundary Scope

### 2.1 Core Objectives

Execute a complete, faithful frontend migration of Nexora from the reference ZIP archive (`nexora-logistics-management (1).zip`), replacing existing UI presentation, component styling, typography, responsiveness, and interaction flows while strictly preserving:

1. Nexora's Next.js 16 App Router architecture and server-side routing model.
2. Centralized CSS Modules and design tokens in `apps/web/styles/tokens.css`.
3. Native local session authentication, HttpOnly cookies, CSRF protection via OriginGuard, and TOTP MFA for ADMIN roles.
4. Authoritative backend domain boundaries, Tactical DDD invariants, and OpenAPI transport contracts via `@nexora/sdk`.
5. Honest presentation of unimplemented backend capabilities: zero mock production records, zero fake tracking events, and zero fabricated freight calculation formulas.

### 2.2 Strict Architectural & Domain Boundaries

- **Ownership Boundaries**:
  - Technical UI ownership is partitioned across Tier A (`packages/ui/`), Tier B (`apps/web/components/`), and Tier C (`apps/web/features/`).
  - No aggregate, entity, or service logic in backend domains (`apps/api/src/customer/`, `apps/api/src/carrier/`, `apps/api/src/identity/`) is modified.
  - Zero direct database access, prisma client imports, or migration files in frontend code.
- **Dependency & Tooling Hygiene**:
  - Zero Vite or Tailwind CSS v4 runtime dependencies introduced into Nexora.
  - Zero `@google/genai` client packages or web scraping integrations.
  - Native Node.js test infrastructure and existing Chromium CDP smoke harness (`scripts/browser-login-smoke.mjs`) reused for visual/browser testing without adding Playwright or Puppeteer.
- **Pre-Code Stop Condition (ADR-009)**:
  - This review is strictly documentation-only. All implementation code, tests, dependencies, and database modifications are strictly prohibited until the repository owner posts an authenticated ADR-009 approval decision.

### 2.3 Applicable Decisions & Architectural Standards

- [ADR-002](../../decisions/product-scope.md): Accepted core product and domain boundaries (enterprise shipment/logistics hub vs. consumer retail/sourcing).
- [ADR-007](../../decisions/multi-carrier-architecture.md): Canonical multi-carrier contracts, carrier-connection lifecycle, and provider isolation.
- [ADR-008](../../decisions/tactical-ddd.md): Tactical DDD aggregates, value objects, and business invariants.
- [ADR-009](../../decisions/mandatory-pre-code-design-review.md): Mandatory pre-code design review, reuse audit, and strict 5-line approval governance.
- [`docs/architecture/frontend.md`](../../architecture/frontend.md): Canonical frontend architectural structure, route registry, and explicit UI sourcing exclusions.
- [`docs/architecture/api-contract.md`](../../architecture/api-contract.md): Canonical HTTP envelope, error mapping, and OpenAPI specification.

---

## 3. Technology Baseline & Environment Alignment

| Dimension           | Canonical Nexora Standard                  | Reference ZIP Implementation              | Migration Resolution & Disposition                                      |
| :------------------ | :----------------------------------------- | :---------------------------------------- | :---------------------------------------------------------------------- |
| **Framework**       | Next.js 16 App Router (React 19)           | Vite 6 + React 18 SPA                     | Next.js 16 App Router; file-system routes; server layouts               |
| **Styling**         | Pure CSS Modules + Centralized Tokens      | Tailwind CSS v4 (`@import "tailwindcss"`) | CSS Modules consuming `apps/web/styles/tokens.css`                      |
| **Typography**      | Inter variable font (`next/font/local`)    | Google Fonts Inter via CDN `<link>`       | Local `InterVariable.woff2` (SIL OFL 1.1; Vietnamese U+1EA0..U+1EF9)    |
| **Icons**           | Lucide React                               | Lucide React                              | Direct Lucide React icon components reused                              |
| **Authentication**  | Real HttpOnly cookie + TOTP MFA            | Simulated `isLoggedIn` React state        | Retain real Nexora session, OriginGuard, and MFA challenge flow         |
| **Data Contracts**  | Generated `@nexora/sdk` + `@nexora/shared` | Static mock arrays (`INITIAL_CUSTOMERS`)  | Real SDK calls for Customer & Carrier; honest empty states for Shipment |
| **Browser Testing** | Native Node.js + Chromium CDP harness      | None (Manual demo)                        | Extend existing Chromium CDP harness (`scripts/browser-*.mjs`)          |

---

## 4. Reusable Component Inventory & Reuse Boundaries (ADR-009 Audit)

To prevent component fragmentation and arbitrary line-count refactoring, UI ownership is strictly governed across three tiers:

```
┌─────────────────────────────────────────────────────────────┐
│                 Tier A: packages/ui                         │
│  Domain-neutral, multi-feature reusable UI primitives       │
│  (Button, TextInput, Select, Checkbox, Drawer, Dialog, etc.)│
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│            Tier B: apps/web/components/app-shell            │
│  Application shell, navigation chrome & session coordination│
│  (Header, Sidebar, AccountMenu, NotificationMenu, Scope)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                 Tier C: apps/web/features                   │
│  Domain-specific business pages, tables, filters & drawers  │
│  (features/customers, features/retail-packages, carriers)   │
└─────────────────────────────────────────────────────────────┘
```

### 4.1 Mandatory Component Reuse Matrix

| Proposed Component                 | Target Tier & Location                           | Existing Implementation on main       | Reuse vs. Create Rationale                                                                    | Architectural Boundary              |
| :--------------------------------- | :----------------------------------------------- | :------------------------------------ | :-------------------------------------------------------------------------------------------- | :---------------------------------- |
| `Button`, `IconButton`             | Tier A: `packages/ui/src/Button.tsx`             | Ad-hoc HTML buttons in web shell      | Create in `@nexora/ui`. Replaces repetitive button markup across all 4 screens.               | Domain-neutral UI primitive         |
| `TextInput`, `Select`, `Checkbox`  | Tier A: `packages/ui/src/TextInput.tsx`          | Ad-hoc `<input>` in LoginForm         | Create in `@nexora/ui`. Standardizes 36px/40px heights, focus rings, and ARIA error states.   | Domain-neutral form primitive       |
| `Drawer`, `Dialog`                 | Tier A: `packages/ui/src/Drawer.tsx`             | Prototypes in PR #22 branch           | Create in `@nexora/ui`. Standardizes backdrop, Escape dismissal, and focus trapping.          | Domain-neutral overlay primitive    |
| `StatusBadge`                      | Tier A: `packages/ui/src/StatusBadge.tsx`        | Existing `StatusBadge.tsx` on main    | **Reuse and extend** existing `@nexora/ui` primitive and `resolveStatusTone`.                 | Domain-neutral status indicator     |
| `Panel`                            | Tier A: `packages/ui/src/Panel.tsx`              | Existing `Panel.tsx` on main          | **Reuse** existing `@nexora/ui` panel for container surfaces and card borders.                | Domain-neutral layout container     |
| `Pagination`                       | Tier A: `packages/ui/src/Pagination.tsx`         | None on main                          | Create in `@nexora/ui`. Accessible page-selector reused across Customer and Package tables.   | Domain-neutral navigation primitive |
| `EmptyState`                       | Tier A: `packages/ui/src/EmptyState.tsx`         | Ad-hoc in web views                   | Create in `@nexora/ui`. Standardizes empty feedback icon, title, copy, and action slots.      | Domain-neutral feedback primitive   |
| `Sidebar`, `Header`                | Tier B: `apps/web/components/app-shell/`         | Existing shell in `apps/web`          | **Replace existing presentation** with reference ZIP navy (`#172B4D`) and orange accent.      | App-wide navigation chrome          |
| `ShippingScopeSelector`            | Tier B: `apps/web/components/app-shell/`         | Prototype in PR #22 branch            | Adapt PR #22 architecture into Header slot backed by real carrier connections API.            | App-wide carrier scope context      |
| `CustomerTable`, `CustomerFilters` | Tier C: `apps/web/features/customers/`           | None on main                          | Implement in feature module. Directly connects to Customer Backend V1 SDK endpoints.          | Customer domain presentation        |
| `AddressForm`                      | Tier C: `apps/web/features/customers/`           | None on main (ZIP has separate forms) | Single cohesive address component reused across Customer Create, Edit, and Address Drawer.    | Customer domain presentation        |
| `DeleteAddressModal`               | Tier C: `apps/web/features/customers/`           | None on main                          | Implement in feature module. Enforces 2-step default reassignment and deletion sequence.      | Customer domain presentation        |
| `PackageTable`, `PackageToolbar`   | Tier C: `apps/web/features/retail-packages/`     | 2,320-line monolithic ZIP file        | Decompose monolithic `RetailPackagesView.tsx` into 10 modular Tier C components.              | Shipment domain presentation        |
| `CarrierAccountsPage`              | Tier C: `apps/web/features/carrier-connections/` | Prototype in PR #22 branch            | Implement in feature module. Connects to real `/api/carriers` and `/api/carrier-connections`. | Carrier domain presentation         |

---

## 5. Tactical DDD Domain Invariants & Business Envelopes

### 5.1 Customer Domain Invariants (ADR-008)

1. **Mandatory Initial Address**: Every customer creation requires an initial recipient address (`address.addressText`).
2. **Address Cardinality**: A customer aggregate must contain at least one address (`Customer.addresses.length >= 1`).
3. **Sole Address Protection**: Attempting to delete a customer's sole address is rejected by the aggregate with HTTP 409 `LAST_CUSTOMER_ADDRESS`.
4. **Default Address Consistency**: Exactly one address must have `isDefault: true` at all times.
5. **Default Address Reassignment Sequencing**: Deleting the default address when alternative addresses exist requires explicit reassignment first via `PUT /api/customers/:id/default-address`. Direct deletion is rejected with HTTP 409 `DEFAULT_ADDRESS_REASSIGN_REQUIRED`.
6. **Phone Number Authority**: Customer phone numbers are normalized and stored in E.164 format. The backend is the sole authority for normalization and duplicate detection (`409 CUSTOMER_PHONE_EXISTS`).
7. **Sequence Code Invariance**: Customer codes are sequence-generated identifiers (`KH000001`) that cannot be edited or modified.

### 5.2 Carrier Domain Invariants (ADR-007)

1. **Single Supported Runtime Provider**: The runtime provider catalog (`CarrierService.providers()`) currently returns **only Uniship** (`{ provider: "uniship", displayName: "Uniship" }`). No other provider (GHN, GHTK, ViettelPost, J&T) is operational in the backend API.
2. **Connect Parameter Invariants**: Connecting a Uniship account requires exactly 4 keys: `provider`, `loginIdentifier` (1..128 chars), `password` (1..1024 chars), `displayName` (1..100 chars). Submitting unknown keys or non-Uniship providers is rejected with HTTP 400 `VALIDATION_ERROR`.
3. **No Credential Persistence in Client**: Plaintext passwords, tokens, or API keys are never stored in browser storage (`localStorage`, `sessionStorage`, cookies) and are never exposed in response DTOs (`usernameMasked` only).
4. **Owner Tenant Isolation**: All carrier connections are strictly isolated by owner ID. Attempting to access or disconnect another owner's connection returns HTTP 404 `NOT_FOUND`.
5. **Connection Test Boundary**: Nexora does not implement a standalone "Test Connection" endpoint. The UI must not simulate connection testing or silently trigger re-authentication.

### 5.3 Shipment Domain Boundaries

1. **Shipment Backend V1 Unimplemented**: Nexora has not yet implemented the Shipment Aggregate backend.
2. **Truthful Planned Presentation**: Retail Packages UI must render honest empty states and mark package creation/export as planned features ("Tính năng đang được phát triển").
3. **Zero Speculative Calculations**: No hardcoded freight rates (e.g., `28,000 VND/kg`) or mock tracking timelines. Missing rates are explicitly displayed as `"Chưa có báo giá"`.

---

## 6. Authentication, Session & Security Architecture

### 6.1 Login Remember Me Specification (Option 1 Selected)

- **Problem**: The reference ZIP includes a "Remember Me" checkbox, but Nexora's `POST /api/auth/login` contract accepts only `{ username, password }` with a fixed 7-day session cookie TTL (`SEVEN_DAYS_MS`).
- **Options Evaluated**:
  - _Option 1 (Recommended & Selected)_: Remember non-secret username in browser `localStorage` under `nexora_remembered_username`. When checked, the username is populated on `/login` load. When unchecked upon login, the key is removed. Zero storage of passwords, tokens, or MFA secrets; zero modification to server cookie TTL.
  - _Option 2_: Remove or disable the control. (Rejected: reduces visual parity with ZIP).
  - _Option 3_: True persistent sliding sessions. (Rejected: requires backend auth contract redesign outside frontend scope).
- **Security Rule**: The frontend will never persist sensitive credentials or session tokens in `localStorage`.

### 6.2 CSRF & OriginGuard Protection

All state-mutating requests (`POST`, `PATCH`, `PUT`, `DELETE`) are protected by NestJS `OriginGuard`, requiring valid `Origin` / `Referer` headers matching the deployment policy. The frontend SDK communicates exclusively via same-origin relative `/api/*` proxies.

### 6.3 TOTP MFA Authentication Flow

For ADMIN users, `POST /api/auth/login` returns `{ mfaRequired: true }` and sets a short-lived `nexora_mfa_token` cookie. The UI transitions to the 6-digit TOTP challenge modal. Verification is completed via `POST /api/auth/mfa/verify` with `{ code }`, which issues the canonical `nexora_session` cookie. Cancellation calls `POST /api/auth/mfa/cancel`.

---

## 7. Form Validation Architecture & Invariant Enforcement

### 7.1 Separation of Validation Ownership

```
┌────────────────────────────────────────────────────────────────┐
│               Frontend Lightweight UX Validation                │
│  - Required field presence & whitespace-only checks            │
│  - Character length constraints (name <= 200, address <= 2000) │
│  - Numeric range bounds (page >= 1, pageSize 1..100)           │
│  - Basic email format feedback (foo@bar.com)                   │
│  - Accessible inline aria-invalid and error message display    │
└───────────────────────────────┬────────────────────────────────┘
                                │ Transport: @nexora/sdk
┌───────────────────────────────▼────────────────────────────────┐
│             Backend Authoritative Domain Validation             │
│  - E.164 Phone Normalization & Country-specific algorithms     │
│  - Phone uniqueness across owner scope (CUSTOMER_PHONE_EXISTS) │
│  - Mandatory initial address cardinality                       │
│  - Aggregate invariant enforcement (LAST_CUSTOMER_ADDRESS)     │
│  - Default address reassignment (DEFAULT_ADDRESS_REASSIGN_REQ) │
│  - ISO 3166-1 alpha-2 country validation                       │
│  - Concurrency control & database transaction integrity        │
└────────────────────────────────────────────────────────────────┘
```

### 7.2 Verified Customer DTO Field Bounds (apps/api/src/customer/presentation/customer.dto.ts)

| Field Name       | Type / Format  | Minimum  | Maximum    | Required | Backend Behavior & Fallbacks                                    |
| :--------------- | :------------- | :------- | :--------- | :------- | :-------------------------------------------------------------- |
| `name`           | String         | 1 char   | 200 chars  | **Yes**  | Trimmed; customer display name                                  |
| `phone`          | String         | 1 char   | 64 chars   | **Yes**  | Valid VN national or international phone; normalized to E.164   |
| `recipientName`  | String         | 1 char   | 200 chars  | No       | Optional; defaults to customer `name` if omitted                |
| `recipientPhone` | String         | 1 char   | 64 chars   | No       | Optional; defaults to customer `phone` if omitted               |
| `label`          | String         | 1 char   | 100 chars  | No       | Optional/nullable address label (e.g., "Kho hàng", "Văn phòng") |
| `addressText`    | String         | 1 char   | 2000 chars | **Yes**  | Full address description text (required on address creation)    |
| `email`          | String (Email) | 1 char   | 254 chars  | No       | Optional/nullable RFC 5322 email                                |
| `note`           | String         | 1 char   | 5000 chars | No       | Optional/nullable customer notes                                |
| `countryCode`    | String         | 2 chars  | 2 chars    | No       | ISO 3166-1 alpha-2; defaults to `"VN"`                          |
| `q`              | String (Query) | 0 chars  | 200 chars  | No       | Customer list keyword search parameter                          |
| `pageSize`       | Integer        | 1        | 100        | No       | Pagination size; default 20                                     |
| `page`           | Integer        | 1        | Unlimited  | No       | Pagination page number; default 1                               |
| `addressId`      | String (UUID)  | 36 chars | 36 chars   | **Yes**  | Used in `PUT /api/customers/:id/default-address`                |

### 7.3 Edge Case Test Matrix for Field Bounds

The test suite will explicitly assert validation bounds without artificial client restrictions:

- **Customer Name**: Valid lengths: 1, 100, 101, 200 chars. Rejected: 0 chars, 201 chars, whitespace-only (`"   "`).
- **Address Text**: Valid lengths: 1, 255, 256, 2000 chars. Rejected: 0 chars, 2001 chars, whitespace-only.
- **Phone Input**: Valid VN formats (`0912345678`, `+84912345678`), valid international formats (`+14155552671`). Rejected: alphabetical characters, symbols (`abc`, `123-xyz`), lengths > 64 chars.
- **Nullable Fields**: `email` and `note` must accept `null`, `undefined`, or valid strings without throwing client runtime exceptions.
- **Unknown Fields**: Client form submissions must strip unknown properties to prevent backend `400 VALIDATION_ERROR` rejection.

---

## 8. Canonical API Error Contract & Mapping

### 8.1 Public Error Response Envelope (apps/api/src/http.ts)

Nexora's authoritative public error format is defined by `ApiErrorDto`:

```typescript
export class ApiErrorDto {
  code: string; // Machine-readable uppercase error token
  message: string; // User-facing localized summary
  requestId: string; // Traceable request correlation ID
}
```

_Crucial Implementation Rule_: The HTTP status code is obtained strictly from the HTTP response status (`res.status`), **never** from a nested `statusCode` property inside the JSON body. There is no `details: unknown[]` array in the production error contract.

### 8.2 Canonical Frontend Error Mapping Table

| HTTP Status | Authority Code                      | Domain Context     | Authoritative Cause                                 | Frontend Presentation & Recovery Behavior                                                                     |
| :---------- | :---------------------------------- | :----------------- | :-------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ |
| **400**     | `VALIDATION_ERROR`                  | Global             | Malformed JSON, unknown fields, or bound violation  | Display form-level error banner. Render inline error only if field was locally validated.                     |
| **400**     | `CANNOT_CONNECT_CARRIER_ACCOUNT`    | Carrier            | Invalid provider credentials or duplicate account   | Render error on Carrier drawer: "Không thể kết nối tài khoản này. Vui lòng kiểm tra lại thông tin đăng nhập." |
| **401**     | `UNAUTHORIZED`                      | Global             | Missing, expired, or invalid session token          | Redirect to `/login` preserving sanitized `?returnUrl=...`. Zero custom session managers.                     |
| **401**     | `PROVIDER_AUTH_FAILED`              | Carrier            | Carrier rejected credentials during reconnect       | Render error on Reconnect modal: "Xác thực với nhà cung cấp thất bại. Vui lòng kiểm tra lại mật khẩu."        |
| **403**     | `FORBIDDEN`                         | Global             | OriginGuard mismatch or insufficient role           | Display safe access denied notification: "Không có quyền thực hiện thao tác này."                             |
| **404**     | `NOT_FOUND`                         | Customer / Carrier | Resource does not exist or belongs to another owner | Treat nonexistent and inaccessible resources identically. Render customer/connection not found view.          |
| **409**     | `CUSTOMER_PHONE_EXISTS`             | Customer           | Phone number already registered under this owner    | Highlight `phone` input with error: "Số điện thoại này đã được sử dụng cho một khách hàng khác." Keep input.  |
| **409**     | `LAST_CUSTOMER_ADDRESS`             | Customer           | Attempted deletion of sole customer address         | Display alert modal: "Không thể xóa địa chỉ cuối cùng của khách hàng." Abort deletion.                        |
| **409**     | `DEFAULT_ADDRESS_REASSIGN_REQUIRED` | Customer           | Attempted deletion of default address directly      | Open reassignment dialog: "Cần chuyển địa chỉ mặc định sang một địa chỉ khác trước khi xóa."                  |
| **429**     | `TOO_MANY_REQUESTS`                 | Global             | Rate limit exceeded at HTTP admission layer         | Display rate-limit toast: "Quá nhiều yêu cầu. Vui lòng thử lại sau giây lát."                                 |
| **429**     | `RATE_LIMITED`                      | Carrier            | External provider API rate limit exceeded           | Render provider rate-limit warning: "Hãng vận chuyển đang giới hạn tần suất yêu cầu. Vui lòng thử lại sau."   |
| **500**     | `INTERNAL_ERROR`                    | Global             | Unhandled server exception                          | Display generic error toast: "Lỗi hệ thống. Vui lòng liên hệ quản trị viên." Zero stack traces exposed.       |
| **503**     | `SERVICE_UNAVAILABLE`               | Carrier            | Carrier external API endpoint unreachable           | Display provider outage warning: "Dịch vụ của hãng vận chuyển hiện không thể kết nối. Vui lòng thử lại sau."  |

### 8.3 Safe 2-Step Default Address Deletion Sequence

When a user deletes a customer address, the frontend executes the following deterministic sequence:

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as CustomerDetailPage
    participant API as CustomerController

    User->>UI: Clicks "Xóa địa chỉ" on Address Card
    UI->>UI: Check total addresses in Customer aggregate
    alt addresses.length === 1
        UI-->>User: Show alert: Cannot delete sole address (LAST_CUSTOMER_ADDRESS)
    else Address is NOT default (isDefault === false)
        UI->>User: Show standard confirmation dialog
        User->>UI: Confirms deletion
        UI->>API: DELETE /api/customers/:id/addresses/:addressId
        API-->>UI: 200 { success: true }
        UI->>UI: Refresh customer detail & show toast
    else Address IS default (isDefault === true)
        UI->>User: Prompt user to select replacement default address
        User->>UI: Selects new default address from existing list & confirms
        Note over UI,API: Step 1: Reassign default address
        UI->>API: PUT /api/customers/:id/default-address { "addressId": newDefaultId }
        alt PUT fails (e.g. 404 or 409)
            API-->>UI: Error response
            UI-->>User: Display error; abort sequence without deleting target
        else PUT succeeds
            API-->>UI: 200 AddressResponseDto (new default active)
            Note over UI,API: Step 2: Delete original target address
            UI->>API: DELETE /api/customers/:id/addresses/:targetAddressId
            alt DELETE succeeds
                API-->>UI: 200 { success: true }
                UI->>UI: Refresh customer detail & show success toast
            else DELETE fails (e.g. network failure)
                API-->>UI: Error response
                UI-->>User: Partial success feedback: "Đã đổi địa chỉ mặc định nhưng chưa thể xóa địa chỉ cũ. Vui lòng thử lại thao tác xóa."
            end
        end
    end
```

---

## 9. Definitive Canonical API Mapping Table

This table maps every API operation utilized by the frontend migration to its authoritative controller, HTTP method, path, request shape, error codes, and generated `@nexora/sdk` operation:

| Domain       | Operation               | Method   | Endpoint Path                             | Request Body / Query                              | Success Response                        | Handled Error Codes          | Generated SDK Operation                | Existing Backend Implementation                                         | Intended Frontend Consumer                                       |
| :----------- | :---------------------- | :------- | :---------------------------------------- | :------------------------------------------------ | :-------------------------------------- | :--------------------------- | :------------------------------------- | :---------------------------------------------------------------------- | :--------------------------------------------------------------- |
| **Customer** | List Customers          | `GET`    | `/api/customers`                          | Query: `page`, `pageSize`, `q`, `status`, `phone` | 200 `CustomersResponseDto`              | 400, 401, 500                | `CustomerController_list`              | `apps/api/src/customer/presentation/customer.controller.ts:40`          | `apps/web/features/customers/CustomerListPage.tsx`               |
| **Customer** | Create Customer         | `POST`   | `/api/customers`                          | Body: `CreateCustomerDto`                         | 201 `CustomerResponseDto`               | 400, 401, 403, 409, 500      | `CustomerController_create`            | `apps/api/src/customer/presentation/customer.controller.ts:45`          | `apps/web/features/customers/CreateCustomerDrawer.tsx`           |
| **Customer** | Get Customer Detail     | `GET`    | `/api/customers/:id`                      | None                                              | 200 `CustomerResponseDto`               | 400, 401, 404, 500           | `CustomerController_get`               | `apps/api/src/customer/presentation/customer.controller.ts:58`          | `apps/web/features/customers/CustomerDetailPage.tsx`             |
| **Customer** | Update Customer Profile | `PATCH`  | `/api/customers/:id`                      | Body: `PatchCustomerDto`                          | 200 `CustomerResponseDto`               | 400, 401, 403, 404, 409, 500 | `CustomerController_update`            | `apps/api/src/customer/presentation/customer.controller.ts:65`          | `apps/web/features/customers/EditCustomerDrawer.tsx`             |
| **Customer** | Add Recipient Address   | `POST`   | `/api/customers/:id/addresses`            | Body: `AddressInputDto`                           | 201 `AddressResponseDto`                | 400, 401, 403, 404, 500      | `CustomerController_add`               | `apps/api/src/customer/presentation/customer.controller.ts:83`          | `apps/web/features/customers/AddressDrawer.tsx`                  |
| **Customer** | Update Address          | `PATCH`  | `/api/customers/:id/addresses/:addressId` | Body: `AddressPatchDto`                           | 200 `AddressResponseDto`                | 400, 401, 403, 404, 500      | `CustomerController_updateAddress`     | `apps/api/src/customer/presentation/customer.controller.ts:95`          | `apps/web/features/customers/AddressDrawer.tsx`                  |
| **Customer** | Delete Address          | `DELETE` | `/api/customers/:id/addresses/:addressId` | None                                              | 200 `AddressDeletedDto`                 | 400, 401, 403, 404, 409, 500 | `CustomerController_remove`            | `apps/api/src/customer/presentation/customer.controller.ts:108`         | `apps/web/features/customers/DeleteAddressModal.tsx`             |
| **Customer** | Set Default Address     | `PUT`    | `/api/customers/:id/default-address`      | Body: `DefaultAddressDto` (`{ addressId }`)       | 200 `AddressResponseDto`                | 400, 401, 403, 404, 500      | `CustomerController_setDefault`        | `apps/api/src/customer/presentation/customer.controller.ts:126`         | `apps/web/features/customers/CustomerDetailPage.tsx`             |
| **Carrier**  | Provider Catalog        | `GET`    | `/api/carriers`                           | None (Uniship only)                               | 200 `CarriersDto`                       | 401, 500                     | `CarrierController_providers`          | `apps/api/src/carrier/presentation/carrier.controller.ts:30`            | `apps/web/features/carrier-connections/CarrierAccountsPage.tsx`  |
| **Carrier**  | List Connections        | `GET`    | `/api/carrier-connections`                | None                                              | 200 `ConnectionsDto`                    | 401, 500                     | `CarrierController_list`               | `apps/api/src/carrier/presentation/carrier.controller.ts:36`            | `apps/web/features/carrier-connections/CarrierAccountsPage.tsx`  |
| **Carrier**  | Connect Account         | `POST`   | `/api/carrier-connections`                | Body: `ConnectCarrierDto` (`uniship`)             | 201 `{ connection: ConnectionDto }`     | 400, 401, 403, 429, 503      | `CarrierLifecycleController_connect`   | `apps/api/src/carrier/presentation/carrier-lifecycle.controller.ts:116` | `apps/web/features/carrier-connections/AddConnectionDrawer.tsx`  |
| **Carrier**  | Rename Connection       | `PATCH`  | `/api/carrier-connections/:id`            | Body: `RenameConnectionDto` (`displayName`)       | 200 `ConnectionDto`                     | 400, 401, 403, 404, 500      | `CarrierController_rename`             | `apps/api/src/carrier/presentation/carrier.controller.ts:42`            | `apps/web/features/carrier-connections/EditConnectionDrawer.tsx` |
| **Carrier**  | Disconnect Account      | `DELETE` | `/api/carrier-connections/:id`            | None                                              | 200 `ConnectionDeletedDto`              | 400, 401, 403, 404, 500      | `CarrierController_remove`             | `apps/api/src/carrier/presentation/carrier.controller.ts:57`            | `apps/web/features/carrier-connections/DisconnectModal.tsx`      |
| **Carrier**  | Reconnect Account       | `POST`   | `/api/carrier-connections/:id/reconnect`  | Body: `ReconnectCarrierDto` (`password`)          | 200 `{ connection: ConnectionDto }`     | 400, 401, 403, 404, 429, 503 | `CarrierLifecycleController_reconnect` | `apps/api/src/carrier/presentation/carrier-lifecycle.controller.ts:143` | `apps/web/features/carrier-connections/ReconnectModal.tsx`       |
| **Auth**     | Login                   | `POST`   | `/api/auth/login`                         | Body: `LoginRequestDto` (`username`, `password`)  | 200 `LoginResponseDto` or `MfaRequired` | 400, 401, 403, 429, 500      | None (Custom auth hook)                | `apps/api/src/identity/presentation/auth.controller.ts:67`              | `apps/web/app/login/LoginForm.tsx`                               |
| **Auth**     | Verify MFA              | `POST`   | `/api/auth/mfa/verify`                    | Body: `MfaVerifyRequestDto` (`code`)              | 200 `MfaVerifyResponseDto`              | 400, 401, 403, 429, 500      | None (Custom auth hook)                | `apps/api/src/identity/presentation/auth.controller.ts:130`             | `apps/web/app/login/LoginForm.tsx`                               |
| **Auth**     | Cancel MFA              | `POST`   | `/api/auth/mfa/cancel`                    | None                                              | 200 `LogoutResponseDto`                 | 403, 500                     | None (Custom auth hook)                | `apps/api/src/identity/presentation/auth.controller.ts:153`             | `apps/web/app/login/LoginForm.tsx`                               |
| **Auth**     | Check Session           | `GET`    | `/api/auth/session`                       | None                                              | 200 `SessionResponseDto`                | 401, 500                     | None (Custom auth hook)                | `apps/api/src/identity/presentation/auth.controller.ts:167`             | `apps/web/components/app-shell/AppShell.tsx`                     |
| **Auth**     | Logout                  | `POST`   | `/api/auth/logout`                        | None                                              | 200 `LogoutResponseDto`                 | 403, 500                     | None (Custom auth hook)                | `apps/api/src/identity/presentation/auth.controller.ts:189`             | `apps/web/components/app-shell/AccountMenu.tsx`                  |

---

## 10. Milestone Verification, Visual Parity & Rollback Strategy

### 10.1 Milestone 1 (M1) — Design System, Font & Application Shell

- **Functional Scope**: Shared tokens in `tokens.css`, local Inter variable font, Tier A neutral primitives (`Button`, `TextInput`, `Select`, `Checkbox`, `Drawer`, `Dialog`, `Pagination`, `EmptyState`), modernized Tier B AppShell (`Sidebar`, `Header`, `AccountMenu`, `NotificationMenu`), modernized `/login` page with Remember Me.
- **Source ZIP Components Covered**: `src/index.css`, `src/components/Header.tsx`, `src/components/Sidebar.tsx`, `src/components/LoginView.tsx`.
- **Existing Nexora Replaced**: Ad-hoc shell navigation replaced by reference ZIP navy/orange layout. Real auth, MFA, and HttpOnly session cookies strictly preserved.
- **Visual Acceptance**: Header height exactly 56px (`--header-height: 56px`). Sidebar 240px expanded (`#172B4D`), 72px collapsed. Monogram logo and orange active indicators (`#F58A24`). Zero text truncation on Vietnamese diacritical marks.
- **Interaction Acceptance**: Sidebar collapses/expands smoothly with CSS transitions. Submenu accordions expand/collapse. Breadcrumbs update per route. Mobile sidebar overlay slides from left and dismisses on backdrop click or Escape. Account dropdown opens with user details; logout triggers `POST /api/auth/logout`.
- **Security & Regression**: Real session verification remains operational. Zero client-side simulated login states.
- **Rollback Strategy**: Revert M1 Git commit; Next.js App Router restores prior functional shell.
- **Merge Criteria**: Unit tests for all Tier A primitives pass; visual checks on all 6 viewports pass; login/logout smoke passes.

### 10.2 Milestone 2 (M2) — Customer Management (Real API Integration)

- **Functional Scope**: Customer list view (`/customers`), customer detail view (`/customers/[id]`), customer filters (All/Active/Inactive), search bar with 300ms debounce, server-side pagination, Create Customer drawer (atomic customer + required initial address), Edit Customer drawer, Address drawer, Delete Address modal with default reassignment.
- **Source ZIP Components Covered**: `src/components/CustomerListView.tsx`, `src/components/CustomerDetailView.tsx`, `src/components/CreateCustomerDrawer.tsx`, `src/components/EditCustomerDrawer.tsx`, `src/components/AddressDrawer.tsx`, `src/components/DeleteAddressConfirmModal.tsx`, `src/components/AddressForm.tsx`.
- **Backend Integration**: Integrates all 8 real Customer Backend V1 SDK operations (`CustomerController_list`, `create`, `get`, `update`, `add`, `remove`, `updateAddress`, `setDefault`).
- **Interaction Acceptance**: Search triggers debounced real query (`?q=...`); status tabs filter by canonical `ACTIVE` / `INACTIVE`; pagination handles 1..100 items per page; create form enforces initial address; default address reassignment uses `PUT /api/customers/:id/default-address`; deleting sole address is blocked.
- **Error Presentation**: Real error mappings for `LAST_CUSTOMER_ADDRESS`, `DEFAULT_ADDRESS_REASSIGN_REQUIRED`, `CUSTOMER_PHONE_EXISTS`, `NOT_FOUND`, and `VALIDATION_ERROR`.
- **Rollback Strategy**: Revert M2 commit; customer routes return to prior state without impacting database data.
- **Merge Criteria**: All 8 customer contract tests pass; form edge cases pass; zero mock customer data in production code.

### 10.3 Milestone 3 (M3) — Retail Packages Modular Refactoring (Honest Planned Presentation)

- **Functional Scope**: Decompose 2,320-line `RetailPackagesView.tsx` into 10 modular Tier C components (`PackageToolbar`, `PackageStatusTabs`, `PackageFilters`, `ActiveFilterChips`, `PackageTable`, `PackageMobileCard`, `PackageDetailDrawer`, `CreatePackageDrawer`, `PackageFeeSection`, `PackageColumnPicker`). Canonical route `/shipments/retail` with HTTP 307 redirect from `/logistics/parcels`.
- **Source ZIP Components Covered**: `src/components/RetailPackagesView.tsx`, `src/data/retailPackagesData.ts` (isolated test fixture only).
- **Backend Integration Boundary**: Shipment Backend V1 is unimplemented. The production UI truthfully renders empty states with planned feature notices ("Tính năng đang được phát triển"). Zero fake persistent packages, mock tracking events, or speculative freight rate math ("Chưa có báo giá").
- **Interaction Acceptance**: 7 status tabs switch active filter and sync URL; advanced filter drawer adds/removes condition rows; active chips display and remove conditions; column visibility toggles persist in `localStorage`; tracking code copies to clipboard with toast.
- **Rollback Strategy**: Revert M3 commit; `/shipments/retail` route removed cleanly.
- **Merge Criteria**: Component test suites pass using isolated synthetic fixtures; responsive cards render cleanly on mobile viewports; zero unauthorized fee calculation formulas.

### 10.4 Milestone 4 (M4) — Carrier Connections & Shipping Scope (Real API Integration)

- **Functional Scope**: Carrier connections management page (`/settings/carrier-connections`), connection drawer, disconnect confirmation modal, reconnect modal, top header Shipping Scope selector.
- **Source ZIP Components Covered**: `src/components/CarrierConnectionsView.tsx`, `src/context/ShippingScopeContext.tsx`.
- **Backend Integration**: Real catalog via `GET /api/carriers` (returns Uniship only); real connections via `GET /api/carrier-connections`; connect via `POST /api/carrier-connections`; rename via `PATCH /api/carrier-connections/:id`; disconnect via `DELETE /api/carrier-connections/:id`; reconnect via `POST /api/carrier-connections/:id/reconnect`.
- **Interaction Acceptance**: Carrier catalog renders real Uniship provider; connection drawer validates exact 4 keys (`provider`, `loginIdentifier`, `password`, `displayName`); rename updates display name; disconnect confirms before deletion; reconnect prompts for password; unsupported capabilities (Test Connection, Manual Sync) truthfully marked `BACKEND_PENDING`.
- **Security Safeguards**: No carrier passwords or access tokens stored in `localStorage` or browser state.
- **Rollback Strategy**: Revert M4 commit; carrier settings restore to prior state.
- **Merge Criteria**: Multi-carrier lifecycle contract tests pass; scope context correctly derives from real connections.

### 10.5 Milestone 5 (M5) — Final Integration, Accessibility & Full Verification

- **Functional Scope**: Execute owner decision on China Sourcing (Option A showcase route `/sourcing` or Option B formal exclusion); verify end-to-end routing; eliminate any residual dead code; execute full verification suite.
- **Accessibility & Focus**: Verify full keyboard navigation (Tab order, focus trapping in drawers/dialogs, Escape key dismissal, `aria-invalid`, `aria-describedby` associations).
- **Cross-Viewport Visual Parity**: Verify all 6 viewports with zero horizontal body overflow (`document.documentElement.scrollWidth <= window.innerWidth`).
- **Merge Criteria**: `pnpm quality`, `pnpm docs:check`, `pnpm preflight:check`, and `pnpm lint` pass with zero warnings.

### 10.6 Six-Viewport Visual Acceptance Matrix

| Target Viewport | Screen Category  | Layout Geometry & Sidebar Behavior                                               | Table & Card Layout                                                       | Overlay / Drawer Placement                                      | Accepted Differences vs ZIP                                       |
| :-------------- | :--------------- | :------------------------------------------------------------------------------- | :------------------------------------------------------------------------ | :-------------------------------------------------------------- | :---------------------------------------------------------------- |
| **1440 × 900**  | Large Desktop    | Sidebar expanded (240px navy); Header 56px; max content width fluid with padding | Full 20-column sticky table; complete action buttons                      | Right slide-over drawer (480px width); centered dialogs (520px) | Pure CSS Modules instead of Tailwind utility classes              |
| **1280 × 800**  | Standard Desktop | Sidebar expanded (240px navy); Header 56px; responsive table container           | Full table with horizontal scroll on small viewports                      | Right slide-over drawer (480px width)                           | Real session user profile in Header instead of mock demo user     |
| **1024 × 768**  | Tablet Landscape | Sidebar collapsed (72px rail with tooltip flyouts); Header 56px                  | Compact table layout; priority columns visible                            | Right slide-over drawer (440px width)                           | Local Inter variable font loaded with full Vietnamese glyphs      |
| **768 × 1024**  | Tablet Portrait  | Sidebar hidden off-canvas; hamburger toggle visible in Header                    | Table switches to responsive card layout on package list                  | Full-height slide-over drawer (400px width); mobile modal       | Breadcrumb trail collapses to parent route on narrow widths       |
| **390 × 844**   | Mobile Standard  | Sidebar off-canvas with backdrop overlay (slides from left)                      | Complete stacked mobile card view; floating action buttons                | Drawer expands to 100% viewport width; bottom-sheet modal       | Address count column omitted from Customer summary table          |
| **375 × 812**   | Mobile Compact   | Sidebar off-canvas; Header icons condensed; scope badge compact                  | Stacked card view; zero horizontal overflow (`scrollWidth <= innerWidth`) | Full-screen modal overlay; bottom action bar                    | Excel export button rendered disabled with planned tooltip notice |

### 10.7 Native Node.js & Chromium CDP Harness Verification Strategy

In strict adherence to repository guidelines (P3-02), visual parity and responsive behavior will be verified by **reusing and extending Nexora's existing Chromium CDP smoke harness** (`scripts/browser-login-smoke.mjs`), eliminating the need for external frameworks such as Playwright or Puppeteer:

1. **Device Emulation via CDP**: Use `Emulation.setDeviceMetricsOverride` over the existing WebSocket CDP connection to deterministically simulate the 6 target viewports:
   ```javascript
   await cdp.send("Emulation.setDeviceMetricsOverride", {
     width: viewport.width,
     height: viewport.height,
     deviceScaleFactor: 1,
     mobile: viewport.isMobile,
   });
   ```
2. **Visual Evidence Capture via CDP**: Capture full-page and element-specific PNG screenshots using `Page.captureScreenshot` saved directly to local test artifact directories.
3. **DOM Layout & Overflow Assertions**: Execute `Runtime.evaluate` to programmatically assert zero horizontal page overflow:
   ```javascript
   const { result } = await cdp.send("Runtime.evaluate", {
     expression: "document.documentElement.scrollWidth <= window.innerWidth",
   });
   assert.strictEqual(
     result.value,
     true,
     `Horizontal overflow detected at ${viewport.width}x${viewport.height}`,
   );
   ```
4. **Lifecycle & Teardown**: Utilize the established process lifecycle and temp directory cleanup patterns from `scripts/browser-teardown.test.mjs`.

---

## 11. Complete Reference ZIP Inventory & Deterministic Interaction Coverage

### 11.1 Complete 30-File Reference ZIP Inventory

The reference archive `nexora-logistics-management (1).zip` contains exactly **30 source files** under `src/` (21 `.tsx`, 8 `.ts`, 1 `.css`):

| #   | Source Path                                    | Type   | Responsibility & Content                                     | Runtime Relevance    | Target Location or Exclusion Rationale                             |
| :-- | :--------------------------------------------- | :----- | :----------------------------------------------------------- | :------------------- | :----------------------------------------------------------------- |
| 1   | `src/App.tsx`                                  | `.tsx` | Root component, tab router (`activeMenuId`), simulated login | Excluded (Bootstrap) | Replaced by Next.js 16 App Router `layout.tsx` and route files     |
| 2   | `src/main.tsx`                                 | `.tsx` | Vite application entry point (`createRoot`)                  | Excluded (Bootstrap) | Excluded; Nexora uses Next.js App Router                           |
| 3   | `src/index.css`                                | `.css` | Tailwind v4 imports (`@import "tailwindcss"`)                | Reference only       | Converted to CSS Modules and centralized tokens in `tokens.css`    |
| 4   | `src/types.ts`                                 | `.ts`  | TypeScript interfaces for navigation and viewports           | Reference only       | Replaced by `@nexora/shared`, SDK types, and feature-local models  |
| 5   | `src/components/Header.tsx`                    | `.tsx` | Top navigation bar (56px), breadcrumbs, notifications        | Migrated             | `apps/web/components/app-shell/Header.tsx`, `AccountMenu.tsx`      |
| 6   | `src/components/Sidebar.tsx`                   | `.tsx` | Collapsible sidebar (240px/72px), logo, grouped menus        | Migrated             | `apps/web/components/app-shell/Sidebar.tsx` & `Sidebar.module.css` |
| 7   | `src/components/LoginView.tsx`                 | `.tsx` | Login screen (420px card, Remember Me, simulated auth)       | Migrated             | `apps/web/app/login/LoginForm.tsx` (preserving real auth & MFA)    |
| 8   | `src/components/CustomerListView.tsx`          | `.tsx` | Customer list, status tabs, search, summary cards            | Migrated             | `apps/web/features/customers/CustomerListPage.tsx`                 |
| 9   | `src/components/CustomerDetailView.tsx`        | `.tsx` | Customer profile, recipient address cards, default action    | Migrated             | `apps/web/features/customers/CustomerDetailPage.tsx`               |
| 10  | `src/components/CreateCustomerDrawer.tsx`      | `.tsx` | Create customer form + initial address                       | Migrated             | `apps/web/features/customers/CreateCustomerDrawer.tsx`             |
| 11  | `src/components/EditCustomerDrawer.tsx`        | `.tsx` | Edit customer name/phone/note/status drawer                  | Migrated             | `apps/web/features/customers/EditCustomerDrawer.tsx`               |
| 12  | `src/components/AddressDrawer.tsx`             | `.tsx` | Add/edit recipient address drawer                            | Migrated             | `apps/web/features/customers/AddressDrawer.tsx`                    |
| 13  | `src/components/AddressForm.tsx`               | `.tsx` | Recipient address form fields                                | Migrated             | Shared `apps/web/features/customers/AddressForm.tsx`               |
| 14  | `src/components/DeleteAddressConfirmModal.tsx` | `.tsx` | Confirmation modal for address deletion                      | Migrated             | `apps/web/features/customers/DeleteAddressModal.tsx`               |
| 15  | `src/components/RetailPackagesView.tsx`        | `.tsx` | 2,320-line package manager, 7 tabs, filter builder           | Migrated (Modular)   | Modular refactor into 10 components in `features/retail-packages/` |
| 16  | `src/components/CarrierConnectionsView.tsx`    | `.tsx` | Carrier catalog, connect/edit/disconnect accounts            | Migrated             | `apps/web/features/carrier-connections/CarrierAccountsPage.tsx`    |
| 17  | `src/components/SearchSection.tsx`             | `.tsx` | China sourcing keyword search bar                            | Pending Scope        | Retained under `/sourcing` (Option A) or excluded (Option B)       |
| 18  | `src/components/CategoryGrid.tsx`              | `.tsx` | Sourcing category card grid                                  | Pending Scope        | Retained under `/sourcing` (Option A) or excluded (Option B)       |
| 19  | `src/components/SearchResultsFeedback.tsx`     | `.tsx` | Sourcing search results feedback widget                      | Pending Scope        | Retained under `/sourcing` (Option A) or excluded (Option B)       |
| 20  | `src/components/ImageSearchModal.tsx`          | `.tsx` | Visual image search upload modal                             | Pending Scope        | Retained under `/sourcing` (Option A) or excluded (Option B)       |
| 21  | `src/context/ShippingScopeContext.tsx`         | `.tsx` | React context for active shipping scope                      | Migrated             | `apps/web/components/app-shell/ShippingScopeContext.tsx`           |
| 22  | `src/data/categoriesData.ts`                   | `.ts`  | Sourcing categories mock list                                | Pending Scope        | Test fixture / demo data only                                      |
| 23  | `src/data/trendingKeywordsData.ts`             | `.ts`  | Sourcing trending keywords list                              | Pending Scope        | Test fixture / demo data only                                      |
| 24  | `src/data/customerData.ts`                     | `.ts`  | Initial mock customer records                                | Test Fixture Only    | Excluded from prod; isolated synthetic test fixture only           |
| 25  | `src/data/retailPackagesData.ts`               | `.ts`  | Initial mock retail package records                          | Test Fixture Only    | Excluded from prod; isolated synthetic test fixture only           |
| 26  | `src/data/carrierConnectionsData.ts`           | `.ts`  | Mock carrier catalog & connected accounts                    | Test Fixture Only    | Excluded from prod; replaced by real `/api/carriers` calls         |
| 27  | `src/data/navigationData.ts`                   | `.ts`  | Sidebar navigation menu configuration                        | Migrated             | Config in `apps/web/components/app-shell/navigation.ts`            |
| 28  | `src/data/notificationsData.ts`                | `.ts`  | Mock unread notifications                                    | Reference only       | Honest empty notification state in `NotificationMenu.tsx`          |
| 29  | `src/utils/imageSearch.ts`                     | `.ts`  | Mock visual tag generator                                    | Pending Scope        | Demo tag generator for Option A showcase; zero `@google/genai`     |
| 30  | `src/utils/chinaLogisticsUtils.ts`             | `.ts`  | Tracking timeline status helper                              | Migrated             | Adapted into `features/retail-packages/tracking-utils.ts`          |

---

### 11.2 Granular UI Interaction Coverage Matrix

Every user interaction in the reference application is cataloged below with its source handler, user trigger, target component, authoritative data requirement, production behavior, delivery classification, and test verification method:

| #   | Interaction Name                       | Source File & Handler / State                               | User Action                             | Target Component            | Data Requirement                                            | Target Production Behavior                                                                             | Delivery Classification          | Verification Test Case                                                          |
| :-- | :------------------------------------- | :---------------------------------------------------------- | :-------------------------------------- | :-------------------------- | :---------------------------------------------------------- | :----------------------------------------------------------------------------------------------------- | :------------------------------- | :------------------------------------------------------------------------------ |
| 1   | **Sidebar Collapse / Expand**          | `Sidebar.tsx` (`isCollapsed`)                               | Clicks collapse toggle icon             | `Sidebar.tsx`               | Client state                                                | Toggles sidebar between 240px and 72px rail with CSS transitions                                       | `FUNCTIONAL_CLIENT_PRESENTATION` | `apps/web/test/shell.test.mjs`: asserts width class & ARIA expanded             |
| 2   | **Sidebar Submenu Navigation**         | `Sidebar.tsx` (`expandedMenus`)                             | Clicks grouped menu title               | `Sidebar.tsx`               | Client state                                                | Expands/collapses submenu accordion items                                                              | `FUNCTIONAL_CLIENT_PRESENTATION` | `apps/web/test/shell.test.mjs`: toggles submenu visibility                      |
| 3   | **Header Notification Popover**        | `Header.tsx` (`isNotificationsOpen`)                        | Clicks bell icon in Header              | `NotificationMenu.tsx`      | Client state                                                | Opens popover rendering honest empty state ("Không có thông báo mới")                                  | `FUNCTIONAL_CLIENT_PRESENTATION` | `apps/web/test/shell.test.mjs`: opens popover on click, closes on outside click |
| 4   | **Shipping Scope Selector**            | `Header.tsx` (`ShippingScopeContext`)                       | Selects carrier/account from dropdown   | `ShippingScopeSelector.tsx` | Real API (`GET /api/carrier-connections`)                   | Updates active carrier scope across application shell                                                  | `FUNCTIONAL_WITH_EXISTING_API`   | `apps/web/test/scope.test.mjs`: updates context on account select               |
| 5   | **Account Dropdown & Logout**          | `Header.tsx` (`handleLogout`)                               | Clicks "Đăng xuất" in account menu      | `AccountMenu.tsx`           | Real API (`POST /api/auth/logout`)                          | Revokes server session, clears HttpOnly cookie, redirects to `/login`                                  | `FUNCTIONAL_WITH_EXISTING_API`   | `scripts/browser-login-smoke.mjs`: confirms logout redirect & cookie clear      |
| 6   | **Login Authentication**               | `LoginView.tsx` (`handleSubmit`)                            | Submits username & password on `/login` | `LoginForm.tsx`             | Real API (`POST /api/auth/login`)                           | Authenticates credentials; sets session cookie or initiates MFA challenge                              | `FUNCTIONAL_WITH_EXISTING_API`   | `scripts/browser-login-smoke.mjs`: verifies successful login flow               |
| 7   | **Password Visibility Toggle**         | `LoginView.tsx` (`showPassword`)                            | Clicks eye icon in password field       | `LoginForm.tsx`             | Client state                                                | Toggles password input type between `"password"` and `"text"`                                          | `FUNCTIONAL_CLIENT_PRESENTATION` | `apps/web/test/login.test.mjs`: asserts input type toggles                      |
| 8   | **Login Remember Me**                  | `LoginView.tsx` (`rememberMe`)                              | Checks "Ghi nhớ đăng nhập"              | `LoginForm.tsx`             | Browser `localStorage`                                      | Persists non-secret username in `localStorage`; zero token persistence                                 | `FUNCTIONAL_CLIENT_PRESENTATION` | `apps/web/test/login.test.mjs`: verifies username stored/cleared                |
| 9   | **TOTP MFA Challenge Verification**    | `LoginView.tsx` (`handleVerifyMfa`)                         | Submits 6-digit TOTP code               | `MfaChallengeModal.tsx`     | Real API (`POST /api/auth/mfa/verify`)                      | Verifies TOTP challenge; issues session cookie                                                         | `FUNCTIONAL_WITH_EXISTING_API`   | `scripts/browser-login-smoke.mjs`: verifies ADMIN TOTP verification             |
| 10  | **TOTP MFA Challenge Cancel**          | `LoginView.tsx` (`handleCancelMfa`)                         | Clicks "Hủy" on MFA challenge modal     | `MfaChallengeModal.tsx`     | Real API (`POST /api/auth/mfa/cancel`)                      | Cancels challenge; clears pending challenge cookie                                                     | `FUNCTIONAL_WITH_EXISTING_API`   | `scripts/browser-login-smoke.mjs`: verifies cancel returns to login             |
| 11  | **Customer Keyword Search**            | `CustomerListView.tsx` (`searchQuery`)                      | Types query in customer search bar      | `CustomerListPage.tsx`      | Real API (`GET /api/customers?q=...`)                       | 300ms debounced search query `q` executed against real backend                                         | `FUNCTIONAL_WITH_EXISTING_API`   | `apps/web/test/customer-api.test.mjs`: asserts query parameter debounce         |
| 12  | **Customer Search Clear**              | `CustomerListView.tsx` (`setSearchQuery`)                   | Clicks clear (X) icon in search input   | `CustomerListPage.tsx`      | Client state                                                | Clears search input and removes `q` from URL, restoring unfiltered list                                | `FUNCTIONAL_CLIENT_PRESENTATION` | `apps/web/test/customer-api.test.mjs`: asserts search reset                     |
| 13  | **Customer Status Tabs**               | `CustomerListView.tsx` (`activeTab`)                        | Clicks All / Active / Inactive tabs     | `CustomerListPage.tsx`      | Real API (`GET /api/customers?status=...`)                  | Filters list by canonical `ACTIVE` or `INACTIVE` status                                                | `FUNCTIONAL_WITH_EXISTING_API`   | `apps/web/test/customer-api.test.mjs`: verifies status query mapping            |
| 14  | **Customer Pagination**                | `CustomerListView.tsx` (`currentPage`)                      | Selects page number or page size        | `Pagination.tsx`            | Real API (`GET /api/customers?page=...`)                    | Server-side pagination via `page` and `pageSize` ($1..100$)                                            | `FUNCTIONAL_WITH_EXISTING_API`   | `apps/web/test/customer-api.test.mjs`: verifies pagination parameters           |
| 15  | **Customer Row Navigation**            | `CustomerListView.tsx` (row click)                          | Clicks customer row in table            | `CustomerTable.tsx`         | Client routing                                              | Navigates to App Router route `/customers/[id]`                                                        | `FUNCTIONAL_CLIENT_PRESENTATION` | `apps/web/test/customer-api.test.mjs`: asserts route push                       |
| 16  | **Customer Code Copy**                 | `CustomerListView.tsx` (`handleCopy`)                       | Clicks sequence customer code chip      | `CustomerTable.tsx`         | Client Clipboard API                                        | Copies `KH000001` to clipboard with visual toast feedback                                              | `FUNCTIONAL_CLIENT_PRESENTATION` | `apps/web/test/customer-api.test.mjs`: asserts clipboard writeText call         |
| 17  | **Customer Creation**                  | `CreateCustomerDrawer.tsx` (`handleSubmit`)                 | Submits customer profile & address      | `CreateCustomerDrawer.tsx`  | Real API (`POST /api/customers`)                            | Atomic creation of customer profile + mandatory initial address                                        | `FUNCTIONAL_WITH_EXISTING_API`   | `apps/web/test/customer-api.test.mjs`: verifies atomic customer creation        |
| 18  | **Customer Profile Edit**              | `EditCustomerDrawer.tsx` (`handleSubmit`)                   | Modifies customer name/phone/status     | `EditCustomerDrawer.tsx`    | Real API (`PATCH /api/customers/:id`)                       | Updates customer aggregate; validates E.164 phone normalization                                        | `FUNCTIONAL_WITH_EXISTING_API`   | `apps/web/test/customer-api.test.mjs`: verifies customer profile patch          |
| 19  | **Customer Add Address**               | `AddressDrawer.tsx` (`handleSubmit`)                        | Submits new address form                | `AddressDrawer.tsx`         | Real API (`POST /api/customers/:id/addresses`)              | Appends recipient address to customer aggregate                                                        | `FUNCTIONAL_WITH_EXISTING_API`   | `apps/web/test/customer-api.test.mjs`: verifies address append                  |
| 20  | **Customer Edit Address**              | `AddressDrawer.tsx` (`handleSubmit`)                        | Modifies address text or recipient      | `AddressDrawer.tsx`         | Real API (`PATCH /api/customers/:id/addresses/:addressId`)  | Updates recipient fields without altering default flag                                                 | `FUNCTIONAL_WITH_EXISTING_API`   | `apps/web/test/customer-api.test.mjs`: verifies address update patch            |
| 21  | **Customer Set Default Address**       | `CustomerDetailView.tsx` (`handleSetDefault`)               | Clicks "Đặt làm mặc định" button        | `CustomerDetailPage.tsx`    | Real API (`PUT /api/customers/:id/default-address`)         | Calls `PUT /api/customers/:id/default-address` with `{ addressId }`                                    | `FUNCTIONAL_WITH_EXISTING_API`   | `apps/web/test/customer-api.test.mjs`: asserts PUT default-address endpoint     |
| 22  | **Customer Delete Address**            | `DeleteAddressConfirmModal.tsx` (`handleConfirm`)           | Confirms address deletion in modal      | `DeleteAddressModal.tsx`    | Real API (`DELETE /api/customers/:id/addresses/:addressId`) | Enforces 2-step default reassignment; blocks deletion of sole address                                  | `FUNCTIONAL_WITH_EXISTING_API`   | `apps/web/test/customer-api.test.mjs`: verifies 2-step deletion sequence        |
| 23  | **Customer Excel Export**              | `CustomerListView.tsx` (export click)                       | Clicks "Xuất Excel" button              | `CustomerListPage.tsx`      | Backend pending                                             | Rendered disabled with planned feature tooltip notice                                                  | `BACKEND_PENDING`                | `apps/web/test/customer-api.test.mjs`: asserts disabled button & tooltip        |
| 24  | **Retail Status Tabs**                 | `RetailPackagesView.tsx` (`activeTab`)                      | Clicks 7 package status tabs            | `PackageStatusTabs.tsx`     | Client URL state                                            | Synchronizes `?status=...`; table displays honest empty state                                          | `FUNCTIONAL_CLIENT_PRESENTATION` | `apps/web/test/packages.test.mjs`: verifies status query string sync            |
| 25  | **Retail Search & Debounce**           | `RetailPackagesView.tsx` (`searchQuery`)                    | Types tracking code or package query    | `PackageToolbar.tsx`        | Client URL state                                            | 300ms debounced search query synchronized to URL `?q=...`                                              | `FUNCTIONAL_CLIENT_PRESENTATION` | `apps/web/test/packages.test.mjs`: asserts debounced query updates              |
| 26  | **Retail Search Clear**                | `RetailPackagesView.tsx` (`handleClearSearch`)              | Clicks clear (X) icon in package search | `PackageToolbar.tsx`        | Client URL state                                            | Clears search input and removes `?q=` from URL                                                         | `FUNCTIONAL_CLIENT_PRESENTATION` | `apps/web/test/packages.test.mjs`: asserts package search clear                 |
| 27  | **Retail Filter Builder**              | `RetailPackagesView.tsx` (`handleAddFilterCondition`)       | Adds condition row to advanced filter   | `PackageFilters.tsx`        | Client state                                                | Evaluates draft condition rules; updates active chips on apply                                         | `FUNCTIONAL_CLIENT_PRESENTATION` | `apps/web/test/packages.test.mjs`: tests condition row addition                 |
| 28  | **Retail Filter Condition Remove**     | `RetailPackagesView.tsx` (`handleRemoveCondition`)          | Removes condition row from filter       | `PackageFilters.tsx`        | Client state                                                | Removes condition row from filter drawer                                                               | `FUNCTIONAL_CLIENT_PRESENTATION` | `apps/web/test/packages.test.mjs`: tests condition row deletion                 |
| 29  | **Retail Filter Chip Removal**         | `RetailPackagesView.tsx` (chip remove)                      | Clicks chip (X) or "Xóa tất cả"         | `ActiveFilterChips.tsx`     | Client state                                                | Removes individual filter chip or resets all active filters; resets page to 1                          | `FUNCTIONAL_CLIENT_PRESENTATION` | `apps/web/test/packages.test.mjs`: tests chip removal & filter reset            |
| 30  | **Retail Column Visibility Toggle**    | `RetailPackagesView.tsx` (`toggleColumn`)                   | Toggles column checkbox in dropdown     | `PackageColumnPicker.tsx`   | Browser `localStorage`                                      | Shows/hides table columns; persists column preferences to `localStorage`                               | `FUNCTIONAL_CLIENT_PRESENTATION` | `apps/web/test/packages.test.mjs`: asserts localStorage column persistence      |
| 31  | **Retail Column Reset Defaults**       | `RetailPackagesView.tsx` (`resetColumns`)                   | Clicks "Khôi phục mặc định"             | `PackageColumnPicker.tsx`   | Browser `localStorage`                                      | Resets visible columns to default configuration in `localStorage`                                      | `FUNCTIONAL_CLIENT_PRESENTATION` | `apps/web/test/packages.test.mjs`: asserts default columns restoration          |
| 32  | **Retail Tracking Code Copy**          | `RetailPackagesView.tsx` (`handleCopyCode`)                 | Clicks tracking code in table           | `PackageTable.tsx`          | Client Clipboard API                                        | Copies tracking code to clipboard with visual toast feedback                                           | `FUNCTIONAL_CLIENT_PRESENTATION` | `apps/web/test/packages.test.mjs`: asserts tracking code clipboard copy         |
| 33  | **Retail Package Detail Drawer**       | `RetailPackagesView.tsx` (`inspectingPackage`)              | Clicks package row in table             | `PackageDetailDrawer.tsx`   | Backend pending                                             | Opens slide-over drawer; renders unlinked notice ("Chưa có dữ liệu vận đơn")                           | `BACKEND_PENDING`                | `apps/web/test/packages.test.mjs`: asserts drawer open & unlinked state         |
| 34  | **Retail Package Creation**            | `RetailPackagesView.tsx` (`handleCreateSubmit`)             | Submits parcel creation drawer form     | `CreatePackageDrawer.tsx`   | Backend pending                                             | Validates client fields; displays planned notice ("Tính năng đang phát triển")                         | `BACKEND_PENDING`                | `apps/web/test/packages.test.mjs`: asserts planned notice on submit             |
| 35  | **Retail Package Export**              | `RetailPackagesView.tsx` (export click)                     | Clicks "Xuất dữ liệu" button            | `PackageToolbar.tsx`        | Backend pending                                             | Rendered disabled with planned feature tooltip notice                                                  | `BACKEND_PENDING`                | `apps/web/test/packages.test.mjs`: asserts disabled export button               |
| 36  | **Carrier Provider Catalog Listing**   | `CarrierConnectionsView.tsx` (`AVAILABLE_CARRIERS_CATALOG`) | Opens carrier connections page          | `CarrierAccountsPage.tsx`   | Real API (`GET /api/carriers`)                              | Renders real provider catalog from backend (currently Uniship only)                                    | `FUNCTIONAL_WITH_EXISTING_API`   | `apps/web/test/carrier-api.test.mjs`: asserts Uniship catalog rendering         |
| 37  | **Carrier Connected Accounts Listing** | `CarrierConnectionsView.tsx` (`connectedCarriers`)          | Views connected carrier accounts        | `CarrierAccountsPage.tsx`   | Real API (`GET /api/carrier-connections`)                   | Renders owner's active carrier connections fetched from backend                                        | `FUNCTIONAL_WITH_EXISTING_API`   | `apps/web/test/carrier-api.test.mjs`: asserts accounts list rendering           |
| 38  | **Carrier Account Search & Filter**    | `CarrierConnectionsView.tsx` (`searchQuery`)                | Types query or filters by carrier tab   | `CarrierAccountsPage.tsx`   | Client state                                                | Filters connected accounts list locally by name or carrier provider                                    | `FUNCTIONAL_CLIENT_PRESENTATION` | `apps/web/test/carrier-api.test.mjs`: asserts client accounts filtering         |
| 39  | **Carrier Connect Account**            | `CarrierConnectionsView.tsx` (`handleSaveAccount`)          | Submits connect account drawer          | `AddConnectionDrawer.tsx`   | Real API (`POST /api/carrier-connections`)                  | Connects Uniship account using exact 4 keys (`provider`, `loginIdentifier`, `password`, `displayName`) | `FUNCTIONAL_WITH_EXISTING_API`   | `apps/web/test/carrier-api.test.mjs`: verifies connect payload & response       |
| 40  | **Carrier Rename Account**             | `CarrierConnectionsView.tsx` (`handleSaveAccount`)          | Submits edited display name             | `EditConnectionDrawer.tsx`  | Real API (`PATCH /api/carrier-connections/:id`)             | Calls `PATCH /api/carrier-connections/:id` with `{ displayName }`                                      | `FUNCTIONAL_WITH_EXISTING_API`   | `apps/web/test/carrier-api.test.mjs`: verifies PATCH rename call                |
| 41  | **Carrier Reconnect Account**          | `CarrierConnectionsView.tsx` (`handleReconnect`)            | Submits new password in reconnect modal | `ReconnectModal.tsx`        | Real API (`POST /api/carrier-connections/:id/reconnect`)    | Calls `POST /api/carrier-connections/:id/reconnect` with `{ password }`                                | `FUNCTIONAL_WITH_EXISTING_API`   | `apps/web/test/carrier-api.test.mjs`: verifies reconnect password call          |
| 42  | **Carrier Disconnect Account**         | `CarrierConnectionsView.tsx` (`handleConfirmDisconnect`)    | Confirms disconnect modal               | `DisconnectModal.tsx`       | Real API (`DELETE /api/carrier-connections/:id`)            | Calls `DELETE /api/carrier-connections/:id`; refreshes accounts list                                   | `FUNCTIONAL_WITH_EXISTING_API`   | `apps/web/test/carrier-api.test.mjs`: verifies DELETE disconnect call           |
| 43  | **Carrier Test Connection**            | `CarrierConnectionsView.tsx` (`handleTestConnection`)       | Clicks "Kiểm tra kết nối" button        | `AddConnectionDrawer.tsx`   | Backend pending                                             | Backend lacks standalone test endpoint; button shows planned notice                                    | `BACKEND_PENDING`                | `apps/web/test/carrier-api.test.mjs`: asserts planned notice on test click      |
| 44  | **Carrier Manual Sync Accounts**       | `CarrierConnectionsView.tsx` (`handleSyncAccount`)          | Clicks "Đồng bộ" or "Đồng bộ tất cả"    | `CarrierAccountsPage.tsx`   | Backend pending                                             | Backend lacks manual sync endpoint; button shows planned notice                                        | `BACKEND_PENDING`                | `apps/web/test/carrier-api.test.mjs`: asserts planned notice on sync click      |
| 45  | **Sourcing Keyword Search**            | `SearchSection.tsx` (`handleSubmit`)                        | Enters search keyword in sourcing bar   | `SearchSection.tsx`         | Showcase presentation                                       | Displays non-operational demo notice ("Chưa kết nối API tìm kiếm")                                     | `PRODUCT_DECISION_PENDING`       | `apps/web/test/sourcing.test.mjs`: asserts demo notice banner                   |
| 46  | **Sourcing Category Card Navigation**  | `CategoryGrid.tsx` (card click)                             | Clicks category card in grid            | `CategoryGrid.tsx`          | Showcase presentation                                       | Toggles active category card in showcase view                                                          | `PRODUCT_DECISION_PENDING`       | `apps/web/test/sourcing.test.mjs`: asserts category toggle                      |
| 47  | **Sourcing Result Feedback**           | `SearchResultsFeedback.tsx`                                 | Clicks search result feedback buttons   | `SearchResultsFeedback.tsx` | Showcase presentation                                       | Renders static presentation mockup                                                                     | `PRODUCT_DECISION_PENDING`       | `apps/web/test/sourcing.test.mjs`: asserts static feedback rendering            |
| 48  | **Sourcing Image Search Modal**        | `ImageSearchModal.tsx` (`handleStartSearch`)                | Uploads demo image for visual search    | `ImageSearchModal.tsx`      | Showcase presentation                                       | Displays pre-computed demo tags; zero `@google/genai` dependency                                       | `PRODUCT_DECISION_PENDING`       | `apps/web/test/sourcing.test.mjs`: asserts demo tags without external API       |

---

### 11.3 Deterministic Verification of Interaction Coverage Counts

The interaction inventory contains exactly **48 discrete user interactions**, categorized across 5 delivery classifications:

- **`FUNCTIONAL_WITH_EXISTING_API`**: **20** interactions (Real API integrations with `@nexora/sdk` and auth endpoints)
- **`FUNCTIONAL_CLIENT_PRESENTATION`**: **18** interactions (Client UI presentation, navigation, filters, column toggles, clipboard)
- **`BACKEND_PENDING`**: **6** interactions (Customer Excel export, Retail package detail/create/export, Carrier test connection/manual sync)
- **`PRODUCT_DECISION_PENDING`**: **4** interactions (China sourcing search, category grid, feedback, image modal)
- **`APPROVED_EXCLUSION`**: **0** interactions (No exclusion has been authorized by the repository owner)
- **Total Discrete Interactions**: **48** ($20 + 18 + 6 + 4 + 0 = 48$)

---

## 12. Approval Evidence & Governance History

| Review Iteration          | Snapshot Path                                                                  | SHA-256 Digest                                                     | Status           | Review Findings & Outcome                                                                           |
| :------------------------ | :----------------------------------------------------------------------------- | :----------------------------------------------------------------- | :--------------- | :-------------------------------------------------------------------------------------------------- |
| **v1** (Initial Draft)    | `docs/tasks/design-reviews/NEXORA-029-rev-2026-10-22-frontend-migration-v1.md` | `b3d81b37fbe01ba3e6a2b89d5a7d6052cf5bfb53ae7b87c7aa31d5b512c01198` | Superseded       | 5 P2 findings, 3 P3 findings (Customer parameters, freight fee math, incomplete inventory).         |
| **v2** (Inventory Update) | `docs/tasks/design-reviews/NEXORA-029-rev-2026-10-22-frontend-migration-v2.md` | `cef5035394f9606e071c16410c9fe9ef3195afbca3f4a3bbe73fd1999e3fe0a9` | Superseded       | 4 P2 findings, 3 P3 findings (Lost milestone acceptance, grouped interactions, Remember Me).        |
| **v3** (Milestone Polish) | `docs/tasks/design-reviews/NEXORA-029-rev-2026-10-22-frontend-migration-v3.md` | `6f6203106bb5db86ac76fc69cbdaa8ea11f791b2fb403b3971b47e3cf6e45418` | Superseded       | 5 P2 contract defects (Customer default endpoint, invented limits, error envelope, Carrier claims). |
| **v4** (Definitive Fix)   | `docs/tasks/design-reviews/NEXORA-029-rev-2026-10-22-frontend-migration-v4.md` | `<computed-digest>`                                                | `PENDING_REVIEW` | Resolved all contract defects; 48 verified interactions; real Carrier catalog; pure CDP test reuse. |

---

## 13. PLAN ISSUES (Unresolved Owner Product Decisions)

### PLAN ISSUE 1: Product Scope Decision for China Sourcing Components

- **Context**: The reference ZIP includes 4 China sourcing components (`SearchSection.tsx`, `CategoryGrid.tsx`, `SearchResultsFeedback.tsx`, `ImageSearchModal.tsx`) as the default home view (`activeMenuId === 'search-products'`).
- **Product Boundary Alignment**: In Nexora's approved product scope ([ADR-002](../../decisions/product-scope.md)), Nexora is an enterprise logistics and shipment hub, not a consumer proxy shopping agent. Web scraping violates third-party ToS, and bundling `@google/genai` violates Nexora's secure server-proxy architecture.
- **Options for Repository Owner Decision**:
  - **Option A (Showcase Route)**: Migrate visual presentation into an isolated feature module `apps/web/features/sourcing/` on route `/sourcing` with clear non-operational planned notices ("Bản thử nghiệm giao diện / Chưa tích hợp API"). Zero scraping, zero `@google/genai` dependency. Preserves 100% visual/interaction coverage. Requires amending `docs/architecture/frontend.md`.
  - **Option B (Formal Exclusion)**: Formally exclude sourcing views from Nexora production code per ADR-002 (`INTENTIONALLY_EXCLUDED_APPROVED`). Route `/` remains the Operational Overview & Dashboard.
- **Decision Status**: `OWNER DECISION REQUIRED`. The agent has not approved Option A or Option B on behalf of the owner. Once the repository owner decides, the design will be finalized for that single option, the digest recomputed, and formal ADR-009 approval requested.

---

## 14. Snapshot Pinning & Approval Instructions

Before implementation begins, capture the selected design in the versioned snapshot. Do not include mutable execution/test/CI logs. Compute actual raw UTF-8 SHA-256 with Node crypto or `computeDesignDigest` from `scripts/preflight-policy-check.mjs`. Put the identical path and digest in active task metadata and PR description, then run structural binding validation.

The authorized repository owner posts a standalone five-line decision containing the `NEXORA DESIGN APPROVAL` header, Task ID `NEXORA-029`, Plan revision `rev-2026-10-22-frontend-migration-v4`, raw-byte Design SHA-256 digest, and Decision `APPROVED` (each field on its own contiguous line, zero surrounding prose or extra markdown).
