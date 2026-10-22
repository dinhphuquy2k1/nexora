# NEXORA-029 immutable design snapshot — full frontend migration v2

Task ID: NEXORA-029
Plan revision: rev-2026-10-22-frontend-migration-v2
Reviewed baseline: c14dada3fcfa9466e74b3353ae4b77f8846338e5

## 1. Objectives, ownership and boundaries

Execute a complete frontend migration of Nexora from the reference ZIP archive (`nexora-logistics-management (1).zip`), replacing existing UI presentation, component styling, and client interaction behavior while strictly preserving Nexora's Next.js 16 App Router architecture, CSS Modules, real local authentication/session/MFA, and backend API contracts. This task is classified as SIGNIFICANT.

Ownership boundaries:

- Technical ownership: `@nexora/web` application, `@nexora/ui` shared primitives package, and `@nexora/shared` contracts.
- No aggregate or entity ownership is modified: Customer domain (`apps/api/src/customer/`), Carrier domain (`apps/api/src/carrier/`), and Identity domain (`apps/api/src/identity/`) remain untouched.
- No database schema migrations, production grants, or direct database access from `@nexora/web` are introduced. Web code interacts exclusively via the generated SDK (`@nexora/sdk`) over relative same-origin `/api/*` proxies.
- Zero Vite, Tailwind CSS v4, `@google/genai`, or client-memory state persistence (`INITIAL_CUSTOMERS`, `INITIAL_PACKAGES`) are migrated into production runtime.
- Pre-code design review governance is strictly enforced per ADR-009: no application code or test modifications may occur before authentic repository owner approval is obtained.

## 2. Complete Reference ZIP Source File Inventory

The reference archive `nexora-logistics-management (1).zip` contains exactly 30 source files under `src/` (21 `.tsx`, 8 `.ts`, 1 `.css`):

| #   | Source Path                                              | Type   | Responsibility & Content                                                         | Runtime Relevance      | UI Behavior Relevance                                | Contains Mock Data              | Target Location or Exclusion Rationale                                                     |
| :-- | :------------------------------------------------------- | :----- | :------------------------------------------------------------------------------- | :--------------------- | :--------------------------------------------------- | :------------------------------ | :----------------------------------------------------------------------------------------- |
| 1   | `src/App.tsx`                                            | `.tsx` | Root component, view coordinator (`activeMenuId`), simulated login state         | Excluded (Bootstrap)   | Replaced by Next.js 16 App Router                    | Yes (`customers` state)         | Replaced by Next.js App Router `layout.tsx` and route files                                |
| 2   | `src/main.tsx`                                           | `.tsx` | Vite application entry point (`createRoot`)                                      | Excluded (Bootstrap)   | None (Vite runtime)                                  | No                              | Excluded; Nexora uses Next.js App Router                                                   |
| 3   | `src/index.css`                                          | `.css` | Tailwind v4 imports (`@import "tailwindcss"`) and font setup                     | Reference only         | Layout styling                                       | No                              | Converted to CSS Modules and centralized tokens in `apps/web/styles/tokens.css`            |
| 4   | `src/types.ts`                                           | `.ts`  | Interfaces for categories, menu items, notifications, viewports                  | Reference only         | TypeScript contracts                                 | No                              | Replaced by `@nexora/shared`, SDK types, and feature-local UI model types                  |
| 5   | `src/components/Header.tsx`                              | `.tsx` | Top navigation bar (56px), breadcrumbs, notifications, scope selector, user menu | Migrated               | Header chrome                                        | Yes (mock unread count)         | `apps/web/components/app-shell/Header.tsx`, `AccountMenu.tsx`, `NotificationMenu.tsx`      |
| 6   | `src/components/Sidebar.tsx`                             | `.tsx` | Collapsible sidebar (240px/72px), monogram logo, grouped menus, tooltips         | Migrated               | Sidebar navigation                                   | No                              | `apps/web/components/app-shell/Sidebar.tsx` & `Sidebar.module.css`                         |
| 7   | `src/components/LoginPage.tsx`                           | `.tsx` | Centered 420px card login form, password visibility toggle, forgot modal         | Migrated               | Authentication UI                                    | Yes (quick fill credentials)    | `apps/web/app/login/LoginForm.tsx` & `login.module.css` (real auth preserved)              |
| 8   | `src/components/RetailPackagesView.tsx`                  | `.tsx` | Comprehensive retail packages view (2,320 lines)                                 | Migrated (Modularized) | Packages list, filter builder, table, cards, drawers | Yes (references mock packages)  | Refactored into 10 modular components in `apps/web/features/retail-packages/`              |
| 9   | `src/components/CarrierConnectionsView.tsx`              | `.tsx` | Multi-carrier accounts list, credentials drawer, disconnect modal (1,095 lines)  | Migrated (Modularized) | Carrier management                                   | Yes (mock connected accounts)   | Refactored into modular components in `apps/web/features/carrier-connections/`             |
| 10  | `src/components/ShippingScopeSelector.tsx`               | `.tsx` | Header dropdown to filter by carrier and account (463 lines)                     | Migrated               | Carrier scope selection                              | Yes (mock carrier accounts)     | `apps/web/components/app-shell/ShippingScopeSelector.tsx`                                  |
| 11  | `src/components/SearchSection.tsx`                       | `.tsx` | China sourcing search bar with Taobao, 1688, Tmall tabs                          | Scope Decision Pending | Product search input                                 | No                              | Provisional `apps/web/features/sourcing/` (PLAN ISSUE 1, pending owner decision)           |
| 12  | `src/components/CategoryGrid.tsx`                        | `.tsx` | 18 e-commerce category cards with Chinese keywords                               | Scope Decision Pending | Category filtering                                   | No                              | Provisional `apps/web/features/sourcing/` (PLAN ISSUE 1, pending owner decision)           |
| 13  | `src/components/SearchResultsFeedback.tsx`               | `.tsx` | Search query feedback card and simulated result list                             | Scope Decision Pending | Search feedback                                      | Yes (mock product items)        | Provisional `apps/web/features/sourcing/` (PLAN ISSUE 1, pending owner decision)           |
| 14  | `src/components/ImageSearchModal.tsx`                    | `.tsx` | Modal for image upload / visual product search                                   | Scope Decision Pending | Image search modal                                   | Yes (sample image presets)      | Provisional `apps/web/features/sourcing/` (PLAN ISSUE 1, pending owner decision)           |
| 15  | `src/components/customers/CustomerListView.tsx`          | `.tsx` | Customer list table, search, status filter, pagination (674 lines)               | Migrated               | Customer list UI                                     | Yes (references mock customers) | `apps/web/features/customers/components/CustomerListPage.tsx`, `CustomerTable.tsx`         |
| 16  | `src/components/customers/CustomerDetailView.tsx`        | `.tsx` | Customer detail profile, addresses list, edit triggers (511 lines)               | Migrated               | Customer detail UI                                   | Yes (references mock addresses) | `apps/web/features/customers/components/CustomerDetailPage.tsx`, `CustomerAddressCard.tsx` |
| 17  | `src/components/customers/CreateCustomerDrawer.tsx`      | `.tsx` | Drawer to create customer with initial address (495 lines)                       | Migrated               | Customer creation                                    | No                              | `apps/web/features/customers/components/CreateCustomerDrawer.tsx`                          |
| 18  | `src/components/customers/EditCustomerDrawer.tsx`        | `.tsx` | Drawer to edit customer profile and status (360 lines)                           | Migrated               | Profile update                                       | No                              | `apps/web/features/customers/components/EditCustomerDrawer.tsx`                            |
| 19  | `src/components/customers/AddressDrawer.tsx`             | `.tsx` | Drawer to add or edit recipient address (251 lines)                              | Migrated               | Address creation/edit                                | No                              | `apps/web/features/customers/components/AddressDrawer.tsx`                                 |
| 20  | `src/components/customers/AddressForm.tsx`               | `.tsx` | Reusable recipient address form fields (166 lines)                               | Migrated               | Address form fields                                  | No                              | `apps/web/features/customers/components/AddressForm.tsx`                                   |
| 21  | `src/components/customers/AddressLabelField.tsx`         | `.tsx` | Preset chips for address label ("Nhà riêng", etc.) (66 lines)                    | Migrated               | Label chips input                                    | No                              | `apps/web/features/customers/components/AddressLabelChips.tsx`                             |
| 22  | `src/components/customers/DeleteAddressConfirmModal.tsx` | `.tsx` | Confirmation modal for deleting address (268 lines)                              | Migrated               | Delete address flow                                  | No                              | `apps/web/features/customers/components/DeleteAddressModal.tsx`                            |
| 23  | `src/context/ShippingScopeContext.tsx`                   | `.tsx` | React Context for carrier/account scope state (209 lines)                        | Migrated               | Workspace scope state                                | Yes (initial mock carriers)     | `apps/web/lib/context/ShippingScopeContext.tsx` (backed by real carrier SDK)               |
| 24  | `src/data/carrierConnectionsData.ts`                     | `.ts`  | Catalog of carriers and mock connected accounts (217 lines)                      | Test Fixture Only      | Carrier metadata                                     | Yes (mock accounts)             | Catalog definitions informed by real `/api/carriers`; mock accounts discarded              |
| 25  | `src/data/categories.ts`                                 | `.ts`  | 18 e-commerce category definitions (149 lines)                                   | Scope Decision Pending | Category metadata                                    | Yes (static categories)         | Provisional `features/sourcing/model/categories.ts` (PLAN ISSUE 1)                         |
| 26  | `src/data/customerContractValidation.ts`                 | `.ts`  | Client-side customer contract validation rules (278 lines)                       | Reference Only         | Validation rules                                     | No                              | Rules enforced via generated SDK and backend OpenAPI validation                            |
| 27  | `src/data/customersData.ts`                              | `.ts`  | Customer interface and `INITIAL_CUSTOMERS` dataset (310 lines)                   | Test Fixture Only      | Mock customer state                                  | Yes (`INITIAL_CUSTOMERS`)       | Discarded from production; test fixtures isolated to `test/fixtures/`                      |
| 28  | `src/data/mockData.ts`                                   | `.ts`  | `MENU_GROUPS`, `NOTIFICATIONS`, `USER_ACCOUNT` (148 lines)                       | Reference Only         | Static navigation data                               | Yes (mock user & notifs)        | Navigation mapped to `nav-config.ts`; notifications render honest empty state              |
| 29  | `src/data/retailPackagesData.ts`                         | `.ts`  | RetailPackage interface, carrier list, `INITIAL_PACKAGES` (464 lines)            | Test Fixture Only      | Mock shipment state                                  | Yes (`INITIAL_PACKAGES`)        | Column definitions to `model/columns.ts`; mock data discarded from production              |
| 30  | `src/data/__tests__/customerInvariants.test.ts`          | `.ts`  | Vitest test suite for customer business invariants (312 lines)                   | Test Reference         | Contract assertions                                  | Yes (in-memory tests)           | Adapted to native Node test runner in `apps/web/test/customer-invariants.test.mjs`         |

---

## 3. UI Interaction Coverage Matrix

The 24 user-visible interaction areas across the application are classified into explicit delivery categories:

Classifications:

- `FUNCTIONAL_WITH_EXISTING_API`: Interaction connects to verified backend endpoints and executes real operations.
- `FUNCTIONAL_CLIENT_PRESENTATION`: Local UI/URL state interaction that operates completely on the client without implying backend mutation.
- `BACKEND_PENDING`: UI presentation is fully rendered with interactive forms/dialogs, but backend execution displays an honest planned/disabled notice because the backend domain is not yet implemented.
- `PRODUCT_DECISION_PENDING`: Feature outside Nexora's core product scope (ADR-002) pending explicit repository owner decision.
- `APPROVED_EXCLUSION`: Out-of-scope capability formally excluded by owner decision.

| #   | Interaction Surface          | User-Visible Interaction                                                       | Classification                   | Real Backend Endpoint                                    | Proposed Production Behavior                                                                    |
| :-- | :--------------------------- | :----------------------------------------------------------------------------- | :------------------------------- | :------------------------------------------------------- | :---------------------------------------------------------------------------------------------- |
| 1   | **Sidebar Navigation**       | Clicking menu item navigates to route; clicking submenu expands/collapses list | `FUNCTIONAL_WITH_EXISTING_API`   | Next.js App Router                                       | Route-driven active states; persistent expanded state; mobile overlay toggle                    |
| 2   | **Sidebar Collapse**         | Clicking toggle button collapses sidebar (240px $\to$ 72px)                    | `FUNCTIONAL_CLIENT_PRESENTATION` | None (Client State)                                      | Smooth CSS transition; tooltips display on hover when collapsed                                 |
| 3   | **Header Breadcrumbs**       | Breadcrumb trail updates based on active route and customer code               | `FUNCTIONAL_WITH_EXISTING_API`   | Pathname derivation                                      | Breadcrumb links allow backward navigation                                                      |
| 4   | **Notifications Popover**    | Clicking bell opens notification popover; clicking "Đánh dấu đã đọc"           | `FUNCTIONAL_CLIENT_PRESENTATION` | None (No backend)                                        | Renders honest empty state ("Không có thông báo mới"); no fake events                           |
| 5   | **User Account Menu**        | Clicking avatar opens account menu; clicking "Đăng xuất"                       | `FUNCTIONAL_WITH_EXISTING_API`   | `POST /api/auth/logout`                                  | Real server logout destroying session cookie; error retry handling                              |
| 6   | **Login Form**               | Submitting credentials; toggling password visibility; remember me              | `FUNCTIONAL_WITH_EXISTING_API`   | `POST /api/auth/login`, `POST /api/auth/mfa/verify`      | Real local authentication with TOTP MFA second-step challenge                                   |
| 7   | **Forgot Password Modal**    | Clicking "Quên mật khẩu" in login card opens modal                             | `BACKEND_PENDING`                | None (No password reset API)                             | Displays notice: "Vui lòng liên hệ quản trị viên hệ thống để cấp lại mật khẩu"                  |
| 8   | **Shipping Scope Selector**  | Dropdown selection of all carriers, specific carrier, or account               | `FUNCTIONAL_WITH_EXISTING_API`   | `GET /api/carriers`, `GET /api/carrier-connections`      | Derives scope from real connections; synchronizes with URL query and Context                    |
| 9   | **Customer Search**          | Typing in customer search bar filters list                                     | `FUNCTIONAL_WITH_EXISTING_API`   | `GET /api/customers?q=`                                  | Debounced real backend search by keyword `q` (name, code, phone substring)                      |
| 10  | **Customer Status Tabs**     | Clicking "Tất cả", "Đang hoạt động", "Ngừng hoạt động"                         | `FUNCTIONAL_WITH_EXISTING_API`   | `GET /api/customers?status=`                             | Real filtering by canonical `CustomerStatusCode` (`ACTIVE`, `INACTIVE`)                         |
| 11  | **Customer Pagination**      | Page navigation, rows-per-page selector                                        | `FUNCTIONAL_WITH_EXISTING_API`   | `GET /api/customers?page=&pageSize=`                     | Real server-backed pagination; positive integers `page` and `pageSize` ($1..100$)               |
| 12  | **Customer Excel Export**    | Clicking "Xuất Excel" button in customer list toolbar                          | `BACKEND_PENDING`                | None (No customer export API)                            | Button is rendered with disabled state and tooltip: "Tính năng xuất Excel đang được phát triển" |
| 13  | **Customer Row Actions**     | Clicking row navigates to `/customers/[id]`; action menu                       | `FUNCTIONAL_WITH_EXISTING_API`   | `GET /api/customers/:id`                                 | Navigates to stable detail page; opens edit drawer                                              |
| 14  | **Customer Creation**        | Opening drawer, entering profile & required address, submitting                | `FUNCTIONAL_WITH_EXISTING_API`   | `POST /api/customers`                                    | Atomic customer profile + initial default address creation                                      |
| 15  | **Customer Profile Edit**    | Opening edit drawer, changing name/phone/email/note/status, saving             | `FUNCTIONAL_WITH_EXISTING_API`   | `PATCH /api/customers/:id`                               | Strict profile patch; updates `status` (`ACTIVE`/`INACTIVE`)                                    |
| 16  | **Customer Add Address**     | Opening address drawer, entering recipient fields, submitting                  | `FUNCTIONAL_WITH_EXISTING_API`   | `POST /api/customers/:id/addresses`                      | Adds recipient address; validates phone and address text                                        |
| 17  | **Customer Edit Address**    | Opening address drawer for existing address, updating fields                   | `FUNCTIONAL_WITH_EXISTING_API`   | `PATCH /api/customers/:id/addresses/:addressId`          | Updates recipient name, phone, address text without altering default flag                       |
| 18  | **Customer Set Default**     | Clicking "Đặt làm mặc định" button on address card                             | `FUNCTIONAL_WITH_EXISTING_API`   | `PUT /api/customers/:id/default-address`                 | Atomically sets selected address as default; refreshes detail view                              |
| 19  | **Customer Delete Address**  | Clicking delete on address card opens confirmation modal                       | `FUNCTIONAL_WITH_EXISTING_API`   | `PUT .../default-address` + `DELETE .../addresses/:id`   | Enforces invariants: blocks last address (`409`); reassigns default before delete               |
| 20  | **Retail Status Tabs**       | Clicking 7 status tabs updates filter and active tab styling                   | `FUNCTIONAL_CLIENT_PRESENTATION` | None (Shipment V1 planned)                               | Updates URL parameter `?status=...`; table displays honest empty state                          |
| 21  | **Retail Condition Filters** | Adding, editing, and clearing conditional filter rules                         | `FUNCTIONAL_CLIENT_PRESENTATION` | None (Shipment V1 planned)                               | Constructs active filter chips; serializes to URL query                                         |
| 22  | **Retail Column Visibility** | Toggling column visibility checkboxes in customizer dropdown                   | `FUNCTIONAL_CLIENT_PRESENTATION` | None (Client storage)                                    | Real-time DOM column show/hide; persists to `localStorage`                                      |
| 23  | **Retail Create Package**    | Opening drawer, entering tracking number and parcel dimensions                 | `BACKEND_PENDING`                | None (No shipment API)                                   | Client validation works; submit displays informative planned notice                             |
| 24  | **Retail Detail & Timeline** | Clicking row opens detail drawer showing specs and tracking timeline           | `BACKEND_PENDING`                | None (No shipment API)                                   | Drawer renders specs; timeline shows honest unlinked state                                      |
| 25  | **Retail Freight Quote**     | Fee calculation display in package detail / creation drawers                   | `BACKEND_PENDING`                | None (No pricing engine)                                 | Fee sections display "Chưa có báo giá"; no hardcoded calculations                               |
| 26  | **Retail Package Export**    | Clicking "Xuất dữ liệu" in package toolbar                                     | `BACKEND_PENDING`                | None (No shipment export API)                            | Displays notice: "Tính năng xuất Excel đang được phát triển theo phân hệ Vận đơn"               |
| 27  | **Carrier Connections**      | Listing catalog, connected accounts, adding account credentials                | `FUNCTIONAL_WITH_EXISTING_API`   | `GET /api/carriers`, `GET/POST /api/carrier-connections` | Real catalog and connected accounts; credentials encrypted on server                            |
| 28  | **Carrier Disconnect**       | Clicking disconnect opens confirmation modal and revokes account               | `FUNCTIONAL_WITH_EXISTING_API`   | `DELETE /api/carrier-connections/:id`                    | Revokes connection via authorized API; refreshes account list                                   |
| 29  | **China Sourcing Search**    | Sourcing search bar, 18 category cards, image search modal                     | `PRODUCT_DECISION_PENDING`       | None (ADR-002 excludes)                                  | Documented as PLAN ISSUE 1; pending owner product decision                                      |

---

## 4. Customer API Contract & Capability Matrix

### 4.1 Canonical Customer List Endpoint Specification

The canonical endpoint for listing customers is:

```http
GET /api/customers?page=&pageSize=&q=&status=&phone=
```

Verified parameters:

- `page`: Optional query parameter. Integer $\ge 1$, default `1`.
- `pageSize`: Optional query parameter. Integer $1..100$, default `20`.
- `q`: Optional keyword search. String, maximum 200 characters. Searches name, code, and phone substring.
- `status`: Optional status filter. Enum: `"ACTIVE" | "INACTIVE"`. (Spelled `"Đang hoạt động"` / `"Ngừng hoạt động"` in presentation).
- `phone`: Optional exact phone filter after normalization. String, maximum 64 characters.
- Strict rejection: Any unknown query parameters (such as `limit` or `search`) are rejected by the backend with HTTP `400 Bad Request`.

### 4.2 Customer List Capability Matrix (Field-by-Field & Operation-by-Operation)

| Field / Operation   | Backend Supported?     | Exact SDK / Response Field              | Scoped by Query / Filters? | Additional Network Calls Required? | Proposed UX Behavior                                                    | Acceptance Test                                                   |
| :------------------ | :--------------------- | :-------------------------------------- | :------------------------- | :--------------------------------- | :---------------------------------------------------------------------- | :---------------------------------------------------------------- |
| **Customer Code**   | Yes                    | `customer.code` (`KH000001`)            | Scoped                     | None                               | Monogram chip `#172B4D`, click-to-copy with feedback                    | Renders valid customer code                                       |
| **Customer Name**   | Yes                    | `customer.name`                         | Scoped                     | None                               | Primary text column                                                     | Renders customer name                                             |
| **Customer Phone**  | Yes                    | `customer.phone` (E.164)                | Scoped                     | None                               | Formatted phone display                                                 | Displays normalized phone                                         |
| **Customer Email**  | Yes                    | `customer.email` (nullable)             | Scoped                     | None                               | Displays email or "—" if null                                           | Renders email or placeholder                                      |
| **Customer Status** | Yes                    | `customer.status` (`ACTIVE`/`INACTIVE`) | Scoped                     | None                               | Tone badge (success/pending)                                            | Correct badge tone                                                |
| **Status Label**    | Yes                    | `customer.statusLabel`                  | Scoped                     | None                               | "Đang hoạt động" / "Ngừng hoạt động"                                    | Matches canonical shared label                                    |
| **Address Count**   | **No**                 | Absent from `CustomerSummaryDto`        | N/A                        | Would require N+1 calls            | **Omitted from table column**; displayed only in Customer Detail        | Zero N+1 calls executed; column replaced by "Xem chi tiết" action |
| **Total Customers** | Yes                    | `pagination.total`                      | **Yes (Scoped by filter)** | None                               | Summary bar shows total matching current filter                         | Displays `pagination.total`; updates on filter change             |
| **Active Count**    | **No** (Unconditional) | Absent from response                    | N/A                        | Would require separate query       | Summary badge shows count for active filter; unselected tabs omit count | Zero guessed totals; no summing of single page                    |
| **Inactive Count**  | **No** (Unconditional) | Absent from response                    | N/A                        | Would require separate query       | Summary badge shows count for active filter; unselected tabs omit count | Zero guessed totals; no summing of single page                    |
| **Keyword Search**  | Yes                    | Request query `q`                       | Scoped                     | None                               | Debounced search input updating URL `?q=`                               | Sends `q` parameter; updates table results                        |
| **Status Filter**   | Yes                    | Request query `status`                  | Scoped                     | None                               | Filter tabs (`ALL`, `ACTIVE`, `INACTIVE`) updating URL `?status=`       | Sends `status` parameter; updates results                         |
| **Phone Filter**    | Yes                    | Request query `phone`                   | Scoped                     | None                               | Advanced phone search option                                            | Sends `phone` parameter                                           |
| **Pagination**      | Yes                    | Request `page`, `pageSize`              | Scoped                     | None                               | Pagination controls updating `?page=` and `?pageSize=`                  | Sends `page` & `pageSize`; updates table                          |
| **Excel Export**    | **No**                 | None                                    | N/A                        | No endpoint exists                 | Toolbar button rendered with **disabled state** and planned tooltip     | Button is disabled; zero fake download or alert                   |
| **Row Navigation**  | Yes                    | `customer.id` (UUID)                    | Scoped                     | None                               | Clicking row navigates to `/customers/[id]`                             | Stable navigation via route parameter                             |

---

## 5. Retail Packages Pricing & Freight Fee Policy

### 5.1 Removal of Unauthorized Example Formulas

The reference ZIP hardcoded arbitrary fee formulas:

```typescript
const estVND = Math.round(
  wtKg * 28000 + (newWoodenCrate ? 80000 : 0) + (newInsurance ? 15000 : 0),
);
```

Under Nexora architecture:

- Nexora foundation v0.1.0 has **no approved Shipment pricing engine** or carrier freight tariff contract.
- Hardcoded constants (`28,000 VND/kg`, `80,000 VND`, `15,000 VND`) are **strictly prohibited** from entering production business logic or UI calculations.
- No example monetary calculation may be presented to operators as an official or operational quote.

### 5.2 Truthful Production Presentation Policy

- Visual fee sections (domestic shipping fee, international shipping fee, VAS fees, total amount) are preserved in the layout.
- In production, when viewing or creating packages, fee fields display:
  `"Chưa có báo giá"` or `"—"`.
- In `CreatePackageDrawer`, submitting a package does not calculate arbitrary totals; it renders the informational notice: "Tính năng tính cước tự động sẽ khả dụng khi biểu phí phân hệ Vận đơn được phê duyệt."
- Test fixtures (`test/fixtures/parcels.fixture.ts`) may contain synthetic fee data strictly for verifying table layout rendering, number formatting, and currency symbols (`¥`, `₫`) in automated visual test suites. Production runtime paths never import test fixtures.

---

## 6. Component Architecture & Reusable Primitives Matrix

### 6.1 Three-Tier Ownership

```
Tier A: packages/ui/
├── Panel.tsx & Panel.module.css              # (Existing) Content container card
├── StatusBadge.tsx & StatusBadge.module.css  # (Existing) Semantic status badge
├── Button.tsx & Button.module.css            # Reusable button with variants (primary, secondary, outline, ghost, danger)
├── TextInput.tsx & TextInput.module.css      # Reusable form input with prefix/suffix icon slots and error states
├── Select.tsx & Select.module.css            # Accessible native styled dropdown select
├── Checkbox.tsx & Checkbox.module.css        # Accessible styled checkbox with focus ring
├── Dialog.tsx & Dialog.module.css            # Centered modal dialog with backdrop blur, focus trap, Escape dismissal
├── Drawer.tsx & Drawer.module.css            # Right slide-over drawer with backdrop blur, focus trap, Escape dismissal
├── Pagination.tsx & Pagination.module.css    # Accessible pagination bar with rows-per-page and jump-to-page
└── EmptyState.tsx & EmptyState.module.css    # Content presentation card with icon, title, description, and action button

Tier B: apps/web/components/app-shell/
├── AppShell.tsx & AppShell.module.css        # Server Component layout frame consumed in (workspace)/layout.tsx
├── ShellClient.tsx                           # Client boundary managing sidebar collapse state
├── Sidebar.tsx & Sidebar.module.css          # Collapsible 240px/72px navigation with submenus
├── Header.tsx & Header.module.css            # 56px top bar with breadcrumb trail, notifications, scope selector
├── AccountMenu.tsx & AccountMenu.module.css  # Authenticated user profile disclosure & verified server logout POST
├── Breadcrumb.tsx                            # Pathname-driven breadcrumbs from canonical nav-config
├── NavigationItem.tsx                        # Navigable Link or disabled planned action button
├── NotificationMenu.tsx & .module.css        # System notifications popover with unread counter and honest empty state
└── ShippingScopeSelector.tsx & .module.css   # Multi-carrier and account scope dropdown selector

Tier C: apps/web/features/
├── customers/                                # Customer list, detail, drawers, address management, SDK hooks
├── retail-packages/                          # Retail packages table, status tabs, filter builder, column picker, mobile cards
├── carrier-connections/                      # Carrier catalog, connected accounts list, connection credentials drawer
└── sourcing/ (Provisional)                   # Isolated China sourcing search showcase (pending owner scope decision)
```

### 6.2 Component Extraction Justification Matrix

| Component Candidate   | Proposed Tier           | Existing Implementations             | Consumers in Nexora                                       | Shared Behavior & Styling                                                                                                  | What Remains Feature-Specific                                       | Extraction Justified?                                 |
| :-------------------- | :---------------------- | :----------------------------------- | :-------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------ | :---------------------------------------------------- |
| **`Button`**          | Tier A (`@nexora/ui`)   | Ad-hoc `<button>` in shell and login | Login, Customers, Packages, Carriers, Dialogs             | Variants (`primary`, `secondary`, `outline`, `ghost`, `danger`), sizes (`sm`, `md`, `lg`), loading spinner, disabled state | Click handlers, business logic                                      | **Yes** (Eliminates hundreds of repetitive classes)   |
| **`TextInput`**       | Tier A (`@nexora/ui`)   | Ad-hoc `<input>` in LoginForm        | Login, Customer drawers, Package search, Carrier API keys | Focus rings, error borders, prefix/suffix icons, height tokens (`36px`, `44px`)                                            | Form state, validation schema                                       | **Yes** (Standardizes accessible input styling)       |
| **`Select`**          | Tier A (`@nexora/ui`)   | None                                 | Customer drawers, Package filters, Carrier forms          | Native styled `<select>`, focus ring, arrow icon, control height                                                           | Options list, change handlers                                       | **Yes** (Domain-neutral form select)                  |
| **`Checkbox`**        | Tier A (`@nexora/ui`)   | Ad-hoc input in LoginForm            | Login (Remember me), Package filters, Address default     | Styled checkbox box, check icon, focus ring, label alignment                                                               | Checked state, business logic                                       | **Yes** (Domain-neutral form checkbox)                |
| **`Dialog`**          | Tier A (`@nexora/ui`)   | None                                 | DeleteAddressModal, DisconnectModal                       | Centered modal frame, backdrop blur, Escape dismissal, focus trap, restoration                                             | Dialog title, body message, confirm/cancel actions                  | **Yes** (Reusable modal infrastructure)               |
| **`Drawer`**          | Tier A (`@nexora/ui`)   | None                                 | 6 distinct drawers across Customers, Packages, Carriers   | Right slide-over frame, backdrop blur, Escape dismissal, body scroll lock                                                  | Drawer title, form content, submit actions                          | **Yes** (Heavily reused across 3 features)            |
| **`Pagination`**      | Tier A (`@nexora/ui`)   | None                                 | Customer List, Retail Packages Table                      | Previous/next buttons, page numbers, rows-per-page select, jump input                                                      | Page change handlers, total items                                   | **Yes** (Identical pagination controls)               |
| **`EmptyState`**      | Tier A (`@nexora/ui`)   | None                                 | Customers, Packages, Carriers, Notifications              | Centered container, icon slot, title, description, action button                                                           | Specific icon, text, and action handler                             | **Yes** (Uniform empty state presentation)            |
| **`Tooltip`**         | **Rejected for Tier A** | CSS in Sidebar                       | Sidebar collapsed items                                   | CSS hover/focus tooltip                                                                                                    | Tooltip text                                                        | **No** (Handled via pure CSS in `Sidebar.module.css`) |
| **`Universal Table`** | **Rejected for Tier A** | None                                 | Packages, Customers                                       | None                                                                                                                       | Column visibility, sorting, and filter builders are domain-specific | **No** (Avoids bloated configuration engine)          |

---

## 7. Design System, Typography and Route Decisions

### 7.1 Single Canonical Token Owner (`apps/web/styles/tokens.css`)

- Foundation Palette: Navy `#172B4D` (`--brand-navy`), Deep Navy `#0F1D36` (`--brand-navy-dark`), Slate Navy `#1E3A5F` (`--brand-navy-light`), Orange `#F58A24` (`--brand-orange`), Dark Orange `#E07716` (`--brand-orange-dark`), Light Orange `#FFF7ED` (`--brand-orange-light`), Text Orange `#C2410C` (`--brand-orange-text`).
- Semantic Tokens: `--color-primary`, `--color-accent`, `--color-background` (`#F5F7FA`), `--color-surface` (`#FFFFFF`), `--color-border` (`#E2E8F0`), `--color-border-subtle` (`#CBD5E1`), `--color-text` (`#1F2937`), `--color-text-muted` (`#64748B`).
- Component Geometry: `--header-height: 56px;`, `--sidebar-width: 240px;`, `--sidebar-collapsed-width: 72px;`, `--control-height: 36px;`, `--control-height-sm: 32px;`, `--control-height-lg: 44px;`, `--table-row-height: 48px;`.
- No competing CSS frameworks or utility engines (Tailwind is strictly excluded).

### 7.2 Inter Font Provenance and License Evidence

- **Upstream Project**: Inter by Rasmus Andersson ([https://rsms.me/inter/](https://rsms.me/inter/)).
- **License**: SIL Open Font License (OFL) version 1.1. Grants permission to use, study, modify, and redistribute the font freely, including commercial bundling with software.
- **Glyph Coverage**: Latin, Extended Latin, Cyrillic, Greek, and complete Vietnamese Unicode glyphs (U+1EA0 through U+1EF9: `ạ`, `ả`, `ấ`, `ầ`, `ẩ`, `ẫ`, `ậ`, `ắ`, `ằ`, `ẳ`, `ẵ`, `ặ`, `ẹ`, `ẻ`, `ẽ`, `ế`, `ề`, `ể`, `ễ`, `ệ`, `ỉ`, `ị`, `ọ`, `ỏ`, `ố`, `ồ`, `ổ`, `ỗ`, `ộ`, `ớ`, `ờ`, `ở`, `ỡ`, `ợ`, `ụ`, `ủ`, `ứ`, `ừ`, `ử`, `ữ`, `ự`, `ỳ`, `ỵ`, `ỷ`, `ỹ`).
- **Variable Font Behavior**: Single variable axis `wght` covering weights 100 through 900.
- **Production Asset Procurement**: In Milestone M1, the official `InterVariable.woff2` binary asset and its `OFL.txt` license will be copied directly into `apps/web/app/fonts/`. No binary font files are committed in this documentation-only planning PR.
- **Next.js Integration**: Configured locally in `apps/web/app/layout.tsx` via `next/font/local` with `display: "swap"`. 100% self-hosted; zero runtime requests to Google Fonts.

### 7.3 Navigation and Route Canonicalization

- `/shipments/retail` is confirmed as the canonical route for Retail Packages in Nexora's Shipment domain.
- Route `/logistics/parcels`: PR #14 prototyped this route, but PR #14 was never merged into `main`. However, to prevent broken links during feature branch testing and ensure backwards compatibility, `apps/web/app/(workspace)/logistics/parcels/page.tsx` implements a Next.js server redirect:

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
      if (typeof value === "string") query.set(key, value);
    }
    const qs = query.toString();
    redirect(`/shipments/retail${qs ? `?${qs}` : ""}`);
  }
  ```

- This preserves all incoming search parameters and avoids open redirect vulnerabilities by constraining the redirect target strictly to `/shipments/retail`.

---

## 8. PLAN ISSUE 1: China Sourcing Product Scope Decision

### Context and Conflict Analysis

- The reference ZIP includes China sourcing components (`SearchSection.tsx`, `CategoryGrid.tsx`, `SearchResultsFeedback.tsx`, `ImageSearchModal.tsx`) as its default screen (`activeMenuId === 'search-products'`).
- In Nexora's governing product scope ([ADR-002](../../decisions/product-scope.md)), Nexora is an enterprise shipment and logistics management hub. ADR-002 explicitly excludes:
  1. Web scraping of third-party e-commerce platforms (Taobao, 1688, Tmall).
  2. Direct client-side integration of generative AI SDKs (`@google/genai`).
  3. Consumer retail purchasing, shopping carts, or foreign exchange rate tickers.
- To reconcile the owner's objective of complete ZIP visual coverage with ADR-002 product boundaries, two distinct options are presented for owner decision:

### Option A — Isolated UI-Only Sourcing Showcase (Recommended)

- **Scope**: Migrate visual presentation components into an isolated feature module `apps/web/features/sourcing/` accessible via route `/sourcing` (accessible from navigation under "Nguồn hàng" or as a dedicated preview route).
- **Behavioral Boundaries**:
  - Zero web scraping of Taobao/1688/Tmall.
  - Zero `@google/genai` package dependency; image search modal displays local image analysis preview with pre-computed demo tags.
  - Search submission renders an informative alert: "Bản thử nghiệm giao diện — Tìm kiếm nguồn hàng Trung Quốc chưa kết nối API."
- **Advantages**: Delivers 100% visual and interaction coverage from the reference ZIP without violating backend security boundaries or introducing unauthorized external scraping.
- **Architectural Requirement**: Requires an owner-approved amendment to ADR-002 authorizing an isolated presentation showcase.

### Option B — Exclude Sourcing Views from Production Scope

- **Scope**: Formally exclude `SearchSection`, `CategoryGrid`, `SearchResultsFeedback`, and `ImageSearchModal` from `@nexora/web` production routes per ADR-002 (`INTENTIONALLY_EXCLUDED_APPROVED`).
- **Behavioral Boundaries**:
  - Route `/` remains the Operational Overview & Dashboard.
  - Nexora navigation focuses strictly on Logistics (Vận đơn / Kiện lẻ TMĐT), Khách hàng, Cài đặt, and Hệ thống.
  - Reference ZIP sourcing assets are retained solely as offline prototype reference.
- **Advantages**: Strictly adheres to the current approved product scope without expanding application boundaries.
- **Trade-off**: Frontend does not achieve 100% component migration of the ZIP, but accurately represents authorized business capabilities.

### Owner Product Decision Requirement

The repository owner (`dinhphuquy2k1`) must select **Option A** or **Option B** before the final design snapshot can be approved. The agent will then finalize the design snapshot to reflect the selected approach, recompute the design digest, and request formal ADR-009 approval.

---

## 9. Review Findings Resolution Summary

| Finding   | Severity | Description                                                                        | Resolution in Revision v2                                                                                                                                                                                              |
| :-------- | :------- | :--------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P2-01** | P2       | Incorrect Customer API query parameters documented (`limit`, `search`)             | Corrected to canonical `pageSize` ($1..100$) and `q` (max 200 chars). Verified against OpenAPI and SDK.                                                                                                                |
| **P2-02** | P2       | Unsupported Customer statistics (`addressCount`, `statusCounts`) & Excel export    | Field-by-field capability matrix created. Address count column omitted from summary table to avoid N+1 queries. Status tabs display filtered count from `pagination.total`. Excel export disabled with planned notice. |
| **P2-03** | P2       | China sourcing product scope unresolved before ADR-009 approval                    | Formulated PLAN ISSUE 1 with detailed comparison of Option A vs Option B. Explicitly established approval sequencing requiring owner decision before final digest binding.                                             |
| **P2-04** | P2       | Unauthorized freight fee calculation formulas in production design                 | Removed all hardcoded fee constants (`28,000 VND/kg`, etc.). Fee displays explicitly show `"Chưa có báo giá"`. Synthetic fees restricted to isolated test fixtures.                                                    |
| **P2-05** | P2       | Incomplete ZIP inventory (claimed 23 files, actual 30) & unsupported parity claims | Complete 30-file Source File Inventory created. 29-interaction UI Interaction Coverage Matrix established with truthful delivery classifications. Unconditional parity claims removed.                                 |
| **P3-01** | P3       | Route compatibility between `/shipments/retail` and `/logistics/parcels`           | Confirmed `/shipments/retail` as canonical. `/logistics/parcels` provides a server-side redirect preserving query parameters for draft link compatibility.                                                             |
| **P3-02** | P3       | Customer status labels spelling inconsistency                                      | Canonical spelling enforced from `@nexora/shared`: `ACTIVE` $\to$ `"Đang hoạt động"`, `INACTIVE` $\to$ `"Ngừng hoạt động"`.                                                                                            |
| **P3-03** | P3       | Font license, provenance, and glyph coverage documentation                         | Documented SIL Open Font License 1.1 provenance, full Vietnamese diacritical coverage, and variable weight behavior. Binary font procurement deferred to M1.                                                           |

---

## 10. Approval and Planning Constraints (ADR-009 Mandatory Stop)

This snapshot represents proposed architecture, not approved code. Task status remains `PLANNED`, implementation status remains `PLANNED`, and verification status remains `NOT VERIFIED`.

Per ADR-009, all implementation, test modifications, and dependency changes are strictly blocked until:

1. The repository owner selects **Option A** or **Option B** for China Sourcing (PLAN ISSUE 1).
2. The agent finalizes the single selected design and recomputes the SHA-256 digest.
3. The repository owner posts the standalone five-line approval block binding Task NEXORA-029, Plan revision rev-2026-10-22-frontend-migration-v2, and the final raw-byte SHA-256 digest with Decision APPROVED.
