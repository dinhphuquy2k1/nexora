# Frontend Architecture

Next.js App Router provides the user interface and transport-only `/api/:path*` rewrite proxy. Server configuration selects `http://api:4000`, while client code in the browser consumes the generated SDK using relative same-origin paths. No database access, secrets, or internal server URLs are imported by client components. The build consumes committed SDK definitions and does not generate contracts on the fly.

## 1. Component Ownership & Tier Model

Nexora enforces three distinct component ownership tiers to prevent component duplication and premature global abstractions:

### Tier A: Shared UI Primitives (`packages/ui/`)

Reusable, business-agnostic presentation and interaction primitives (e.g. `Panel`, `StatusBadge`, future `Button`, `Input`):

- **Domain Agnostic**: Must never import Shipment, Customer, or Identity domain models.
- **Transport Agnostic**: Must never call Nexora API endpoints or SDK client factories.
- **Self-Contained Styling**: Owns its CSS Modules (`*.module.css`) and consumes semantic design tokens with sensible fallbacks (`var(--token, fallback)`).
- **Extraction Criterion**: Extract into `packages/ui` only when a primitive has no domain coupling and is actively reused across multiple distinct features or applications.

### Tier B: Application-Level Components (`apps/web/components/`)

Components dedicated to Nexora's application shell, layout frame, and cross-route coordination:

- **`AppShell` (`AppShell.tsx`)**: Authoritative Server Component layout frame consumed in `apps/web/app/layout.tsx`.
- **`ShellClient` (`ShellClient.tsx`)**: Client boundary managing interactive sidebar collapse state (`isSidebarCollapsed`) and bypassing shell chrome on public authentication routes (`/login`).
- **`Sidebar` (`Sidebar.tsx`, `Sidebar.module.css`)**: Logistics navigation bar with geometric monogram logo, grouped navigation items, active route indicators, and planned item tags.
- **`Header` (`Header.tsx`, `Header.module.css`)**: Top bar containing sidebar toggle, pathname-driven breadcrumbs, and authenticated user account disclosure (`AccountMenu`).
- **`AccountMenu` (`AccountMenu.tsx`, `AccountMenu.module.css`)**: Accessible user account disclosure displaying authenticated username and active session status, with server-side logout action.
- **`Breadcrumb` (`Breadcrumb.tsx`)**: Pathname-driven breadcrumbs consuming shared navigation metadata.
- **`NavigationItem` (`NavigationItem.tsx`)**: Distinguishes available routes (Next.js `Link`) from planned features (disabled action button with "Chưa triển khai" label).
- **Popover Semantics (`use-dismissable.ts`)**: Reusable disclosure hook managing outside pointer dismissal and Escape key closing with focus restoration.

### Tier C: Feature-Level Components (`apps/web/features/<feature>/`)

Future feature-specific modules (e.g., `ShipmentTable`, `TrackingTimeline`, `CustomerForm`):

- Kept strictly local to the feature directory.
- Reuses Tier A shared UI primitives and Tier B layout slots.
- May own feature-specific validation schemas, presentation types, and SDK caller hooks.

## 2. Design Tokens & Styling Strategy

The frontend enforces a CSS Modules architecture governed by centralized design tokens in `apps/web/styles/tokens.css`:

### 2-Tier Token Architecture

1. **Foundation Palette**: Raw brand and color constants (`--brand-navy`, `--brand-navy-dark`, `--brand-navy-light`, `--brand-orange`, `--brand-orange-light`, `--brand-orange-text`, `--gray-50` to `--gray-900`).
2. **Semantic Application Tokens**: Purpose-driven tokens mapped to the foundation constants (`--color-primary`, `--color-accent`, `--color-surface`, `--color-border`, `--color-status-*`, `--focus-ring-*`).
3. **Standardized Scales**:
   - **Spacing**: `--space-1` (4px), `--space-2` (8px), `--space-3` (12px), `--space-4` (16px), `--space-5` (20px), `--space-6` (24px), `--space-8` (32px).
   - **Radius**: `--radius-xs` (4px), `--radius-sm` (6px), `--radius-md` (8px), `--radius-lg` (12px), `--radius-full` (9999px).
   - **Shadows**: `--shadow-sm`, `--shadow-md`, `--shadow-lg`.

### Token Ownership & Consumption Contract (Option A)

- **Host Application Ownership**: Tokens are declared on `:root` in `apps/web/styles/tokens.css` and loaded globally in `apps/web/app/styles.css`.
- **Package Consumption**: Shared primitives in `packages/ui` consume these CSS custom properties via `var(--token-name, fallback)` without directly importing application stylesheets.
- **Central Theming & Overrides**: Overriding CSS variables on `:root` or scoped selectors cleanly propagates across all shell components and `@nexora/ui` primitives simultaneously without residual hardcoded styles.

### Minimal Global Styles (`apps/web/app/styles.css`)

Global CSS is restricted to root token imports, basic CSS reset, base typography, and macro page layout grids (`.grid`, `.status-grid`). All internal component presentation for `Panel` and `StatusBadge` is decoupled into `@nexora/ui` CSS Modules.

## 3. Server vs. Client Component Conventions

Nexora adheres strictly to Next.js App Router boundary best practices:

- **Server Components by Default**: All page routes (`/`, `/settings`, `/system`) and static wrappers (`AppShell`) are Server Components unless client state is required.
- **Narrow Client Boundaries**: Client boundaries (`"use client"`) are pushed to the smallest possible leaf nodes (e.g., `ShellClient` for collapse state, `AccountMenu` for disclosure, `/system` for live polling).
- **Serialization Invariant**: Server-to-Client boundaries only pass serializable data (primitives, plain objects, strings). React component constructors and icon factories are never passed across boundaries; components resolve string identifiers (`iconKey`) via local lookup registries.

## 4. Feature Data-Fetching & UI State Conventions

- **Data Ownership**: Page and feature boundaries own API data fetching; shared UI primitives remain completely transport-agnostic.
- **Typed SDK Usage**: All client data calls consume the generated OpenAPI SDK (`createNexoraClient()`). Direct database access or direct imports from `apps/api` are strictly disallowed.
- **Truthful UI State Modeling**:
  - Always distinguish empty data from unsupported or planned features.
  - Planned features must render explicit "Chưa triển khai" indicators and must never show mock records or fake success toasts.
  - Interactive requests must handle loading, error, and cancellation cleanly without external global state stores (Redux, Zustand) until multi-feature operational complexity proves a concrete requirement.

## 5. Navigation Contract & Single Source of Truth

Navigation metadata is centralized in `apps/web/lib/navigation/nav-config.ts`:

- **Typed Configuration (`NAVIGATION_ITEMS`)**: Single source of truth defining `id`, `label`, `href`, `status` (`available` | `planned`), `group` (`Workspace` | `System`), and `iconKey`.
- **Approved Navigation Contract (`navigation.test.mjs`)**: Verified against an independent `APPROVED_NAVIGATION_CONTRACT` table in Node.js test runner. Detects unauthorized route additions, missing items, status alterations, or planned items with navigable URLs.
- **Pure Resolvers (`apps/web/lib/navigation/resolve-active.ts`)**: Pure functions for URL normalization (`normalizePathname`), active route matching (`isItemActive`, `resolveActiveItem`), and breadcrumb trail derivation (`resolveBreadcrumbs`).
- **Collapsed Sidebar Overflow Handling**: Tooltips use `visibility: hidden` and `opacity: 0` in resting state, revealed on `:hover` and `:focus-within`. `.collapsed .nav { overflow: visible; }` ensures tooltip visibility without clipping, while compact header layout guarantees `scrollWidth <= clientWidth` across all approved viewports.

## 6. Product Scope Boundaries & Exclusions (ADR-002)

Nexora is a local-first shipment management platform. In foundation v0.1.0, the UI scope includes Overview (`/`), System Health (`/system`), and Settings (`/settings`). The reference prototype contained sourcing and customer portal features that are strictly excluded from Nexora production code:

- **Excluded Sourcing Features**: China sourcing search (Taobao, 1688, Tmall), image recognition modal, product category grid, search result feedback mockups, and supplier directory listings.
- **Excluded Financial Features**: Customer wallet balance, VIP tiers, currency exchange rate ticker, payment assistance, and simulated transaction logs.
- **Preserved Existing Pages**:
  - `/` (Overview): Concise, professional page hierarchy featuring page title (`Tổng quan`), subtitle (`Quản lý vận đơn, trạng thái nền tảng và kiện hàng.`), compact foundation notice, and 3 capability cards with truthful "Chưa triển khai" indicators.
  - `/system` (System Health): Real SDK client calls to `/api/health/live` and `/api/health/ready`, database/storage health checks, refresh action, and request ID tracking.
  - `/settings` (Settings): Foundation version, single-machine local runtime mode, Vietnamese language, and explicit notes on unconfigured network authentication.

## 7. Automated Verification & Runtime Evidence

- **Pure Navigation Tests**: `node --test apps/web/test/navigation.test.mjs` verifies contract compliance, route normalization, active matching, and breadcrumb derivation.
- **Shared UI & Token Tests**: `node --test apps/web/test/shared-ui.test.mjs` verifies 2-tier design token architecture, absence of global component class coupling in `styles.css`, self-contained CSS modules in `@nexora/ui`, and repository-wide token reference integrity without undeclared CSS custom property usage.
- **Shared UI Primitives Tests**: `node --test packages/ui/test/status-tone.test.mjs` verifies the pure `resolveStatusTone` resolver in `@nexora/ui` across boolean and null states using Node 24 native TypeScript type stripping.
- **Workspace Build**: Turbo and Next.js webpack production build (`pnpm build`) transpile `@nexora/ui` and prerender all static pages (`/`, `/_not-found`, `/settings`, `/system`) with zero errors.
- **Typecheck & Lint**: Zero errors in `pnpm --filter @nexora/ui typecheck`, `pnpm --filter @nexora/web typecheck`, `pnpm lint`, `node scripts/boundaries.mjs`, and `pnpm format:check`.
- **Interactive Browser & Theme Override Verification**:
  - Validated across 1440×900, 1280×800, and 1024×768 viewports in expanded and collapsed sidebar modes with `scrollWidth <= clientWidth`.
  - Tested dynamic theme override of `--color-primary` and `--color-accent` in browser runtime, confirming coherent, system-wide updates without hardcoded color leaks.
  - Verified Panel paragraph typography and StatusBadge tone mapping visually in the rendered DOM across `/`, `/system`, and `/settings`.

## 8. Authentication & Route Protection

- **Public Login Page (`/login`)**: Standalone centered layout presenting brand monogram, username/password fields, keyboard-accessible password show/hide toggle, accessible error banners, and safe local redirect handling (`sanitizeReturnUrl`). Server Component performs authoritative session verification before redirecting genuinely authenticated users to avoid redirect loops on invalid or stale cookies.
- **Route Guarding (`middleware.ts`)**: Enforces Host allowlist validation at ingress across all matched paths including `/api/*`. Inspects `nexora_session` cookie; unauthenticated requests accessing workspace pages (`/`, `/system`, `/settings`) redirect to `/login?from=...`.
- **Authenticated Account State (`AccountMenu`)**: Discloses active operator username, displays local runtime badge, and provides verified server-side logout destroying the session in PostgreSQL and clearing client cookies. Checks response status before redirecting and renders accessible error notifications on failure with retry capability.
- **Upstream API Proxy (`next.config.ts`)**: Rewrites `/api/:path*` to `API_INTERNAL_URL`, defaulting to `http://api:4000` in container runtime. Host-run workflows must explicitly specify `API_INTERNAL_URL` to an independently reachable API upstream.
