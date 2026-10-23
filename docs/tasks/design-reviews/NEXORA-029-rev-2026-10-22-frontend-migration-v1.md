# NEXORA-029 immutable design snapshot — full frontend migration v1

Task ID: NEXORA-029
Plan revision: rev-2026-10-22-frontend-migration-v1
Reviewed baseline: c14dada3fcfa9466e74b3353ae4b77f8846338e5

## 1. Objectives, ownership and boundaries

Execute a complete frontend migration of Nexora from the reference ZIP archive (`nexora-logistics-management (1).zip`), replacing existing UI presentation, component styling, and client interaction behavior while strictly preserving Nexora's Next.js 16 App Router architecture, CSS Modules, real local authentication/session/MFA, and backend API contracts. This task is classified as SIGNIFICANT.

Ownership boundaries:

- Technical ownership: `@nexora/web` application, `@nexora/ui` shared primitives package, and `@nexora/shared` contracts.
- No aggregate or entity ownership is modified: Customer domain (`apps/api/src/customer/`), Carrier domain (`apps/api/src/carrier/`), and Identity domain (`apps/api/src/identity/`) remain untouched.
- No database schema migrations, production grants, or direct database access from `@nexora/web` are introduced. Web code interacts exclusively via the generated SDK (`@nexora/sdk`) over relative same-origin `/api/*` proxies.
- Zero Vite, Tailwind CSS v4, `@google/genai`, or client-memory state persistence (`INITIAL_CUSTOMERS`, `INITIAL_PACKAGES`) are migrated into production runtime.
- Pre-code design review governance is strictly enforced per ADR-009: no application code or test modifications may occur before authentic repository owner approval is obtained.

## 2. Complete Source-to-Target Migration Coverage Matrix

Every source screen, component, and interaction from the reference ZIP is cataloged below with its delivery classification, visual/interaction parity requirements, backend contract availability, and proposed production behavior:

Classifications:

- `FULLY_MIGRATED`: Fully supported by approved architecture and backend.
- `UI_MIGRATED_API_CONNECTED`: UI migrated and integrated with existing, verified backend APIs.
- `UI_MIGRATED_BACKEND_PENDING`: UI presentation and local interactions migrated with complete fidelity; backend domain is planned/not yet implemented; renders honest empty/planned state with zero fake persistence.
- `OUT_OF_SCOPE_REQUIRES_DECISION`: Functionality from ZIP outside Nexora's core product scope (ADR-002) requiring an explicit product-scope decision from the repository owner.
- `INTENTIONALLY_EXCLUDED_APPROVED`: Out-of-scope feature that the owner has explicitly decided to exclude.

| Source File / Component                                                                                     | Source Responsibility & Interactions                                                                                                                                                           | Target Route & Destination Component                                                                                | Delivery Classification          | Visual & Interaction Parity Requirements                                                                                                                                              | Backend API Availability                                                                                                            | Proposed Production Behavior & Non-Goals                                                                                                                                                                                                                                  |
| :---------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------ | :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/App.tsx`                                                                                               | Root bootstrap, conditional `activeMenuId` view switch, simulated login state, in-memory customer array                                                                                        | Next.js App Router root layout `apps/web/app/layout.tsx` and protected layout `apps/web/app/(workspace)/layout.tsx` | `FULLY_MIGRATED`                 | Replace client-side memory view switch with Next.js 16 App Router file-system routing. Stable URLs across all views.                                                                  | Server session verification via `verifyServerSession()`                                                                             | Discard `activeMenuId` application state. Retain authenticated layout frame and HttpOnly cookie session protection.                                                                                                                                                       |
| `src/components/Sidebar.tsx`                                                                                | 240px/72px collapsible navigation, geometric monogram logo, 3 grouped menu sections, active indicator, submenus, collapsed tooltips                                                            | `apps/web/components/app-shell/Sidebar.tsx` & `Sidebar.module.css`                                                  | `FULLY_MIGRATED`                 | 1:1 visual match with Navy `#172B4D` background, 56px brand header, monogram logo, active orange accent bar `#F58A24`, expandable submenus, accessible hover tooltips when collapsed. | Driven by canonical `apps/web/lib/navigation/nav-config.ts`                                                                         | Route-driven active states using Next.js pathname. Mobile off-canvas overlay behavior below 768px.                                                                                                                                                                        |
| `src/components/Header.tsx`                                                                                 | 56px top bar, breadcrumb trail, sidebar toggle button, notification popover with unread counter, scope selector, user avatar dropdown                                                          | `apps/web/components/app-shell/Header.tsx`, `AccountMenu.tsx`, `NotificationMenu.tsx`                               | `FULLY_MIGRATED`                 | 56px height, path-driven breadcrumbs, notification popover, carrier/account scope selector slot, user avatar menu.                                                                    | Authenticated user session (`GET /api/auth/session`), Logout (`POST /api/auth/logout`)                                              | Integrate real authenticated username and verified server logout POST. Notifications render honest empty state (see Section 7.6).                                                                                                                                         |
| `src/components/LoginPage.tsx`                                                                              | Centered 420px card login, monogram logo, account/email input, password toggle, remember me, quick fill, simulated timeout, forgot password modal                                              | `apps/web/app/login/LoginForm.tsx` & `login.module.css`                                                             | `FULLY_MIGRATED`                 | 1:1 visual match with 420px card, monogram logo, Vietnamese typography, accessible password visibility toggle, error alert box.                                                       | Real credentials login (`POST /api/auth/login`), TOTP MFA (`POST /api/auth/mfa/verify`)                                             | Discard simulated timeout and fake quick fill. Preserve Nexora real password + TOTP MFA authentication, return URL sanitization, and HttpOnly cookies.                                                                                                                    |
| `src/components/customers/CustomerListView.tsx`                                                             | Customer list table, search bar, status tabs (All/Active/Inactive), summary stats badges, pagination controls, drawer triggers                                                                 | `apps/web/features/customers/components/CustomerListPage.tsx`, `CustomerTable.tsx`, `CustomerFilters.tsx`           | `UI_MIGRATED_API_CONNECTED`      | 1:1 visual match: table layout, code chip `#172B4D`, phone formatting, status badge, action menu, stats summary cards.                                                                | Real `GET /api/customers?page=&limit=&search=&status=` via `@nexora/sdk`                                                            | Real server-backed pagination and search. Stats summary displays authoritative `total` from paginated response; zero invented status counts.                                                                                                                              |
| `src/components/customers/CustomerDetailView.tsx`                                                           | Customer profile card, customer code header, status badge, recipient addresses list, default address tag, add/edit/delete triggers                                                             | `apps/web/features/customers/components/CustomerDetailPage.tsx`, `CustomerAddressCard.tsx`                          | `UI_MIGRATED_API_CONNECTED`      | 1:1 visual match: profile overview card, addresses list, default address badge, copy customer code action.                                                                            | Real `GET /api/customers/:id` via `@nexora/sdk`                                                                                     | Stable route `/customers/[id]`. Displays real owner-scoped records, normalized E.164 phone numbers, and ordered addresses.                                                                                                                                                |
| `src/components/customers/CreateCustomerDrawer.tsx`                                                         | Slide-over drawer to create customer with mandatory initial recipient address fields                                                                                                           | `apps/web/features/customers/components/CreateCustomerDrawer.tsx`                                                   | `UI_MIGRATED_API_CONNECTED`      | Slide-over drawer from right, smooth animation, field labels, error highlights, preset address chips.                                                                                 | Real `POST /api/customers` via `@nexora/sdk`                                                                                        | Enforces atomic customer + address creation. Validates mandatory addressText, phone, and optional email/notes.                                                                                                                                                            |
| `src/components/customers/EditCustomerDrawer.tsx`                                                           | Slide-over drawer to edit customer profile (name, phone, email, note, status active/inactive)                                                                                                  | `apps/web/features/customers/components/EditCustomerDrawer.tsx`                                                     | `UI_MIGRATED_API_CONNECTED`      | Slide-over drawer from right, status switch, input fields, save button with loading state.                                                                                            | Real `PATCH /api/customers/:id` via `@nexora/sdk`                                                                                   | Sends strict command payload. Updates ACTIVE/INACTIVE status cleanly without touching recipient addresses.                                                                                                                                                                |
| `src/components/customers/AddressDrawer.tsx`                                                                | Slide-over drawer to add or edit recipient address details                                                                                                                                     | `apps/web/features/customers/components/AddressDrawer.tsx`                                                          | `UI_MIGRATED_API_CONNECTED`      | Slide-over drawer, preset label chips, recipient name, phone, address text, set-as-default checkbox.                                                                                  | Real `POST /api/customers/:id/addresses` and `PATCH /api/customers/:id/addresses/:id`                                               | Validates recipient fields. Updating address preserves parent default flag.                                                                                                                                                                                               |
| `src/components/customers/AddressForm.tsx` & `AddressLabelField.tsx`                                        | Reusable recipient address form fields with preset label chips                                                                                                                                 | `apps/web/features/customers/components/AddressForm.tsx`, `AddressLabelChips.tsx`                                   | `FULLY_MIGRATED`                 | Shared form inputs for label, recipient name, phone, country, address text. Preset chips ("Nhà riêng", "Văn phòng", "Kho hàng").                                                      | Neutral validation rules matching backend contracts                                                                                 | Reused across CreateCustomerDrawer and AddressDrawer to eliminate duplication. E.164 input compatibility with VN default country.                                                                                                                                         |
| `src/components/customers/DeleteAddressConfirmModal.tsx`                                                    | Confirmation modal for address deletion, checking last-address and default-address reassignment                                                                                                | `apps/web/features/customers/components/DeleteAddressModal.tsx`                                                     | `UI_MIGRATED_API_CONNECTED`      | Centered modal dialog, warning alert, alternative address selection dropdown when deleting default address.                                                                           | Real `PUT /api/customers/:id/default-address` and `DELETE /api/customers/:id/addresses/:id`                                         | Enforces Nexora invariants: blocks deleting last address (`409 LAST_CUSTOMER_ADDRESS`); requires reassigning default address before deletion (`409 DEFAULT_ADDRESS_REASSIGN_REQUIRED`). Safe orchestration of the two real API calls.                                     |
| `src/components/RetailPackagesView.tsx` (2,320 lines)                                                       | Complete retail packages view: header, 7 status tabs, search, condition filter builder, active chips, column customizer, table, mobile cards, detail drawer, create drawer, pagination, export | Refactored into 10 modular components in `apps/web/features/retail-packages/`                                       | `UI_MIGRATED_BACKEND_PENDING`    | 1:1 visual match with reference ZIP: 7 status tabs, advanced condition filter builder, column picker, sticky table header, mobile cards (<768px), detail drawer with event timeline.  | Shipment Backend V1 is **PLANNED** (not implemented in foundation v0.1.0)                                                           | Full interactive presentation (filtering, columns, drawer toggles, URL query sync). Displays honest empty state. Package creation and Excel export display truthful planned notices. Zero fake persistent packages or mock tracking.                                      |
| `src/components/CarrierConnectionsView.tsx`                                                                 | Carrier catalog, connected accounts list, connection credentials drawer, disconnect modal, test connection simulation                                                                          | `apps/web/features/carrier-connections/` components                                                                 | `UI_MIGRATED_API_CONNECTED`      | Summary stats cards, available carrier provider cards, connected accounts list with status badges, add/edit connection drawer.                                                        | Real `GET /api/carriers` and `GET /api/carrier-connections`, `POST /api/carrier-connections`, `DELETE /api/carrier-connections/:id` | Connects to real carrier catalog and owner-scoped connections. Server encrypts credentials; no secrets exposed client-side. Live provider sync actions remain disabled/planned until authorized.                                                                          |
| `src/components/ShippingScopeSelector.tsx`                                                                  | Multi-carrier and account selector dropdown in top header                                                                                                                                      | `apps/web/components/app-shell/ShippingScopeSelector.tsx`                                                           | `UI_MIGRATED_API_CONNECTED`      | Dropdown selector supporting "All carriers", specific carrier, or individual account; search filter; expand/collapse groups; keyboard navigation.                                     | Real carrier metadata from `/api/carriers` and `/api/carrier-connections`                                                           | Derives selectable scopes from real user connections. Scope selection synchronizes across navigation and retail package filters without granting unauthorized access.                                                                                                     |
| `src/context/ShippingScopeContext.tsx`                                                                      | React Context managing active scope and carrier connections                                                                                                                                    | `apps/web/lib/context/ShippingScopeContext.tsx`                                                                     | `FULLY_MIGRATED`                 | Context provider supplying active scope (`all`, `carrier`, `account`) and connected carrier metadata.                                                                                 | Real carrier SDK client                                                                                                             | Provides single source of truth for scope state across header and feature pages.                                                                                                                                                                                          |
| `src/components/SearchSection.tsx`, `CategoryGrid.tsx`, `SearchResultsFeedback.tsx`, `ImageSearchModal.tsx` | China sourcing search bar (Taobao/1688/Tmall), 18 category cards, search results mockup, image recognition search modal                                                                        | `apps/web/features/sourcing/` (provisional isolated module)                                                         | `OUT_OF_SCOPE_REQUIRES_DECISION` | Search input with quick keyword tags, 18 e-commerce category cards with Chinese keywords, search feedback mockup, image search modal with sample images.                              | None. China commerce scraping and external Gemini API are excluded per ADR-002.                                                     | Documented as **PLAN ISSUE 1**. Recommended treatment: retain visual presentation in isolated route `/sourcing` with clear "Bản thử nghiệm giao diện / Chưa tích hợp API" notices; zero external scraping, zero `@google/genai` dependency. Pending owner scope decision. |

## 3. Component Architecture and Reuse Design

### 3.1 Three-Tier Component Architecture

Nexora enforces strict separation across three component ownership tiers to avoid premature global abstractions while preventing duplication:

#### Tier A — Shared UI Primitives (`packages/ui/`)

Shared primitives must remain strictly **domain-neutral** and **transport-agnostic**. They never import domain models, API endpoints, or SDK client factories:

- `Panel` (`packages/ui/src/Panel.tsx`, `Panel.module.css`): (Existing) Content container card with subtle border and shadow.
- `StatusBadge` (`packages/ui/src/StatusBadge.tsx`, `StatusBadge.module.css`): (Existing) Semantic status badge powered by `status-tone.ts`.
- `Button` (`packages/ui/src/Button.tsx`, `Button.module.css`): Domain-neutral button with variants (`primary`, `secondary`, `outline`, `ghost`, `danger`), sizes (`sm`, `md`, `lg`), loading spinner, and icon support. Reused across Login, Customer drawers, Retail packages toolbar, and Carrier connections.
- `TextInput` (`packages/ui/src/TextInput.tsx`, `TextInput.module.css`): Accessible form input with prefix/suffix icon slots, helper text, and error states. Reused across Login, Customer address forms, Package search, and Carrier API keys.
- `Select` (`packages/ui/src/Select.tsx`, `Select.module.css`): Accessible native styled dropdown select for standard form inputs.
- `Checkbox` (`packages/ui/src/Checkbox.tsx`, `Checkbox.module.css`): Accessible styled checkbox with label and focus ring.
- `Dialog` (`packages/ui/src/Dialog.tsx`, `Dialog.module.css`): Centered modal dialog with backdrop blur, Escape key dismissal, body scroll lock, and focus restoration. Reused by DeleteAddressModal and DisconnectModal.
- `Drawer` (`packages/ui/src/Drawer.tsx`, `Drawer.module.css`): Slide-over drawer from right with backdrop blur, smooth CSS animation, Escape key dismissal, and focus trapping. Reused by 6 distinct drawers across Customers, Retail Packages, and Carrier Connections.
- `Pagination` (`packages/ui/src/Pagination.tsx`, `Pagination.module.css`): Accessible pagination bar with rows-per-page selector, previous/next buttons, page numbers, and jump-to-page input. Reused by Customer List and Retail Packages Table.
- `EmptyState` (`packages/ui/src/EmptyState.tsx`, `EmptyState.module.css`): Presentation card with icon, title, description, and action button. Reused across Customers, Retail Packages, and Carrier Connections.

Components **NOT** extracted to `packages/ui` (avoiding premature abstraction):

- Tooltip: Handled cleanly via pure CSS in `Sidebar.module.css` and local CSS Modules; no heavy React wrapper needed.
- Universal Table / Form Builder: Complex table controls (column visibility, advanced filter builders) remain feature-local to avoid bloated configuration engines.

#### Tier B — Application Shell Components (`apps/web/components/app-shell/`)

Application layout frame and cross-route navigation chrome:

- `AppShell.tsx`: Server Component layout frame consumed exclusively in `(workspace)/layout.tsx`.
- `ShellClient.tsx`: Client boundary managing sidebar collapse state (`isSidebarCollapsed`) and mobile drawer state.
- `Sidebar.tsx` & `Sidebar.module.css`: 240px/72px collapsible navigation with geometric monogram logo, grouped navigation items, active indicator bar (`#F58A24`), and submenus.
- `Header.tsx` & `Header.module.css`: 56px top bar with sidebar toggle, pathname-driven breadcrumbs, notification popover with unread counter, and scope selector slot.
- `AccountMenu.tsx` & `AccountMenu.module.css`: Authenticated user profile disclosure displaying username and verified server logout POST.
- `Breadcrumb.tsx`: Pathname-driven breadcrumbs derived from canonical navigation configuration.
- `NavigationItem.tsx`: Distinguishes navigable routes (`Link`) from planned features (disabled action button with "Chưa triển khai" label).
- `NotificationMenu.tsx` & `NotificationMenu.module.css`: System notifications popover with unread counter and honest empty state.
- `ShippingScopeSelector.tsx` & `ShippingScopeSelector.module.css`: Carrier and account scope dropdown selector.

#### Tier C — Feature Modules (`apps/web/features/`)

Domain-specific presentation, state management, and SDK orchestration:

- `apps/web/features/customers/`: Customer list, detail, address management, and SDK hooks.
- `apps/web/features/retail-packages/`: Retail packages table, filter builder, column customizer, mobile cards, timeline drawer.
- `apps/web/features/carrier-connections/`: Carrier catalog, connected accounts, credentials drawer, disconnect modal.
- `apps/web/features/sourcing/`: Provisional isolated module for China sourcing search and category grid (pending owner decision).

### 3.2 Modularization Plan for Giant Reference Components

The reference ZIP's 2,320-line `RetailPackagesView.tsx` and 1,095-line `CarrierConnectionsView.tsx` are refactored into cohesive, responsibility-focused modules:

#### Retail Packages Refactoring (`apps/web/features/retail-packages/`)

- `components/RetailPackagesPage.tsx` (~120 lines): Root page coordinator managing layout and drawer visibility.
- `components/PackageToolbar.tsx` (~150 lines): Search bar, filter toggle button, column picker trigger, refresh button, export button, create button.
- `components/PackageStatusTabs.tsx` (~90 lines): 7 status tabs with active indicators and count badges.
- `components/PackageFilters.tsx` (~180 lines): Popover filter builder allowing conditional rules (`field`, `operator`, `value`).
- `components/ActiveFilterChips.tsx` (~80 lines): Active filter tags with dismiss buttons and "Clear all" action.
- `components/PackageTable.tsx` (~250 lines): Desktop data table with sticky header, configurable visible columns, and row actions.
- `components/PackageMobileCard.tsx` (~120 lines): Responsive card list for viewport widths < 768px.
- `components/PackageDetailDrawer.tsx` (~220 lines): Slide-over drawer with package specifications, declared values, domestic shipping, and status timeline.
- `components/CreatePackageDrawer.tsx` (~180 lines): Slide-over drawer for package creation with truthful planned notice.
- `hooks/usePackageFilters.ts` (~120 lines): Filter state management and URL query serialization.
- `hooks/usePackageColumns.ts` (~80 lines): Column visibility state with `localStorage` persistence.
- `model/columns.ts` (~60 lines): 20 column definitions, default visibility, alignment, and widths.
- `model/filter-config.ts` (~80 lines): Filter field definitions, operators, and options.

#### Customer Management Refactoring (`apps/web/features/customers/`)

- `components/CustomerListPage.tsx` (~140 lines): List view coordinator, search, pagination, drawer triggers.
- `components/CustomerTable.tsx` (~160 lines): Table with code, name, phone, email, address count, status badge, action menu.
- `components/CustomerStatsBar.tsx` (~70 lines): Summary badges (total customers) derived truthfully from API response.
- `components/CustomerDetailPage.tsx` (~180 lines): Profile card, edit profile trigger, recipient addresses card, add address trigger.
- `components/CustomerAddressCard.tsx` (~110 lines): Recipient address card with default badge, set-default action, edit, and delete triggers.
- `components/CreateCustomerDrawer.tsx` (~160 lines): Customer creation drawer with required initial recipient address.
- `components/EditCustomerDrawer.tsx` (~120 lines): Profile edit drawer (name, phone, email, note, status).
- `components/AddressDrawer.tsx` (~120 lines): Add / edit address drawer.
- `components/AddressForm.tsx` (~100 lines): Shared address fields (label, recipient name, phone, address text).
- `components/DeleteAddressModal.tsx` (~110 lines): Confirmation dialog enforcing last-address and default-reassignment rules.
- `hooks/useCustomerList.ts` (~100 lines): Data fetching, pagination, and search orchestration via `@nexora/sdk`.
- `hooks/useCustomerDetail.ts` (~120 lines): Detail fetch, address mutation orchestration, and atomic default selection.

#### Carrier Connections Refactoring (`apps/web/features/carrier-connections/`)

- `components/CarrierConnectionsPage.tsx` (~120 lines): Page coordinator.
- `components/CarrierCatalogGrid.tsx` (~100 lines): Available carrier providers catalog from `GET /api/carriers`.
- `components/ConnectedAccountList.tsx` (~140 lines): Cards for connected accounts from `GET /api/carrier-connections`.
- `components/AddConnectionDrawer.tsx` (~160 lines): Drawer to input carrier credentials.
- `components/DisconnectModal.tsx` (~80 lines): Confirmation dialog to revoke an account connection.
- `hooks/useCarrierConnections.ts` (~110 lines): Real SDK queries and mutations.

### 3.3 Reusable Component Matrix (ADR-009)

| Field                        | 1. Button & IconButton Primitives                                 | 2. TextInput & Select Primitives                                    | 3. Drawer & Dialog Primitives                                          | 4. StatusBadge & Tone Mapping                                          | 5. Panel Container                                          | 6. Customer SDK Integration                             | 7. Customer Address Form                                                  | 8. Shipping Scope Selector                                                                |
| :--------------------------- | :---------------------------------------------------------------- | :------------------------------------------------------------------ | :--------------------------------------------------------------------- | :--------------------------------------------------------------------- | :---------------------------------------------------------- | :------------------------------------------------------ | :------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------- |
| **Component**                | `Button` & `IconButton` primitives with variants                  | `TextInput`, `Select`, `Checkbox` accessible form inputs            | Slide-over `Drawer` and centered `Dialog` modal overlays               | `StatusBadge` and tone resolver                                        | `Panel` content card container                              | Generated `@nexora/sdk` client and custom hooks         | `AddressForm` shared recipient address component                          | `ShippingScopeSelector` header dropdown                                                   |
| **Existing implementations** | Ad-hoc HTML buttons in shell components                           | Ad-hoc HTML inputs in `apps/web/app/login/LoginForm.tsx`            | Ad-hoc overlays in PR #22; none in `@nexora/ui`                        | `packages/ui/src/StatusBadge.tsx` and `status-tone.ts`                 | `packages/ui/src/Panel.tsx` and `Panel.module.css`          | `@nexora/sdk` (`createNexoraClient()`)                  | None on `main` (ZIP has `AddressForm.tsx`)                                | Prototype in PR #22 branch                                                                |
| **Domain owner**             | Neutral UI (`packages/ui`)                                        | Neutral UI (`packages/ui`)                                          | Neutral UI (`packages/ui`)                                             | Neutral UI (`packages/ui`)                                             | Neutral UI (`packages/ui`)                                  | Customer Domain (`apps/api/src/customer/`) / SDK        | Customer Domain presentation (`apps/web/features/customers/`)             | Carrier Domain presentation (`apps/web/components/app-shell/`)                            |
| **Reuse alternatives**       | Extract to `@nexora/ui` or keep local in each feature             | Extract to `@nexora/ui` or keep local in each feature               | Extract to `@nexora/ui` or duplicate across features                   | Reuse existing `StatusBadge` or rewrite                                | Reuse existing `Panel` or write new card divs               | Reuse `@nexora/sdk` or write manual fetch wrappers      | Reuse single form across create/edit or duplicate                         | Adapt PR #22 carrier scope or rewrite from ZIP                                            |
| **Selected approach**        | **Extract domain-neutral `Button` to `@nexora/ui`**               | **Extract domain-neutral `TextInput` and `Select` to `@nexora/ui`** | **Extract domain-neutral `Drawer` and `Dialog` to `@nexora/ui`**       | **Reuse and extend existing `StatusBadge` in `@nexora/ui`**            | **Reuse existing `Panel` from `@nexora/ui`**                | **Reuse `@nexora/sdk` with dedicated React hooks**      | **Extract single cohesive `AddressForm` in `features/customers/`**        | **Adapt PR #22 carrier scope architecture into Shell**                                    |
| **Rationale**                | Reused across all screens; eliminates repetitive Tailwind classes | Standardizes focus outlines, error borders, and control heights     | Standardizes backdrop overlay, Escape key handling, and focus trapping | Avoids duplicate badge styling; leverages existing `resolveStatusTone` | Provides uniform card surface, border `#E2E8F0`, and shadow | Enforces single source of truth from OpenAPI contracts  | Eliminates drift between customer creation address and address management | Leverages verified multi-carrier contracts from ADR-007; connects to real `/api/carriers` |
| **Risks**                    | Over-parameterization of button props                             | Breaking login form styling during extraction                       | Focus trapping bugs or body scroll locking issues on mobile            | Missing tone mappings for package/carrier specific statuses            | Inflexible padding if hardcoded                             | Out-of-sync SDK if backend changes                      | Incomplete phone normalization on client                                  | Stale scope when carriers are added or disconnected                                       |
| **Verification**             | Unit tests in `packages/ui/test/`; visual check at all viewports  | Accessibility tests for aria-invalid, focus outline; unit tests     | Keyboard tests (Escape, Tab focus trap, restoration); mobile swipe     | Unit tests in `status-tone.test.mjs`; visual checks                    | Visual verification across customer and package pages       | Contract tests in `apps/web/test/customer-api.test.mjs` | Form validation unit tests; E.164 formatting checks                       | Unit tests for scope resolution and context synchronization                               |

---

## 4. Retail Packages UI vs. Missing Backend Contract

The reference ZIP's `RetailPackagesView.tsx` provides extensive presentation and interaction capabilities. Because Shipment Backend V1 is **PLANNED** and not yet implemented in Nexora, presentation interactions and backend-dependent business operations are explicitly decoupled:

### 4.1 Fully Functional Presentation Interactions (Client-Side & URL State)

The following interactions remain 100% operational in production without requiring a shipment database:

1. **Status Tabs Selection**: Clicking any of the 7 tabs (`all`, `to_origin`, `at_origin`, `in_transit`, `at_dest`, `delivered`, `disputed`) updates the URL query parameter `?status=...` and active tab indicator.
2. **Search Filtering**: Typing in the search input updates `?q=...` with debounced synchronization.
3. **Advanced Condition Filter Builder**: Users can construct conditional filter rows (`field`, `operator`, `value`), generating active filter chips.
4. **Active Filter Chips**: Individual filter chips can be dismissed, or cleared entirely via "Clear all".
5. **Column Visibility Customizer**: Dropdown picker toggles visibility for each of the 20 columns. Visibility preferences persist in `localStorage` (`nexora_retail_columns_v1`).
6. **Table Layout & Scrolling**: Responsive table with sticky header and horizontal scroll container.
7. **Mobile Card View**: Responsive card list rendering on viewports < 768px with expand/collapse details.
8. **Package Detail Drawer Presentation**: Slides open to display package specifications, dimensions, declared values, and timeline structure.
9. **Copy Actions**: Clicking tracking codes or row data copies text to clipboard with transient visual confirmation.
10. **Pagination UI**: Rows-per-page selector and page number buttons update URL parameters `?page=` and `?pageSize=`.

### 4.2 Backend-Dependent Business Operations (Truthful Temporary Behavior)

| Target Interaction                | Required Backend Capability                      | Current Backend Status                             | Truthful Temporary UI Behavior                                                                                                                                                                                                                   | Future Integration Boundary                                              | Action UI State                       | Expected Acceptance Test                                                                        |
| :-------------------------------- | :----------------------------------------------- | :------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------- | :------------------------------------ | :---------------------------------------------------------------------------------------------- |
| **Listing Shipments**             | `GET /api/shipments` with pagination and filters | **PLANNED** (Not implemented)                      | Displays clean `EmptyState` with Package icon: "Chưa có kiện hàng nào" / "Phân hệ Vận đơn (Shipment Backend V1) đang được phát triển." Zero fake persistent packages.                                                                            | `useRetailPackages` hook will swap empty mock query with real SDK query. | Active empty state                    | Verify EmptyState renders with correct text; verify zero mock packages in production DOM.       |
| **Create Package**                | `POST /api/shipments`                            | **PLANNED** (Not implemented)                      | Drawer form opens and validates inputs client-side (tracking code format, weight > 0). Submitting displays an informative alert: "Tính năng tạo kiện hàng sẽ khả dụng khi phân hệ Vận đơn được kích hoạt." Form does not fake a successful save. | Form submit handler delegates to SDK `createShipment`.                   | Form functional, submit informational | Verify drawer opens, validates fields, and shows planned notice without saving to memory or DB. |
| **Tracking Timeline**             | Tracking event history table / webhooks          | **PLANNED** (Not implemented)                      | Detail drawer renders timeline layout with an honest "Chưa có sự kiện hành trình" state.                                                                                                                                                         | Detail drawer maps real tracking events array from shipment aggregate.   | Informational presentation            | Verify timeline layout renders without fabricated delivery checkpoints.                         |
| **Authoritative Fee Calculation** | Pricing engine with verified freight tariffs     | **PLANNED** (Not implemented)                      | Values are explicitly labeled as "Ước tính tham khảo (chưa chốt cước)", avoiding claiming authoritative billing fees.                                                                                                                            | Replaced by backend pricing quote service.                               | Informational disclaimer              | Verify fee amounts carry clear disclaimer labels.                                               |
| **Excel Export**                  | Batch XLSX export worker / endpoint              | **PLANNED** (Not implemented)                      | Clicking Export displays notice: "Xuất dữ liệu Excel đang được phát triển theo kế hoạch phân hệ Vận đơn."                                                                                                                                        | Export button initiates authorized server stream download.               | Informational notification            | Verify Export click displays notice and does not download a corrupt/empty file.                 |
| **Carrier Tracking Sync**         | Authorized carrier API synchronization           | **PLANNED** (Deferred pending provider API review) | Sync button displays notice: "Đồng bộ hãng vận chuyển yêu cầu cấu hình phân hệ Vận đơn."                                                                                                                                                         | Background worker synchronizes carrier tracking via approved adapters.   | Informational notification            | Verify Sync click displays notice without making unauthorized outbound API calls.               |

---

## 5. Design System, CSS Tokens and Typography Architecture

### 5.1 Centralized Token System (`apps/web/styles/tokens.css`)

Nexora retains `apps/web/styles/tokens.css` as the single canonical token owner. The token scale is extended to match the reference ZIP's palette and layout dimensions without introducing Tailwind:

```css
:root {
  /* ==========================================================================
     1. Foundation Palette
     ========================================================================== */
  --brand-navy: #172b4d;
  --brand-navy-dark: #0f1d36;
  --brand-navy-light: #1e3a5f;
  --brand-orange: #f58a24;
  --brand-orange-dark: #e07716;
  --brand-orange-light: #fff7ed;
  --brand-orange-text: #c2410c;

  --gray-50: #f8fafc;
  --gray-100: #f1f5f9;
  --gray-200: #e2e8f0;
  --gray-300: #cbd5e1;
  --gray-400: #94a3b8;
  --gray-500: #64748b;
  --gray-600: #475569;
  --gray-700: #334155;
  --gray-800: #1f2937;
  --gray-900: #0f172a;

  /* ==========================================================================
     2. Semantic Application Tokens
     ========================================================================== */
  --color-primary: var(--brand-navy);
  --color-primary-strong: var(--brand-navy-dark);
  --color-primary-hover: var(--brand-navy-light);

  --color-accent: var(--brand-orange);
  --color-accent-hover: var(--brand-orange-dark);
  --color-accent-light: var(--brand-orange-light);
  --color-accent-text: var(--brand-orange-text);

  --color-background: #f5f7fa;
  --color-surface: #ffffff;
  --color-surface-subtle: var(--gray-50);
  --color-surface-muted: var(--gray-100);

  --color-text: var(--gray-800);
  --color-text-muted: var(--gray-500);
  --color-border: var(--gray-200);
  --color-border-subtle: var(--gray-300);

  /* Context-aware focus rings */
  --focus-ring-on-light: var(--brand-orange-text);
  --focus-ring-on-dark: var(--brand-orange);

  /* Status Tokens */
  --color-status-success-bg: #e2f2e6;
  --color-status-success-text: #24663b;
  --color-status-warning-bg: #fef3c7;
  --color-status-warning-text: #92400e;
  --color-status-error-bg: #fbe8e3;
  --color-status-error-text: #973d2b;
  --color-status-info-bg: #e0f2fe;
  --color-status-info-text: #0369a1;

  /* ==========================================================================
     3. Component & Layout Dimensions
     ========================================================================== */
  --header-height: 56px;
  --sidebar-width: 240px;
  --sidebar-collapsed-width: 72px;
  --control-height: 36px;
  --control-height-sm: 32px;
  --control-height-lg: 44px;
  --table-row-height: 48px;

  /* ==========================================================================
     4. Spacing, Radius & Shadows
     ========================================================================== */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;

  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.04);
  --shadow-md:
    0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
  --shadow-lg:
    0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
  --shadow-drawer: -4px 0 24px rgba(0, 0, 0, 0.12);
}
```

### 5.2 Font Inter & Local Loading Strategy

- **Font**: Inter variable font (`InterVariable.woff2`).
- **Provenance & Licensing**: Licensed under the SIL Open Font License (OFL) 1.1, permitting self-hosting and distribution.
- **Glyph Coverage**: Full Latin, Extended Latin, and complete Vietnamese Unicode diacritics.
- **Loading Mechanism**: Configured via Next.js `next/font/local` in `apps/web/app/layout.tsx`:

  ```typescript
  import localFont from "next/font/local";

  const inter = localFont({
    src: "./fonts/InterVariable.woff2",
    display: "swap",
    variable: "--font-inter",
  });
  ```

- **Performance & Security**: 100% locally hosted. Zero runtime network requests to Google Fonts or third-party CDNs; strict offline capability and Content Security Policy compliance.

### 5.3 CSS Modules Architecture

- Component styles reside in `*.module.css` sibling files.
- Zero Tailwind utility classes or global style leakage.
- Global styles in `apps/web/app/styles.css` are restricted to font declaration, token imports, CSS reset, base typography, and macro layout wrappers.

---

## 6. Route Architecture and Navigation

### 6.1 Canonical Routes

The reference ZIP's conditional `activeMenuId` switch inside a single `App.tsx` is completely replaced by Next.js 16 App Router file-system routes:

| Route Path                      | Type      | Component Target                                                 | Canonical Nav Item ID | Breadcrumb Trail                     | Description                                                             |
| :------------------------------ | :-------- | :--------------------------------------------------------------- | :-------------------- | :----------------------------------- | :---------------------------------------------------------------------- |
| `/login`                        | Public    | `apps/web/app/login/page.tsx`                                    | N/A                   | None                                 | Centered 420px card login; real password + TOTP MFA authentication      |
| `/`                             | Protected | `apps/web/app/(workspace)/page.tsx`                              | `overview`            | `Tổng quan`                          | Workspace overview and system health dashboard                          |
| `/customers`                    | Protected | `apps/web/app/(workspace)/customers/page.tsx`                    | `customers`           | `Logistics > Khách hàng`             | Customer list table with server pagination, search & status filters     |
| `/customers/[id]`               | Protected | `apps/web/app/(workspace)/customers/[id]/page.tsx`               | `customers`           | `Logistics > Khách hàng > [KH-CODE]` | Customer detail profile and recipient addresses management              |
| `/shipments/retail`             | Protected | `apps/web/app/(workspace)/shipments/retail/page.tsx`             | `shipment`            | `Logistics > Vận đơn > Kiện lẻ TMĐT` | Retail packages management with filter builder and configurable columns |
| `/logistics/parcels`            | Redirect  | `apps/web/app/(workspace)/logistics/parcels/page.tsx`            | N/A                   | N/A                                  | Next.js server redirect to `/shipments/retail` for link compatibility   |
| `/settings/carrier-connections` | Protected | `apps/web/app/(workspace)/settings/carrier-connections/page.tsx` | `settings`            | `Cài đặt > Kết nối hãng vận chuyển`  | Multi-carrier accounts management and connection status                 |
| `/settings`                     | Protected | `apps/web/app/(workspace)/settings/page.tsx`                     | `settings`            | `Cài đặt`                            | General workspace configuration                                         |
| `/system`                       | Protected | `apps/web/app/(workspace)/system/page.tsx`                       | `system`              | `Hệ thống`                           | Live health checks and system diagnostics                               |

### 6.2 Route Canonicalization Rationale

- `/shipments/retail` is selected as the canonical route because the core aggregate domain in Nexora's architecture is `shipments` (`docs/domains/shipments.md`).
- PR #14 prototyped `/logistics/parcels`, but PR #14 was never merged into `main`. To ensure absolute link safety and compatibility with any open drafts, `apps/web/app/(workspace)/logistics/parcels/page.tsx` performs a Next.js server redirect (`redirect('/shipments/retail')`).

---

## 7. Customer, Carrier, Notification & State Management Integration

### 7.1 Customer Management Integration

Customer Backend V1 is fully implemented on `main` via PR #23. `@nexora/web` integrates all 8 generated SDK operations:

1. `GET /api/customers?page=&limit=&search=&status=`: Server-backed pagination and search.
2. `POST /api/customers`: Atomic customer profile + mandatory initial recipient address creation.
3. `GET /api/customers/:id`: Detailed view loading profile and ordered recipient addresses.
4. `PATCH /api/customers/:id`: Strict profile command updating name, phone, email, note, and active/inactive status toggle.
5. `POST /api/customers/:id/addresses`: Adding recipient address with validation.
6. `PATCH /api/customers/:id/addresses/:addressId`: Updating recipient fields without touching default flag.
7. `DELETE /api/customers/:id/addresses/:addressId`: Deleting recipient address.
8. `PUT /api/customers/:id/default-address`: Atomically designating default address.

### 7.2 Customer Invariants & Address Deletion Flow

The UI strictly enforces Nexora business invariants:

- **Minimum Address Invariant**: A customer cannot delete their last address. If only 1 address exists, the delete button is disabled with an explanatory tooltip ("Không thể xóa địa chỉ duy nhất của khách hàng").
- **Default Address Deletion**: Deleting the default address when alternative addresses exist requires explicit reassignment first (`409 DEFAULT_ADDRESS_REASSIGN_REQUIRED`). `DeleteAddressModal` prompts the user to pick a new default address, orchestrating `PUT /api/customers/:id/default-address` first, then `DELETE /api/customers/:id/addresses/:addressId`. If the first call fails, deletion does not proceed.
- **Truthful Customer Counts**: The Customer List summary bar displays the authoritative `total` count returned by the paginated API response. The frontend never sums a single page to infer global active/inactive counts.

### 7.3 Carrier Connections & Scope Selector Integration

- Carrier catalog is loaded dynamically from `GET /api/carriers`.
- Connected accounts are loaded from `GET /api/carrier-connections`.
- Adding an account posts encrypted credentials via `POST /api/carrier-connections`; secrets are never exposed in client responses.
- `ShippingScopeSelector` in the header derives its options from real carrier connections, synchronizing with `ShippingScopeContext`. Scope selection does not broaden backend permissions.

### 7.4 System Notifications Handling

- Nexora currently has **no** notification backend module or database table.
- The reference ZIP includes static mock notifications in `Header.tsx`.
- Truthful implementation:
  - Header renders the notification bell button with accessible `aria-label="Thông báo hệ thống"`.
  - When opened, the popover displays an honest empty state: "Không có thông báo mới" with subtext "Tính năng thông báo tự động đang được phát triển theo kế hoạch Vận đơn và Hệ thống."
  - Local interaction feedback (copied tracking codes, customer updated) uses transient UI toasts scoped to the active page, never fake server notifications.

### 7.5 Frontend State & Data Boundaries

- **URL State**: Owns filters (`?status=`, `?q=`), sorting (`?sort=`, `?order=`), pagination (`?page=`, `?pageSize=`), and shipping scope (`?scope=`). Back/Forward navigation and page reload preserve context.
- **Server Data**: Fetched on demand via `@nexora/sdk` inside custom React hooks (`useCustomerList`, `useCustomerDetail`, `useCarrierConnections`). Managed with loading skeletons, error alerts, and abort controllers to prevent race conditions.
- **Local Form State**: Managed inside drawer/modal components (`CreateCustomerDrawer`, `AddressDrawer`, etc.). Reset on close or submission.
- **Overlay State**: Managed by local React state (`isOpen`, `activeDrawer`).
- **User Preferences**: Column visibility preferences stored in `localStorage` (`nexora_retail_columns_v1`).
- **Global State**: Zero heavy state management libraries (Redux, Zustand). Context is restricted to `ShippingScopeContext` for workspace-wide carrier/account scope.

---

## 8. Responsive & Accessibility Acceptance Criteria

### 8.1 Measurable Responsive Acceptance

Layout behavior is validated across all 6 required target viewports:

1. **1440 × 900 (Large Desktop)**:
   - Sidebar expanded at 240px width.
   - Header height 56px with breadcrumb trail and carrier scope selector.
   - Full data table with all default columns visible and sticky action column.
   - Slide-over drawers open at 480px width without obscuring main content.
2. **1280 × 800 (Standard Desktop)**:
   - Sidebar expanded (240px). Table container supports horizontal scrolling with pinned actions.
3. **1024 × 768 (Tablet Landscape)**:
   - Sidebar collapses automatically to 72px width; hovering menu items reveals floating tooltips.
   - Filter chips wrap cleanly without overlapping search inputs.
4. **768 × 1024 (Tablet Portrait)**:
   - Sidebar collapsed (72px). Drawers expand to 400px width.
5. **390 × 844 (Mobile Standard / iPhone 14)**:
   - Sidebar hidden behind hamburger menu toggle; opens as a full-height mobile overlay drawer.
   - Data table replaced by responsive `PackageMobileCard` list with expand/collapse summary.
   - Scope selector collapses to compact modal trigger.
6. **375 × 812 (Mobile Compact / iPhone SE)**:
   - Guaranteed `document.documentElement.scrollWidth <= window.innerWidth` across all pages (zero body horizontal overflow).
   - Minimum 44×44px touch target size on all interactive buttons and inputs.

### 8.2 Accessibility (WCAG 2.1 AA)

- All interactive controls have accessible names (`aria-label`, visible text, or form labels).
- Visible focus indicators conforming to `--focus-ring-on-light` and `--focus-ring-on-dark`.
- Dialogs and Drawers implement `role="dialog"`, `aria-modal="true"`, focus trapping within overlay, Escape key dismissal, and focus restoration to the trigger element upon closing.
- Form inputs communicate errors via `aria-invalid="true"` and `aria-describedby` linked to error messages.

---

## 9. Milestone and Reviewable PR Execution Sequence

To ensure reviewability and maintain quality gates, implementation is divided into 6 bounded milestones. Each milestone can be delivered as an independent reviewable PR or sequentially on the migration branch under this approved design:

### M0 — Design, Inventory & Governance (Current Gate)

- Deliverables: Comprehensive ZIP component inventory, coverage matrix, reuse audit, design review snapshot, and owner approval.
- Tests: `pnpm docs:check`, `pnpm preflight:check`, `pnpm format:check`, `pnpm lint`.
- Gate: **STOP**. Zero implementation code modified.

### M1 — Design Tokens, Font & Foundation UI

- Scope: Extend `apps/web/styles/tokens.css`, local Inter variable font configuration in `layout.tsx`, Tier A primitives in `packages/ui` (`Button`, `TextInput`, `Select`, `Checkbox`, `Drawer`, `Dialog`, `Pagination`, `EmptyState`), modernized Tier B shell (`Sidebar`, `Header`, `AppShell`, `AccountMenu`, `NotificationMenu`), and modernized `/login` card.
- Visual & Interaction Acceptance: 1:1 match of shell geometry, 56px header, Navy `#172B4D` sidebar, monogram logo, active orange accent bar. Real authentication and MFA challenge preserved.
- Tests: `pnpm --filter @nexora/ui test`, `pnpm --filter @nexora/web test`, responsive shell smoke checks.

### M2 — Customer Management Migration

- Scope: `CustomerListPage`, `CustomerDetailPage`, `CreateCustomerDrawer`, `EditCustomerDrawer`, `AddressDrawer`, `DeleteAddressModal`. Integration with 8 Customer Backend V1 SDK endpoints.
- Behavioral Acceptance: Real server pagination, keyword search, status filtering. Atomic customer + initial address creation. Safe default-address reassignment before deletion. Last-address deletion blocked.
- Tests: Automated SDK integration tests in `apps/web/test/customer-api.test.mjs`, form validation unit tests.

### M3 — Retail Packages Refactoring

- Scope: Refactor `RetailPackagesView.tsx` into 10 modular components in `apps/web/features/retail-packages/`. Implement status tabs, filter builder, active chips, column picker, table, mobile cards, and detail drawer.
- Behavioral Acceptance: Full interactive presentation with honest empty state for package data. Create drawer and Excel export display truthful planned notices. URL query synchronization and column preferences persistence verified.
- Tests: Retail filter serialization tests, column visibility tests, responsive mobile card render tests.

### M4 — Carrier Connections & Shipping Scope

- Scope: `CarrierConnectionsPage` on `/settings/carrier-connections`, `ShippingScopeSelector` in Header, and `ShippingScopeContext`.
- Behavioral Acceptance: Real carrier catalog and connected accounts loaded via SDK. Add/disconnect connection flows backed by authorized APIs. Scope selection synchronized across header and retail filters.
- Tests: Carrier connections SDK tests, scope resolution tests.

### M5 — Scope Decision Implementation, Visual Parity & Final Acceptance

- Scope: Implementation of owner scope decision for China Sourcing views (either isolated demo route `/sourcing` with planned notices, or formal removal), full accessibility audit, cross-viewport verification (1440px to 375px), documentation synchronization.
- Verification: Full canonical test suite (`pnpm format:check`, `pnpm lint`, `pnpm preflight:check`, `pnpm docs:check`, `pnpm test`, `pnpm quality`).

---

## 10. Unresolved PLAN ISSUES and Product Decisions

### PLAN ISSUE 1: Product Scope Decision for Sourcing Views

- **Context**: The reference ZIP includes China sourcing components (`SearchSection.tsx`, `CategoryGrid.tsx`, `SearchResultsFeedback.tsx`, `ImageSearchModal.tsx`) as the default home view (`activeMenuId === 'search-products'`). In Nexora's approved product scope ([ADR-002](../../decisions/product-scope.md)), Nexora is an enterprise logistics and shipment hub, not a China sourcing agent or Taobao/1688 proxy buyer. Furthermore, live scraping violates third-party ToS, and bundling `@google/genai` on the client violates Nexora's secure server-proxy architecture.
- **Option A (Recommended)**: Migrate the visual presentation and client interactions into an isolated feature module `apps/web/features/sourcing/` accessible via route `/sourcing` (or demo menu item), with explicit "Bản thử nghiệm giao diện / Chưa tích hợp API" notices on search execution and image upload. Do NOT install `@google/genai` or attempt live scraping of Taobao/1688. This achieves 100% visual and interaction coverage of the reference ZIP without violating backend or security contracts.
- **Option B**: Formally exclude sourcing views from Nexora production code per ADR-002 (`INTENTIONALLY_EXCLUDED_APPROVED`). Route `/` remains the Operational Overview & Dashboard.
- **Decision Request**: The repository owner is requested to confirm Option A (Recommended) or Option B in their approval directive.

---

## 11. Approval and Planning Constraints (ADR-009 Mandatory Stop)

This snapshot represents proposed architecture, not approved code. Task status remains `PLANNED`, implementation status remains `PLANNED`, and verification status remains `NOT VERIFIED`.

Per ADR-009, all implementation, test modifications, and dependency changes are strictly blocked until an authentic design approval decision block is posted by the repository owner (`dinhphuquy2k1`), binding Task NEXORA-029, Plan revision rev-2026-10-22-frontend-migration-v1, and the computed raw-byte SHA-256 digest with Decision APPROVED. No self-approval, simulated approval, or premature coding is permitted.
