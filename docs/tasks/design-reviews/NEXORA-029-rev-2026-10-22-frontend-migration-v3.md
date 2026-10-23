# NEXORA-029 immutable design snapshot — full frontend migration v3

Task ID: NEXORA-029
Plan revision: rev-2026-10-22-frontend-migration-v3
Reviewed baseline: 3f5de7980f4794d31ae1f209d891e460df77e427

---

## 1. Task Metadata & Classification

- Task identifier: `NEXORA-029`
- Task Title: Full Frontend Migration from Supplied Reference Design
- Classification: `SIGNIFICANT`
- Documentation Impact: `REQUIRED`
- Target Branch & PR: `feat/full-frontend-migration` / [PR #25](https://github.com/dinhphuquy2k1/nexora/pull/25)
- Active revision: `rev-2026-10-22-frontend-migration-v3`
- Snapshot location: `docs/tasks/design-reviews/NEXORA-029-rev-2026-10-22-frontend-migration-v3.md`
- Reviewed Baseline HEAD: `3f5de7980f4794d31ae1f209d891e460df77e427`
- Approval Authority: `dinhphuquy2k1` (Repository Owner)
- Approval Status: `PENDING_REVIEW`

---

## 2. Requirements & Boundary Scope

### 2.1 User Story & Business Need

The repository owner requires replacing Nexora's existing frontend presentation with the layout, visual styling, color palette, local Inter typography, and user interactions demonstrated in the reference ZIP archive (`nexora-logistics-management (1).zip`). This migration replaces legacy forms, table presentations, and ad-hoc navigation with maintainable, reusable React components under Nexora's established Next.js 16 App Router architecture, CSS Modules design tokens, and real API/SDK contracts.

### 2.2 In-Scope Items

1. **Design System & Typography**: Extend `apps/web/styles/tokens.css` with layout dimensions (56px header, control heights, status tokens) and configure local variable Inter font (`InterVariable.woff2`, SIL OFL 1.1) with full Vietnamese diacritics coverage (`U+1EA0..U+1EF9`).
2. **Component Architecture (Three Tiers)**:
   - **Tier A (`packages/ui`)**: Extract domain-neutral, accessible primitives (`Button`, `TextInput`, `Select`, `Checkbox`, `Drawer`, `Dialog`, `Pagination`, `EmptyState`).
   - **Tier B (`apps/web/components/app-shell/`)**: Modernize shell components (`Sidebar`, `Header`, `Breadcrumb`, `AccountMenu`, `NotificationMenu`, `ShippingScopeSelector`).
   - **Tier C (`apps/web/features/`)**: Modularize giant views into focused subcomponents for `customers`, `retail-packages`, `carrier-connections`, and provisional `sourcing`.
3. **Customer Management Integration**: Integrate 8 real endpoints from `@nexora/sdk` on `/customers` and `/customers/[id]`. Enforce canonical query parameters (`page`, `pageSize`, `q`, `status`, `phone`) and strict business invariants (atomic customer + initial address, last address deletion protection, default reassignment).
4. **Retail Packages Presentation**: Modularize 2,320-line `RetailPackagesView.tsx` into 10 focused components on `/shipments/retail` with server-side compatibility redirect from `/logistics/parcels`. Render honest empty states and planned notices; eliminate fake persistent data, mock tracking, and arbitrary rate formulas.
5. **Carrier Connections & Scope**: Integrate `/settings/carrier-connections` with real `/api/carriers` and `/api/carrier-connections` endpoints. Drive Header scope selection via `ShippingScopeContext`.
6. **Authentication & Session Preservation**: Restyle `/login` with 420px card aesthetics while strictly preserving existing session cookies, logout POST, and ADMIN TOTP MFA verification. Implement non-secret username persistence for "Remember Me".

### 2.3 Explicit Non-Goals & Out-of-Scope Items

1. **Zero Backend Modifications**: No edits to NestJS controllers, services, database schemas, Prisma migrations, or generated SDK in this PR.
2. **Zero Third-Party Scraping & AI SDKs**: No web scraping of Taobao/1688/Tmall and no bundling of `@google/genai` on the client.
3. **No Speculative Freight Tariff Engine**: Missing pricing displayed explicitly as `"Chưa có báo giá"`.
4. **No Tailwind CSS or Vite**: Preserve pure CSS Modules and centralized custom properties.
5. **No Production Mocks**: Synthetic datasets are restricted to isolated test fixtures (`apps/web/test/fixtures/`).
6. **No Implementation Code in Planning Phase**: Pure documentation PR establishing pre-code design approval per ADR-009.

---

## 3. Relevant Documentation & Canonical Owners

- **Governing ADRs**:
  - [ADR-002](../../decisions/product-scope.md): Accepted core product and domain boundaries (enterprise shipment/logistics hub vs. consumer retail/sourcing).
  - [ADR-007](../../decisions/multi-carrier-architecture.md): Canonical multi-carrier contracts and carrier-connection boundaries.
  - [ADR-008](../../decisions/tactical-ddd.md): Tactical DDD aggregates, value objects, and business invariants.
  - [ADR-009](../../decisions/mandatory-pre-code-design-review.md): Mandatory pre-code design review, reuse audit, and strict 5-line approval governance.
- **Frontend Architecture**:
  - [Frontend Architecture](../../architecture/frontend.md): Section 1 (Three-Tier Component Ownership), Section 2 (Design Tokens & CSS Modules), Section 5 (Navigation Contract), Section 6 (Explicit UI Scope & Sourcing Exclusions).
  - [Reusable Components Registry](../../architecture/reusable-components.md): Registry of approved shared UI primitives.
- **Domain & Operations Documents**:
  - [Customer Domain](../../domains/customers.md): Customer invariants, address lifecycle, and query contracts.
  - [Shipment Domain](../../domains/shipments.md): Shipment boundaries and freight pricing non-goals.
  - [Testing Operations](../../operations/testing.md): Native Node.js test infrastructure, browser smoke suites, and quality verification.

---

## 4. Existing Code References & Search Scope

- **Searched Directories**:
  - `apps/web/app/`: Next.js 16 App Router routes, layouts, and public entry points.
  - `apps/web/components/`: Existing shell components (`AppShell`, `Sidebar`, `Header`, `AccountMenu`).
  - `apps/web/styles/`: Centralized design token definitions in `tokens.css`.
  - `packages/ui/`: Existing shared primitives (`Panel`, `StatusBadge`, `status-tone.ts`).
  - `apps/api/src/customer/`: Authoritative customer DTOs, query contracts, and domain error maps.
  - `packages/sdk/`: Generated OpenAPI TypeScript client contracts.
  - `packages/shared/`: Shared status definitions (`CustomerStatusLabelsVi`).
- **Relevant Existing Files**:
  - `apps/api/src/customer/presentation/customer.dto.ts`: Canonical `ListCustomersQueryDto` defining `page` (int $\ge 1$), `pageSize` (int $1..100$), `q` (string $\le 200$), `status` (`ACTIVE`/`INACTIVE`), and `phone` (string $\le 64$).
  - `apps/web/app/login/LoginForm.tsx`: Authoritative form implementing password authentication, TOTP MFA challenge, and return URL sanitization.
  - `packages/shared/src/status.ts`: Authoritative `CustomerStatusLabelsVi` mapping (`ACTIVE: "Đang hoạt động"`, `INACTIVE: "Ngừng hoạt động"`).
  - `apps/web/lib/navigation/nav-config.ts`: Single source of truth for workspace navigation items.

---

## 5. Mandatory Reuse & Design Audit Matrix

| Field                        | 1. Button & IconButton                                                | 2. TextInput & Select                                                          | 3. Drawer & Dialog                                                  | 4. StatusBadge & Tone                                                  | 5. Panel Container                                 | 6. Customer SDK Hook                                    | 7. Customer Address Form                                           | 8. Shipping Scope Selector                                  |
| :--------------------------- | :-------------------------------------------------------------------- | :----------------------------------------------------------------------------- | :------------------------------------------------------------------ | :--------------------------------------------------------------------- | :------------------------------------------------- | :------------------------------------------------------ | :----------------------------------------------------------------- | :---------------------------------------------------------- |
| **Component**                | `Button` and `IconButton` primitives                                  | `TextInput`, `Select`, `Checkbox` inputs                                       | Slide-over `Drawer` & centered `Dialog`                             | `StatusBadge` and tone resolver                                        | `Panel` content card container                     | Generated `@nexora/sdk` React hooks                     | `AddressForm` shared recipient form                                | `ShippingScopeSelector` dropdown                            |
| **Existing Implementations** | Ad-hoc HTML buttons in shell/login                                    | Ad-hoc `<input>` in LoginForm                                                  | None in `@nexora/ui` (PR #22 had prototype)                         | `packages/ui/src/StatusBadge.tsx` & `status-tone.ts`                   | `packages/ui/src/Panel.tsx` & `Panel.module.css`   | `createNexoraClient()` in `@nexora/sdk`                 | None on `main` (`AddressForm.tsx` in ZIP)                          | Prototype in PR #22 branch                                  |
| **Domain Owner**             | Neutral UI (`packages/ui`)                                            | Neutral UI (`packages/ui`)                                                     | Neutral UI (`packages/ui`)                                          | Neutral UI (`packages/ui`)                                             | Neutral UI (`packages/ui`)                         | Customer Domain / SDK                                   | Customer Domain (`apps/web/features/customers`)                    | Carrier Domain (`apps/web/components/app-shell`)            |
| **Reuse Alternatives**       | Extract to `@nexora/ui` vs feature-local                              | Extract to `@nexora/ui` vs feature-local                                       | Extract to `@nexora/ui` vs duplicate                                | Reuse existing vs rewrite                                              | Reuse existing vs new div cards                    | Reuse `@nexora/sdk` vs fetch wrappers                   | Extract cohesive form vs duplicate                                 | Adapt PR #22 scope vs rewrite from ZIP                      |
| **Selected Approach**        | **Extract domain-neutral `Button` to `@nexora/ui`**                   | **Extract domain-neutral `TextInput`, `Select`, `Checkbox` to `@nexora/ui`**   | **Extract domain-neutral `Drawer`, `Dialog` to `@nexora/ui`**       | **Reuse and extend existing `StatusBadge`**                            | **Reuse existing `Panel` from `@nexora/ui`**       | **Reuse `@nexora/sdk` with dedicated hooks**            | **Extract single cohesive `AddressForm` in `features/customers/`** | **Adapt PR #22 carrier scope into AppShell**                |
| **Rationale**                | Reused across all 5 major screens; eliminates Tailwind button classes | Standardizes focus rings, error outlines, and control heights (`36px`, `44px`) | Standardizes backdrop overlay, Escape dismissal, and focus trapping | Avoids duplicate badge styling; leverages existing `resolveStatusTone` | Uniform card surface, border `#E2E8F0`, and shadow | Enforces single source of truth from OpenAPI contracts  | Eliminates drift between customer creation and address edit        | Connects to verified multi-carrier contracts from ADR-007   |
| **Risks**                    | Over-parameterization of props                                        | Breaking login form during extraction                                          | Mobile body scroll locking or focus trapping bugs                   | Missing tone mappings for package/carrier statuses                     | Inflexible padding if hardcoded                    | Out-of-sync SDK if backend changes                      | Client phone normalization mismatches                              | Stale scope when accounts are disconnected                  |
| **Verification**             | Unit tests in `packages/ui/test/`; visual check across all viewports  | Accessibility tests for `aria-invalid`, focus outline; unit tests              | Keyboard tests (Escape, Tab focus trap, restoration); mobile swipe  | Unit tests in `status-tone.test.mjs`; visual checks                    | Visual check across customer and package pages     | Contract tests in `apps/web/test/customer-api.test.mjs` | Form validation unit tests; E.164 normalization checks             | Unit tests for scope resolution and context synchronization |

---

## 6. Alternative Designs & Trade-offs

### 6.1 Login "Remember Me" Behavior

- **Alternative 1: Remember Username Only in `localStorage` (Recommended & Selected)**:
  - When checked, stores `localStorage.setItem('nexora_remembered_username', username)`. Pre-populates username on mount; clears if unchecked.
  - Zero passwords, MFA tokens, or session secrets stored. Cookie TTL and server session lifecycle remain completely untouched.
  - Labeled clearly: _"Ghi nhớ tên đăng nhập"_. Delivers 100% visual fidelity to the reference ZIP while maintaining zero-secret browser storage security invariants.
- **Alternative 2: Remove or Disable Checkbox**:
  - Eliminates the control. Rejected because it introduces visual disparity against the reference design without security necessity.
- **Alternative 3: True Persistent Login / Extended Session TTL**:
  - Extending cookie TTL or issuing persistent refresh tokens requires backend authentication contract changes, database token tables, and rotation security. Rejected as out of scope for a frontend migration PR.

### 6.2 China Sourcing Product Scope (PLAN ISSUE 1)

- **Alternative A: Isolated Presentation Showcase on `/sourcing` (Recommended)**:
  - Migrates visual components into `apps/web/features/sourcing/` on route `/sourcing` with non-operational planned disclaimers. Zero scraping, zero `@google/genai` dependency. Delivers 100% visual/interaction coverage. Requires owner-approved amendment to `docs/architecture/frontend.md`.
- **Alternative B: Formal Exclusion from Production per ADR-002**:
  - Excludes sourcing components from `@nexora/web` routes. Route `/` remains Operational Overview. Retains reference components in offline archive.

### 6.3 Universal Table vs. Domain-Specific Tables

- **Alternative 1: Universal Shared Table Engine in `@nexora/ui`**:
  - Building a generic table abstraction handling sorting, column visibility, conditional filtering, and pagination.
  - _Why Rejected_: Over-engineering anti-pattern. Customer Table and Retail Packages Table have drastically different column configurations, filter rules, and row action semantics. A generic table would require a bloated configuration schema.
- **Alternative 2: Feature-Owned Tables Consuming Shared Primitives (Selected)**:
  - `CustomerTable` and `RetailPackagesTable` remain local to their respective features, reusing domain-neutral Tier A primitives (`Pagination`, `Button`, `Checkbox`, `StatusBadge`).

---

## 7. Selected Design & Tactical DDD Alignment

### 7.1 Form Validation Architecture & Authoritative Boundaries

To prevent drift and duplicate logic, form validation responsibilities are strictly decoupled:

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser Client                        │
│                                                             │
│  Lightweight UX Validation (features/customers/validation)   │
│  • Required fields presence (name, phone, address text)      │
│  • Whitespace-only string rejection                         │
│  • Field lengths: name <= 100, q <= 200, addressText <= 255 │
│  • Basic numeric bounds: page >= 1, pageSize 1..100          │
│  • Visible field errors & accessible aria-invalid flags     │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP POST / PATCH (via SDK)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Server Backend                       │
│                                                             │
│  Authoritative Domain Validation & Invariant Enforcement    │
│  • Strict E.164 phone parsing & normalization               │
│  • Phone uniqueness within tenant (CUSTOMER_PHONE_CONFLICT) │
│  • Aggregate invariants: address cardinality (>= 1)         │
│  • Default address assignment & deletion restrictions       │
│  • Authorization, ownership, and database transaction locks │
└─────────────────────────────────────────────────────────────┘
```

- **Client-Side Validation Policy**:
  - The client performs lightweight UX checks to provide instant typing feedback.
  - The frontend **must not** duplicate `libphonenumber-js` parsing rules or regional regexes. Raw phone input is sent directly to the backend for authoritative normalization.
- **Standard Error Envelope & Mapping**:
  All API errors follow the canonical envelope `{ statusCode, error: { code, message, details? } }`:

  | Error Code / Status                     | Origin & Cause                               | Client Handling & Presentation                                                                                               |
  | :-------------------------------------- | :------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- |
  | `400 VALIDATION_FAILED`                 | DTO validation failure (e.g. invalid format) | If `details` array specifies property path (`phone`, `name`), render inline field error; otherwise render form alert banner. |
  | `400 INVALID_QUERY_PARAMETER`           | Unknown query parameter sent (e.g. `limit`)  | Reset invalid parameter to default and display query error notice.                                                           |
  | `401 UNAUTHORIZED` / `SESSION_EXPIRED`  | Expired or missing HttpOnly cookie           | Clear client state and redirect to `/login?from=${currentPath}`.                                                             |
  | `403 FORBIDDEN` / `ORIGIN_GUARD`        | Role mismatch or invalid CSRF origin         | Display toast banner: "Bạn không có quyền thực hiện thao tác này."                                                           |
  | `404 CUSTOMER_NOT_FOUND`                | Customer ID does not exist or wrong tenant   | Render 404 EmptyState card with action button navigating back to `/customers`.                                               |
  | `404 CUSTOMER_ADDRESS_NOT_FOUND`        | Address ID does not exist                    | Refresh customer detail view; inform user address was already removed.                                                       |
  | `409 LAST_CUSTOMER_ADDRESS`             | Attempting to delete customer's sole address | Modal displays error message: _"Không thể xóa địa chỉ duy nhất của khách hàng."_ (Delete button disabled).                   |
  | `409 DEFAULT_ADDRESS_REASSIGN_REQUIRED` | Deleting default address without replacement | Modal intercepts flow and displays default address reassignment selector.                                                    |
  | `409 CUSTOMER_PHONE_CONFLICT`           | Phone number already registered              | Render inline error on phone input: _"Số điện thoại đã tồn tại trong hệ thống."_                                             |
  | `429 RATE_LIMITED`                      | Rate limiter threshold exceeded              | Display warning banner: _"Bạn đang thao tác quá nhanh. Vui lòng thử lại sau vài giây."_                                      |
  | `500 INTERNAL_SERVER_ERROR`             | Unhandled server exception                   | Safe generic alert: _"Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau."_ (No internal stack traces leaked).                     |

### 7.2 Two-Step Default Address Deletion Sequencing

When an operator attempts to delete an address that is currently marked default (`isDefault: true`):

1. **Modal Interception**: `DeleteAddressModal` inspects `address.isDefault`.
2. **Cardinality Check**:
   - If total addresses $== 1$: Deletion is strictly blocked with explanatory message (`LAST_CUSTOMER_ADDRESS`).
   - If total addresses $> 1$: Modal presents a dropdown listing all _other_ addresses for this customer, requiring the operator to choose a replacement default address.
3. **Execution Sequence**:
   - Step 2a: Client executes `POST /api/customers/:id/addresses/:newDefaultId/default`.
   - Step 2b: Upon 200 OK from step 2a, client executes `DELETE /api/customers/:id/addresses/:targetAddressId`.
   - Step 2c: If Step 2a succeeds but Step 2b fails (network interruption): modal notifies operator that the new default was assigned but target deletion failed, providing an explicit "Thử lại xóa" retry button. The two calls are not assumed to be atomic.
   - Step 2d: Detail view refreshes from server via `CustomerController_get`.

---

## 8. Security, Concurrency & Performance Analysis

- **Authentication & MFA**: Real local authentication via `POST /api/auth/login` issuing HttpOnly, SameSite=Lax cookies. ADMIN role enforces mandatory second-step TOTP challenge via `POST /api/auth/mfa/verify`. Zero passwords, TOTP secrets, or session tokens enter client-side storage.
- **Client State Security**: `localStorage` is restricted strictly to non-sensitive UI preferences:
  - `nexora_remembered_username`: non-secret username string.
  - `nexora_packages_columns`: JSON array of visible column keys.
  - `nexora_sidebar_collapsed`: boolean flag (`true`/`false`).
- **N+1 Query Prevention**:
  - `CustomerSummaryDto` on the list endpoint does not contain recipient addresses.
  - The design **omits** the `addressCount` column from the summary table. Deriving address counts on the list page would require issuing $N$ individual detail queries, creating an N+1 query vulnerability. Address counts are displayed only on the Customer Detail page (`/customers/[id]`).
- **Scoped Statistics & Projection**:
  - `pagination.total` represents the total matching the active query/filter criteria, not an unconditional tenant total.
  - Filter tabs display counts scoped strictly to active filters; unselected tabs omit artificial counts rather than guessing or summing a single page.

---

## 9. Compatibility Matrix & Route Strategy

### 9.1 Route Canonicalization & Query Preservation

- **Canonical Route**: `/shipments/retail` is the permanent route for Retail Packages.
- **Compatibility Route (`/logistics/parcels`)**:
  - PR #14 (unmerged) proposed `/logistics/parcels`. To ensure backwards compatibility during branch testing, `apps/web/app/(workspace)/logistics/parcels/page.tsx` implements a server-side redirect.
  - **Redirect Semantics**: Implemented using Next.js `redirect()` (HTTP 307 Temporary Redirect). A temporary 307 redirect is chosen rather than a permanent 308 (`permanentRedirect()`) to avoid permanent browser cache poisoning while migration routes are actively consolidating.
  - **Query Parameter Preservation**:

    ```typescript
    import { redirect } from "next/navigation";

    export default async function ParcelsRedirect({
      searchParams,
    }: {
      searchParams: Promise<Record<string, string | string[] | undefined>>;
    }) {
      const params = await searchParams;
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
          for (const item of value) query.append(key, item);
        } else if (typeof value === "string") {
          query.append(key, value);
        }
      }
      const qs = query.toString();
      redirect(`/shipments/retail${qs ? `?${qs}` : ""}`);
    }
    ```

    - Supports repeated query keys and array values (`query.append`).
    - Uses relative path target `/shipments/retail` to guarantee zero open redirect vulnerabilities.

### 9.2 API & OpenAPI Contract Impact

- Zero modifications to existing OpenAPI contracts.
- Customer List consumes canonical `GET /api/customers?page=&pageSize=&q=&status=&phone=`.
- Generated SDK types in `@nexora/sdk` are consumed without modification.
- Zero database migrations or schema alterations.

---

## 10. Milestone Verification, Visual Parity & Rollback Strategy

### 10.1 Milestone Plans (M1 through M5)

#### Milestone M1 — Design System, Font & Application Shell

- **Functional Scope**: Global design tokens, local variable Inter font, Tier A UI primitives (`Button`, `TextInput`, `Select`, `Checkbox`, `Drawer`, `Dialog`, `Pagination`, `EmptyState`), and Tier B application shell (`AppShell`, `Sidebar`, `Header`, `Breadcrumb`, `AccountMenu`, `NotificationMenu`). Public Login card restyling.
- **Source ZIP Components Covered**: `App.tsx`, `Sidebar.tsx`, `Header.tsx`, `LoginPage.tsx`, `types.ts`, `index.css`.
- **Existing Nexora Components Reused/Replaced**:
  - Replaces ad-hoc HTML buttons, inputs, and dialogs across web app.
  - Replaces existing `Sidebar.tsx` and `Header.tsx` presentation while preserving Next.js App Router frame.
  - Preserves existing `Panel.tsx` and `StatusBadge.tsx` from `packages/ui`.
  - Preserves real `LoginForm.tsx` session authentication and MFA challenge.
- **Architectural Boundaries**:
  - Tier A primitives placed strictly in `packages/ui/src/`. Zero domain imports.
  - Shell components placed in `apps/web/components/app-shell/`.
  - Centralized tokens owned exclusively by `apps/web/styles/tokens.css`.
- **Visual Parity Requirements**:
  - Header height exactly 56px (`--header-height: 56px`).
  - Sidebar width 240px (expanded) and 72px (collapsed) with navy `#172B4D` background and active item orange indicator `#F58A24`.
  - Inter font loaded locally (`InterVariable.woff2`) rendering crisp Vietnamese diacritics.
  - Login card centered at 420px width.
- **Interaction Acceptance Requirements**:
  - Sidebar collapse/expand toggle functions smoothly with CSS transition.
  - Mobile hamburger toggle opens slide-over sidebar drawer; backdrop click and Escape dismiss overlay.
  - Breadcrumb trail updates accurately based on route.
  - Account menu opens on avatar click; "Đăng xuất" triggers real server logout.
  - Notification popover opens on bell click, displaying honest empty state ("Không có thông báo mới").
  - "Remember Me" checkbox on `/login` persists non-secret username to `localStorage` (Option 1).
- **Backend Integration Requirements**:
  - `POST /api/auth/login` (real session cookie creation).
  - `POST /api/auth/mfa/verify` (TOTP MFA validation).
  - `POST /api/auth/logout` (session invalidation).
- **Accessibility Requirements**:
  - ARIA attributes: `aria-expanded`, `aria-haspopup`, `aria-controls` on dropdowns and drawers.
  - Focus trapping and Escape key closing on overlays.
  - High-contrast focus outlines on all interactive inputs and buttons (`--focus-ring`).
- **Test Plan**:
  - Unit tests for Tier A primitives in `packages/ui/test/`.
  - Token propagation and contrast tests in `apps/web/test/tokens.test.mjs`.
  - Shell navigation and breadcrumb tests in `apps/web/test/navigation.test.mjs`.
  - Native browser smoke test verifying login, logout, and responsive drawer toggling.
- **Auth/Security Regression Risks**:
  - Risk of accidentally replacing real session authentication with ZIP simulated state. Mitigated by keeping `LoginForm.tsx` server proxy architecture untouched.
  - Risk of storing credentials in `localStorage`. Mitigated by strict assertion that only non-secret username string is stored.
- **Rollback Strategy**: Git revert of M1 commit restores previous shell and token stylesheets cleanly; no database or SDK dependencies exist.
- **Merge Acceptance Criteria**:
  - `pnpm format:check`, `pnpm lint`, `pnpm preflight:check`, `pnpm docs:check` pass.
  - Browser smoke test logs zero console errors across login and shell navigation.

#### Milestone M2 — Customer Management (Real API Integration)

- **Functional Scope**: Customer list page (`/customers`) and customer detail page (`/customers/[id]`). Filter tabs (All, Active, Inactive), debounced keyword search, pagination, create customer drawer, edit profile drawer, recipient address drawer, default address setting, and delete address modal with invariant protection.
- **Source ZIP Components Covered**: `CustomerListView.tsx`, `CustomerDetailView.tsx`, `CreateCustomerDrawer.tsx`, `EditCustomerDrawer.tsx`, `AddressDrawer.tsx`, `AddressForm.tsx`, `AddressLabelField.tsx`, `DeleteAddressConfirmModal.tsx`, `customerContractValidation.ts`.
- **Existing Nexora Components Reused/Replaced**:
  - Replaces legacy customer list and detail prototypes.
  - Connects to existing generated `@nexora/sdk` client.
  - Consumes canonical `CustomerStatusLabelsVi` from `@nexora/shared`.
- **Architectural Boundaries**:
  - All customer components placed in `apps/web/features/customers/`.
  - Reusable address subcomponents located in `apps/web/features/customers/components/`.
  - Client SDK hooks isolated in `apps/web/features/customers/hooks/`.
- **Visual Parity Requirements**:
  - Matches customer table styling, status badge tones, monogram customer code chips, address card grid, and drawer aesthetics.
  - Customer table omits `addressCount` column to prevent N+1 queries.
  - Summary bar displays total matching current filter (`pagination.total`).
  - Customer Excel export button rendered disabled with planned notice.
- **Interaction Acceptance Requirements**:
  - Search input debounces at 300ms, sends `q` parameter, and updates browser URL without full reload.
  - Switching status tabs sends canonical `status` parameter (`ACTIVE` / `INACTIVE`).
  - Pagination sends `page` and `pageSize` ($1..100$).
  - Customer creation drawer enforces initial recipient address and creates record atomically via `POST /api/customers`.
  - Editing profile updates fields via `PATCH /api/customers/:id`.
  - Adding/editing address calls corresponding address sub-resource endpoints.
  - Deleting default address requires selecting replacement default address first.
  - Deleting sole address is blocked with inline error (`LAST_CUSTOMER_ADDRESS`).
  - Copy customer code triggers toast feedback.
- **Backend Integration Requirements**:
  - Full integration with 8 SDK operations: `CustomerController_list`, `create`, `get`, `update`, `add`, `remove`, `updateAddress`, `setDefault`.
  - Strict parameter validation: reject `limit` or `search`.
- **Accessibility Requirements**:
  - Keyboard navigation for table rows and action menus.
  - Drawer and modal dialog focus trapping, Escape dismissal, and return-focus.
  - Accessible form validation messages (`aria-invalid="true"`, `aria-describedby`).
- **Test Plan**:
  - Contract integration tests in `apps/web/test/customer-api.test.mjs` verifying real API pagination and error mapping.
  - Invariant tests in `apps/web/test/customer-invariants.test.mjs` asserting address delete protection and default reassignment.
  - E2E browser smoke test covering customer creation, address edit, and filtering.
- **Auth/Security Regression Risks**:
  - Cross-tenant customer access attempts. Mitigated by backend tenant scoping; client safely presents 404 for unowned IDs.
- **Rollback Strategy**: Revert customer feature directory; workspace navigation redirects back to safe empty page.
- **Merge Acceptance Criteria**:
  - All 8 customer endpoints verified working against Dockerized PostgreSQL test database.
  - Zero mock customer records in production runtime code.

#### Milestone M3 — Retail Packages (Modular Refactoring & Honest Planned Presentation)

- **Functional Scope**: Modularization of 2,320-line `RetailPackagesView.tsx` into 10 cohesive components on canonical route `/shipments/retail`. Status tabs (7 tabs), condition filter builder, active filter chips, column visibility customizer with `localStorage` persistence, responsive table, mobile cards, parcel detail drawer with tracking timeline, and create package drawer.
- **Source ZIP Components Covered**: `RetailPackagesView.tsx`, `retailPackagesData.ts`, `mockData.ts`.
- **Existing Nexora Components Reused/Replaced**:
  - Replaces monolithic unmerged parcel prototypes from PR #14.
  - Implements `/logistics/parcels` server-side 307 redirect to `/shipments/retail`.
- **Architectural Boundaries**:
  - Components placed in `apps/web/features/retail-packages/components/`.
  - Filter state hook `usePackageFilters.ts` and column hook `usePackageColumns.ts` in `features/retail-packages/hooks/`.
  - Types in `features/retail-packages/model/`.
- **Visual Parity Requirements**:
  - 100% visual layout parity with reference ZIP table, filter popovers, and detail drawer.
  - Fee quote sections display `"Chưa có báo giá"`; zero speculative constants (`28,000 VND/kg`).
  - Production renders truthful empty state ("Chưa có kiện hàng bán lẻ nào").
- **Interaction Acceptance Requirements**:
  - 7 status tabs update active styling and URL parameter `?status=...`.
  - Advanced filter popover adds condition rows (`field`, `operator`, `value`); chips can be removed individually or cleared all.
  - Column picker checkboxes toggle table column visibility in real time; persisted to `localStorage.getItem('nexora_packages_columns')`.
  - Reset default columns restores initial 20-column layout.
  - Package detail drawer opens on row click, displaying specifications and timeline.
  - Copy tracking code copies to clipboard with toast notification.
  - Create package drawer and export button display informative planned notice ("Tính năng đang được phát triển theo phân hệ Vận đơn").
- **Backend Integration Requirements**:
  - Truthful planned modeling: Shipment Backend V1 is not yet implemented. Zero fake persistence or simulated server writes.
- **Accessibility Requirements**:
  - Table headers include accessible sort and visibility labels.
  - Filter popover and detail drawer handle Escape dismissal and focus restoration.
- **Test Plan**:
  - Isolated fixture tests in `apps/web/test/retail-packages-view.test.mjs` verifying table column toggling and filter chip serialization using synthetic test fixture.
  - Redirect test verifying `/logistics/parcels` forwards query parameters to `/shipments/retail`.
- **Auth/Security Regression Risks**:
  - None (read-only presentation and client filter state).
- **Rollback Strategy**: Revert retail packages feature directory; restore redirect to Overview.
- **Merge Acceptance Criteria**:
  - Zero hardcoded pricing formulas in production code.
  - Zero mock package data imported into production bundle.

#### Milestone M4 — Carrier Connections & Shipping Scope (Real API Integration)

- **Functional Scope**: Multi-carrier connections page on `/settings/carrier-connections` and header `ShippingScopeSelector`. Carrier catalog display, connected accounts listing, add connection drawer, disconnect confirmation modal, and multi-carrier scope context.
- **Source ZIP Components Covered**: `CarrierConnectionsView.tsx`, `ShippingScopeSelector.tsx`, `ShippingScopeContext.tsx`, `carrierConnectionsData.ts`.
- **Existing Nexora Components Reused/Replaced**:
  - Connects to real `/api/carriers` and `/api/carrier-connections` endpoints established in ADR-007.
  - Integrates `ShippingScopeSelector` into `Header.tsx`.
- **Architectural Boundaries**:
  - Feature components placed in `apps/web/features/carrier-connections/`.
  - Scope context and header selector located in `apps/web/components/app-shell/`.
- **Visual Parity Requirements**:
  - Matches carrier account card styling, status indicators (Active, Inactive, Error), and add-account drawer form.
- **Interaction Acceptance Requirements**:
  - Connected accounts list filters by carrier and search keyword.
  - Add connection drawer collects required provider credentials and calls `POST /api/carrier-connections`.
  - Disconnect modal confirms and calls `DELETE /api/carrier-connections/:id`.
  - Header scope selector allows selecting all carriers, a specific carrier, or a specific connected account; synchronizes across routes via `ShippingScopeContext`.
  - Invalid/deleted scope recovery gracefully falls back to "Tất cả nhà vận chuyển".
- **Backend Integration Requirements**:
  - `GET /api/carriers` (catalog of supported providers: GHN, GHTK, ViettelPost, J&T).
  - `GET /api/carrier-connections` (owner-scoped connected accounts).
  - `POST /api/carrier-connections` (encrypts credentials server-side).
  - `DELETE /api/carrier-connections/:id` (revokes connection).
- **Accessibility Requirements**:
  - Accessible disclosure semantics on carrier group accordions and scope dropdowns.
- **Test Plan**:
  - Multi-carrier contract tests in `apps/web/test/carrier-connections.test.mjs`.
  - Scope context synchronization tests in `apps/web/test/shipping-scope.test.mjs`.
- **Auth/Security Regression Risks**:
  - Carrier API key or secret leakage. Mitigated by verifying that client never receives raw secrets; backend returns only masked credentials (`****`).
- **Rollback Strategy**: Revert carrier feature; scope selector defaults to static label.
- **Merge Acceptance Criteria**:
  - Real carrier catalog and connections verified against running API server.

#### Milestone M5 — Final Integration, Scope Decision & Visual Verification

- **Functional Scope**: Implementation of owner decision on China Sourcing (Option A showcase or Option B exclusion), complete cross-route navigation verification, responsive layout testing across 6 viewports, documentation synchronization, and full automated CI pass.
- **Source ZIP Components Covered**: `SearchSection.tsx`, `CategoryGrid.tsx`, `SearchResultsFeedback.tsx`, `ImageSearchModal.tsx`, `categories.ts` (disposition governed by owner decision).
- **Existing Nexora Components Reused/Replaced**:
  - Final cleanup: delete all superseded legacy presentation files.
- **Architectural Boundaries**:
  - Zero Tailwind or Vite dependencies remaining.
  - Single token authority `tokens.css` verified across all pages.
- **Visual Parity Requirements**:
  - Full compliance with Visual Acceptance Matrix across all 6 viewports.
- **Interaction Acceptance Requirements**:
  - Flawless cross-route navigation and browser history restoration.
  - Keyboard navigation (Tab, Shift-Tab, Enter, Space, Escape) verified across all interactive dialogs, drawers, and menus.
- **Backend Integration Requirements**:
  - Full end-to-end integration across auth, customers, and carriers.
- **Accessibility Requirements**:
  - WCAG 2.1 AA compliance: contrast ratio $\ge 4.5:1$, visible focus indicators, screen reader labels.
- **Test Plan**:
  - Full canonical verification suite: `pnpm format:check`, `pnpm lint`, `pnpm preflight:check`, `pnpm docs:check`, `pnpm quality`.
  - Docker Foundation and runtime browser smoke tests on final HEAD.
- **Rollback Strategy**: Clean feature branch history allows targeted rollback of individual milestone commits if necessary.
- **Merge Acceptance Criteria**:
  - Hosted CI Preflight and Docker Foundation workflows completely green on final mergeable HEAD.
  - Owner attestation of visual acceptance.

---

### 10.2 Visual & Responsive Acceptance Matrix

All major screens must satisfy explicit layout, typography, and geometry invariants across the 6 approved viewports:

- **Desktop Large**: 1440 × 900
- **Desktop Laptop**: 1280 × 800
- **Tablet Landscape / Small Desktop**: 1024 × 768
- **Tablet Portrait**: 768 × 1024
- **Mobile Modern**: 390 × 844
- **Mobile Compact**: 375 × 812

| Screen / Route                        | Target Route                    | Viewport Range | Expected Geometry & Layout                                                                          | Typography & Tokens                                                      | Scroll & Overflow Behavior                                                                 | Drawer / Modal Positioning                                                 | Responsive Transformations                                                     | Accepted Differences & Rationale                                                                      |
| :------------------------------------ | :------------------------------ | :------------- | :-------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------- | :----------------------------------------------------------------------------------------- | :------------------------------------------------------------------------- | :----------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| **Login**                             | `/login`                        | All viewports  | Centered card, 420px max-width; padding 32px (desktop) / 20px (mobile)                              | Brand Navy `#172B4D`, Inter font, border `#E2E8F0`, shadow-md            | Vertical page scroll if height $< 600$px; zero horizontal scroll                           | Forgot password modal centered with backdrop blur                          | Full-width card with 16px margins on $\le 420$px                               | Real TOTP challenge step preserved for ADMIN; Remember Me persists non-secret username only           |
| **Workspace Shell**                   | `/(workspace)/*`                | $\ge 1025$px   | Header height 56px; Sidebar 240px (expanded) / 72px (collapsed); main content fills remaining width | Monogram logo, navy sidebar `#172B4D`, orange active indicator `#F58A24` | `document.documentElement.scrollWidth <= window.innerWidth` (zero horizontal body scroll)  | Tooltips reveal on hover/focus when collapsed (`visibility: visible`)      | Persistent sidebar on desktop; toggle button collapses to 72px                 | Submenus expand cleanly; notifications popover renders honest empty state                             |
| **Workspace Shell (Tablet/Mobile)**   | `/(workspace)/*`                | $\le 1024$px   | Header 56px with hamburger menu button; main content full width (sidebar hidden by default)         | Consistent brand tokens and Inter font                                   | Zero horizontal body overflow; touch scrolling smooth                                      | Sidebar transforms into slide-over drawer (280px width) with dark backdrop | Sidebar collapses into drawer; dismisses on backdrop tap or Escape             | Scope selector adjusts to compact icon/dropdown mode                                                  |
| **Customer List**                     | `/customers`                    | $\ge 1025$px   | Toolbar with search bar, status tabs, create button; table layout with sticky header                | Table row height 48px, customer code chip, tone badges                   | Table container handles horizontal overflow with sticky actions; page body never overflows | Create customer drawer slides in from right (480px width)                  | Full table visible with all canonical columns                                  | Address count column omitted to prevent N+1 queries; Excel export button disabled with planned notice |
| **Customer List (Mobile)**            | `/customers`                    | $\le 768$px    | Compact search input, horizontally scrollable status tabs, stacked action buttons                   | Control height 44px for touch targets                                    | Smooth horizontal tab scroll without scrollbar clipping; zero body overflow                | Drawers expand to full screen width ($100\text{vw}$)                       | Table rows transform into mobile customer cards with chevron navigation        | Stacked cards display customer code, name, phone, and status badge                                    |
| **Customer Detail**                   | `/customers/[id]`               | $\ge 1025$px   | 2-column layout: left profile card (320px), right address cards grid (auto-fill $\ge 300$px)        | Inter font, border `#E2E8F0`, default address badge                      | Zero horizontal body scroll                                                                | Edit profile and address drawers slide from right (480px)                  | 2-column layout on desktop                                                     | Address count displayed accurately from loaded detail array                                           |
| **Customer Detail (Mobile)**          | `/customers/[id]`               | $\le 768$px    | 1-column stacked layout: profile card on top, address cards stacked vertically                      | Touch target height $\ge 44$px                                           | Vertical scroll only; zero horizontal overflow                                             | Modals and drawers full width ($100\text{vw}$)                             | Stacked single-column layout                                                   | Action buttons (Add address, Edit) full width                                                         |
| **Retail Packages**                   | `/shipments/retail`             | $\ge 1025$px   | 7 status tabs, search & filter toolbar, column visibility picker, sticky table header               | 20 configurable columns, currency/weight formatted                       | Horizontal table scroll inside container; zero body overflow                               | Detail drawer slides from right (560px width)                              | Full table with column customizer                                              | Missing pricing displayed as `"Chưa có báo giá"`; honest empty state rendered                         |
| **Retail Packages (Mobile)**          | `/shipments/retail`             | $\le 768$px    | Compact toolbar, horizontally scrollable tabs, filter badge button                                  | Clean card layout, font size $\ge 14$px                                  | Zero horizontal body overflow                                                              | Detail drawer full width ($100\text{vw}$)                                  | Table transforms into mobile package cards with tracking code and status badge | Detail drawer displays specs and unlinked tracking timeline                                           |
| **Carrier Connections**               | `/settings/carrier-connections` | All viewports  | 2-tier layout: connected accounts grid on top, carrier provider catalog grid below                  | Provider logos, status badges, border `#E2E8F0`                          | Grid auto-wraps; zero horizontal overflow                                                  | Add account drawer slides from right (480px)                               | 3-column grid (desktop) $\to$ 2-column (tablet) $\to$ 1-column (mobile)        | Real API catalog and accounts; zero fake connection test results                                      |
| **Sourcing Showcase** _(If Option A)_ | `/sourcing`                     | All viewports  | Search bar with platform tabs, 18 category cards grid, image search trigger button                  | Demo badge, orange accent `#F58A24`                                      | Grid auto-wraps; zero horizontal overflow                                                  | Image upload modal centered with backdrop                                  | 6 columns (desktop) $\to$ 4 (tablet) $\to$ 2 (mobile)                          | Search submissions display demo alert notice; zero web scraping                                       |

> [!NOTE]
> **Baseline Screenshot Capture Prerequisite**: In milestone M1, automated Playwright/Puppeteer screenshot capture harnesses will be executed against these viewports using synthetic test fixtures. The captured baselines will serve as immutable visual regression references for pull request verification.

---

## 11. Complete Reference ZIP Inventory & Interaction Matrix

### 11.1 Source File Inventory (Exact 30 Files)

| #   | Source Path                                              | Type   | Responsibility & Content                        | Runtime Relevance      | UI Relevance           | Mock Data?          | Target Location or Exclusion Rationale                    |
| :-- | :------------------------------------------------------- | :----- | :---------------------------------------------- | :--------------------- | :--------------------- | :------------------ | :-------------------------------------------------------- |
| 1   | `src/App.tsx`                                            | `.tsx` | Root layout, tab coordinator, simulated login   | Excluded (Bootstrap)   | Replaced by App Router | Yes                 | Replaced by App Router `layout.tsx` & page routes         |
| 2   | `src/main.tsx`                                           | `.tsx` | Vite DOM entry point (`createRoot`)             | Excluded (Bootstrap)   | None (Vite runtime)    | No                  | Excluded; Nexora uses Next.js App Router                  |
| 3   | `src/index.css`                                          | `.css` | Tailwind v4 imports and utility setup           | Reference Only         | Layout styling         | No                  | Converted to CSS Modules and `tokens.css`                 |
| 4   | `src/types.ts`                                           | `.ts`  | Interfaces for categories, menus, viewports     | Reference Only         | TypeScript models      | No                  | Replaced by `@nexora/shared`, SDK, & feature types        |
| 5   | `src/components/Header.tsx`                              | `.tsx` | Top bar (56px), breadcrumbs, notifications      | Migrated               | Header chrome          | Yes (mock notifs)   | `apps/web/components/app-shell/Header.tsx`                |
| 6   | `src/components/Sidebar.tsx`                             | `.tsx` | Collapsible sidebar (240px/72px), menus         | Migrated               | Sidebar navigation     | No                  | `apps/web/components/app-shell/Sidebar.tsx`               |
| 7   | `src/components/LoginPage.tsx`                           | `.tsx` | 420px card login, password toggle, forgot       | Migrated               | Authentication UI      | Yes (quick fill)    | `apps/web/app/login/LoginForm.tsx` (restyled)             |
| 8   | `src/components/RetailPackagesView.tsx`                  | `.tsx` | Monolithic retail packages view (2,320 lines)   | Migrated (Modularized) | Packages list/filters  | Yes (mock parcels)  | `apps/web/features/retail-packages/` (10 modules)         |
| 9   | `src/components/CarrierConnectionsView.tsx`              | `.tsx` | Carrier accounts list, drawers (1,095 lines)    | Migrated (Modularized) | Carrier settings       | Yes (mock accounts) | `apps/web/features/carrier-connections/`                  |
| 10  | `src/components/ShippingScopeSelector.tsx`               | `.tsx` | Header carrier/account dropdown (463 lines)     | Migrated               | Scope selector         | Yes (mock carriers) | `apps/web/components/app-shell/ShippingScopeSelector.tsx` |
| 11  | `src/components/SearchSection.tsx`                       | `.tsx` | Sourcing search bar with platform tabs          | Scope Pending          | Product search         | No                  | `apps/web/features/sourcing/` (PLAN ISSUE 1)              |
| 12  | `src/components/CategoryGrid.tsx`                        | `.tsx` | 18 e-commerce category cards                    | Scope Pending          | Category grid          | No                  | `apps/web/features/sourcing/` (PLAN ISSUE 1)              |
| 13  | `src/components/SearchResultsFeedback.tsx`               | `.tsx` | Sourcing search results feedback card           | Scope Pending          | Search feedback        | Yes (mock items)    | `apps/web/features/sourcing/` (PLAN ISSUE 1)              |
| 14  | `src/components/ImageSearchModal.tsx`                    | `.tsx` | Modal for image upload sourcing                 | Scope Pending          | Image search modal     | Yes (demo presets)  | `apps/web/features/sourcing/` (PLAN ISSUE 1)              |
| 15  | `src/components/customers/CustomerListView.tsx`          | `.tsx` | Customer list table, search, tabs (674 lines)   | Migrated               | Customer list UI       | Yes (mock list)     | `apps/web/features/customers/CustomerListPage.tsx`        |
| 16  | `src/components/customers/CustomerDetailView.tsx`        | `.tsx` | Customer detail, address grid (511 lines)       | Migrated               | Customer detail UI     | Yes (mock details)  | `apps/web/features/customers/CustomerDetailPage.tsx`      |
| 17  | `src/components/customers/CreateCustomerDrawer.tsx`      | `.tsx` | Drawer to create customer + address (495 lines) | Migrated               | Customer create        | No                  | `apps/web/features/customers/CreateCustomerDrawer.tsx`    |
| 18  | `src/components/customers/EditCustomerDrawer.tsx`        | `.tsx` | Drawer to edit customer profile (360 lines)     | Migrated               | Profile update         | No                  | `apps/web/features/customers/EditCustomerDrawer.tsx`      |
| 19  | `src/components/customers/AddressDrawer.tsx`             | `.tsx` | Drawer to add/edit address (251 lines)          | Migrated               | Address create/edit    | No                  | `apps/web/features/customers/AddressDrawer.tsx`           |
| 20  | `src/components/customers/AddressForm.tsx`               | `.tsx` | Reusable recipient address form (166 lines)     | Migrated               | Address form fields    | No                  | `apps/web/features/customers/AddressForm.tsx`             |
| 21  | `src/components/customers/AddressLabelField.tsx`         | `.tsx` | Preset chips for address tag (66 lines)         | Migrated               | Label chips input      | No                  | `apps/web/features/customers/AddressLabelChips.tsx`       |
| 22  | `src/components/customers/DeleteAddressConfirmModal.tsx` | `.tsx` | Modal to confirm deleting address (268 lines)   | Migrated               | Delete address flow    | No                  | `apps/web/features/customers/DeleteAddressModal.tsx`      |
| 23  | `src/context/ShippingScopeContext.tsx`                   | `.tsx` | React Context for carrier scope (209 lines)     | Migrated               | Workspace state        | Yes (mock carriers) | `apps/web/components/app-shell/ShippingScopeContext.tsx`  |
| 24  | `src/data/carrierConnectionsData.ts`                     | `.ts`  | Carrier catalog & mock accounts (217 lines)     | Test Fixture Only      | Carrier metadata       | Yes (mock accounts) | Replaced by real `/api/carriers`; mock to fixtures        |
| 25  | `src/data/categories.ts`                                 | `.ts`  | 18 sourcing category items (149 lines)          | Scope Pending          | Category data          | Yes (static data)   | `features/sourcing/model/categories.ts` (Option A)        |
| 26  | `src/data/customerContractValidation.ts`                 | `.ts`  | Customer validation rules (278 lines)           | Reference Only         | Validation rules       | No                  | Enforced via generated SDK and backend OpenAPI            |
| 27  | `src/data/customersData.ts`                              | `.ts`  | `INITIAL_CUSTOMERS` dataset (310 lines)         | Test Fixture Only      | Mock customer state    | Yes (mock data)     | Discarded from prod; test fixture in `test/fixtures/`     |
| 28  | `src/data/mockData.ts`                                   | `.ts`  | Navigation groups, notifications (148 lines)    | Reference Only         | Navigation items       | Yes (mock notifs)   | Navigation to `nav-config.ts`; notifs empty state         |
| 29  | `src/data/retailPackagesData.ts`                         | `.ts`  | RetailPackage interface, mock items (464 lines) | Test Fixture Only      | Mock parcels           | Yes (mock parcels)  | Columns to `model/columns.ts`; mock data to fixtures      |
| 30  | `src/data/__tests__/customerInvariants.test.ts`          | `.ts`  | Vitest test suite for invariants (312 lines)    | Test Reference         | Contract assertions    | Yes (in-memory)     | Adapted to native Node tests in `test/`                   |

---

### 11.2 Granular UI Interaction Coverage Matrix (38 Interaction Cases)

The 38 discrete user interactions across all source files are cataloged with exact handler bindings, data dependencies, and delivery classifications:

- **`FUNCTIONAL_WITH_EXISTING_API`**: 12 interactions
- **`FUNCTIONAL_CLIENT_PRESENTATION`**: 11 interactions
- **`BACKEND_PENDING`**: 10 interactions
- **`PRODUCT_DECISION_PENDING`**: 5 interactions
- **`APPROVED_EXCLUSION`**: 0 interactions

| #   | Interaction Case             | Source File & Handler / State                            | User Action                   | Reference ZIP Behavior            | Target Component            | Data Requirement                      | Target Production Behavior                                | Classification                   | Verification Test Case         | Approved Difference / Exception                            |
| :-- | :--------------------------- | :------------------------------------------------------- | :---------------------------- | :-------------------------------- | :-------------------------- | :------------------------------------ | :-------------------------------------------------------- | :------------------------------- | :----------------------------- | :--------------------------------------------------------- |
| 1   | **Sidebar Navigation**       | `Sidebar.tsx` (`activeMenuId`)                           | Clicks menu item              | Updates state; switches view      | `Sidebar.tsx`               | Pathname                              | Next.js App Router navigation                             | `FUNCTIONAL_WITH_EXISTING_API`   | `navigation.test.mjs`          | Uses Next.js `Link` routes instead of in-memory tab state  |
| 2   | **Sidebar Submenu**          | `Sidebar.tsx` (`toggleSubmenu`, `openSubmenus`)          | Clicks parent group           | Expands/collapses submenu list    | `Sidebar.tsx`               | Local State                           | Toggles open state with CSS transition                    | `FUNCTIONAL_CLIENT_PRESENTATION` | `sidebar.test.mjs`             | Preserves expanded state across route changes              |
| 3   | **Sidebar Collapse**         | `Sidebar.tsx` (`isCollapsed`)                            | Clicks collapse button        | Width shrinks 240px $\to$ 72px    | `ShellClient.tsx`           | `localStorage`                        | Shrinks width; hover reveals tooltips                     | `FUNCTIONAL_CLIENT_PRESENTATION` | `sidebar-collapse.test.mjs`    | Persists collapsed preference to `localStorage`            |
| 4   | **Mobile Sidebar Overlay**   | `Sidebar.tsx` (`isMobileOpen`)                           | Taps hamburger icon           | Slide-over drawer opens from left | `AppShell.tsx`              | Local State                           | Opens drawer with backdrop blur; Escape closes            | `FUNCTIONAL_CLIENT_PRESENTATION` | `mobile-drawer.test.mjs`       | Full focus trap and backdrop tap dismissal                 |
| 5   | **Header Breadcrumbs**       | `Header.tsx` (`currentMenu`)                             | Navigates routes              | Displays active menu text         | `Breadcrumb.tsx`            | Pathname                              | Generates clickable breadcrumb hierarchy                  | `FUNCTIONAL_WITH_EXISTING_API`   | `breadcrumb.test.mjs`          | Dynamically resolves customer codes from route params      |
| 6   | **Notification Popover**     | `Header.tsx` (`showNotifications`)                       | Clicks bell icon              | Displays mock notification list   | `NotificationMenu.tsx`      | None                                  | Renders honest empty state ("Không có thông báo mới")     | `BACKEND_PENDING`                | `notification-menu.test.mjs`   | Zero fake notifications rendered in production             |
| 7   | **User Account Menu**        | `Header.tsx` (`showUserDropdown`)                        | Clicks user avatar            | Toggles user menu dropdown        | `AccountMenu.tsx`           | Server Session                        | Displays username, role, and logout action                | `FUNCTIONAL_WITH_EXISTING_API`   | `account-menu.test.mjs`        | Displays real authenticated user session data              |
| 8   | **Session Logout**           | `Header.tsx` (`onLogout`)                                | Clicks "Đăng xuất"            | Resets simulated state            | `AccountMenu.tsx`           | `POST /api/auth/logout`               | Real POST logout destroying HttpOnly cookie               | `FUNCTIONAL_WITH_EXISTING_API`   | `auth-logout.test.mjs`         | Executes secure server logout instead of memory clear      |
| 9   | **Login Submission**         | `LoginPage.tsx` (`handleSubmit`)                         | Submits credentials           | Validates against mock strings    | `LoginForm.tsx`             | `POST /api/auth/login`                | Real login POST; prompts MFA for ADMIN role               | `FUNCTIONAL_WITH_EXISTING_API`   | `login-flow.test.mjs`          | Preserves real password + TOTP MFA authentication          |
| 10  | **Password Visibility**      | `LoginPage.tsx` (`showPassword`)                         | Clicks eye icon               | Toggles input type text/password  | `TextInput.tsx`             | Local State                           | Toggles password visibility cleanly                       | `FUNCTIONAL_CLIENT_PRESENTATION` | `password-visibility.test.mjs` | None                                                       |
| 11  | **Remember Me Checkbox**     | `LoginPage.tsx` (`rememberMe`)                           | Toggles checkbox              | Toggles local state               | `LoginForm.tsx`             | `localStorage`                        | Persists non-secret username to `localStorage`            | `FUNCTIONAL_CLIENT_PRESENTATION` | `remember-me.test.mjs`         | Option 1: username only; zero secrets or TTL extension     |
| 12  | **Forgot Password Modal**    | `LoginPage.tsx` (`showForgotModal`)                      | Clicks "Quên mật khẩu"        | Opens simulated reset form        | `LoginForm.tsx`             | None                                  | Opens modal directing user to contact administrator       | `BACKEND_PENDING`                | `forgot-password.test.mjs`     | Nexora has no self-serve reset API; informs honestly       |
| 13  | **Shipping Scope Selector**  | `ShippingScopeSelector.tsx` (`handleSelectAccount`)      | Selects carrier/account       | Updates context state             | `ShippingScopeSelector.tsx` | `GET /api/carrier-connections`        | Derives scope from real connections; updates URL          | `FUNCTIONAL_WITH_EXISTING_API`   | `shipping-scope.test.mjs`      | Backed by real carrier connections; recovers on invalid ID |
| 14  | **Customer Keyword Search**  | `CustomerListView.tsx` (`searchQuery`)                   | Types in search bar           | Filters in-memory array           | `CustomerListPage.tsx`      | `GET /api/customers?q=`               | 300ms debounced real API search query `q`                 | `FUNCTIONAL_WITH_EXISTING_API`   | `customer-search.test.mjs`     | Query parameter named `q` (not `search`); debounced        |
| 15  | **Customer Search Clear**    | `CustomerListView.tsx` (`setSearchQuery`)                | Clicks clear (X) icon         | Clears search input               | `CustomerListPage.tsx`      | `GET /api/customers`                  | Clears `q` from URL and restores paginated list           | `FUNCTIONAL_WITH_EXISTING_API`   | `customer-search.test.mjs`     | None                                                       |
| 16  | **Customer Status Tabs**     | `CustomerListView.tsx` (`activeTab`)                     | Clicks status tab             | Filters in-memory array           | `CustomerListPage.tsx`      | `GET /api/customers?status=`          | Filters by canonical `ACTIVE` / `INACTIVE`                | `FUNCTIONAL_WITH_EXISTING_API`   | `customer-status.test.mjs`     | Uses canonical status enum and shared labels               |
| 17  | **Customer Pagination**      | `CustomerListView.tsx` (`currentPage`, `pageSize`)       | Selects page or size          | Slices in-memory array            | `Pagination.tsx`            | `GET /api/customers?page=&pageSize=`  | Server pagination via `page` and `pageSize` ($1..100$)    | `FUNCTIONAL_WITH_EXISTING_API`   | `customer-pagination.test.mjs` | Uses canonical `pageSize` (not `limit`)                    |
| 18  | **Customer Row Navigation**  | `CustomerListView.tsx` (row click)                       | Clicks customer row           | Sets detail view state            | `CustomerTable.tsx`         | `customer.id`                         | Navigates to App Router route `/customers/[id]`           | `FUNCTIONAL_WITH_EXISTING_API`   | `customer-nav.test.mjs`        | Stable route navigation instead of state swap              |
| 19  | **Customer Code Copy**       | `CustomerListView.tsx` (`handleCopy`)                    | Clicks code chip              | Copies string to clipboard        | `CustomerTable.tsx`         | Clipboard API                         | Copies `KH000001` with toast notification                 | `FUNCTIONAL_CLIENT_PRESENTATION` | `clipboard-copy.test.mjs`      | None                                                       |
| 20  | **Customer Creation**        | `CreateCustomerDrawer.tsx` (`handleSubmit`)              | Enters profile & address      | Appends to in-memory array        | `CreateCustomerDrawer.tsx`  | `POST /api/customers`                 | Atomic customer profile + required initial address        | `FUNCTIONAL_WITH_EXISTING_API`   | `customer-create.test.mjs`     | Strictly requires initial recipient address per invariant  |
| 21  | **Customer Profile Edit**    | `EditCustomerDrawer.tsx` (`handleSubmit`)                | Updates name/phone/status     | Modifies in-memory object         | `EditCustomerDrawer.tsx`    | `PATCH /api/customers/:id`            | Executes real patch; validates phone normalization        | `FUNCTIONAL_WITH_EXISTING_API`   | `customer-edit.test.mjs`       | Maps duplicate phone conflict to field error (`409`)       |
| 22  | **Customer Add Address**     | `AddressDrawer.tsx` (`handleSubmit`)                     | Submits address form          | Appends to customer array         | `AddressDrawer.tsx`         | `POST /api/customers/:id/addresses`   | Adds recipient address to aggregate                       | `FUNCTIONAL_WITH_EXISTING_API`   | `address-add.test.mjs`         | Server validates required address text and recipient phone |
| 23  | **Customer Edit Address**    | `AddressDrawer.tsx` (`handleSubmit`)                     | Modifies address fields       | Modifies address object           | `AddressDrawer.tsx`         | `PATCH .../addresses/:id`             | Updates recipient fields without altering default flag    | `FUNCTIONAL_WITH_EXISTING_API`   | `address-edit.test.mjs`        | None                                                       |
| 24  | **Customer Set Default**     | `CustomerDetailView.tsx` (`handleSetDefaultAddress`)     | Clicks "Đặt làm mặc định"     | Toggles `isDefault` flags         | `CustomerDetailPage.tsx`    | `POST .../addresses/:id/default`      | Atomically assigns default address via backend            | `FUNCTIONAL_WITH_EXISTING_API`   | `address-default.test.mjs`     | Atomic server-authoritative reassignment                   |
| 25  | **Customer Delete Address**  | `DeleteAddressConfirmModal.tsx` (`handleConfirm`)        | Confirms address delete       | Filters address array             | `DeleteAddressModal.tsx`    | `POST default` + `DELETE address`     | Enforces 2-step default reassignment; blocks last address | `FUNCTIONAL_WITH_EXISTING_API`   | `address-delete.test.mjs`      | Blocks sole address deletion (`409 LAST_CUSTOMER_ADDRESS`) |
| 26  | **Customer Excel Export**    | `CustomerListView.tsx` (export click)                    | Clicks "Xuất Excel"           | Displays alert("Exported")        | `CustomerListPage.tsx`      | None                                  | Button rendered disabled with planned tooltip notice      | `BACKEND_PENDING`                | `customer-export.test.mjs`     | Disabled button; zero fake download or browser alerts      |
| 27  | **Retail Status Tabs**       | `RetailPackagesView.tsx` (`activeTab`)                   | Clicks 7 status tabs          | Filters in-memory parcels         | `PackageStatusTabs.tsx`     | URL Query                             | Synchronizes `?status=...`; table shows empty state       | `FUNCTIONAL_CLIENT_PRESENTATION` | `retail-tabs.test.mjs`         | Truthful empty state; no mock shipments in production      |
| 28  | **Retail Search & Debounce** | `RetailPackagesView.tsx` (`searchQuery`)                 | Types package search          | Filters in-memory parcels         | `PackageToolbar.tsx`        | URL Query                             | 300ms debounced search query sync to URL `?q=`            | `FUNCTIONAL_CLIENT_PRESENTATION` | `retail-search.test.mjs`       | None                                                       |
| 29  | **Retail Filter Builder**    | `RetailPackagesView.tsx` (`handleAddFilterCondition`)    | Adds condition row            | Constructs filter predicate       | `PackageFilters.tsx`        | Local State                           | Evaluates draft condition rules; updates active chips     | `FUNCTIONAL_CLIENT_PRESENTATION` | `retail-filters.test.mjs`      | None                                                       |
| 30  | **Retail Filter Chips**      | `RetailPackagesView.tsx` (remove chip)                   | Clicks chip (X) or clear all  | Removes condition rule            | `ActiveFilterChips.tsx`     | Local State                           | Removes chip, re-evaluates filters, resets page to 1      | `FUNCTIONAL_CLIENT_PRESENTATION` | `retail-chips.test.mjs`        | None                                                       |
| 31  | **Retail Column Visibility** | `RetailPackagesView.tsx` (`toggleColumn`)                | Toggles column checkbox       | Toggles column visibility         | `PackageColumnPicker.tsx`   | `localStorage`                        | Shows/hides DOM columns; persists to `localStorage`       | `FUNCTIONAL_CLIENT_PRESENTATION` | `retail-columns.test.mjs`      | None                                                       |
| 32  | **Retail Code Copy**         | `RetailPackagesView.tsx` (`handleCopyCode`)              | Clicks tracking code          | Copies tracking number            | `PackageTable.tsx`          | Clipboard API                         | Copies tracking code with visual feedback toast           | `FUNCTIONAL_CLIENT_PRESENTATION` | `clipboard-copy.test.mjs`      | None                                                       |
| 33  | **Retail Detail Drawer**     | `RetailPackagesView.tsx` (`inspectingPackage`)           | Clicks package row            | Opens slide-over drawer           | `PackageDetailDrawer.tsx`   | Test Fixture                          | Renders parcel specs; timeline shows unlinked status      | `BACKEND_PENDING`                | `retail-drawer.test.mjs`       | Timeline renders unlinked presentation; no fake events     |
| 34  | **Retail Create Package**    | `RetailPackagesView.tsx` (`handleCreateSubmit`)          | Enters parcel specs & submits | Appends to in-memory array        | `CreatePackageDrawer.tsx`   | None                                  | Form validates; displays planned feature notice           | `BACKEND_PENDING`                | `retail-create.test.mjs`       | Truthful planned notice; zero fake persistence             |
| 35  | **Retail Freight Quote**     | `RetailPackagesView.tsx` (fee calculation)               | Enters weight / VAS items     | Computes `wtKg * 28000 + ...`     | `PackageFeeSection.tsx`     | None                                  | Displays `"Chưa có báo giá"`; zero example math           | `BACKEND_PENDING`                | `retail-fee.test.mjs`          | Example arithmetic strictly removed from production        |
| 36  | **Retail Package Export**    | `RetailPackagesView.tsx` (export click)                  | Clicks "Xuất dữ liệu"         | Displays alert("Exported")        | `PackageToolbar.tsx`        | None                                  | Button rendered disabled with planned tooltip notice      | `BACKEND_PENDING`                | `retail-export.test.mjs`       | Disabled button; zero fake download or alert               |
| 37  | **Carrier Accounts Listing** | `CarrierConnectionsView.tsx` (`selectedCarrierFilter`)   | Filters accounts by carrier   | Filters in-memory array           | `CarrierAccountsPage.tsx`   | `GET /api/carrier-connections`        | Lists real connected accounts from backend                | `FUNCTIONAL_WITH_EXISTING_API`   | `carrier-accounts.test.mjs`    | Backed by real database accounts via API                   |
| 38  | **Carrier Disconnect**       | `CarrierConnectionsView.tsx` (`handleConfirmDisconnect`) | Confirms disconnect modal     | Removes from in-memory array      | `DisconnectModal.tsx`       | `DELETE /api/carrier-connections/:id` | Executes real revocation; refreshes accounts list         | `FUNCTIONAL_WITH_EXISTING_API`   | `carrier-disconnect.test.mjs`  | Real backend account revocation                            |
| 39  | **Sourcing Search Bar**      | `SearchSection.tsx` (`handleSubmit`)                     | Enters search keyword         | Simulates search results          | `SearchSection.tsx`         | Scope Pending                         | Displays demo notice: "Chưa kết nối API tìm kiếm"         | `PRODUCT_DECISION_PENDING`       | `sourcing-search.test.mjs`     | Option A showcase only; zero Taobao scraping               |
| 40  | **Sourcing Category Grid**   | `CategoryGrid.tsx` (card click)                          | Clicks category card          | Filters simulated products        | `CategoryGrid.tsx`          | Scope Pending                         | Toggles active category card in showcase view             | `PRODUCT_DECISION_PENDING`       | `sourcing-category.test.mjs`   | Option A showcase only                                     |
| 41  | **Sourcing Result Feedback** | `SearchResultsFeedback.tsx`                              | Clicks feedback buttons       | Displays feedback alert           | `SearchResultsFeedback.tsx` | Scope Pending                         | Renders static presentation mockup                        | `PRODUCT_DECISION_PENDING`       | `sourcing-feedback.test.mjs`   | Option A showcase only                                     |
| 42  | **Sourcing Image Modal**     | `ImageSearchModal.tsx` (`handleStartSearch`)             | Uploads demo image            | Simulates Gemini analysis         | `ImageSearchModal.tsx`      | Scope Pending                         | Displays pre-computed demo tags; zero `@google/genai`     | `PRODUCT_DECISION_PENDING`       | `sourcing-image.test.mjs`      | Option A showcase only; zero external GenAI SDK            |

---

## 12. Approval Evidence & Governance

- **Review Authority**: `dinhphuquy2k1` (Repository Owner)
- **Approval Reference**: `PENDING_REVIEW`
- **Approval Status**: `PENDING_REVIEW`
- **Approval Date**: Pending Owner Decision & Directive

---

## 13. Unresolved PLAN ISSUES

### PLAN ISSUE 1: China Sourcing Product Scope Owner Decision

#### Context & Architectural Conflict

The reference ZIP includes China sourcing components (`SearchSection.tsx`, `CategoryGrid.tsx`, `SearchResultsFeedback.tsx`, `ImageSearchModal.tsx`, `categories.ts`) as the default screen (`activeMenuId === 'search-products'`).
Under Nexora's approved architecture:

- [ADR-002](../../decisions/product-scope.md) establishes Nexora as an enterprise logistics and shipment hub.
- [Frontend Architecture (Section 6)](../../architecture/frontend.md#6-product-scope-boundaries--exclusions-adr-002) explicitly excludes third-party e-commerce web scraping (Taobao, 1688, Tmall), direct generative AI SDK bundling (`@google/genai`), and consumer purchasing features.

#### Owner Decision Comparison

| Dimension                  | Option A: Isolated Sourcing Showcase (Recommended)                                                                                                                   | Option B: Formal Exclusion from Production                                                                             |
| :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| **Product Scope**          | Preserves visual components in an isolated route (`/sourcing`) with non-operational planned disclaimers.                                                             | Formally excludes sourcing views from `@nexora/web` production bundle per ADR-002 (`INTENTIONALLY_EXCLUDED_APPROVED`). |
| **Operational Impact**     | Zero scraping, zero `@google/genai` bundling. Search displays informational notice: _"Bản thử nghiệm giao diện — Chưa kết nối API."_                                 | Route `/` remains Operational Overview & Dashboard. Zero sourcing UI in navigation or bundle.                          |
| **Visual Parity to ZIP**   | **100% visual component coverage** achieved from the reference archive.                                                                                              | Sourcing screens omitted; operational logistics screens achieve 100% parity.                                           |
| **Governance Requirement** | Requires an owner-authorized amendment to `docs/architecture/frontend.md` documenting `/sourcing` as an experimental preview route.                                  | Strictly complies with existing ADR-002 and `frontend.md` without any documentation amendments.                        |
| **Recommendation**         | **Recommended**: Allows complete visual evaluation of the supplied reference design without compromising security, backend boundaries, or business domain integrity. | Viable alternative if the owner prefers zero non-logistics code in the production repository.                          |

#### Approval Sequencing Directive

1. The repository owner selects **Option A** or **Option B** in a comment.
2. The agent updates the design snapshot to describe that single chosen approach and recomputes the SHA-256 digest.
3. The repository owner posts the standalone five-line ADR-009 approval block binding Task `NEXORA-029`, Plan revision `rev-2026-10-22-frontend-migration-v3`, and the newly computed SHA-256 digest with Decision `APPROVED`.
4. _(Note: As mandated by ADR-009, the approval comment must contain only the five contiguous lines without any discussion or option selections)._

---

## 14. Snapshot Pinning & Approval Instructions

Before implementation begins, capture the selected design in the versioned snapshot. Do not include mutable execution/test/CI logs. Compute actual raw UTF-8 SHA-256 with Node crypto or `computeDesignDigest` from `scripts/preflight-policy-check.mjs`. Put the identical path and digest in active task metadata and PR description, then run structural binding validation.

The authorized repository owner posts a standalone five-line decision containing the `NEXORA DESIGN APPROVAL` header, Task ID `NEXORA-029`, Plan revision `rev-2026-10-22-frontend-migration-v3`, raw-byte Design SHA-256 digest, and Decision `APPROVED` (each field on its own contiguous line, zero surrounding prose or extra markdown).
