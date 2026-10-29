# NEXORA-031 immutable design amendment — Retail Packages UI M3 v1

Task ID: NEXORA-031
Plan revision: rev-2026-10-29-retail-packages-m3-v1
Reviewed baseline: 837e8238a91350bd741dcd3e935052f0aa2d9eb5

Captured on 2026-10-29 (Asia/Saigon). This artifact contains selected design decisions, not execution evidence. It amends delivery topology and specifies M3 against the merged PR #28 baseline on main. Do not alter this snapshot after creation.

## 1. Task Metadata & Classification

- Classification: SIGNIFICANT. Documentation Impact: REQUIRED.
- Tracking: existing active NEXORA-031, Full Frontend Migration M1–M5. Milestone M3 — Retail Packages UI (Kiện lẻ TMĐT).
- Branch: `feat/retail-packages-ui`, from `origin/main` at baseline `837e8238a91350bd741dcd3e935052f0aa2d9eb5`; target branch: `main` (new Draft PR into main).
- Reference Archive: "C:\Users\wayyk\Downloads\nexora-logistics-management (1).zip"
  - Archive SHA-256: `17e7d68fccf654fac306f9fbde49fa4646cd770191f3922a77962776e0b1b3e5`
  - `src/components/RetailPackagesView.tsx` SHA-256: `429c11652c6b848d195ca360bf08c6e3c247a35a94ca186c49d5f98f28015556`
  - `src/data/retailPackagesData.ts` SHA-256: `df671b752b40631bb3635f9708d1f3b8778121793f51591c6e18b6c4d96fe67c`

## 2. Requirements & Boundary Scope

Port the Retail Packages (Kiện lẻ TMĐT) management interface from the reference ZIP into Nexora:

- Protected route: `/shipments/retail` with session authentication via Next.js AppShell.
- Legacy redirect: `/logistics/parcels` returns HTTP 307 temporary redirect to `/shipments/retail`, preserving URL search queries.
- Seven status tabs: TẤT CẢ, ĐANG ĐẾN KHO GỬI, ĐÃ VỀ KHO GỬI, ĐANG VỀ KHO NHẬN, ĐÃ VỀ KHO NHẬN, ĐÃ GIAO HÀNG, KHIẾU NẠI.
- Twenty-column table model matching reference: MÃ VẬN ĐƠN required/sticky; HÃNG VẬN CHUYỂN hidden by default (19 visible by default); column picker with search, toggle, and default reset.
- Filter engine: 9 filter fields with operator support (equals, not_equals, contains, not_contains, before, after) and active filter chips.
- Pagination: Default page size 10 (choices: 5, 10, 20, 50, 100), with URL/query synchronization.
- Create Package Drawer: Visual form with package details, added-value services (insurance, inspection, crate, bubble wrap), warehouse selectors; submit disabled with honest explanation as Shipment CRUD API does not yet exist.
- Package Detail Drawer: Route timeline, summary strip, warehouse information; rendered for test fixtures or synthetic inspection without claiming live tracking events.
- Package Fee Section: Displays honest "Chưa có báo giá" when authorized rate data is absent; no hard-coded 28000 \* weight formulas.
- Excel Export: Visual button disabled with tooltip explaining server export is not yet implemented; no fake `alert()`.
- Responsive layout: Dedicated mobile cards view for small screens (< 768px).

Explicit non-goals:

- No Shipment backend CRUD implementation or database migrations.
- No Carrier Provider API integration, Carrier Connection management (M4), or Shipping Scope provider (M4).
- No fake backend persistence (`setPackages` generating client-only mock data).
- No new global store or non-standard UI libraries; strictly use `@nexora/ui` and tokens.

## 3. Mandatory Eight-Field Reuse & Design Audit Matrix

| Component                   | Existing implementations                                                           | Domain owner              | Reuse alternatives                                                            | Selected approach                                                                                                                             | Rationale                                                                          | Risks                                         | Verification                                               |
| :-------------------------- | :--------------------------------------------------------------------------------- | :------------------------ | :---------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------- | :-------------------------------------------- | :--------------------------------------------------------- |
| **AppShell & Routing**      | `apps/web/app/(workspace)/layout.tsx`, `lib/api/session.ts`                        | Shared Shell / Auth       | Create standalone layout; reuse AppShell                                      | Reuse existing `AppShell` with server session guard; thin `shipments/retail/page.tsx` wrapper                                                 | Maintains unified security, sidebar, header, and user profile state                | Session expiration during active view         | Auth redirects and server layout tests                     |
| **Overlays & Drawers**      | `packages/ui/src/Overlay.tsx`, `apps/web/features/customers/CustomerDrawers.tsx`   | `@nexora/ui`              | Custom inline modal divs; port ZIP fixed backdrop; reuse `Overlay`            | Reuse `@nexora/ui` `Overlay` for `CreatePackageDrawer` and `PackageDetailDrawer`                                                              | Consistent focus trapping, ESC key dismiss, backdrop tokens, and ARIA attributes   | Z-index conflicts with header                 | Native keyboard/focus and overlay dismissal tests          |
| **Form Controls**           | `packages/ui/src/Controls.tsx`, `apps/web/styles/tokens.css`                       | `@nexora/ui`              | Raw HTML inputs with Tailwind utility classes; reuse shared Controls          | Reuse `Button`, `TextInput`, `Checkbox`, `Select` from `@nexora/ui`                                                                           | Preserves Design System v3 32px standard height and v4 brand orange token bindings | Form control sizing divergence                | Token policy scanner and control size tests                |
| **Status Presentation**     | `packages/ui/src/StatusBadge.tsx`, `apps/web/features/customers/CustomerTable.tsx` | Presentation UI           | Custom CSS chips; duplicate status badges                                     | Standard status classes mapping to semantic tokens (`--color-status-success-*`, etc.)                                                         | Prevents color divergence and enforces dark/light theme token compliance           | Unknown status key at runtime                 | Exhaustive status key tests and fallback handling          |
| **Navigation & Contract**   | `apps/web/lib/navigation/nav-config.ts`, `apps/web/test/navigation.test.mjs`       | Navigation                | Keep shipment 'planned'; activate 'available' pointing to `/shipments/retail` | Set `shipment` item to `status: "available"`, `href: "/shipments/retail"`, `contentVariant: "wide"` and update `APPROVED_NAVIGATION_CONTRACT` | Activates honest navigation only when route exists and satisfies frame contract    | Regressions in navigation contract assertions | `apps/web/test/navigation.test.mjs` contract verification  |
| **Column Preferences**      | `PR #14`, `PR #22`, reference ZIP `RETAIL_PACKAGE_COLUMNS`                         | Retail Presentation       | Static 20 columns; hardcoded visibility; storage-persisted preferences        | Local state with 20 columns defined in `columns.ts`, fallback to `DEFAULT_COLUMN_VISIBILITY`                                                  | Exact 20-column parity with ZIP; zero hydration mismatch                           | Storage corruption if malformed               | Column configuration and visibility tests                  |
| **Filter Engine**           | `PR #22`, `RetailPackagesView.tsx`                                                 | Retail Presentation       | URL-only filters; purely internal state; combined engine                      | Synchronized URL query with local filter popover and active filter chips                                                                      | Consistent back/forward behavior and bookmarkability                               | Complex URL query serialization               | Query parsing and operator compatibility tests             |
| **Production Truthfulness** | `apps/web/features/customers/CustomerListPage.tsx`                                 | Architecture / Governance | Load demo mock data in production; render planned empty state                 | Pass empty `initialPackages={[]}` in production `page.tsx`; render honest planned empty state; isolate synthetic fixtures to tests            | Truthful UX: never deceive users with fake packages or non-existent backend data   | User confusion about lack of data             | Production empty state render test; synthetic fixture test |

## 4. Verification Plan

1. **Model & Column Tests:** Verify 20 columns, 7 status tabs, default visibility, and default page size 10 in `apps/web/test/retail-packages.test.mjs`.
2. **Token & Design System Compliance:** Pass `apps/web/test/form-control-contracts.test.mjs` without semantic token misuse or raw color literals.
3. **Navigation Contract:** Pass `apps/web/test/navigation.test.mjs` with shipment item active as available with wide variant.
4. **Static Quality Checks:** `pnpm lint`, `pnpm docs:check`, `pnpm contracts:check`, `node scripts/boundaries.mjs`, `pnpm typecheck`.
5. **Customer UI Non-Regression:** Verify all existing Customer tests continue to pass without modification.
6. **Docker & Browser Verification:** Canonical headless browser smoke in Docker environment covering retail page navigation, tabs, filters, column picker, and empty/fixture states.
