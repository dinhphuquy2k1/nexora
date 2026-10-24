# Frontend Architecture

## Current identity and deployment profiles

Both ACTIVE roles use independent Nexora credentials. Logical PR6 now requires ADMIN password then TOTP or a single-use recovery code before issuing an MFA session. OPERATOR retains password-only login. Database-backed ADMIN + MFA is mandatory across administrative APIs. LOCAL remains the default loopback profile. NEXORA-024 adds the explicit PUBLIC_HTTPS application/ingress profile; real production activation still requires DNS/TLS/firewall/host NTP evidence. Carrier UI and shipment sync remain PLANNED. Executed full canonical verification is recorded in completed NEXORA-022; PR19 records the final exact-head CI.

`/login` renders one Nexora form for both roles. Legacy provider/admin mode selection is removed; password visibility, loading/errors, server session redirects, sanitized `from`, logout and HttpOnly cookies remain. `/setup` reads only the token fragment client-side, clears URL history, retains it in memory, validates password/confirmation and posts only the JSON body. It returns to `/login` after success without issuing a session. The page uses no-store/no-referrer and existing local assets; no token enters SSR HTML or browser storage. Query-string tokens are rejected.

Next.js App Router provides the user interface and transport-only `/api/:path*` rewrite proxy. Server configuration selects `http://api:4000`, while client code in the browser consumes the generated SDK using relative same-origin paths. No database access, secrets, or internal server URLs are imported by client components. The build consumes committed SDK definitions and does not generate contracts on the fly.

## 1. Component Ownership & Tier Model

Nexora enforces three distinct component ownership tiers to prevent component duplication and premature global abstractions:

### Tier A: Shared UI Primitives (`packages/ui/`)

Reusable, business-agnostic presentation and interaction primitives (e.g. `Panel`, `StatusBadge`, future `Button`, `Input`):

- **Domain Agnostic**: Must never import Shipment, Customer, or Identity domain models.
- **Transport Agnostic**: Must never call Nexora API endpoints or SDK client factories.
- **Self-Contained Styling**: Owns its CSS Modules (`*.module.css`) and consumes semantic design tokens. Fallbacks in `packages/ui` are permitted only under a documented standalone consumer contract consistent with root defaults.
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

Future feature-specific modules (e.g., `ShipmentTable`, `TrackingTimeline`, `CustomerForm`):

- Kept strictly local to the feature directory.
- Reuses Tier A shared UI primitives and Tier B layout slots.
- May own feature-specific validation schemas, presentation types, and SDK caller hooks.

## 2. Design Tokens & Styling Strategy (Official Styling Policy)

The frontend enforces a strict Design Token and CSS Modules architecture. `apps/web/styles/tokens.css` is the canonical Single Source of Truth for all design tokens across the Nexora frontend.

### A. Single Source of Truth & Token Architecture

The token system is structured into four explicit layers:

1. **Foundation Palette**: Raw brand and neutral color values (`--brand-navy`, `--brand-navy-dark`, `--brand-navy-light`, `--brand-orange`, `--brand-orange-light`, `--brand-orange-text`, `--gray-50` to `--gray-900`).
2. **Semantic Application Tokens**: Role-based tokens describing UI function (`--color-primary`, `--color-accent`, `--color-surface`, `--color-border`, `--color-status-*`, `--focus-ring-*`).
3. **Dark-Surface Context Tokens**: Role-specific dark-theme tokens (`--color-text-on-dark`, `--color-text-on-dark-muted`, `--color-border-on-dark`, `--color-border-on-dark-subtle`, `--color-surface-on-dark`, `--color-surface-on-dark-hover`, `--shadow-on-dark-tooltip`).
4. **Standardized Scales**:
   - **Typography Scale**: `--font-size-2xs` (10px), `--font-size-xs` (11px), `--font-size-sm` (12px), `--font-size-base` (13px), `--font-size-md` (14px), `--font-size-lg` (15px), `--font-size-xl` (16px), `--font-size-2xl` (20px), `--font-size-3xl` (24px).
   - **Line Heights**: `--line-height-tight` (1.2), `--line-height-snug` (1.35), `--line-height-normal` (1.5).
   - **Font Weights**: `--font-weight-normal` (400), `--font-weight-medium` (500), `--font-weight-semibold` (600), `--font-weight-bold` (700), `--font-weight-extrabold` (800).
   - **Spacing Scale**: `--space-1` (4px), `--space-2` (8px), `--space-3` (12px), `--space-4` (16px), `--space-5` (20px), `--space-6` (24px), `--space-8` (32px).
   - **Radius Scale**: `--radius-xs` (4px), `--radius-sm` (6px), `--radius-md` (8px), `--radius-lg` (12px), `--radius-xl` (16px, cards), `--radius-full` (9999px).
   - **Elevation Shadows**: `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-on-dark-tooltip`.
5. **Canonical Form Control Contract Tokens**:
   - Sizing: `--control-height: 44px;`, `--control-radius: var(--radius-lg);`, `--control-padding-x: 14px;`, `--control-padding-y: 10px;`, `--control-font-size: var(--font-size-base);`.
   - Colors: `--control-bg: var(--color-surface-muted);`, `--control-bg-focus: var(--color-surface);`, `--control-text: var(--color-text);`, `--control-placeholder: var(--gray-400);`.
   - Borders: `--control-border: var(--color-border-subtle);`, `--control-border-hover: var(--gray-400);`, `--control-focus-border: var(--color-accent);`.
   - Focus rings: `--control-focus-ring: rgba(245, 138, 36, 0.2);`, `--control-invalid-focus-ring: rgba(151, 61, 43, 0.2);`.
   - States: `--control-disabled-bg: var(--gray-100);`, `--control-disabled-text: var(--gray-500);`, `--control-disabled-border: var(--gray-200);`, `--control-readonly-bg: var(--gray-50);`, `--control-invalid-border: var(--color-status-error-text);`.

### B. Semantic Ownership & Usage Rules

Tokens must be consumed strictly according to their intended semantic role:

- **Text Colors**: Use text tokens (`--color-text`, `--color-text-muted`, `--color-text-on-dark`, `--color-text-on-dark-muted`, `--color-accent-text`, status text tokens). Never use border tokens (`--color-border-subtle`, `--color-border`) as text colors.
- **Backgrounds**: Use surface and background tokens (`--color-surface`, `--color-background`, `--color-surface-muted`, `--color-surface-on-dark`, status bg tokens). Never use text or border tokens as background colors.
- **Borders**: Use border tokens (`--color-border`, `--color-border-subtle`, `--color-border-on-dark`, status error border). Never use surface or text tokens for border colors.
- **Elevations**: Use elevation shadow tokens (`--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-on-dark-tooltip`).
- **Focus Rings**: Use focus tokens (`--focus-ring-on-light`, `--focus-ring-on-dark`, `--control-focus-ring`).
- **No Value-Based Conflation**: Never reuse a token solely because its current hex/pixel value happens to match. Tokens represent architectural intent and role.

### C. Fallback Policy

- **In `apps/web`**:
  - CSS custom properties are guaranteed by the root theme (`apps/web/styles/tokens.css` imported in `styles.css`).
  - Consumers must write `color: var(--color-text);` and `border-color: var(--color-border);` **without fallbacks**.
  - Unnecessary fallbacks (e.g. `var(--space-4, 16px)`, `var(--color-surface, #ffffff)`) are strictly forbidden because they hide missing token declarations and create maintenance drift.
- **In `packages/ui`**:
  - Fallbacks are permitted **only** when defining an explicit standalone component contract for use in consumers where the root theme is not guaranteed.
  - Any standalone fallback must be consistent with the default root theme values (e.g. `var(--control-height, 44px)`).
  - Standalone fallbacks must be cleanly defined without deeply nested ad-hoc fallback chains (e.g. avoid `var(--a, var(--b, 12px))`).
  - Fallbacks must be tested independently in package tests.
  - Fallbacks must never be added reflexively to every `var()` declaration.

### D. Shared Component Contract & Parity

Per [NEXORA UI TOKEN & COMPONENT REUSE RULE](../ai/PROJECT_RULES.md#7-mandatory-ui-design-system--component-reuse-rule), all standard form controls (`TextInput`, `Textarea`, `Button`, `Checkbox`) share one canonical state and sizing contract:

- **Height & Box-Sizing**: Exact 44px height (`height: var(--control-height)`), `box-sizing: border-box`, standard 12px radius (`border-radius: var(--control-radius)`).
- **Interactive State Precedence**: Focus and invalid states strictly supersede hover styling:
  - Default: `var(--control-border)` (`#cbd5e1`), `var(--control-bg)` (`#f8fafc`).
  - Hover: `var(--control-border-hover)` (`#94a3b8`) only when not disabled, readonly, focused, or invalid (`:not(:focus):not([aria-invalid="true"])`).
  - Focus: `var(--control-focus-border)` (`#f58a24`) with 2px outer focus ring (`rgba(245, 138, 36, 0.2)`).
  - Invalid (`aria-invalid="true"`): `var(--control-invalid-border)` (`#973d2b`) with error focus ring (`rgba(151, 61, 43, 0.2)`).
  - Disabled: `var(--control-disabled-bg)` (`#f1f5f9`), `var(--control-disabled-text)` (`#64748b`), `cursor: not-allowed`.
  - Readonly: `var(--control-readonly-bg)` (`#f8fafc`), `cursor: default`.
- **Textarea Parity**: Reuses identical colors, borders, radius, focus rings, and state semantics; default minimum height is 88px with vertical resize.
- **Select Specification**: Standardized to 44px height, identical border, radius, and focus parity matching `TextInput`. Implementation is deferred to M2's first consumer per YAGNI and component reuse policy.
- **Button Contrast & WCAG AA**: Foreground text on `--color-accent` (`#F58A24`) uses `var(--brand-navy, #172b4d)` providing a **5.74:1** contrast ratio (surpassing the WCAG AA 4.5:1 threshold for normal text). On hover (`#E07716`), contrast is 4.54:1 (>= 4.5:1).
- **Layout Scoping**: Feature layouts (Login, Setup, Customer, Carrier) may adjust surrounding whitespace, layout width, or leading icon padding, but must **never** use `!important` or override the default states of shared controls.

### E. Legitimate CSS-Local Exceptions

CSS literals (raw values) are permitted without creating a design token only in these explicit cases:

1. **Standard Contextual Constants**: `0`, `auto`, `inherit`, `transparent`, `100%`, `50%`, `100vh`, `100dvh`.
2. **Component-Local Geometric Coordinates**: Local layout positioning, offsets, and icon alignments (e.g. `top: 10px; right: 12px;`, `left: calc(100% + 8px);`, active bar `top: 6px; bottom: 6px; width: 4px;`).
3. **Component-Specific Micro-Shadows on Complex Backgrounds**: Subtle monogram box-shadows (e.g. `0 1px 2px rgba(0, 0, 0, 0.1)`) that depend directly on component-local gradients and do not constitute an elevation surface.
4. **Browser Pseudo-Elements**: Scrollbar sizing (`width: 6px; height: 6px;`).

Creating hundreds of single-use tokens for purely local coordinates or micro-adjustments is anti-pattern and rejected.

### F. Testing Strategy & Runtime Token Override

Testing does not lock implementation strings (e.g. asserting exact regex like `/height:\s*var\(--control-height,\s*44px\)/`). Instead, frontend tests are organized into three behavioral groups:

1. **Token Contract Tests**: Assert required tokens are declared in `tokens.css`, references resolve without circular dependencies, consumers use semantic tokens according to ownership rules, and `apps/web` contains no unnecessary fallbacks.
2. **Component Consistency Tests**: Assert shared controls bind sizing and states to canonical contract tokens, interactive states are synchronized with proper specificity (hover cannot clobber focus), no `!important` overrides exist, and `@nexora/ui` primitives are reused across pages.
3. **Runtime Token Override Tests**: Execute in browser via Chromium/CDP:
   - Render page containing form controls.
   - Record initial computed styles of controls via `window.getComputedStyle()`.
   - Dynamically override root tokens (e.g. `--control-height: 52px;`, `--control-radius: 6px;`) on `document.documentElement`.
   - Assert all consumer controls synchronously update their computed styles in lockstep.
   - Restore root tokens and verify computed styles return cleanly to their initial values.

### G. Header First-Paint Responsive Parity at 901–1100px

To eliminate visual layout shift and hydration discrepancy at compact desktop viewports (901–1100px):

- Header uses CSS-first `.responsiveBrand` styling matching Sidebar's CSS-first `@media (min-width: 901px) and (max-width: 1100px)` 72px collapsed geometry.
- On first paint before React hydration completes, Header renders `.collapsedBrand` monogram at 901–1100px and hides it on wide viewports (>1100px) and mobile (<=900px) via pure CSS media queries with zero layout shift.
- Manual sidebar toggle overrides are cleanly separated in `userOverride: boolean | null`, ensuring user preferences supersede responsive defaults.

### H. Minimal Global Styles (`apps/web/app/styles.css`)

Global CSS is restricted to root token imports, basic CSS reset, base typography, and macro page layout grids (`.grid`, `.status-grid`). All internal component presentation for `Panel`, `StatusBadge`, and form controls is decoupled into `@nexora/ui` CSS Modules.

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

- **Layout Architecture & Route Groups**:
  - **Root Layout (`apps/web/app/layout.tsx`)**: Owns `html`, `body`, global `styles.css`, and application metadata. Does not render `AppShell`.
  - **Standalone Public Login Route (`apps/web/app/login/`)**: One local Nexora form for both roles, brand monogram, accessible errors, password visibility and sanitized return URL. No mode toggle or AppShell. Posts to `/api/auth/login`, then `/api/auth/mfa/verify` for ADMIN; cancel revokes the pending challenge through `/api/auth/mfa/cancel`.
  - **Public Setup Route (`apps/web/app/setup/`)**: One-time fragment secret, password confirmation, no-store/no-referrer, memory-only token and return to login without auto-login.
  - **Protected Workspace Route Group (`apps/web/app/(workspace)/`)**: Routes (`/`, `/settings`, `/system`) reside in the `(workspace)` route group. Its Server Component layout (`apps/web/app/(workspace)/layout.tsx`) enforces server session verification via `verifyServerSession(cookie)`. Genuinely authenticated users receive `<AppShell user={result.user}>{children}</AppShell>`; unauthenticated requests redirect to `/login?from=...`; upstream backend outages fail closed with a service error banner without redirect loops.
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

## Customer shared vocabulary contract — NEXORA-027 amendment

Customer frontend remains PLANNED. The owner-approved cross-package contract exposes CustomerStatus/CustomerStatusCode and exhaustive CustomerStatusLabelsVi from @nexora/shared for future filters/comparisons/badges. Use generated SDK HTTP types, never Backend Domain imports or hand-written response substitutes. A targeted Web contract fixture checks imports/types without introducing a Customer page.

Filters send canonical status codes; labels are display-only. ALL/Tất cả is UI state, not a persisted status. Two static options require no metadata endpoint. Labels have one shared Vietnamese mapping, no Domain/UI color coupling or new i18n framework. API Customer Summary/Detail now include required statusLabel; see [API contract](api-contract.md). Same-revision API/Web builds/deployment are assumed; a shared source package cannot synchronize separately deployed versions automatically. Shared exports are pure/browser-safe and Next transpiles the existing package.

## NEXORA-029 selected migration design — implementation PLANNED

[Active NEXORA-029](../tasks/active/NEXORA-029-full-frontend-migration.md) and its [v8 snapshot](../tasks/design-reviews/NEXORA-029-rev-2026-10-23-frontend-migration-v8.md) specify planned visual migration, not implemented routes or API behavior. Owner selected Option B: no China sourcing route/navigation/screens/showcase/product/image search/scraping/Gemini in production; ZIP sources remain provenance only. Login Quick Fill is deliberately excluded for security. Existing server session/MFA ownership and neutral UI tiers remain authoritative.

CustomerStatsBar remains PLANNED in M2. Merged NEXORA-030/PR26 already implements required owner/q/phone-scoped stats on GET /api/customers and its generated SDK; status/page/pageSize do not filter stats, and the eight endpoints remain. The selected M2 test runtime must verify the actual API/SDK contract. Never derive counts from page rows/pagination.total or fabricate zeros for missing/old-server stats. NEXORA-031 has its own digest-bound approval; the owner currently authorizes M1 only. Historical NEXORA-029 snapshots remain unchanged.

## NEXORA-031 M1 foundation

M1 implements the approved presentation foundation on the existing App Router/security architecture; M2–M5 are NOT STARTED. Header56px, sidebar240px/72px, current navy/orange semantic palette and local Inter normal-variable100–900 are retained as central tokens. The unmodified font and SIL OFL license/provenance are in app/fonts; actual cmap covers U+1EA0–U+1EF9 plus Đ/đ, verified against source bytes. next/font/local supplies the root --font-inter variable; no external font request. Existing Panel and boolean/null StatusBadge semantics are unchanged.

Neutral packages/ui Button/TextInput/Checkbox are consumed by Login/MFA; Overlay is consumed by mobile navigation and login-help dialog. No unused Select or generic form framework. Overlay uses native modal dialog/top-layer/inert background/focus containment, Escape/backdrop dismissal and overflow restoration. Existing useDismissable remains the popover policy. The shell adapts to tablet collapse and off-canvas at widths<=900px, closes on route/viewport change, restores trigger focus and exposes the existing honest empty NotificationMenu. Navigation registry and availability remain unchanged: Overview/System/Settings only; no Customer/Retail/Carrier activation.

AppShell selects only safe deployment text on the server using existing shared policy (selective PR21 helper reuse); ShellClient receives text/user props, never environment/keys or authorization responsibility. Existing workspace server guard, session verification, safe-from, Host/Origin rules, cookie/MFA/setup/logout behavior remain authoritative. Login visual changes reuse current password/MFA outcome logic and API contracts. Remember Me stores only trimmed username (<=50) under nexora_remembered_username, clears unchecked preference on valid submit, tolerates blocked storage and never changes session TTL. Password/MFA/session/recovery secrets are never persisted. Forgot-password help directs users to their administrator; there is no fake reset endpoint or Quick Fill.

Native Node tests and real CDP viewport/auth evidence are tracked in [NEXORA-031](../tasks/active/NEXORA-031-full-frontend-migration.md) and PR27. Implemented UI is distinct from passing visual/runtime acceptance. Full M5 reference-image comparison and Customer/Carrier/retail consumer acceptance remain later milestones; no production deployment is claimed.
