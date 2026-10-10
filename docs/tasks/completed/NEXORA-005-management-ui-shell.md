# Task: NEXORA-005 — Integrate Management UI Shell into Nexora

- **Task ID**: `NEXORA-005`
- **Status**: `COMPLETED`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `VERIFIED`

---

## 1. Provenance & Starting Baseline

- **Repository**: `https://github.com/dinhphuquy2k1/nexora`
- **Starting Main SHA**: `f11be98bcdfcf4160a495338387a328f750a6090` (PR #3 merged)
- **Working Branch**: `feat/management-ui-shell`
- **Reference Prototype**: `C:\Users\wayyk\Downloads\nexora-logistics-management.zip`
- **Task Classification**: `SIGNIFICANT`

---

## 2. Objective & Product Scope

Integrate the visual design language, application shell, and reusable management UI components from the provided ReactJS prototype into Nexora's existing Next.js application (`apps/web`).

### Approved Scope Boundaries (ADR-002 Alignment)

Nexora is an independent local-first shipment management platform.

- **In-Scope**:
  - Application shell layout (`AppShell`, `ShellClient`, `Header`, `Sidebar`, `Breadcrumb`).
  - Brand identity (Geometric monogram `N` logo with accent dot, Navy/Orange palette).
  - CSS Modules styling model with canonical semantic tokens (`tokens.css`).
  - Single typed navigation configuration (`nav-config.ts`).
  - Pure functions for active pathname and breadcrumb derivation (`resolve-active.ts`).
  - Truthful representation of planned vs available navigation items.
  - Migration of existing pages (`/`, `/system`, `/settings`) to the new shell while strictly preserving real API health checks, foundation copy, and Vietnamese language.
- **Mandatory Exclusions (Out-of-Scope)**:
  - China sourcing portals (Taobao, 1688, Tmall product search, image search modal).
  - Category grids and search result feedback mockups.
  - Customer accounts, fictional VIP tiers, wallet balances, currency exchange rates, payment assistance.
  - Mock supplier results, transaction history, and fabricated logistics notifications.
  - Premature shipment CRUD operations.

---

## 3. Approved Navigation Contract

Single source of truth navigation metadata (`apps/web/lib/navigation/nav-config.ts`):

| Group     | Label               | href        | Status      | iconKey     | Behavior                                 |
| :-------- | :------------------ | :---------- | :---------- | :---------- | :--------------------------------------- |
| Workspace | Tổng quan           | `/`         | `available` | `overview`  | Next.js Link, active on `/`              |
| Workspace | Vận đơn             | `null`      | `planned`   | `shipment`  | Disabled button, "Chưa triển khai" badge |
| Workspace | Khách hàng          | `null`      | `planned`   | `customers` | Disabled button, "Chưa triển khai" badge |
| System    | Trạng thái hệ thống | `/system`   | `available` | `system`    | Next.js Link, active on `/system`        |
| System    | Cài đặt             | `/settings` | `available` | `settings`  | Next.js Link, active on `/settings`      |

---

## 4. Styling Strategy & CSS Conflict Resolution

- **CSS Modules**: Component styles isolated in `AppShell.module.css`, `Header.module.css`, and `Sidebar.module.css`.
- **Semantic Design Tokens**: Centralized variables in `apps/web/styles/tokens.css` (`--color-primary`, `--color-primary-strong`, `--color-primary-hover`, `--color-accent`, `--color-background`, `--color-surface`, `--color-border`, `--sidebar-width`, `--sidebar-collapsed-width`, `--header-height`).
- **Global CSS Reset**: Removed legacy global element selectors (`aside`, `header`, `nav`, `main`) in `apps/web/app/styles.css` to eliminate layout collisions. Preserved global resets, typography, and `@nexora/ui` panel, button, and badge styles.
- **Typography**: System font stack (`Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`) without external runtime font CDN.
- **Icons**: Pinned exact `lucide-react@0.546.0` dependency. String-based registry in `apps/web/lib/icons.ts` prevents React constructors from crossing Server/Client boundaries.

---

## 5. Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- Migrated frontend application shell from legacy static layout to modular AppShell with collapsible Sidebar, Header, and dynamic breadcrumbs.
- Established centralized semantic design tokens (`apps/web/styles/tokens.css`) and scoped CSS Modules styling model without Tailwind CSS.
- Defined single source of truth navigation contract with truthful planned item treatment and pure logic resolvers.
- Preserved existing Overview, System Health (real SDK check), and Settings pages within the new shell.
- Explicitly documented exclusion of prototype sourcing/financial features per ADR-002 product scope.

### Canonical owners

- `docs/architecture/frontend.md`

### Documentation verification

- `pnpm docs:check`

---

## 6. Evidence

| Claim                                                                      | Evidence                                                        | Date       | Result |
| :------------------------------------------------------------------------- | :-------------------------------------------------------------- | :--------- | :----- |
| Baseline commit and clean working tree confirmed                           | `git status; git rev-parse HEAD` (`f11be98`)                    | 2026-10-10 | PASS   |
| Pure navigation logic resolver passes unit tests                           | `node --test apps/web/test/navigation.test.mjs`                 | 2026-10-10 | PASS   |
| Full workspace tests pass including web and API                            | `pnpm test`                                                     | 2026-10-10 | PASS   |
| Web workspace typecheck passes                                             | `pnpm --filter @nexora/web typecheck`                           | 2026-10-10 | PASS   |
| Production build passes across all packages                                | `pnpm build`                                                    | 2026-10-10 | PASS   |
| Architectural boundaries check passes                                      | `node scripts/boundaries.mjs`                                   | 2026-10-10 | PASS   |
| Linter passes across repository                                            | `pnpm lint`                                                     | 2026-10-10 | PASS   |
| Prettier code formatting check passes                                      | `pnpm format:check`                                             | 2026-10-10 | PASS   |
| Documentation governance check passes                                      | `pnpm docs:check`                                               | 2026-10-10 | PASS   |
| Browser interactive verification of shell, collapse, routes, and viewports | `browser_subagent` recording `management_ui_shell_verification` | 2026-10-10 | PASS   |
