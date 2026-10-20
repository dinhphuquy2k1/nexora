# Frontend Architecture

## Current identity and deployment profiles

Both ACTIVE roles use independent Nexora credentials. Logical PR6 now requires ADMIN password then TOTP or a single-use recovery code before issuing an MFA session. OPERATOR retains password-only login. Database-backed ADMIN + MFA is mandatory across administrative APIs. LOCAL remains the default loopback profile. NEXORA-024 adds the explicit PUBLIC_HTTPS application/ingress profile; real production activation still requires DNS/TLS/firewall/host NTP evidence. Carrier connection mutation forms and shipment sync remain PLANNED; NEXORA-026 adds metadata scope selection and retail presentation only. Executed full canonical verification is recorded in completed NEXORA-022; PR19 records the final exact-head CI.

`/login` renders one Nexora form for both roles. Legacy provider/admin mode selection is removed; password visibility, loading/errors, server session redirects, sanitized `from`, logout and HttpOnly cookies remain. `/setup` reads only the token fragment client-side, clears URL history, retains it in memory, validates password/confirmation and posts only the JSON body. It returns to `/login` after success without issuing a session. The page uses no-store/no-referrer and existing local assets; no token enters SSR HTML or browser storage. Query-string tokens are rejected.

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

Feature-specific modules (current shipping scope and retail presentation; future `TrackingTimeline`/`CustomerForm`):

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

- **Server Components by Default**: All page routes (`/`, `/settings`, `/system`, `/shipments/retail`) and static wrappers (`AppShell`) are Server Components unless client state is required.
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

- **Layout Architecture & Route Groups**:
  - **Root Layout (`apps/web/app/layout.tsx`)**: Owns `html`, `body`, global `styles.css`, and application metadata. Does not render `AppShell`.
  - **Standalone Public Login Route (`apps/web/app/login/`)**: One local Nexora form for both roles, brand monogram, accessible errors, password visibility and sanitized return URL. No mode toggle or AppShell. Posts to `/api/auth/login`, then `/api/auth/mfa/verify` for ADMIN; cancel revokes the pending challenge through `/api/auth/mfa/cancel`.
  - **Public Setup Route (`apps/web/app/setup/`)**: One-time fragment secret, password confirmation, no-store/no-referrer, memory-only token and return to login without auto-login.
  - **Protected Workspace Route Group (`apps/web/app/(workspace)/`)**: Routes (`/`, `/settings`, `/system`, `/shipments/retail`) reside in the `(workspace)` route group. Its Server Component layout (`apps/web/app/(workspace)/layout.tsx`) enforces server session verification via `verifyServerSession(cookie)`. Genuinely authenticated users receive `<AppShell user={result.user}>{children}</AppShell>`; unauthenticated requests redirect to `/login?from=...`; upstream backend outages fail closed with a service error banner without redirect loops.
- **Route Guarding (`middleware.ts`)**: Enforces Host allowlist validation at ingress across all matched paths including `/api/*`. Provides fast loopback redirection for unauthenticated workspace requests lacking `nexora_session` cookies, and injects `x-pathname` header for downstream Server Components while avoiding network requests in middleware.
- **Authenticated Account State (`AccountMenu`)**: Discloses active operator username, displays local runtime badge, and provides verified server-side logout destroying the session in PostgreSQL and clearing client cookies. Checks response status before redirecting and renders accessible error notifications on failure with retry capability.
- **Upstream API Proxy (`next.config.ts`) & Server API Configuration (`lib/api/config.ts`)**: Authoritative configuration owner validates `API_INTERNAL_URL` as a required HTTP/HTTPS origin without path, credentials, query, or fragment. No implicit application fallback is permitted; Compose supplies `http://api:4000` for container runtime. Server Component session verification (`lib/api/session.ts`) queries `/api/auth/session` using this configuration, distinguishing authenticated (200), unauthenticated (401), and upstream unavailable (5xx/network) states while performing redirects strictly outside catch blocks.

## 9. Authentication transport and session payload validation

LoginForm and AccountMenu make browser-originated, same-origin relative POST calls through the Web `/api/*` rewrite; these are not Server Actions. The reusable server session helper only performs GET, forwarding the session cookie to the explicit internal API URL. No server-originated authentication mutation or internal Origin bypass exists. Web Host validation remains ahead of proxying, including `/api/*`.

A server HTTP 200 session response authenticates only when `authenticated === true` and user ID/username are nonempty strings. Invalid JSON or malformed 200 payloads return unavailable service; 401 or missing cookie returns unauthenticated; upstream/network failures remain unavailable. LoginPage redirects only from the authenticated result, preventing malformed payloads from entering Workspace. AccountMenu navigates only after successful logout and retains retry behavior on revocation failure. Login displays a generic retry message for 429, covering both account lockout and the faster global admission budget without incorrectly promising a fixed five-minute wait.

PR4 owner amendment (2026-10-16) is backend-only: connect/reconnect SDK contracts do not add a Carrier Settings page, credential form or navigation item. Carrier UI remains PLANNED in a separate future task. No UI worker or shipment sync is introduced.

## ADMIN second step — NEXORA-022

LoginForm consumes the generated same-origin SDK. It parses the successful password result strictly: mfaRequired displays the second step without protected navigation and clears password state; only an actual user session result permits the existing sanitized return URL. TOTP input preserves leading zeros and supports one-time-code autocomplete, accessible labels/focus, six-digit validation and disabled/loading states. Recovery mode accepts the documented four-group code; switching clears input/errors.401 explains invalid/expired proof and offers retry or cancel/back;429 requests a later retry without promising a fixed wait. Correct-password unenrolled ADMIN sees trusted CLI guidance.

Cancel calls the Origin-protected pending-challenge revocation endpoint before returning to the password form. Network/cancel failures stay on the current step. No pending token is read by JavaScript, stored in browser storage, URL or SSR. Existing server session validation, layout, Host guard, fragment setup, AppShell and OPERATOR one-step login remain. Browser smoke uses disposable CLI-enrolled ADMIN fixtures, checks no session or navigation before MFA, wrong-code/expired-challenge/back/retry, TOTP/recovery input mode, successful MFA then the existing onboarding/OPERATOR/logout checks.

## Public profile ingress — NEXORA-024

PUBLIC_HTTPS Web uses the same pure profile/authority policy as API, with explicit exact Host authorities and no implicit loopback allowlist. Host rejection occurs in middleware before /api rewrites; forwarded Host is not accepted as authority. Public redirects use configured PUBLIC_ORIGIN, not request/forwarding values. Existing LOCAL loopback/custom-host behavior is retained with strict malformed authority rejection. Next16 middleware compatibility remains; no unrelated proxy-convention migration.

Login/MFA/setup/AccountMenu continue same-origin browser requests and generated SDK. Public Secure cookies are HttpOnly and keep existing paths/SameSite; frontend receives no keys or pending token. Canonical HTTPS fragment setup, history clearing/memory-only token/no-auto-login remain. Public network publishing belongs solely to approved Nginx, not Web. HTTPS test evidence is distinct from actual production DNS/TLS/firewall/NTP readiness.

## Multi-carrier retail presentation — NEXORA-026

The protected `/shipments/retail` route adds a **presentation-only** Kiện lẻ workspace. This supersedes the earlier statement that all Carrier UI is planned: metadata scope selection is implemented; connection creation/reconnect forms and Shipment business operations remain planned. Navigation still comes exclusively from nav-config, with a separate approved test contract and existing breadcrumb resolver. No batch-shipment, sourcing or financial capability is activated.

Ownership:

| Owner                                               | Responsibility and reused components                                                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/shipping-scope/model.ts`                  | Minimal all/provider/connection identifiers, strict URL parsing, current metadata resolution and grouping; SDK-derived DTO types                  |
| `features/shipping-scope/ShippingScopeProvider.tsx` | Workspace-only metadata request pair through SDK, cancellation, atomic readiness/error, tab-local URL scope and shipping links                    |
| `features/shipping-scope/ShippingScopeSelector.tsx` | Hierarchical provider/account search, separate selection/expansion, problem status mapping; existing useDismissable                               |
| `components/app-shell/Header.tsx`                   | Integration slot before existing AccountMenu; no shipment query ownership                                                                         |
| `features/shipments/retail/`                        | Container, filter drafts/chips, column disclosure, table states, pagination presentation and unsupported detail dialog; local model/configuration |
| `packages/ui`                                       | Existing business-agnostic Panel/StatusBadge retained; no domain code or speculative table framework added                                        |

Provider wraps ShellClient's workspace children, never public login/setup. `GET /api/carriers` and `GET /api/carrier-connections` run once per workspace mount or explicit refresh/retry, not on dropdown opening or scope change. One AbortController covers both requests; old/unmounted attempts cannot publish. Only allowlisted provider/id/displayName/status metadata is retained. Status derives from the generated contract; disconnected/problem accounts remain selectable as data scope, with an explicit problem indicator. Scope does not authorize access or invoke a provider.

`provider` and `connection` query parameters encode scope. Absence of both means all; duplicates, blank values, connection without provider, unknown/deleted/mismatched IDs produce an invalid selection requiring explicit re-selection. Metadata failure is never rendered as no connections. Labels derive from current metadata. User scope/search/page-size changes push history and clear `page`, retaining unrelated query parameters and the current fragment. Next useSearchParams responds to Back/Forward/refresh. No localStorage/sessionStorage/cookie is used for scope. Workspace memory retains the last shipping query for shipping navigation links; settings/system remain unfiltered. Opening Kiện lẻ in a new tab uses its own URL; no cross-tab synchronization.

Search is an explicit submitted draft, and advanced conditions are labelled local drafts; no Shipment request is issued. Column preferences are component-local, with tracking always required and basic/all/default presets. Status labels reproduce the reference inventory as disabled design references, **not** an approved backend vocabulary. Counts and pagination totals remain `—`; create/export are disabled with an explanatory title and visible unsupported-state explanation. Detail/history explicitly reports its missing endpoint; no fabricated timeline, record or success message exists. The empty presentation state is distinct from unsupported/error/loading/invalid; production currently selects unsupported only after valid metadata. The table scrolls within its own region.

### Local Inter typography

Root layout loads the unmodified upstream Inter4.1 normal variable WOFF2 with `next/font/local` once on html. `--font-inter` is generated by Next; `--font-sans` consumes it with a system fallback (no self-reference). Source/license live in `apps/web/app/fonts/`; weights400/500/600/700 and Vietnamese glyphs are included. No Google Fonts runtime or build network request and no new font dependency. Body, inherited controls, shared primitives and body-descendant/native-dialog portals use the same font; application numeric presentation uses tabular numbers. OS/browser-owned native chrome remains outside this guarantee.

The isolated `scripts/retail-ui-smoke.mjs` starts a real Next production server and Chromium against an explicitly fake loopback metadata/session backend. It is frontend interaction/font/layout evidence only. Genuine Nest/PostgreSQL auth/MFA and Docker checks remain separate; fixture sessions do not establish backend security or provider readiness.

At viewport widths up to600px, the existing sidebar is a modal overlay drawer: background content is inert, Tab/Shift+Tab stay in the drawer, and the hidden sidebar is inert and CSS-hidden. Manual close/backdrop/Escape restores the connected Header toggle after inert is removed. A committed pathname change closes the mobile drawer; Next Link onNavigate handles current-page menu selections. Query-only changes outside menu navigation do not close it. Desktop navigation retains expanded/collapsed state. After navigation, Next manages focus; only focus remaining in the now-hidden sidebar falls back to main content, never unnecessarily to Header. This keeps the new fixed-width selector and retail controls within the viewport; the table owns horizontal scrolling.

### PR22 selected scope and scoped return behavior

Opening the scope dropdown reveals the selected provider/connection group; actual scope-key changes during an open session (including Back/Forward) reveal the new selection. User collapse is not a reveal-effect dependency, so manual collapse persists until a new open/scope event. Search changes expand matching groups; the valid current metadata-backed selection remains available alongside matches, without clearing query or moving input focus. Group counts come from complete connection metadata, not the filtered result. A nearest-edge adjustment changes only the options container scrollTop; the page behind the dropdown is never scrolled by selection reveal. Invalid scope keeps the warning and original URL, with no selected fallback.

For the retail route only, middleware passes sanitized pathname+search as the existing workspace return target, both in the missing-cookie login redirect and the trusted x-pathname request header consumed by the server layout for rejected sessions. This preserves provider/connection/filter deep links through the existing Login flow. It changes neither password/session/MFA nor the generic sanitizer; fragments are client-only and are not received by the server. Other workspace route-return behavior is unchanged.
