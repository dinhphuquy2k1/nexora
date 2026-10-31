# NEXORA-031 immutable design amendment — Retail Packages UI M3 v3 (Visual Parity, Typography, Border Ownership & Active Icon Tone Refinement)

Task ID: NEXORA-031
Plan revision: rev-2026-10-30-retail-packages-m3-v3
Reviewed baseline: 3fb9ea72b356313848219e9e470fbde2f2f49a58
Reference ZIP: remix-nexora-logistics-management.zip
Reference ZIP SHA-256: 3eacbe20ffcef1a87741b3914bcc35870a7a71bada05026ff7679342b63fb7f4
Classification: MATERIAL VISUAL REVISION
Documentation Impact: REQUIRED

---

## 1. Context & Motivation

Following the implementation of the shared Line TabBar in M3 v2 (PR #29), visual inspection against the reference ZIP (`remix-nexora-logistics-management.zip`) and owner interface captures revealed specific visual parity divergences:

1. **Border Ownership & Spacing**:
   - The Page Header (`.titleRow`) lacked a bottom separator above the TabBar.
   - The TabBar wrapper introduced an unwanted 8px bottom margin (`margin: 0 0 var(--space-2)`).
   - The Toolbar included a top border (`border-top: 1px solid var(--color-border)`), creating a double border and visual gap below the TabBar.
2. **Typography**:
   - Tab title font-size was 11px (`--font-size-xs`), which is too small for prominent navigation.
   - Tab badge font-size was 10px (`--font-size-2xs`).
   - Active tab changed font-weight from 600 to 700, causing micro layout shift.
3. **Active Icon Colors**:
   - All active tab icons defaulted to brand orange (`var(--color-tab-line-indicator)`).
   - The reference ZIP specifies distinct semantic accent tones for each status icon when active (Navy, Amber 700, Blue 700, Indigo 700, Emerald 700, Teal 700, Rose 700) while unselected icons remain muted.
4. **Count Badge Default Presentation**:
   - M3 v2 rendered `—` when backend availability is unavailable.
   - Owner requirement: default badge count presents `0` rather than `—`, while preserving explicit semantic distinction between placeholder presentation and authoritative synchronized backend counts.

This snapshot (M3 v3) supersedes M3 v2 specifically for these presentation and layout aspects. It preserves all architectural boundaries, manual keyboard activation, controlled selection, and Customer UI independence.

---

## 2. Border Ownership Contract

To ensure visual consistency and modularity across all screens:

- **Page Header (`.titleRow`)**: Owns `border-bottom: 1px solid var(--color-border);` separating Header from TabBar.
- **Shared TabBar (`.tabBar`)**: Owns single `border-bottom: 1px solid var(--color-tab-line-border);` separating TabBar from Toolbar.
- **TabBar Wrapper (`.tabBarWrapper`)**: Owns `margin: 0;` and no borders.
- **Toolbar (`.toolbar`)**: Owns `border-top: none;` avoiding redundant dividing lines.

---

## 3. Typography & Sizing Specification

- **Tab Title**: Font-size normalized to 14px (`var(--font-size-md)`), font-weight fixed at 600 (`var(--font-weight-semibold)`).
- **Tab Active State**: Font-weight remains 600 (`var(--font-weight-semibold)`) to prevent width expansion and layout shift. Active state indicated via brand orange underline (2px) and selected text color (`var(--color-tab-line-selected-text)`).
- **Count Badge**: Font-size normalized to 12px (`var(--font-size-sm)`), tabular figures (`tabular-nums`), min-width 20px, height 20px.
- **Tab Icons**: Sized 15–16px, vertically centered with text title.
- **Tab Item Padding**: `padding: var(--space-3) var(--space-3);` (12px vertical, 12px horizontal) ensuring comfortable touch target and scannability.
- **Global Typography**: No change to `--font-size-base` (13px) across the application in this milestone.

---

## 4. Per-Item Active Icon Color Architecture

### Public API Extension

`TabBarItem<T>` receives an optional presentation property:

```typescript
export interface TabBarItem<T extends string> {
  id: T;
  title: string;
  icon?: ReactNode;
  activeIconColor?: string;
  disabled?: boolean;
}
```

### Presentation Logic

- Inactive tab: Icon inherits `--color-tab-line-unselected-text` (muted gray).
- Active tab with `activeIconColor`: Icon inherits the supplied semantic token color.
- Active tab without `activeIconColor`: Falls back to `--color-tab-line-indicator` (brand orange).
- Active underline remains canonical brand orange (`#f58a24`).

### Foundation & Semantic Tokens

Added foundation tokens:

- `--blue-700`: `#1d4ed8`
- `--indigo-700`: `#4338ca`
- `--teal-700`: `#0f766e`
- `--rose-700`: `#be123c`

Mapped semantic tokens:

- `--color-retail-tab-all-icon`: `var(--brand-navy)`
- `--color-retail-tab-to-origin-icon`: `var(--amber-700)`
- `--color-retail-tab-at-origin-icon`: `var(--blue-700)`
- `--color-retail-tab-in-transit-icon`: `var(--indigo-700)`
- `--color-retail-tab-at-dest-icon`: `var(--emerald-700)`
- `--color-retail-tab-delivered-icon`: `var(--teal-700)`
- `--color-retail-tab-disputed-icon`: `var(--rose-700)`

---

## 5. Count Badge Default & Availability Truthfulness

1. **Presentation Value**: When Shipment API is unavailable, the 7 status badges present `0` to satisfy owner visual preference.
2. **Availability Distinctions**:
   - UI alerts and headers continue to declare `"Shipment API chưa khả dụng"`.
   - Tooltips / accessibility labels state `"Chưa đồng bộ từ máy chủ (tạm tính: 0)"` so assistive tech does not mistake placeholder values for verified metrics.
   - When backend data is available, actual verified counts are displayed verbatim.
   - No mock packages, fake API calls, or fabricated backend statistics are introduced.

---

## 6. Non-Goals

- No capsule tabs, pipeline steppers, or card tabs.
- No variant dropdown or style switchers.
- No global body font-size migration.
- No modification of Customer UI Segmented Tabs.
- No changes to manual keyboard activation contract established in M3 v2.
