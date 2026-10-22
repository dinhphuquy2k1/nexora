# NEXORA-029 — Full Frontend Migration from Supplied Reference Design

Task: PLANNED
Implementation: PLANNED
Verification: NOT VERIFIED
Classification: SIGNIFICANT
Documentation Impact: REQUIRED

## Baseline and interface preflight

2026-10-22: origin/main `c14dada3fcfa9466e74b3353ae4b77f8846338e5`, dedicated migration branch `feat/full-frontend-migration`. Clean working tree. PR #23 (NEXORA-027 Customer Backend V1) and PR #24 (NEXORA-028 Test Infrastructure Standardization) are merged into main. Inspected open PRs: PR #14 (logistics parcel list UI), PR #21 (auth/session review), PR #22 (carrier scope and retail UI). Extracted reference archive `nexora-logistics-management (1).zip` into scratch directory and thoroughly inspected all 30 source files under `src/` (21 `.tsx`, 8 `.ts`, 1 `.css`), components, data fixtures, CSS, and manifest.

Governing rules: AGENTS.md, apps/web/AGENTS.md, docs/ai/PROJECT_RULES.md, ADR-009 (Mandatory Pre-Code Design Review), ADR-008 (Tactical DDD), ADR-002 (Product Scope), docs/architecture/frontend.md, docs/architecture/reusable-components.md, and docs/domains/customers.md.

Mandatory pre-code stop condition: This task is SIGNIFICANT. Implementation, code modifications, and test changes are strictly blocked until the repository owner (`dinhphuquy2k1`) posts an authentic design approval decision block.

## Plan and contracts before implementation

1. **M0 — Inventory, Architecture & Approval Gate (Current Milestone)**:
   - Complete comprehensive ZIP component and interaction inventory covering all 30 source files and 77 discrete user interactions across 5 delivery classifications (64 `ZIP_SOURCE`, 7 `NEXORA_EXISTING`, 6 `NEXORA_ADAPTATION`).
   - Establish migration coverage matrix distinguishing supported features, real backend integrations, honest planned/empty states, and out-of-scope capabilities.
   - Establish ADR-009 component reuse matrix across Tier A (`packages/ui/`), Tier B (`apps/web/components/app-shell/`), and Tier C (`apps/web/features/`).
   - Draft and pin immutable design review snapshot `docs/tasks/design-reviews/NEXORA-029-rev-2026-10-22-frontend-migration-v5.md` with SHA-256 digest `6210584000a36bce279abc0f39e7b910a173ac6d1a39b501ff12eed7a93699b8`.
   - **STOP BEFORE IMPLEMENTATION** until authentic owner approval is verified.

2. **M1 — Foundation UI, Design System & Application Shell**:
   - Extend `apps/web/styles/tokens.css` with layout dimensions (56px header, control heights, status tokens) matching reference ZIP without duplicating raw Tailwind color values throughout CSS Modules.
   - Configure local variable Inter font loading (`InterVariable.woff2`) in Next.js layout via `next/font/local` with full Vietnamese diacritics coverage, zero external Google Fonts requests, and verified SIL Open Font License redistribution rights.
   - Implement reusable, domain-neutral Tier A primitives in `@nexora/ui` (`Button`, `TextInput`, `Select`, `Checkbox`, `Drawer`, `Dialog`, `Pagination`, `EmptyState`). Keep complex controls and tooltips out of `@nexora/ui` to avoid premature abstraction.
   - Modernize Tier B shell components: `Sidebar` (navy `#172B4D`, monogram logo, orange active indicator `#F58A24`, submenus), `Header` (56px, breadcrumb trail, notification popover with unread counter, scope selector slot), `AppShell`, `AccountMenu` (preserving real server session and logout POST), and `NotificationMenu` (rendering honest empty state).
   - Modernize `/login` with 420px card aesthetics, preserving real password + TOTP MFA authentication and sanitized return URL.

3. **M2 — Customer Management Migration (Real API Integration)**:
   - Implement `CustomerListPage` and `CustomerDetailPage` on routes `/customers` and `/customers/[id]`.
   - Implement `CustomerTable`, `CustomerFilters` (All/Active/Inactive tabs, search input), and `CustomerStatsBar`.
   - Implement `CreateCustomerDrawer` (atomic customer + required initial recipient address), `EditCustomerDrawer`, and `AddressDrawer`.
   - Implement `DeleteAddressModal` enforcing Nexora business invariants: reject deleting last address (`LAST_CUSTOMER_ADDRESS`), require explicit default reassignment before deleting default address (`DEFAULT_ADDRESS_REASSIGN_REQUIRED`).
   - Integrate 8 real endpoints from `@nexora/sdk` (`CustomerController_list`, `create`, `get`, `update`, `add`, `remove`, `updateAddress`, `setDefault`). Canonical query parameters: `page` (int >= 1), `pageSize` (int 1..100), `q` (string <= 200), `status` ("ACTIVE" | "INACTIVE"), `phone` (string <= 64). Reject `limit` or `search`.
   - Zero mock customer data (`INITIAL_CUSTOMERS`) in production; handle loading, error, empty, and retry states. Filter tabs display count only for selected filter (`pagination.total`). Address count column omitted from summary table to avoid N+1 queries. Customer Excel export rendered as disabled action with planned notice.

4. **M3 — Retail Packages Modular Refactoring (Honest Planned Presentation)**:
   - Refactor 2,320-line `RetailPackagesView.tsx` into 10 focused components in `apps/web/features/retail-packages/`. Canonical route `/shipments/retail` with server redirect from `/logistics/parcels` preserving query parameters.
   - Implement `PackageToolbar`, `PackageStatusTabs` (7 tabs), `PackageFilters` (advanced condition builder), `ActiveFilterChips`, `PackageTable` (sticky header, 20 configurable columns), `PackageMobileCard`, and `PackageDetailDrawer` (timeline and parcel specs).
   - Implement `usePackageFilters` with URL query sync and `usePackageColumns` with local storage persistence.
   - Truthful state modeling: Shipment Backend V1 is not yet implemented in Nexora; render honest empty state and mark package creation/export as planned features ("Tính năng đang được phát triển"). Zero fake persistent packages, mock tracking events, or fabricated pricing algorithms (unsupported rates displayed explicitly as "Chưa có báo giá").

5. **M4 — Carrier Connections & Shipping Scope (Real API Integration)**:
   - Implement `CarrierConnectionsPage` on route `/settings/carrier-connections`.
   - Connect to real `GET /api/carriers` (catalog) and `GET /api/carrier-connections` (connected accounts).
   - Implement `AddConnectionDrawer` and `DisconnectModal`.
   - Implement `ShippingScopeSelector` in Header backed by `ShippingScopeContext` derived from real carrier connections.

6. **M5 — Scope Decision Implementation, Visual Parity & Final Acceptance**:
   - Implement owner decision on China Sourcing views (Option A: isolated demo route `/sourcing` with clear planned notices, or Option B: formal exclusion).
   - Verify keyboard navigation, ARIA attributes, focus trapping, and Escape dismissal for all overlays.
   - Verify responsive layout across all 6 approved viewports: 1440×900, 1280×800, 1024×768, 768×1024, 390×844, and 375×812.
   - Synchronize canonical documentation (`docs/architecture/frontend.md`, `reusable-components.md`, `domains/customers.md`, `domains/shipments.md`, `operations/testing.md`).
   - Execute full verification suite (`pnpm format:check`, `pnpm lint`, `pnpm preflight:check`, `pnpm docs:check`, package tests, `pnpm quality`).

## Acceptance criteria

- [ ] Immutable design snapshot pinned with SHA-256 digest and authentic owner approval obtained.
- [ ] Centralized tokens extended in `apps/web/styles/tokens.css`; zero Tailwind or Vite dependencies introduced.
- [ ] Inter variable font loaded locally with full Vietnamese diacritics support.
- [ ] Tier A primitives extracted to `@nexora/ui` (`Button`, `TextInput`, `Select`, `Checkbox`, `Drawer`, `Dialog`, `Pagination`, `EmptyState`).
- [ ] Shell modernized matching ZIP navy/orange palette and 56px header; real session/auth/MFA preserved.
- [ ] Customer Management fully integrated with 8 Customer Backend V1 SDK endpoints on `/customers` and `/customers/[id]`.
- [ ] Customer invariants strictly enforced (mandatory initial address, last-address delete protection, default reassign flow).
- [ ] 2,320-line `RetailPackagesView.tsx` refactored into modular components with honest empty/planned state.
- [ ] Carrier connections integrated with real `/api/carriers` and `/api/carrier-connections` APIs.
- [ ] Responsive parity verified across all 6 target viewports with zero horizontal body overflow (`document.documentElement.scrollWidth <= window.innerWidth`).
- [ ] Full canonical verification passes (`pnpm quality`, `pnpm docs:check`, `pnpm preflight:check`).

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- Frontend architecture updated: Next.js 16 App Router pages for Customer Management (`/customers`, `/customers/[id]`), Retail Packages (`/shipments/retail`), and Carrier Connections (`/settings/carrier-connections`).
- Reusable components registry extended in `docs/architecture/reusable-components.md` with new `@nexora/ui` primitives.
- Status of Customer Frontend updated from PLANNED to IMPLEMENTED in `docs/domains/customers.md`.
- Status of Retail Packages presentation clarified as honest planned UI in `docs/domains/shipments.md`.
- Testing documentation updated in `docs/operations/testing.md` for web component test suites and responsive checks.

### Canonical owners

- `docs/architecture/frontend.md`
- `docs/architecture/reusable-components.md`
- `docs/domains/customers.md`
- `docs/domains/shipments.md`
- `docs/operations/testing.md`

### Documentation verification

pnpm docs:check, pnpm format:check, pnpm contracts:check, and preflight policy verification. Full canonical runtime and quality checks are independent milestone gates.

## Evidence

| Claim                               | Evidence                                                                                                                                                          | Date       | Result |
| :---------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Clean worktree on latest main       | `git log -n 1 --oneline`: `c14dada Merge pull request #24...`; clean working tree                                                                                 | 2026-10-22 | PASS   |
| Next unused task ID                 | Inspection of `docs/tasks/active/` and `completed/`; 027 and 028 exist, 029 is next available                                                                     | 2026-10-22 | PASS   |
| Reference ZIP presence & extraction | Extracted `nexora-logistics-management (1).zip` to scratch directory; inspected all 30 source files under `src/`                                                  | 2026-10-22 | PASS   |
| Immutable design review snapshot    | Created `docs/tasks/design-reviews/NEXORA-029-rev-2026-10-22-frontend-migration-v5.md`, digest `6210584000a36bce279abc0f39e7b910a173ac6d1a39b501ff12eed7a93699b8` | 2026-10-22 | PASS   |

## Design Review & Reuse Decision

- **Task ID**: NEXORA-029
- **Classification**: SIGNIFICANT
- **Plan revision**: rev-2026-10-22-frontend-migration-v5
- **Design Snapshot**: docs/tasks/design-reviews/NEXORA-029-rev-2026-10-22-frontend-migration-v5.md
- **Design SHA-256**: 6210584000a36bce279abc0f39e7b910a173ac6d1a39b501ff12eed7a93699b8
- **Reviewed baseline**: c14dada3fcfa9466e74b3353ae4b77f8846338e5
- **Approval authority**: dinhphuquy2k1
- **Approval status**: PENDING_REVIEW
- **Approval evidence**: PENDING_REVIEW

### Mandatory Reuse & Design Audit Matrix

| Field                        | Component 1: Button & IconButton Primitives                       | Component 2: TextInput & Select Primitives                      | Component 3: Drawer & Dialog Primitives                                | Component 4: StatusBadge & Tone Mapping                                | Component 5: Panel Container                                | Component 6: Customer SDK Integration                   | Component 7: Customer Address Form                                        | Component 8: Shipping Scope Selector                                                      |
| :--------------------------- | :---------------------------------------------------------------- | :-------------------------------------------------------------- | :--------------------------------------------------------------------- | :--------------------------------------------------------------------- | :---------------------------------------------------------- | :------------------------------------------------------ | :------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------- |
| **Component**                | `Button` and `IconButton` primitives with variants                | `TextInput`, `Select`, `Checkbox` accessible form inputs        | Slide-over `Drawer` and centered `Dialog` modal overlays               | `StatusBadge` and tone resolver                                        | `Panel` content card container                              | Generated `@nexora/sdk` client and custom hooks         | `AddressForm` shared recipient address component                          | `ShippingScopeSelector` header dropdown                                                   |
| **Existing implementations** | Ad-hoc HTML buttons in shell components                           | Ad-hoc HTML inputs in `apps/web/app/login/LoginForm.tsx`        | Ad-hoc overlays in PR #22; none in `@nexora/ui`                        | `packages/ui/src/StatusBadge.tsx` and `status-tone.ts`                 | `packages/ui/src/Panel.tsx` and `Panel.module.css`          | `@nexora/sdk` (`createNexoraClient()`)                  | None on `main` (ZIP has `AddressForm.tsx`)                                | Prototype in PR #22 branch                                                                |
| **Domain owner**             | Neutral UI (`packages/ui`)                                        | Neutral UI (`packages/ui`)                                      | Neutral UI (`packages/ui`)                                             | Neutral UI (`packages/ui`)                                             | Neutral UI (`packages/ui`)                                  | Customer Domain (`apps/api/src/customer/`) / SDK        | Customer Domain presentation (`apps/web/features/customers/`)             | Carrier Domain presentation (`apps/web/components/app-shell/`)                            |
| **Reuse alternatives**       | Extract to `@nexora/ui` or keep local in each feature             | Extract to `@nexora/ui` or keep local in each feature           | Extract to `@nexora/ui` or duplicate across features                   | Reuse existing `StatusBadge` or rewrite                                | Reuse existing `Panel` or write new card divs               | Reuse `@nexora/sdk` or write manual fetch wrappers      | Reuse single form across create/edit or duplicate                         | Adapt PR #22 carrier scope or rewrite from ZIP                                            |
| **Selected approach**        | Extract domain-neutral `Button` to `@nexora/ui`                   | Extract domain-neutral `TextInput` and `Select` to `@nexora/ui` | Extract domain-neutral `Drawer` and `Dialog` to `@nexora/ui`           | Reuse and extend existing `StatusBadge` in `@nexora/ui`                | Reuse existing `Panel` from `@nexora/ui`                    | Reuse `@nexora/sdk` with dedicated React hooks          | Extract single cohesive `AddressForm` in `features/customers/`            | Adapt PR #22 carrier scope architecture into Shell                                        |
| **Rationale**                | Reused across all screens; eliminates repetitive Tailwind classes | Standardizes focus outlines, error borders, and control heights | Standardizes backdrop overlay, Escape key handling, and focus trapping | Avoids duplicate badge styling; leverages existing `resolveStatusTone` | Provides uniform card surface, border `#E2E8F0`, and shadow | Enforces single source of truth from OpenAPI contracts  | Eliminates drift between customer creation address and address management | Leverages verified multi-carrier contracts from ADR-007; connects to real `/api/carriers` |
| **Risks**                    | Over-parameterization of button props                             | Breaking login form styling during extraction                   | Focus trapping bugs or body scroll locking issues on mobile            | Missing tone mappings for package/carrier specific statuses            | Inflexible padding if hardcoded                             | Out-of-sync SDK if backend changes                      | Incomplete phone normalization on client                                  | Stale scope when carriers are added or disconnected                                       |
| **Verification**             | Unit tests in `packages/ui/test/`; visual check at all viewports  | Accessibility tests for aria-invalid, focus outline; unit tests | Keyboard tests (Escape, Tab focus trap, restoration); mobile swipe     | Unit tests in `status-tone.test.mjs`; visual checks                    | Visual verification across customer and package pages       | Contract tests in `apps/web/test/customer-api.test.mjs` | Form validation unit tests; E.164 formatting checks                       | Unit tests for scope resolution and context synchronization                               |

### Tactical DDD Boundaries and Invariants

1. **Customer Invariants**:
   - Customer creation requires an initial recipient address (`address.addressText`).
   - Customer has at least one recipient address (`Customer.addresses.length >= 1`).
   - Customer has exactly one default recipient address (`isDefault: true`).
   - Customer cannot delete their last address (`409 LAST_CUSTOMER_ADDRESS`).
   - Deleting default address when alternative addresses exist requires explicit reassignment first (`409 DEFAULT_ADDRESS_REASSIGN_REQUIRED`).
   - Phone numbers are E.164 normalized; customer codes are sequence-generated (`KH000001`).
   - Status transitions: `ACTIVE` and `INACTIVE` (`CustomerStatusLabelsVi`: "Đang hoạt động" / "Ngừng hoạt động").
2. **Shipment Boundaries**:
   - Shipment Backend V1 is not implemented.
   - Retail packages UI must display an honest empty state with informative notices.
   - No mock tracking events, fake persistent packages, or fabricated pricing algorithms ("Chưa có báo giá").
3. **Identity & Security Boundaries**:
   - Real session authentication via `POST /api/auth/login` and HttpOnly cookies.
   - Real TOTP MFA challenge verification for ADMIN role via `POST /api/auth/mfa/verify`.
   - Protected workspace routes guarded server-side by `verifyServerSession()`.

## PLAN ISSUES

- **PLAN ISSUE 1: Product Scope Decision for Sourcing Views**:
  - The reference ZIP includes China sourcing components (`SearchSection.tsx`, `CategoryGrid.tsx`, `SearchResultsFeedback.tsx`, `ImageSearchModal.tsx`) as the default home view (`activeMenuId === 'search-products'`).
  - In Nexora's approved product scope ([ADR-002](../../decisions/product-scope.md)), Nexora is an enterprise logistics and shipment hub, not a China sourcing agent or Taobao/1688 proxy buyer. Furthermore, live scraping violates third-party ToS, and bundling `@google/genai` on the client violates Nexora's secure server-proxy architecture.
  - **Option A (Recommended)**: Migrate visual presentation into an isolated feature module `apps/web/features/sourcing/` on route `/sourcing` with clear "Bản thử nghiệm giao diện / Chưa tích hợp API" notices on search execution and image upload. Zero scraping, zero `@google/genai` dependency. Preserves 100% visual/interaction coverage.
  - **Option B**: Formally exclude sourcing views from Nexora production code per ADR-002 (`INTENTIONALLY_EXCLUDED_APPROVED`). Route `/` remains the Operational Overview & Dashboard.
  - **Approval Sequencing**: The repository owner must make this product-scope decision explicitly (Option A or Option B) prior to final ADR-009 design approval. Once decided, the design will be finalized for that single option, the digest recomputed, and formal approval executed via the strict 5-line approval comment.
