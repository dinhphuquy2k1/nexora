# NEXORA-031 immutable design amendment — Retail Packages UI M3 v2 (Shared Line TabBar)

Task ID: NEXORA-031
Plan revision: rev-2026-10-30-retail-packages-m3-v2
Reviewed baseline: ea4fcfaa6d94516cb2e7dc90700f8d5a7c69cfee

Captured on 2026-10-30 (Asia/Saigon). This artifact contains selected design decisions, not execution evidence. It amends the visual and technical presentation contract of the status tabs in Milestone M3 (Retail Packages UI), superseding the Segmented Tabs decision of M3 v1 while preserving all existing Customer UI, AppShell, and Shipments domain boundaries. Do not alter this snapshot after creation.

## 1. Task Metadata & Classification

- Classification: SIGNIFICANT. Documentation Impact: REQUIRED.
- Tracking: Active NEXORA-031, Full Frontend Migration M1–M5. Milestone M3 — Retail Packages UI (Kiện lẻ TMĐT).
- Branch: `feat/retail-packages-ui` (current PR #29 branch); target branch: `main`.
- Baseline HEAD: `ea4fcfaa6d94516cb2e7dc90700f8d5a7c69cfee`.
- Reference Archive: "C:\Users\wayyk\Downloads\remix-nexora-logistics-management.zip" (also provided as `remix-nexora-logistics-management(1).zip`)
  - Archive SHA-256: `3eacbe20ffcef1a87741b3914bcc35870a7a71bada05026ff7679342b63fb7f4`
  - `src/components/RetailPackagesView.tsx` SHA-256: `15589a3957844e1fb057c8c54feaa82f5de0be08e0f2d81119366f37c60f51bc`
  - `src/data/retailPackagesData.ts` SHA-256: `df671b752b40631bb3635f9708d1f3b8778121793f51591c6e18b6c4d96fe67c`

## 2. Requirements & Boundary Scope

Port and establish the canonical Shared Line TabBar in `@nexora/ui` and integrate it into the Retail Packages management view:

- Shared Line TabBar: A reusable atomic UI primitive under `@nexora/ui` (`packages/ui/src/TabBar.tsx`, `packages/ui/src/TabBar.module.css`) implementing the Line (underline) tab presentation pattern from the reference ZIP.
- Single Display Style (Line-Only): Only the Line TabBar is implemented. No capsule tabs, pipeline stepper tabs, KPI cards tabs, style switcher dropdowns, or speculative `variant` abstractions.
- Controlled Selection Pattern: `value` is the single source of truth for the selected tab; `onValueChange` is triggered only when a different, non-disabled tab is selected. Selecting the already-active tab is a no-op.
- Custom Trailing Slot: `renderTrailing?: (item: TabBarItem<T>, state: { active: boolean }) => ReactNode` allows rendering badges, counters, or actions per tab item without leaking domain state into `@nexora/ui`.
- Shared TabCountBadge: Standardized badge component (`packages/ui/src/TabCountBadge.tsx`) supporting exact counts (including `0`), uncounted states (`undefined` renders em-dash `—`), tabular numbers, and stable height to prevent layout shift.
- Manual Keyboard Activation (W3C APG Tabs Pattern): Arrow keys (Right, Left, Home, End) move roving DOM focus between available tabs without selecting them or firing `onValueChange`, URL changes, or API calls. `Enter` or `Space` activates the currently focused tab.
- Horizontal Scrolling & Overflow Controls: Responsive single-row track with container-relative smooth scrolling, dynamic left/right navigation scroll buttons when overflow occurs, and `ResizeObserver` lifecycle management with clean teardown. Scroll buttons never overlay tab titles or trailing badges.
- Dedicated Line Semantic Tokens: Clean design tokens added to `apps/web/styles/tokens.css` mapping to the existing foundation palette without hardcoded HEX values or modifying Customer segmented tab tokens.
- Retail Packages Integration: Replace inline status button map in `RetailPackageListPage.tsx` with `<TabBar>` and `<TabCountBadge>`, updating labels to match the reference ZIP ("Tất cả kiện hàng", "Đang đến kho gửi", "Đã về kho gửi", "Đang về kho nhận", "Đã về kho nhận", "Đã giao hàng", "Khiếu nại / Xử lý") with Lucide icons (`Layers`, `Truck`, `Building2`, `Plane`, `Warehouse`, `CheckCircle2`, `AlertTriangle`).
- Full 7-Key Status Counts: Initialize counts for all 7 statuses to 0 when data is available (never `undefined`), and `undefined` (rendered as `—`) when availability is `unavailable`.

Explicit non-goals:

- No capsule, pipeline, cards, or KPI tab styles.
- No UI style switcher dropdown or `variant` prop.
- No global TabBar state, React Context, or local storage persistence inside TabBar.
- No API fetching or URL/History API synchronization inside TabBar.
- No modification of Customer UI Segmented Tabs contract or tokens in this PR.
- No Shipment backend CRUD implementation or database migrations.
- No Carrier Provider API integration (M4).

## 3. Mandatory Eight-Field Reuse & Design Audit Matrix

| Component                | Existing implementations                                                  | Domain owner              | Reuse alternatives                                                         | Selected approach                                                           | Rationale                                                                                                               | Risks                                                                            | Verification                                                               |
| :----------------------- | :------------------------------------------------------------------------ | :------------------------ | :------------------------------------------------------------------------- | :-------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------- | :------------------------------------------------------------------------- |
| **Shared TabBar**        | Inline button map in `RetailPackageListPage.tsx`, `CustomerStatsBar.tsx`  | `@nexora/ui` (Tier A)     | Duplicate inline tabs across features; create monolithic feature component | Atomic `TabBar` and `TabCountBadge` in `@nexora/ui`                         | Promotes DRY UI presentation, standardizes W3C APG accessibility, and unifies responsive scrolling                      | Potential over-abstraction if feature-specific requirements bleed into primitive | Component contract tests, SSR render tests, and CDP browser tests          |
| **Tab Item Trigger**     | `Button` in `packages/ui/src/Controls.tsx`                                | `@nexora/ui`              | Reuse shared `Button` with variant `ghost`; raw buttons in feature         | Encapsulated native `<button type="button" role="tab">` inside `TabBar.tsx` | Shared `Button` imposes standard 32px height, border, and press-scale transforms incompatible with underline indicators | Loss of shared control styling if leaked                                         | Native button strictly internal to `@nexora/ui/TabBar.tsx`; boundary tests |
| **Tab Badge**            | Inline span badges in `RetailPackageListPage.tsx`, `CustomerStatsBar.tsx` | `@nexora/ui`              | Inline `<span>` per screen; customize StatusBadge                          | Shared `TabCountBadge` in `@nexora/ui`                                      | Enforces tabular nums, stable height, zero layout shift (9->10->100), and semantic Line colors                          | Inconsistent `undefined` vs `0` rendering across features                        | Unit tests for 0, positive integers, and `undefined` displaying `—`        |
| **Horizontal Scrolling** | Custom scroll container in ZIP `RetailPackagesView.tsx`                   | `@nexora/ui`              | Unconstrained CSS overflow; external scroll library                        | Encapsulated scroll track with left/right buttons and `ResizeObserver`      | Pure CSS and native DOM APIs prevent external dependency bloat and guarantee clean teardown                             | Memory leak from unremoved event listeners; button overlay obstruction           | Explicit cleanup in `useEffect`, headless viewport overflow checks         |
| **Keyboard Interaction** | Automatic activation on Arrow keys in M3 v1 and Customer M2               | Shared UI Accessibility   | Automatic activation; roving tabIndex without manual activation            | Manual keyboard activation (Arrows move focus; Enter/Space selects)         | W3C APG Tabs best practice prevents premature URL mutations and API load during keyboard scanning                       | Inconsistent behavior with Customer M2                                           | Intentional behavior change documented; CDP keyboard tests                 |
| **Design Tokens**        | Segmented tokens `--color-tab-selected-bg` (#F58A24) in `tokens.css`      | Design System / Web       | Reuse Segmented tokens; hardcode HEX in module CSS                         | Add dedicated Line tokens `--color-tab-line-*` and `--color-count-line-*`   | Line tabs render active tab on light background with orange underline, not solid orange background                      | Semantic token proliferation                                                     | `form-control-contracts.test.mjs` token definition and cycle validation    |
| **Retail Integration**   | Inline `.statusBand` in `RetailPackageListPage.tsx`                       | Retail Feature (Tier C)   | Keep inline JSX; adapt CustomerStatsBar                                    | Replace with `TabBar` and `TabCountBadge` adapter                           | Clean decoupling; parent owns query state, filter change, and URL sync                                                  | Regressions in existing filter/query serialization                               | Retail integration tests, filter popover tests, and URL sync tests         |
| **Customer Boundary**    | `CustomerStatsBar.tsx` using Segmented Tabs                               | Customer Feature (Tier C) | Migrate Customer to Line TabBar immediately                                | Preserve Customer Segmented Tabs completely unchanged                       | Prevents regression of merged M2 visual contract; Customer migration requires separate design review                    | Inadvertent Customer style override via shared tokens                            | Customer regression test suite execution                                   |

## 4. Public Component Contract

### `packages/ui/src/TabBar.tsx`

```typescript
import type { ReactNode } from "react";

export interface TabBarItem<T extends string> {
  id: T;
  title: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface TabBarProps<T extends string> {
  items: readonly TabBarItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  renderTrailing?: (
    item: TabBarItem<T>,
    state: { active: boolean },
  ) => ReactNode;
  idPrefix: string;
  panelId: string;
  ariaLabel: string;
}
```

### `packages/ui/src/TabCountBadge.tsx`

```typescript
export interface TabCountBadgeProps {
  value?: number;
  active?: boolean;
}
```

Rules:

- `value === 0` -> renders `"0"`
- `value > 0` -> renders stringified count
- `value === undefined` -> renders em-dash `"—"` (`\u2014`)
- Font variant: `tabular-nums`
- Stable dimensions to eliminate layout shifts across count updates.

## 5. Keyboard, Focus & Scrolling Specification

### Manual Keyboard Activation (W3C APG Pattern)

- `ArrowRight`: Focuses the next enabled tab. If on the last tab, wraps to the first enabled tab. Selection and URL do not change.
- `ArrowLeft`: Focuses the previous enabled tab. If on the first tab, wraps to the last enabled tab. Selection and URL do not change.
- `Home`: Focuses the first enabled tab. Selection and URL do not change.
- `End`: Focuses the last enabled tab. Selection and URL do not change.
- `Enter` / `Space`: Activates the currently focused tab, invoking `onValueChange(focusedId)`. Native click duplication is prevented.
- Tab navigation (`Tab` / `Shift+Tab`): Leaves the tablist according to standard tab order. When entering the tablist, focus lands on the currently selected tab (or last focused tab).
- External `value` change (e.g. browser Back/Forward): Updates `aria-selected="true"` and base `tabIndex={0}` without stealing DOM focus.

### Horizontal Scrolling & Layout

- Track: Single row, `white-space: nowrap`, `overflow-x: auto`, hidden scrollbars, `touch-action: pan-x`.
- Navigation Buttons: Rendered conditionally when overflow is detected (`canScrollLeft`, `canScrollRight`). Accessible labels (`Cuộn sang trái`, `Cuộn sang phải`).
- Non-Obstructive Layout: Buttons reside in dedicated flex control slots or positioned without obscuring the active underline, tab text, or trailing badge.
- Selected Tab Visibility: When `value` changes, the container scrolls smoothly to bring the active tab into view using container-relative offsets (`scrollLeft`), avoiding page-level vertical jumping (`scrollIntoView`).
- Lifecycle: `ResizeObserver` and scroll listener with passive flag and explicit disconnect/cleanup on component unmount. Reduced motion preferences are respected.

## 6. Semantic Design Tokens

Added to `apps/web/styles/tokens.css`:

```css
/* Status line tab semantics */
--color-tab-line-indicator: var(--color-accent);
--color-tab-line-selected-text: var(--color-text);
--color-tab-line-unselected-text: var(--color-text-muted);
--color-tab-line-hover-bg: var(--color-surface-muted);
--color-tab-line-border: var(--color-border);

/* Count badge line semantics */
--color-count-line-selected-bg: var(--color-accent-light);
--color-count-line-selected-text: var(--brand-orange-text);
--color-count-line-unselected-bg: var(--color-surface-subtle);
--color-count-line-unselected-text: var(--color-text-muted);
```

## 7. Tactical DDD Boundaries & Domain Invariants

- Domain Invariant: Presentation-only tabs. The status codes (`all`, `to_origin`, `at_origin`, `in_transit`, `at_dest`, `delivered`, `disputed`) in `columns.ts` are presentation query filters, not persisted database domain entities.
- Truthful Availability: When shipment data is unavailable (`availability="unavailable"`), counts evaluate to `undefined` and render honest em-dash badges (`—`). No synthetic mocks or simulated backend numbers are rendered in production.
- Architectural Boundaries: `@nexora/ui` contains zero imports from `apps/web` or `@nexora/database`. `apps/web` consumes `@nexora/ui` components through clean public exports.

## 8. Verification & Acceptance Plan

1. **Component & Contract Tests**:
   - `packages/ui/test/tabbar.test.mjs`: Verify `@nexora/ui` exports, SSR rendering of items, title, icon, trailing slot, ARIA attributes (`role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`), roving `tabIndex`, disabled item handling, and `TabCountBadge` values (0, >0, undefined).
2. **Design Token Tests**:
   - `apps/web/test/form-control-contracts.test.mjs`: Verify mandatory Line semantic tokens in `tokens.css`, token resolution, absence of raw HEX in `TabBar.module.css`, and preservation of Customer segmented tokens.
3. **Retail Integration & Browser Smoke**:
   - `apps/web/test/retail-packages.test.mjs`: Verify retail status tabs configuration, count calculations, and query filters.
   - `scripts/retail-browser-checks.mjs`: Verified via headless Chromium/CDP:
     - Manual keyboard activation: ArrowRight moves focus without selection change; Enter activates tab and updates count/URL once.
     - Mouse click: Activates tab without layout shift or unwanted scale.
     - Horizontal scrolling: Scroll controls appear on overflow, scrolling updates `scrollLeft`, and active tab is brought into view.
4. **Non-Regression**:
   - Customer UI tests and AppShell/Navigation tests pass without modification.
5. **Quality Gates**:
   - `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm docs:check`, `pnpm preflight:check`, `node scripts/boundaries.mjs`.
