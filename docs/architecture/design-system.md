# Nexora Design System

This document owns shared frontend visual contracts. [Frontend architecture](frontend.md) owns routes/data/server boundaries, [Reusable Components](reusable-components.md) owns exported APIs and actual consumers, and [Project Rules](../ai/PROJECT_RULES.md) owns mandatory reuse. The design architecture is governed jointly by the approved [v3 design](../tasks/design-reviews/NEXORA-031-rev-2026-10-26-design-system-m2-v3.md) (governing shared controls, 32px standard sizing, typography scale, spacing, 9-column customer table layout, and 5-row skeleton) and the [v4 color policy](../tasks/design-reviews/NEXORA-031-rev-2026-10-26-color-policy-m2-v4.md) (governing the canonical color system and palette fidelity, which supersedes prior conflicting WCAG AA contrast merge gates on Brand Orange `#F58A24` and White text while strictly preserving all non-color accessibility standards); execution and remaining verification belong to [NEXORA-031](../tasks/active/NEXORA-031-full-frontend-migration.md).

## Ownership and token layers

Use existing Vanilla CSS Modules, local Inter and neutral @nexora/ui components. No duplicate UI library, feature-specific form defaults or unapproved dependencies. Theme source is apps/web/styles/tokens.css:

1. Foundation: existing palette, type10–24px, weights400–800, line heights1.2/1.35/1.5, spacing4/8/12/16/20/24/32, radii4/6/8/12/16/full and shadows.
2. Semantic: text/surface/border/focus/action/status roles, typography aliases and density/layout contracts. Equal current values do not make roles interchangeable.
3. Component: @nexora/ui maps public size tokens to private --\_control-\* values at the actual consumer. Private aliases are owned only by Controls.module.css, not root theme overrides or feature extension points.

## Controls and public APIs

| size                        | Height/min-height/interactive target | Inline padding | Icon | Checkbox indicator |
| --------------------------- | ------------------------------------ | -------------- | ---- | ------------------ |
| default, including omission | 32px                                 | 12px           | 14px | 16px               |
| medium                      | 40px                                 | 16px           | 16px | 18px               |
| large                       | 48px                                 | 20px           | 18px | 20px               |

Button, TextInput, Select, Textarea and Checkbox accept size="default"|"medium"|"large" and React19 native refs. Input/Select omit conflicting numeric native size; no current numeric-size consumer exists. All modules, including Login/MFA/Setup, use32px by default. No legacy44px fallback or Customer28px density. Decorative logos/avatars and container/navigation geometry have separate semantic roles.

```tsx
<Button>Thêm khách hàng</Button>
<TextInput size="medium" type="number" />
<Select size="large" aria-label="Lựa chọn" />
<Textarea rows={6} />
```

Button variants primary(default), secondary, ghost and emphasis share size/state/focus/disabled behavior. Labels stay single-line within the selected fixed height; consuming action/feedback groups wrap between controls rather than wrapping a label inside32px. icon gives a square target; consumers supply an accessible name. Real navigation stays a real Link; buttonClassName shares presentation with data-size without changing link semantics.

Textarea shares font, padding, radius and states, defaults rows3, honors explicit rows and vertical resize, and retains a multiline minimum; it is never forced to32px tall. Checkbox's label is the interactive target; indicator dimensions are separate. One-line native Input types reuse TextInput; no speculative DatePicker, Radio, Switch, Combobox or multi-select framework. Native multiple Select remains auto-height, not a32px listbox.

## Runtime override and migration

Authoritative public sizing points are --control-size-default/medium/large. --control-radius and --control-font-size remain public. State colors/focus tokens remain semantic public theme controls. Change a root size token to update that variant across actual compatible consumers; other variants retain their own size. Private mappings resolve at the control rather than inheriting a feature's shadowed defaults.

--control-height and old generic padding aliases are retired. Migrate theme overrides to the selected size token; remove feature-local control height/font/radius/padding declarations and direct button/input/select state overrides. Use explicit shared size/variant APIs. Feature CSS may own widths, positions and icon input padding, not shared height/min-height or hover/focus/disabled rules.

Tests assert32/40/48 as owner-defined acceptance values AND dynamically change public values to different measurements. Verify actual computed styles per consumer/variant, isolation, detached-consumer negatives and restoration of exact inline values/priorities plus computed baseline. Changing only test expectations cannot repair a hidden cascade defect.

## Typography, spacing and surfaces

| Role                             | Existing scale mapping               |
| -------------------------------- | ------------------------------------ |
| Page title                       | xl/bold/tight                        |
| Section heading                  | md/semibold/snug                     |
| Body / small body                | base/normal/normal; sm/normal/normal |
| Label / button label             | base/semibold/snug                   |
| Caption / table heading / status | sm with medium/semibold and snug     |

Semantic --type-\*-size aliases reference the existing scale, not a second font scale. Use canonical weight and line-height variables. Controls share --control-font-size; headings do not inherit control heights.

Use spacing2 for control gaps/field-label separation; spacing4 for form groups; toolbar padding3/gap2; surface standard padding6, compact4; table inline3/block2; dialog header/body/footer4; pagination3. Use root radius/shadow/border tokens; focus is a distinct role from border/error. Real local coordinates are allowed; arbitrary offsets that conceal a structural defect are not.

Panel/Card/Overlay/Drawer use semantic surface density, automatic content height and appropriate border/elevation. StatusBadge/Toast use semantic typography/padding and automatic height, not input-height constraints. Native Overlay remains the focus/top-layer/body-lock authority; no parallel trap.

## Canonical Color System

The canonical project color specification is owned by this document, and the actual runtime color definitions are owned by `apps/web/styles/tokens.css`. Components and shared UI primitives consume these semantic tokens.

### 1. Design Principles & Color Policy

- **Palette Fidelity Over Mandatory Contrast Gates**: The owner has explicitly decided to prioritize fidelity to the selected brand visual palette over mandatory WCAG AA color-contrast compliance. The combination of `#F58A24` background and `#FFFFFF` foreground text (contrast ~2.46:1) is an authorized design contract and must not be rejected on contrast thresholds alone.
- **Strict Role-Based Semantics**: Every production color has an explicit design role. Raw colors belong solely in the root foundation palette (`tokens.css`) and must never be hardcoded in feature CSS.
- **Three-Tier Token Architecture**: Foundation (raw values) → Semantic (application roles) → Component (private consumer mappings).
- **Prohibition of Automatic Palette Shifting**: Do not automatically darken backgrounds or change white text to navy to satisfy WCAG AA.
- **Non-Color Accessibility Invariant**: All other accessibility requirements remain strictly enforced: semantic HTML, accessible ARIA labels and states, keyboard navigation (Tab/Shift+Tab/Arrow navigation), 32px standard click targets, visible focus rings (`:focus-visible`), modal focus traps, and screen reader announcements.
- **Focus Indication & Non-Interactive Layout Surfaces**: Visible focus rings (`:focus-visible`) belong strictly to interactive controls (buttons, links, inputs, selects, textareas). Non-interactive programmatic focus containers, such as `<main id="workspace-content" tabIndex={-1}>` (`.contentArea`), receive programmatic focus during route transitions and skip-navigation without rendering visual focus outlines (`.contentArea:focus { outline: none; }`). This prevents unintended rectangular border artifacts around the main workspace surface while maintaining accessibility focus management and keyboard navigation flow.
- **Self-Contained Contract**: This specification is self-contained and independent of any external files or temporary archives.

### 2. Foundation Palette

| Color Role                   | Foundation Token      | Hex / Value               | Usage Intent                                           |
| :--------------------------- | :-------------------- | :------------------------ | :----------------------------------------------------- |
| **Brand Navy**               | `--brand-navy`        | `#172B4D`                 | Brand primary color, table headers, dark surfaces      |
| **Brand Orange**             | `--brand-orange`      | `#F58A24`                 | Primary brand accent, Add action, selected tab/page    |
| **Brand Orange Hover**       | `--brand-orange-dark` | `#E07716`                 | Hover state for orange actions                         |
| **White**                    | `--color-white`       | `#FFFFFF`                 | Surface default, action foreground text, badge text    |
| **Dark Heading**             | `--gray-900`          | `#0F172A`                 | Primary typography and headings                        |
| **Standard Body Text**       | `--gray-800`          | `#1F2937`                 | Standard readable text                                 |
| **Secondary Text**           | `--gray-600`          | `#475569`                 | Unselected tab/page text, inactive status text         |
| **Muted Text**               | `--gray-500`          | `#64748B`                 | Secondary metadata, dates, table subtitles             |
| **Placeholder / Muted Icon** | `--gray-400`          | `#94A3B8`                 | Input placeholder, deactivate power icon, inactive dot |
| **Light Surface**            | `--gray-50`           | `#F8FAFC`                 | Surface muted, table hover, subtle card background     |
| **Light Neutral Surface**    | `--gray-100`          | `#F1F5F9`                 | Surface subtle, inactive badge bg, deactivate hover bg |
| **Segmented Surface**        | `--gray-100`          | `#F1F5F9`                 | Segmented tab bar container background                 |
| **Standard Border**          | `--gray-300`          | `#CBD5E1`                 | Standard control borders, unselected page border       |
| **Subtle Border**            | `--gray-200`          | `#E2E8F0`                 | Subtle card borders, table dividers                    |
| **Emerald 50**               | `--emerald-50`        | `#ECFDF5`                 | Active status badge bg, activate power hover bg        |
| **Emerald 200**              | `--emerald-200`       | `#A7F3D0`                 | Active status badge border                             |
| **Emerald 500**              | `--emerald-500`       | `#10B981`                 | Active status dot                                      |
| **Emerald 600**              | `--emerald-600`       | `#059669`                 | Inactive customer power activate icon                  |
| **Emerald 700**              | `--emerald-700`       | `#047857`                 | Active status text, activate power hover fg            |
| **Slate 700**                | `--gray-700`          | `#334155`                 | Deactivate power hover fg                              |
| **Amber 50**                 | `--amber-50`          | `#FFFBEB`                 | Filter chip background                                 |
| **Amber 400 (60%)**          | `--amber-400-60`      | `rgba(251, 191, 36, 0.6)` | Filter chip border                                     |
| **Amber 700**                | `--amber-700`         | `#B45309`                 | Filter clear action text                               |
| **Amber 800**                | `--amber-800`         | `#92400E`                 | Filter chip text                                       |
| **Amber 900**                | `--amber-900`         | `#78350F`                 | Filter clear action hover text                         |

### 3. Semantic Component Color Contracts

#### Primary Accent Action (Add Customer / Primary Button)

| Property               | Token                          | Value                     |
| :--------------------- | :----------------------------- | :------------------------ |
| **Default Background** | `--color-accent`               | `#F58A24`                 |
| **Default Foreground** | `--color-text-on-accent`       | `#FFFFFF`                 |
| **Hover Background**   | `--color-accent-hover`         | `#E07716`                 |
| **Hover Foreground**   | `--color-text-on-accent-hover` | `#FFFFFF`                 |
| **Border**             | —                              | `transparent` (1px solid) |
| **Border Radius**      | `--control-radius`             | `6px` (`--radius-sm`)     |
| **Standard Height**    | `--control-size-default`       | `32px`                    |

#### Status Segmented Tabs (Customer)

| State / Element                   | Background Token                  | Background Value            | Foreground Token                    | Foreground Value |
| :-------------------------------- | :-------------------------------- | :-------------------------- | :---------------------------------- | :--------------- |
| **Selected Tab**                  | `--color-tab-selected-bg`         | `#F58A24`                   | `--color-tab-selected-text`         | `#FFFFFF`        |
| **Selected Tab Dot**              | —                                 | `#FFFFFF` (`--color-white`) | —                                   | —                |
| **Selected Count Badge**          | `--color-count-selected-bg`       | `rgba(255, 255, 255, 0.25)` | `--color-count-selected-text`       | `#FFFFFF`        |
| **Unselected Tab**                | `transparent`                     | `transparent`               | `--color-tab-unselected-text`       | `#475569`        |
| **Unselected Tab Hover**          | `--color-tab-unselected-hover-bg` | `rgba(255, 255, 255, 0.8)`  | `--color-tab-unselected-hover-text` | `#172B4D`        |
| **Unselected Count Badge**        | `--color-count-unselected-bg`     | `#FFFFFF`                   | `--color-count-unselected-text`     | `#475569`        |
| **Active Tab Dot (Unselected)**   | —                                 | `#10B981` (`--emerald-500`) | —                                   | —                |
| **Inactive Tab Dot (Unselected)** | —                                 | `#94A3B8` (`--gray-400`)    | —                                   | —                |

#### Status Line TabBar (Shared Line TabBar — Retail Packages)

| State / Element            | Indicator / Underline Token  | Indicator Value | Text Token                           | Text Value | Background Token                   | Background Value |
| :------------------------- | :--------------------------- | :-------------- | :----------------------------------- | :--------- | :--------------------------------- | :--------------- |
| **Selected Tab**           | `--color-tab-line-indicator` | `#F58A24`       | `--color-tab-line-selected-text`     | `#1F2937`  | `transparent`                      | `transparent`    |
| **Unselected Tab**         | —                            | —               | `--color-tab-line-unselected-text`   | `#64748B`  | `transparent`                      | `transparent`    |
| **Unselected Tab Hover**   | —                            | —               | `--color-tab-line-selected-text`     | `#1F2937`  | `--color-tab-line-hover-bg`        | `#F8FAFC`        |
| **Selected Count Badge**   | —                            | —               | `--color-count-line-selected-text`   | `#C2410C`  | `--color-count-line-selected-bg`   | `#FFF7ED`        |
| **Unselected Count Badge** | —                            | —               | `--color-count-line-unselected-text` | `#64748B`  | `--color-count-line-unselected-bg` | `#F1F5F9`        |
| **Track Border / Divider** | —                            | —               | —                                    | —          | `--color-tab-line-border`          | `#E2E8F0`        |

##### Active Status Icon Palette (Retail Status Tabs)

| Tab Key      | Status Name       | Lucide Icon     | Active Color Token                   | Active Resolved Hex     | Inactive Color Token                           |
| :----------- | :---------------- | :-------------- | :----------------------------------- | :---------------------- | :--------------------------------------------- |
| `all`        | Tất cả kiện hàng  | `Layers`        | `--color-retail-tab-all-icon`        | `#172B4D` (Navy)        | `--color-tab-line-unselected-text` (`#64748B`) |
| `to_origin`  | Đang đến kho gửi  | `Truck`         | `--color-retail-tab-to-origin-icon`  | `#B45309` (Amber 700)   | `--color-tab-line-unselected-text` (`#64748B`) |
| `at_origin`  | Đã về kho gửi     | `Building2`     | `--color-retail-tab-at-origin-icon`  | `#1D4ED8` (Blue 700)    | `--color-tab-line-unselected-text` (`#64748B`) |
| `in_transit` | Đang về kho nhận  | `Plane`         | `--color-retail-tab-in-transit-icon` | `#4338CA` (Indigo 700)  | `--color-tab-line-unselected-text` (`#64748B`) |
| `at_dest`    | Đã về kho nhận    | `Warehouse`     | `--color-retail-tab-at-dest-icon`    | `#047857` (Emerald 700) | `--color-tab-line-unselected-text` (`#64748B`) |
| `delivered`  | Đã giao hàng      | `CheckCircle2`  | `--color-retail-tab-delivered-icon`  | `#0F766E` (Teal 700)    | `--color-tab-line-unselected-text` (`#64748B`) |
| `disputed`   | Khiếu nại / Xử lý | `AlertTriangle` | `--color-retail-tab-disputed-icon`   | `#BE123C` (Rose 700)    | `--color-tab-line-unselected-text` (`#64748B`) |

#### Pagination Page Controls

| State / Element           | Background Token                   | Background Value | Foreground Token                     | Foreground Value | Border Token / Value           |
| :------------------------ | :--------------------------------- | :--------------- | :----------------------------------- | :--------------- | :----------------------------- |
| **Selected Page**         | `--color-pagination-selected-bg`   | `#F58A24`        | `--color-pagination-selected-text`   | `#FFFFFF`        | `#F58A24`                      |
| **Selected Page Hover**   | `--color-action-emphasis-hover`    | `#E07716`        | `--color-pagination-selected-text`   | `#FFFFFF`        | `#E07716`                      |
| **Unselected Page**       | `--color-pagination-unselected-bg` | `#FFFFFF`        | `--color-pagination-unselected-text` | `#475569`        | `#CBD5E1` (`--gray-300`)       |
| **Unselected Page Hover** | `--color-surface-muted`            | `#F8FAFC`        | `--color-primary`                    | `#172B4D`        | `#CBD5E1`                      |
| **Navigation Buttons**    | `--color-surface`                  | `#FFFFFF`        | `--color-text`                       | `#1F2937`        | `--control-border` (`#CBD5E1`) |

#### Power Status Actions

| Customer Status                         | State   | Icon Color Token                  | Icon Value | Background Token                     | Background Value |
| :-------------------------------------- | :------ | :-------------------------------- | :--------- | :----------------------------------- | :--------------- |
| **ACTIVE Customer** (Deactivate action) | Default | `--color-action-deactivate`       | `#94A3B8`  | `transparent`                        | `transparent`    |
| **ACTIVE Customer** (Deactivate action) | Hover   | `--color-action-deactivate-hover` | `#334155`  | `--color-action-deactivate-hover-bg` | `#F1F5F9`        |
| **INACTIVE Customer** (Activate action) | Default | `--color-action-activate`         | `#059669`  | `transparent`                        | `transparent`    |
| **INACTIVE Customer** (Activate action) | Hover   | `--color-action-activate-hover`   | `#047857`  | `--color-action-activate-hover-bg`   | `#ECFDF5`        |

#### Status Badges

| Status       | Background Token            | Background Value | Text Token                    | Text Value | Border Token                    | Border Value | Dot Token / Value                        |
| :----------- | :-------------------------- | :--------------- | :---------------------------- | :--------- | :------------------------------ | :----------- | :--------------------------------------- |
| **Active**   | `--color-status-success-bg` | `#ECFDF5`        | `--color-status-success-text` | `#047857`  | `--color-status-success-border` | `#A7F3D0`    | `#10B981` (`--color-status-success-dot`) |
| **Inactive** | `--color-status-pending-bg` | `#F1F5F9`        | `--color-status-pending-text` | `#475569`  | `--color-status-pending-border` | `#CBD5E1`    | `#94A3B8` (`--color-status-pending-dot`) |

#### Search, Filter Chip & Table Geometry

Customer search icon uses `--color-search-icon` (`#94A3B8`); search input uses shared `--control-bg` and `--control-border` (with normal shared focus semantics). Customer status dots use `--color-status-success-dot`/`--color-status-pending-dot`; these are semantic roles mapped to the same existing foundation colors. Table header and cells retain only horizontal bottom-row separators; no vertical gridlines. The table's scroll region keeps its `:focus-visible` indicator, separate from non-interactive main content.

| Element                      | Background Token         | Background Value            | Foreground Token            | Foreground Value            | Border Token / Value                                                      |
| :--------------------------- | :----------------------- | :-------------------------- | :-------------------------- | :-------------------------- | :------------------------------------------------------------------------ |
| **Search Input**             | `--control-bg`           | `#F8FAFC`                   | `--color-text` (`#1F2937`)  | Placeholder `#94A3B8`       | `--control-border` (`#CBD5E1`)                                            |
| **Filter Chip ("Đang lọc")** | `--color-filter-chip-bg` | `#FFFBEB`                   | `--color-filter-chip-text`  | `#92400E`                   | `rgba(251, 191, 36, 0.6)`                                                 |
| **Filter Clear Action**      | `transparent`            | `transparent`               | `--color-filter-chip-clear` | `#B45309` (hover `#78350F`) | `none`                                                                    |
| **Detail Link (Eye)**        | `--color-surface-subtle` | `#F1F5F9` (hover `#172B4D`) | `--color-text-muted`        | `#64748B` (hover `#FFFFFF`) | `none` (radius 6px)                                                       |
| **Table Header**             | `--color-primary`        | `#172B4D`                   | `--color-text-on-dark`      | `#FFFFFF`                   | Bottom divider: `1px solid var(--color-border)`; no vertical cell borders |
| **Table Rows**               | `--color-surface`        | `#FFFFFF` (hover `#F8FAFC`) | `--color-text`              | `#1F2937`                   | Bottom divider only: `1px solid var(--color-border)`                      |

### 4. Governance & Token Change Approval

1. **Token Authority**: Root `apps/web/styles/tokens.css` is the sole source of raw colors and public semantic variables. Feature CSS modules must consume `var(--token)`.
2. **Plan-first change governance (ADR-009)**: Record scoped inspection, reuse audit, implementation plan and verification; no authenticated owner approval or GitHub comment is required. Preserve immutable historical snapshots and existing plan/digest bindings.
3. **Automated Regression Verification**:
   - `apps/web/test/form-control-contracts.test.mjs` verifies token acyclicity, CSS policy compliance (zero raw colors in CSS modules), and canonical palette token bindings.
   - `scripts/customer-control-checks.mjs` verifies actual rendered computed styles match canonical tokens for all default and hover interaction states.
   - Dynamic runtime overrides verify that altering a root custom property propagates to all consumers.

## Shared workspace and asynchronous feedback migration

Keyed read/statistics retention, nine-column colgroup/Skeleton and modal-aware Toast are implemented in v3 stages 2–4; browser verification remains pending. Standard/wide frame migration is implemented in stage 5; final browser geometry remains required. Source implementation is not runtime PASS. Do not create LayoutProvider/global state manager, Customer-only Toast or stats hook/request.

The frame contract uses the same Header/content inline gutters 24 desktop / 16 ≤ 900 / 12 ≤ 600, standard max-width 1600 including gutters and wide unrestricted; preserve sidebar 240/72, Header 56 and SSR/mobile behavior. Customer owns column geometry and backend-field truth; shared UI owns generic interaction. Exact backend row/address/status/session rules remain outside this document.

## Reuse, policy and verification

Before any UI change inspect this document and the registry, search actual consumers and choose reuse. Changes to shared defaults require consumer impact and regression verification. Extend the existing CSS declaration/context parser rather than regex-only policy or blanket exceptions. Enforce token existence/cycles/semantic roles, legitimate component mappings and no feature-shadowed public sizes; include negative and valid-future-module tests. No new Python tooling.

Use native Node discovery and existing Chromium CDP session. Test three sizes/omission, type/ref compatibility, native fields, multiline/checkbox behavior, real pointer/keyboard states, public overrides and negative contrast/ownership cases. Full quality/contracts/build/genuine Docker/API/DB/MFA/runtime/HTTPS/data/dev and final-head hosted evidence remain mandatory. Visual acceptance requires opening actual images and DOM measurements at the ten approved viewports, with source/merge lineage and explicit reference differences. Unit or overflow PASS is insufficient.

Exceptions need a concrete consumer/rationale, owner/path, compatibility impact, tests and approved design delta where material. Do not edit approved snapshots. Rollback uses focused source/test/doc commits together, never security assertions, keys or data resets. Current stage outcomes and failures are recorded in task 031 and PR 28.

### Shared Toast and asynchronous outcomes

ToastProvider/useToast/Toast/ToastViewport are neutral UI exports. Workspace owner-keyed provider keeps one bounded/deduplicated queue (3 visible/6 queued), safe text, explicit dismissal, persistent errors and pausable success timers. An open native Overlay registers the sole active viewport so notifications remain inside its top-layer/inert boundary; no provider preserves existing Overlay behavior. Toast does not steal focus. Modal notification placement, pointer/keyboard dismissal, timers and session cleanup require actual browser acceptance.

Customer List/Detail/forms classify API errors with their existing safe mapper and preserve essential inline descriptions. Toast announces API errors once; inline Feedback uses a non-live data-customer-error marker when already announced. Browser gates still assert surface errors and, in API negative cases, an actual error Toast; persistent historical Toasts do not make an otherwise settled surface erroneous. 401 clears retained rows/stats/dialogs/notifications before redirect; generic denial stays latched through failed refresh until accepted success. Power uses a synchronous table-wide gate, not React state as a lock; confirmed write and read reconciliation have separate outcomes and Retry.

### Workspace frame implementation (v3 stage 5)

Canonical navigation metadata supplies `contentVariant`: Customer list/detail use `wide`; Overview/System/Settings use `standard`. Resolution uses the longest available ancestor and rejects prefix near-matches. Unknown routes fall back to standard. `WorkspaceFrame.module.css` owns both Header inner and main frames, centered at 1600px including gutters for standard, unlimited for wide. Root gutter tokens are 24px desktop, 16px at ≤900px and 12px at ≤600px. MainWrapper owns vertical scrolling, so its scrollbar reduces both frames together; Header remains sticky at 56px. Customer no longer selects padding through a pathname-specific CSS class. Sidebar widths/breakpoints and mobile Overlay behavior remain the existing contract. Browser geometry across variants and Sidebar states remains required evidence.

### Customer emphasis and Panel composition (v3 stage 6)

Customer Create, selected tabs, selected pagination and primary drawer/confirmation controls use shared `primary` / `emphasis` (`#F58A24` orange background, `#FFFFFF` white foreground); Login/MFA keep default primary. Selected count/dot colors follow the canonical white foreground contract. Actual composed-color, hover and focus measurements are still required; palette calculations alone are not browser evidence.

Panel accepts existing title/children/className plus optional `density` and `actions`. `standard` remains the default; `compact` uses the shared compact surface spacing and heading divider, without outer margin. Customer profile and address sections consume this shared composition; their duplicate card/heading paint was removed. The search field advertises name, code, phone.

Disabled Input/Textarea presentation takes precedence when readonly and invalid are also present; those enabled-state rules exclude `:disabled`. Genuine state probes wait real CSS transitions, verify focus/invalid-focus distinction and compare the combined disabled presentation, restoring native attributes/focus afterward.

Fixed-column Customer name/email text wraps within the column and retains complete DOM text plus keyboard Detail links; it cannot paint over neighboring columns. The same native colgroup owns row/Skeleton/header widths. Browser Range checks validate both padded header text and actual data-cell content, including long fixtures.

Pending/inactive status text uses its semantic pending foreground mapped to gray-600 (`#475569`), with light background `#F1F5F9` and border `#CBD5E1`. Active status uses emerald-50 (`#ECFDF5`), emerald-700 (`#047857`) text, and emerald-200 (`#A7F3D0`) border.

Retained Customer statistics keep fresh/stale/unavailable metadata without adding visible stale text to the tabbar. Tab contents remain geometrically identical on same-scope refresh; sr-only status and existing table/Toast errors communicate loading or failed reconciliation. Counts remain backend-authoritative and cannot cross owner/search/phone scope. An ambiguous Power response does not establish write failure: retain the table gate through authoritative GET settlement, block on read failure and offer GET-only reconciliation rather than repeating PATCH.

### Customer Table Skeleton & Loading Presentation Contract (NEXORA-031)

The Customer table skeleton loading state is governed by a unified geometry and semantic placeholder contract that eliminates visual movement, jumps, and layout shifts during transitions between loading and loaded data:

1. **Geometry Single Source of Truth**:
   - `columns.ts` (`customerColumns`) owns the 9-column widths (`detail: 80px`, `code: 144px`, `name: 240px`, `phone: 152px`, `email: 200px`, `addresses: 104px`, `status: 156px`, `created: 128px`, `actions: 104px`; min-width 1312px).
   - Real rows, empty state, and skeleton rows share the exact same `<colgroup>` and `<th>` boundaries (verified agreement within < 0.5px).
   - The approved contract specifies a fixed 5-row skeleton (`Array.from({ length: 5 })`). Measured across 0, 1, 2, 3, 5, and 10 result sets, the card-anchored footer remains stable at exactly 588px (0px shift).

2. **Per-Column Semantic Shape & Alignment Registry**:
   - **Detail Icon (`detail`, 80px)**: 26px × 26px square (`var(--radius-sm)`), centered horizontally (`margin-inline: auto`), matching the 26px Eye icon button.
   - **Customer Code (`code`, 144px)**: 88% width × 16px bar (`var(--radius-sm)`), centered horizontally (`margin-inline: auto`, 105.1px on 120.4px usable content box, gap diff 0.00px), matching monospace code links.
   - **Customer Name (`name`, 240px)**: 90% width × 16px bar (`var(--radius-sm)`), centered horizontally (`margin-inline: auto`, 194.1px on 216.7px usable content box, gap diff 0.015px), matching primary customer names.
   - **Phone Number (`phone`, 152px)**: 88% width × 16px bar (`var(--radius-sm)`), centered horizontally (`margin-inline: auto`, 112.2px on 128.5px usable content box, gap diff 0.015px), matching tabular-nums telephone format.
   - **Email (`email`, 200px)**: 90% width × 16px bar (`var(--radius-sm)`), centered horizontally (`margin-inline: auto`, 158.0px on 176.6px usable content box, gap diff 0.00px), matching customer email strings.
   - **Address Count (`addresses`, 104px)**: 44px × 20px pill (`var(--radius-full)`), centered horizontally (`margin-inline: auto`, gap diff 0.00px), matching the MapPin count badge.
   - **Status Badge (`status`, 156px)**: 104px × 22px chip (`var(--radius-sm)`), centered horizontally (`margin-inline: auto`, gap diff 0.00px), matching the status badge.
   - **Created Date (`created`, 128px)**: 85% width × 16px bar (`var(--radius-sm)`), centered horizontally (`margin-inline: auto`, 87.9px on 104.4px usable content box, gap diff 0.015px), matching tabular-nums date text.
   - **Actions (`actions`, 104px)**: Two 32px × 32px button placeholders (`var(--control-radius)`) inside `.actionGroup` with 4px gap (`var(--space-1)`), centered horizontally (`vertical-align: middle`, gap diff 0.50px), matching Edit and Power controls.

3. **Row Height & Layout Invariants**:
   - Both skeleton and real data rows compute to exactly 44.5px height (zero vertical row shift).
   - All 9 columns maintain balanced horizontal margins (`abs(leftGap - rightGap) <= 1px`, verified <= 0.52px in Chromium CDP) relative to the usable content box excluding cell padding.
   - Skeleton placeholders use `margin-block: 0`, resting inside cell padding boxes (`padding: 6px var(--space-3)`, and `padding: 6px var(--space-1)` for detail).
   - Centered column centers agree with real cell content centers within < 0.25px (0.00px shift on detail, addresses, actions; 0.01px on status, created).
   - Long text rows (name up to 200 characters, email up to 254 characters) wrap cleanly via `overflow-wrap: anywhere` and expand vertically as needed without clipping or horizontal column leakage.

4. **Lifecycle & State Fencing**:
   - Initial query execution renders the 5-row skeleton.
   - Same-query revalidation retains active real rows with `data-stale` styling, preventing skeleton flicker.
   - Query modifications (search key, status filter, pagination) invalidate stale records immediately; prior query data is never displayed.
   - Responsive scrolling is contained inside `.tableViewport`, preventing body horizontal overflow while preserving footer stability.

## Retail column picker corrective contract (M3 v6)

The Retail unselected option label uses the feature-scoped semantic token
`--color-colpicker-option-unselected-text` → `--gray-400` (`#94A3B8`). Shared
SelectButton stacked defaults and the global `--color-text-muted` (`#64748B`)
remain unchanged. Selected/required labels remain primary navy; required tracking
is bold with its amber badge. The popup uses `--radius-lg` (12px), maximum336px
width,12px padding,8px gaps and a scrollable208px checklist.

Column search composes TextInput and a ghost icon Button with the standard32px
square target. Feature CSS owns only clear-button positioning and input accessory
padding; shared Button owns hover/focus/disabled states. Clear preserves column
selection, keeps the disclosure open, and returns focus to the search input. Native
search cancel is suppressed so the two clear mechanisms do not overlap.

SelectButton's `appearance` belongs only to single/segmented props. Multiple/stacked
rejects concrete appearance values (`appearance?: never`), preserving its existing
DOM/default styling. This is the correction of the formerly accepted silent no-op,
not a new multiple-selection appearance.
