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

- **`AppShell` (`AppShell.tsx`)**: Authoritative Server Component layout frame consumed exclusively in the protected workspace layout `apps/web/app/(workspace)/layout.tsx`.
- **`ShellClient` (`ShellClient.tsx`)**: Client boundary managing interactive sidebar collapse state (`isSidebarCollapsed`) and rendering workspace navigation chrome. Fully decoupled from public login routes.
- **`Sidebar` (`Sidebar.tsx`, `Sidebar.module.css`)**: Logistics navigation bar with geometric monogram logo, grouped navigation items, active route indicators, and planned item tags.
- **`Header` (`Header.tsx`, `Header.module.css`)**: Top bar containing sidebar toggle, pathname-driven breadcrumbs, and authenticated user account disclosure (`AccountMenu`).
- **`AccountMenu` (`AccountMenu.tsx`, `AccountMenu.module.css`)**: Accessible user account disclosure displaying authenticated username and active session status, with browser POST logout and status-aware retry.
- **`Breadcrumb` (`Breadcrumb.tsx`)**: Pathname-driven breadcrumbs consuming shared navigation metadata.
- **`NavigationItem` (`NavigationItem.tsx`)**: Distinguishes available routes (Next.js `Link`) from planned features (disabled action button with "Chưa triển khai" label).
- **Popover Semantics (`use-dismissable.ts`)**: Reusable disclosure hook managing outside pointer dismissal and Escape key closing with focus restoration.

### Tier C: Feature-Level Components (`apps/web/features/<feature>/`)

Feature-specific modules (e.g. `apps/web/features/parcels/`):

- **Parcels Feature (`features/parcels/`)**: Individual parcel list screen ("Kiện hàng lẻ") implementing deterministic local fixture dataset, status tabs with item counts, search input, responsive desktop table with sticky tracking code and horizontal scrolling, touch-optimized mobile card list (<768px), pagination, and accessible empty/no-results states.
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

- **Typed Configuration (`NAVIGATION_ITEMS`)**: Single source of truth defining `id`, `label`, `href`, `status` (`available` | `planned`), `group` (`Workspace` | `Logistics` | `System`), and `iconKey`.
- **Approved Navigation Contract (`navigation.test.mjs`)**: Verified against an independent `APPROVED_NAVIGATION_CONTRACT` table in Node.js test runner covering `/` (Overview), planned `/shipment` and `/customers`, `/logistics/parcels` (Kiện hàng lẻ), `/system`, and `/settings`. Detects unauthorized route additions, missing items, status alterations, or planned items with navigable URLs.
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

- **Layout Architecture & Route Groups**:
  - **Root Layout (`apps/web/app/layout.tsx`)**: Owns `html`, `body`, global `styles.css`, and application metadata. Does not render `AppShell`.
  - **Standalone Public Login Route (`apps/web/app/login/`)**: Uses a standalone `LoginLayout` (`apps/web/app/login/layout.tsx`) and `LoginPage` presenting brand monogram, mode-aware header/subtitle, accessible error banners, mode toggle link, and return URL sanitization (`sanitizeReturnUrl`). Does not render `AppShell`.
    - **Employee Login (`/login`)**: Default mode submitting credentials to `POST /api/auth/provider/login`. Displays safe error `"Thông tin đăng nhập không hợp lệ hoặc tài khoản chưa được cấp quyền truy cập."` on 401. Includes a navigation link to switch to Admin mode (`/login?mode=admin`).
    - **Admin Login (`/login?mode=admin`)**: Independent local administrator mode submitting credentials to `POST /api/auth/login`. Displays `"Tên đăng nhập hoặc mật khẩu không chính xác."` on 401. Includes a navigation link to switch to Employee mode (`/login`).
  - **Protected Workspace Route Group (`apps/web/app/(workspace)/`)**: Routes (`/`, `/settings`, `/system`) reside in the `(workspace)` route group. Its Server Component layout (`apps/web/app/(workspace)/layout.tsx`) enforces server session verification via `verifyServerSession(cookie)`. Genuinely authenticated users receive `<AppShell user={result.user}>{children}</AppShell>`; unauthenticated requests redirect to `/login?from=...`; upstream backend outages fail closed with a service error banner without redirect loops.
- **Route Guarding (`middleware.ts`)**: Enforces Host allowlist validation at ingress across all matched paths including `/api/*`. Provides fast loopback redirection for unauthenticated workspace requests lacking `nexora_session` cookies, and injects `x-pathname` header for downstream Server Components while avoiding network requests in middleware.
- **Authenticated Account State (`AccountMenu`)**: Discloses active operator username, displays local runtime badge, and provides verified server-side logout destroying the session in PostgreSQL and clearing client cookies. Checks response status before redirecting and renders accessible error notifications on failure with retry capability.
- **Upstream API Proxy (`next.config.ts`) & Server API Configuration (`lib/api/config.ts`)**: Authoritative configuration owner validates `API_INTERNAL_URL` as a required HTTP/HTTPS origin without path, credentials, query, or fragment. No implicit application fallback is permitted; Compose supplies `http://api:4000` for container runtime. Server Component session verification (`lib/api/session.ts`) queries `/api/auth/session` using this configuration, distinguishing authenticated (200), unauthenticated (401), and upstream unavailable (5xx/network) states while performing redirects strictly outside catch blocks.

## 9. Authentication transport and session payload validation

LoginForm and AccountMenu make browser-originated, same-origin relative POST calls through the Web `/api/*` rewrite; these are not Server Actions. The reusable server session helper only performs GET, forwarding the session cookie to the explicit internal API URL. No server-originated authentication mutation or internal Origin bypass exists. Web Host validation remains ahead of proxying, including `/api/*`.

A server HTTP 200 session response authenticates only when `authenticated === true` and user ID/username are nonempty strings. Invalid JSON or malformed 200 payloads return unavailable service; 401 or missing cookie returns unauthenticated; upstream/network failures remain unavailable. LoginPage redirects only from the authenticated result, preventing malformed payloads from entering Workspace. AccountMenu navigates only after successful logout and retains retry behavior on revocation failure. Login displays a generic retry message for 429, covering both account lockout and the faster global admission budget without incorrectly promising a fixed five-minute wait.

## 10. Logistics UI & Component Design Standards

### Control Sizing Rules

Form controls and interactive buttons adhere to consistent height tiers:

- **Default Control Height (`40px`, `--control-height-default`)**: Used for primary page-level search inputs (`ParcelSearch`), action buttons (`ParcelListHeader`, `ParcelColumnToggle`), and prominent dialog triggers. Standard horizontal padding is 12–14px with 16px icons.
- **Compact Control Height (`32px`, `--control-height-compact`)**: Used strictly in dense secondary contexts such as pagination navigation buttons (`ParcelPagination`), table row inline actions, or nested toolbar utilities where 40px controls would disrupt vertical density.
- **Visual & Focus Consistency**: Standard border radius is 8px (`--radius-md`), border colors utilize `--color-border-subtle`, and focus states utilize a visible focus ring (`--color-accent` or `--color-primary`) with subtle background shifts.

### Viewport Layout & Internal Table Scrolling

To eliminate unnecessary outer vertical scrolling on desktop:

- **Flex Container Containment**: `.contentArea` in `AppShell.module.css` specifies `min-width: 0;` to prevent wide children from forcing horizontal expansion of the main layout and misaligning sticky headers or sidebars.
- **Internal Table Scrolling**: On desktop screens with sufficient viewport height (`min-width: 1024px` and `min-height: 680px`), the parcels screen container uses flex column layout with `height: 100%` and `min-height: 0`. The table wrapper (`.tableScrollContainer`) manages internal vertical and horizontal overflow with a sticky header (`top: 0`, `z-index: 10`) and sticky tracking column (`left: 0`, `z-index: 12` / `15`). Pagination remains fixed outside the scroll container.
- **Responsive Adaptability**: Short desktop screens (<680px height) and mobile viewports (<768px) smoothly fall back to normal outer scrolling and stacked responsive card layouts.

### Configurable Table Columns (`nexora.parcels.columns.v1`)

Table column visibility is user-configurable without backend storage:

- **Typed Configuration Contract**: Centralized in `features/parcels/columns.ts`. Each column defines `id`, `label`, `align`, `defaultVisible`, and optional `required`.
- **Pinned Columns & Constraints**: The tracking number (`trackingNumber`) is permanently visible (`required: true`) and cannot be unchecked. Configurations with zero visible columns are strictly disallowed.
- **Local Persistence & Hydration Safety**: Preferences are saved in `localStorage` under `nexora.parcels.columns.v1`. To avoid Next.js hydration mismatches, default columns render initially on the server, while stored preferences hydrate safely inside `useEffect`.
- **Resilient Parsing**: `parseStoredColumns` validates against active column schemas, strips unknown keys, rejects corrupted or obsolete JSON, and falls back gracefully to defaults. A "Khôi phục mặc định" action allows users to reset their selection at any time.
