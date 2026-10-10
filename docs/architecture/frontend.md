# Frontend Architecture

Next.js App Router provides the user interface and transport-only `/api/:path*` rewrite proxy. Server configuration selects `http://api:4000`, while client code in the browser consumes the generated SDK using relative same-origin paths. No database access, secrets, or internal server URLs are imported by client components. The build consumes committed SDK definitions and does not generate contracts on the fly.

## 1. Application Shell & Component Ownership

The management UI shell (`apps/web/components/app-shell/`) provides a unified, reusable layout frame across all routes:

- **`AppShell` (`AppShell.tsx`)**: Authoritative Server Component layout container consumed in `apps/web/app/layout.tsx`. Wraps page content within the client shell boundary.
- **`ShellClient` (`ShellClient.tsx`)**: Client boundary managing interactive sidebar collapse state (`isSidebarCollapsed`). Renders `Sidebar`, `Header`, and the main content viewport.
- **`Sidebar` (`Sidebar.tsx`, `Sidebar.module.css`)**: Collapsible logistics navigation bar featuring the geometric monogram logo (`N` with accent dot), grouped navigation items, active route indicators (accent vertical bar), and truthful planned item badges ("Chưa triển khai").
- **`Header` (`Header.tsx`, `Header.module.css`)**: Top bar containing the sidebar toggle, dynamic breadcrumb trail derived from the active URL, local workspace badge ("● Không gian cục bộ"), empty notification popover, and truthful local workspace status menu.
- **`Breadcrumb` (`Breadcrumb.tsx`)**: Pathname-driven breadcrumb navigation consuming the shared navigation metadata.
- **`NavigationItem` (`NavigationItem.tsx`)**: Distinguishes available routes (Next.js `Link`) from planned features (disabled action button with explicit "Chưa triển khai" indicator).
- **`UserMenu` (`UserMenu.tsx`)**: Truthful local workspace status overlay displaying foundation version, single-node operational mode, and local-first boundaries. Follows lightweight accessible disclosure semantics (`aria-expanded`, `aria-controls` via `useId`) without modal dialog traps.
- **`NotificationMenu` (`NotificationMenu.tsx`)**: Truthful notification indicator displaying that notification functionality is not yet implemented ("Chức năng thông báo chưa được triển khai"), without asserting unverified operational health status. Provides an explicit Next.js link to `/system` for actual live system verification.
- **Popover Semantics & Dismissal (`use-dismissable.ts`)**: Reusable disclosure hook managing outside pointer dismissal and Escape key closing. On Escape, keyboard focus cleanly returns to the trigger button (`triggerRef`), while outside clicks close the menu without stealing the pointer target's focus.

## 2. Styling Strategy & Token Layer

The frontend enforces a CSS Modules architecture with centralized semantic design tokens:

- **Tokens (`apps/web/styles/tokens.css`)**: Defines canonical variables including `--color-primary` (`#172b4d`), `--color-primary-strong` (`#0f1d36`), `--color-primary-hover` (`#1e3a5f`), `--color-accent` (`#f58a24`), `--color-background` (`#f5f7fa`), `--color-surface` (`#ffffff`), `--color-border` (`#e2e8f0`), layout dimensions (`--sidebar-width`, `--sidebar-collapsed-width`, `--header-height`), and status colors.
- **CSS Modules**: All shell components use scoped `.module.css` files, preventing global stylesheet pollution. Tailwind CSS is not introduced into the repository.
- **Global Reset & Legacy Migration (`apps/web/app/styles.css`)**: Removed unscoped layout element selectors (`aside`, `header`, `nav`, `main`) to eliminate layout collisions with the new shell. Preserves global typography, CSS reset, and `@nexora/ui` panel, grid, button, and badge styles.
- **Typography**: System font stack (`Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`) rendered without external runtime font CDNs or `next/font/google` overhead, with full fallback support for Vietnamese text.
- **Collapsed Sidebar Tooltips**: Tooltips use `visibility: hidden` and `opacity: 0` in resting state, revealed on both mouse hover (`:hover`) and keyboard navigation (`:focus-within`). Purely visual tooltips use `aria-hidden="true"` to prevent duplicate screen reader announcements, while parent links and disabled buttons provide independent `aria-label` definitions in collapsed mode.

## 3. Navigation Contract & Single Source of Truth

Navigation metadata is centralized in `apps/web/lib/navigation/nav-config.ts`:

- **Typed Configuration (`NAVIGATION_ITEMS`)**: Single source of truth defining `id`, `label`, `href`, `status` (`available` | `planned`), `group` (`Workspace` | `System`), and `iconKey`.
- **Approved Navigation Contract (`navigation.test.mjs`)**: Verified against an independent `APPROVED_NAVIGATION_CONTRACT` table in Node.js test runner. Detects unauthorized route additions (e.g. sourcing, wallet), missing items, status alterations, group changes, or planned items with navigable URLs.
- **Pure Resolvers (`apps/web/lib/navigation/resolve-active.ts`)**: Pure functions for URL normalization (`normalizePathname`), active route matching (`isItemActive`, `resolveActiveItem`), and breadcrumb trail derivation (`resolveBreadcrumbs`).
- **Truthful Planned Items**: Planned capabilities (`shipment`, `customers`) have `href: null` and render with explicit "Chưa triển khai" indicators. They do not navigate to fake routes, simulate CRUD actions, or silently alter active state.
- **Icons (`apps/web/lib/icons.ts`)**: Pinned exact dependency `lucide-react@0.546.0`. Configuration stores string `iconKey` identifiers, resolving Lucide icon components within rendering components to avoid serializing React component constructors across Server/Client boundaries.
- **TypeScript Extension Convention**: Node 24 native ESM type-stripping executes `.mjs` test suites (`navigation.test.mjs`) against TypeScript modules without a compilation step. Node's ESM loader requires explicit `.ts` extensions on relative module specifiers. To support this while preserving type safety, `apps/web/tsconfig.json` specifies `"allowImportingTsExtensions": true` alongside `"noEmit": true`.

## 4. Product Scope Boundaries & Exclusions (ADR-002)

Nexora is a local-first shipment management platform. In foundation v0.1.0, the UI scope includes Overview (`/`), System Health (`/system`), and Settings (`/settings`). The reference prototype contained sourcing and customer portal features that are strictly excluded from Nexora production code:

- **Excluded Sourcing Features**: China sourcing search (Taobao, 1688, Tmall), image recognition modal, product category grid, search result feedback mockups, and supplier directory listings.
- **Excluded Financial Features**: Customer wallet balance, VIP tiers, currency exchange rate ticker, payment assistance, and simulated transaction logs.
- **Preserved Existing Pages**:
  - `/` (Overview): Preserves product introduction, shipment foundation status, and link to system health without falsely claiming shipment CRUD exists.
  - `/system` (System Health): Preserves real SDK client calls to `/api/health/live` and `/api/health/ready`, database/storage health checks, refresh action, and request ID tracking.
  - `/settings` (Settings): Preserves foundation version, single-machine local runtime mode, Vietnamese language, and explicit notes on unconfigured network authentication.

## 5. Verification & Runtime Evidence

- **Logic Tests**: Pure navigation resolvers and contract compliance verified using Node.js test runner (`node --test apps/web/test/navigation.test.mjs`), covering contract validation, negative assertions, exact/prefix active matching, breadcrumbs, and invalid route rejection.
- **Workspace Build**: Turbo and Next.js webpack production build (`pnpm build`) prerender all static pages (`/`, `/_not-found`, `/settings`, `/system`) with zero errors.
- **Typecheck & Lint**: Zero errors in `pnpm --filter @nexora/web typecheck`, `pnpm lint`, `node scripts/boundaries.mjs`, and `pnpm format:check`.
- **Interactive Browser Verification**: Validated across 1440×900, 1280×800, and 1024×768 viewports:
  - Sidebar collapse to 72px and expansion to 240px.
  - Pathname-driven navigation between Overview, System Health, and Settings.
  - Disabled planned links with no unwanted navigation.
  - Dismissable popovers on outside click and Escape key with focus restoration to trigger.
  - Execution of real SDK health checks on `/system`.
