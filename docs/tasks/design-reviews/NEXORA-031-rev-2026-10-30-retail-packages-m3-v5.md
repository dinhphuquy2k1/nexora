# NEXORA-031 immutable design amendment — Retail Packages UI M3 v5 (Shared SelectButton Architecture, Retail Column Picker Parity & Table Full-Width Geometry)

Task ID: NEXORA-031
Plan revision: rev-2026-10-30-retail-packages-m3-v5
Reviewed baseline: 4f6a24b27d0bff1db0719cbbe8f24be5ab8a3bdb
Reference component: PrimeVue SelectButton (https://primevue.dev/selectbutton/)
Reference ZIP: remix-nexora-logistics-management(4).zip
Reference ZIP SHA-256: 3eacbe20ffcef1a87741b3914bcc35870a7a71bada05026ff7679342b63fb7f4
Classification: MATERIAL ARCHITECTURE & VISUAL REVISION
Documentation Impact: REQUIRED

---

## 1. Context & Motivation

Following the completion of M3 v4 visual parity enhancements for CommandDeck, ColumnPicker visual trigger states, Reload label, and desktop pagination (PR #29, baseline `4f6a24b27d0bff1db0719cbbe8f24be5ab8a3bdb`), code review and design inspection identified architectural and visual parity discrepancies in the Column Picker and Table layout (findings I1, I2, M1–M4, m1–m3):

1. **Missing Shared `SelectButton` Component (I1, M1)**:
   - Retail Column Picker implemented custom, ad-hoc button groups for column presets and raw checkbox mappings for column selection.
   - Nexora requires a reusable `SelectButton` primitive in `@nexora/ui`, taking architectural inspiration from PrimeVue SelectButton's API, UX, and interaction patterns, while strictly avoiding external dependencies (no PrimeVue, PrimeReact, Radix UI, React Aria, Base UI, or shadcn/ui).
   - The shared component must strictly compose existing `@nexora/ui` primitives: `Button` for single segmented selection, and `Checkbox` for multiple stacked selection.
2. **Column Picker Popover Visual Discrepancies (I2, M2)**:
   - Missing popover header structure: reference ZIP (`remix-nexora-logistics-management(4).zip` / `scratch/RetailPackagesView.tsx` lines 1750–1765) defines an explicit header with a `SlidersHorizontal` (or `Columns3`) icon, title `"Tùy chỉnh cột hiển thị"`, and a close icon button (`X`).
   - Pinned tracking column presentation: the required tracking column currently uses text `"(bắt buộc)"` instead of the reference's distinct amber badge `"Cố định"`.
   - Popover footer: action button uses `"Hoàn tất"` instead of the reference's navy-toned `"Đã xong"` button (`#172B4D`).
3. **Table Width Collapse on Few Columns (M3)**:
   - In `RetailPackageTable.tsx`, table width is calculated strictly as `style={{ width: visibleColumns.reduce((n, c) => n + c.width, 0) }}`.
   - When users select the "Cơ bản" preset (7 columns, total ~855px), the table shrinks and leaves an empty void on the right side of standard desktop containers (1024px, 1280px, 1440px).
   - The table must expand to full container width (`width: 100%`) while enforcing a minimum width (`minWidth: minTableWidth`) to preserve column readability and trigger horizontal scroll with pinned sticky tracking column when columns exceed container width.
4. **Selection Invariants During Search (M4, m1–m3)**:
   - When searching column names in the picker, toggling a visible column must never drop previously selected columns that are hidden by the search filter.
   - Required tracking column must be strictly protected against unchecking across both UI interaction and state updates.
   - Active preset must be derived dynamically from visible column IDs against preset definitions; no disconnected local preset state.

---

## 2. Invariants & Tactical DDD Boundaries

1. **Quarantined Domain Boundary**:
   - `SelectButton` in `packages/ui` is an entirely domain-agnostic presentation primitive. It knows nothing about Retail Packages, Shipments, ColumnVisibility, presets, or required tracking codes.
   - All domain and feature-specific rules remain strictly encapsulated within `apps/web/features/retail-packages/`.
2. **Primitive Composition & Zero New Dependencies**:
   - `SelectButton` is constructed strictly by composing existing `@nexora/ui` `Button` and `Checkbox` primitives.
   - No external libraries (no Radix, React Aria, PrimeVue, shadcn) are added.
   - The public API, height (32px), and default behavior of shared `Button` and `Checkbox` remain untouched.
3. **Semantic Accessibility & Native Controls**:
   - Single segmented selection renders `role="group"` with native buttons using `aria-pressed` for selection state.
   - Multiple stacked selection renders `role="group"` with native `input[type=checkbox]` inside accessible labels.
   - No fake checkboxes inside buttons, no nested interactive elements, and no nested labels (`<label><label>`).
4. **Search Filter Selection Invariance**:
   - Multiple selection operates on the entire set of selected values. Filtering the option list via search does not drop or mutate selected items that are outside the current filtered view.
5. **Control Sizing Invariant**:
   - Standard control size default remains 32px (`--control-size-default`). Shared controls are never reduced to 28px.
6. **Data Truthfulness**:
   - Unavailable Shipment API routes remain honestly disabled; no synthetic fixture data is introduced to production routes.

---

## 3. Mandatory Reuse Audit Matrix

| Component                                | Existing Implementations                                                                     | Domain Owner         | Reuse Alternatives                                                                                                          | Selected Approach                                                                                                             | Rationale                                                                                                                                                      | Risks                                                | Verification                                                                                                           |
| :--------------------------------------- | :------------------------------------------------------------------------------------------- | :------------------- | :-------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| Shared `SelectButton` (Single Segmented) | Ad-hoc `<Button>` list in `RetailColumnPicker.tsx`; `AddressLabelField` in `AddressForm.tsx` | `@nexora/ui`         | 1. Third-party toggle group (Radix/PrimeVue). 2. Custom native button group from scratch. 3. Compose `@nexora/ui` `Button`. | Compose `@nexora/ui` `Button` inside `SelectButton` with `mode: "single", layout: "segmented"`                                | Zero external dependencies; guarantees design system sizing, typography, and focus ring compliance; preserves keyboard semantics via native buttons            | Button styling override conflicts                    | Tested in `packages/ui/test/select-button.test.mjs` for `aria-pressed`, click events, disabled state, and `allowEmpty` |
| Shared `SelectButton` (Multiple Stacked) | Ad-hoc `<Checkbox>` list in `RetailColumnPicker.tsx`                                         | `@nexora/ui`         | 1. Custom checkbox reimplementation. 2. Compose `@nexora/ui` `Checkbox`.                                                    | Compose `@nexora/ui` `Checkbox` with full-row clickability and custom trailing slot support                                   | Reuses existing accessible `<Checkbox>` primitive, native input, and token-bound check styling; guarantees no nested labels or fake inputs                     | Missing items during filtered search                 | Tested in unit and browser tests with filtered search toggles; verified all out-of-filter selections are preserved     |
| Column Presets (All / Basic / Default)   | Hand-rolled preset button row in `RetailColumnPicker.tsx`                                    | Web / Retail Feature | 1. Keep hand-rolled buttons. 2. Consume `SelectButton mode="single" layout="segmented"`                                     | Consume `SelectButton` with derived `activePreset` from `visibleColumns` set equality                                         | Unifies segmented selection under shared component; eliminates redundant state; accurately clears selection on custom adjustments                              | Flawed preset match when visibility object keys vary | Key-agnostic comparison via `visibleColumns(visibility).map(c => c.id).join(",")` vs preset column IDs                 |
| Column Visibility Checklist              | Hand-rolled checkbox list in `RetailColumnPicker.tsx`                                        | Web / Retail Feature | 1. Keep hand-rolled list. 2. Consume `SelectButton mode="multiple" layout="stacked"`                                        | Consume `SelectButton` with `renderOption` for badge "Cố định"                                                                | Clean abstraction separation; isolates search filtering and column mapping in feature while reusing shared checklist component                                 | Performance on 20 items                              | Negligible DOM footprint; instant reactivity; zero re-render lag                                                       |
| Popover Chrome & Visual Parity           | Minimal popover panel in `RetailColumnPicker.tsx`                                            | Web / Retail Feature | 1. Retain current minimal header/footer. 2. Refactor to match reference ZIP structure                                       | Add header with icon + title + close `X`; add "Cố định" badge; add footer with "Đang bật: x/20 cột" and navy "Đã xong" button | Delivers exact visual parity with reference ZIP; improves discoverability and modal usability                                                                  | CSS module scoping conflicts                         | Visual verification at 6 standard viewports and CDP browser check                                                      |
| Table Full-Width Behavior                | Table with fixed inline width sum in `RetailPackageTable.tsx`                                | Web / Retail Feature | 1. Hardcode 100% width without minWidth. 2. `style={{ width: "100%", minWidth: minTableWidth }}`                            | Apply `width: "100%", minWidth: minTableWidth` to desktop table                                                               | Table expands naturally to container width when few columns are visible, while enforcing minimum column dimensions and scrolling when columns exceed container | Sticky column misalignment on expansion              | Browser geometry tests verify sticky tracking column position and column width distribution                            |

---

## 4. Technical Specifications

### 4.1. Shared `SelectButton` Specification (`@nexora/ui`)

#### File Structure

- `packages/ui/src/SelectButton.tsx`
- `packages/ui/src/SelectButton.module.css`
- `packages/ui/src/index.tsx` (re-exports `SelectButton`, `SelectButtonProps`, `SelectButtonOption`)

#### Public Typed API

```typescript
export interface SelectButtonOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface BaseSelectButtonProps<T extends string> {
  options: readonly SelectButtonOption<T>[];
  ariaLabel: string;
  className?: string;
  fluid?: boolean;
  disabled?: boolean;
  renderOption?: (
    option: SelectButtonOption<T>,
    state: { selected: boolean },
  ) => React.ReactNode;
}

export type SelectButtonProps<T extends string> = BaseSelectButtonProps<T> &
  (
    | {
        mode: "single";
        layout: "segmented";
        value: T | null;
        allowEmpty?: boolean;
        onValueChange: (value: T | null) => void;
      }
    | {
        mode: "multiple";
        layout: "stacked";
        value: readonly T[];
        onValueChange: (value: T[]) => void;
      }
  );
```

#### Single Segmented Mode Behavior

- Container element: `<div role="group" aria-label={ariaLabel} className={...}>`
- Each item is rendered using `@nexora/ui` `<Button>`:
  - `variant="secondary"` as baseline primitive.
  - `aria-pressed={selected}` reflecting whether `value === option.value`.
  - `disabled={disabled || option.disabled}`.
  - Clicking an unselected option calls `onValueChange(option.value)`.
  - Clicking an already selected option calls `onValueChange(null)` if `allowEmpty === true`, or does nothing if `allowEmpty === false` (default `false`).
  - Disabled options do not trigger `onValueChange`.
  - Custom option rendering supported via `renderOption(option, { selected })`.

#### Multiple Stacked Mode Behavior

- Container element: `<div role="group" aria-label={ariaLabel} className={...}>`
- Each item is rendered using `@nexora/ui` `<Checkbox>`:
  - `checked={selected}` reflecting whether `value.includes(option.value)`.
  - `disabled={disabled || option.disabled}`.
  - Entire row area is clickable through the native `<label>` wrapper of `<Checkbox>`.
  - When toggling an option:
    - If currently checked: `onValueChange(value.filter((v) => v !== option.value))`.
    - If currently unchecked: `onValueChange([...value, option.value])`.
  - **Critical Invariant**: Selected values that are not currently present in `options` (e.g. filtered out by search) are strictly preserved in `value`.
  - Disabled checkboxes cannot be toggled; checked + disabled items remain checked.
  - Trailing content (such as badge "Cố định") is passed via `renderOption(option, { selected })` without creating nested interactive elements or nested `<label>` tags.

#### CSS Presentation Tokens

- `.segmented`: background `var(--color-surface-muted)`, border `1px solid var(--color-border)`, border-radius `var(--radius-md)`, padding `2px`.
- `.segmentedItem[aria-pressed="true"]`: background `var(--color-surface)`, color `var(--color-primary)`, border-color `var(--color-border)`, shadow `var(--shadow-sm)`.
- `.segmentedItem[aria-pressed="false"]`: background `transparent`, color `var(--color-text-muted)`, border-color `transparent`.
- `.stackedItem`: full-width flex row, padding `var(--space-1) var(--space-2)`, border-radius `var(--radius-md)`, hover background `var(--color-surface-subtle)`.

### 4.2. Retail Column Picker Visual Parity

- **Popover Dimensions & Position**:
  - Width: 320px (`min-width: 300px; max-width: 340px;`).
  - Radius: `var(--radius-lg)` (12px).
  - Border: `1px solid var(--color-border)`.
  - Shadow: `var(--shadow-lg)` / elevation 3.
  - Background: `var(--color-surface)`.
- **Header**:
  - Title row with `SlidersHorizontal` (or `Columns3`) icon in `var(--brand-orange)`.
  - Title text: `"Tùy chỉnh cột hiển thị"` in `var(--color-primary)` bold 12px.
  - Close button: ghost icon button with `X` (14px) right-aligned, hover color `var(--color-primary)`.
  - Bottom border: `1px solid var(--color-border)`.
- **Presets**:
  - Segmented `SelectButton` with options:
    - `all`: "Tất cả"
    - `basic`: "Cơ bản"
    - `default`: "Mặc định"
  - `value={activePreset}` computed dynamically:
    ```typescript
    const currentIds = visibleColumns(visibility)
      .map((c) => c.id)
      .join(",");
    const activePreset =
      (["all", "basic", "default"] as const).find(
        (p) =>
          visibleColumns(columnPreset(p))
            .map((c) => c.id)
            .join(",") === currentIds,
      ) ?? null;
    ```
- **Search Input**:
  - Quick column search with `type="search"`, placeholder `"Tìm tên cột…"`.
- **Column List**:
  - Scrollable area: `max-height: 240px; overflow-y: auto;`.
  - Stacked `SelectButton` rendering `searchColumns(search)`.
  - Required tracking column: `disabled: true`, renders amber badge `"Cố định"` (`background: var(--amber-50); border: 1px solid var(--amber-200); color: var(--brand-orange-text)`).
  - Toggling items preserves out-of-search items and required tracking column.
- **Footer**:
  - Top border: `1px solid var(--color-border)`.
  - Summary text: `"Đang bật: "` + `<strong>{count}</strong>` + `"/20 cột"`.
  - Action button: `"Đã xong"` in navy `#172B4D` (`background: var(--brand-navy); color: var(--color-white)`), 28–32px height, closes popover and returns focus to trigger.

### 4.3. Table Full-Width Behavior

- In `RetailPackageTable.tsx`:

  ```tsx
  const minTableWidth = visibleColumns.reduce((sum, col) => sum + col.width, 0);

  <table
    className={styles.table}
    style={{ width: "100%", minWidth: minTableWidth }}
    aria-label="Danh sách kiện lẻ TMĐT"
  >
  ```

- **Behavior**:
  - When visible columns total width is less than container width (e.g. 7 columns = 855px on a 1200px container), the table expands to 100% width, filling the container without void spaces.
  - When visible columns total width exceeds container width (e.g. 19 or 20 columns = ~2300px), `minWidth` ensures columns retain readable width and container scrolls horizontally.
  - Pinned tracking column retains its sticky position (`sticky`, `left: 0`, opaque background) during horizontal scroll.

### 4.4. Potential Consumer Impact & Non-Goals

- `AddressForm.tsx` in `apps/web/features/customers/` has address label buttons ("Nhà riêng", "Cửa hàng", etc.) supporting single toggle selection.
- It is recognized as a genuine potential consumer for `SelectButton` with `mode: "single", layout: "segmented", allowEmpty: true`.
- **Explicit Non-Goal**: To avoid scope creep and preserve Customer UI stability, `AddressForm.tsx` is NOT refactored in PR #29. Refactoring it is a separate follow-up task.

---

## 5. Test Contract & Verification Plan

1. **Shared Component Tests (`packages/ui/test/select-button.test.mjs`)**:
   - Single segmented:
     - Renders options with `role="group"` and `aria-label`.
     - Active item has `aria-pressed="true"`, inactive items have `aria-pressed="false"`.
     - Disabled option has `disabled` attribute.
     - `allowEmpty=false` preserves selected value on re-click.
     - `allowEmpty=true` calls `onValueChange(null)` on re-click.
     - Controlled state changes reflect properly.
   - Multiple stacked:
     - Renders native `<input type="checkbox">` elements.
     - Checked state accurately reflects `value` array.
     - Toggling an item calls `onValueChange` with item added/removed.
     - Selection invariant: items in `value` not present in `options` are strictly preserved.
     - Disabled items do not toggle; checked + disabled items remain checked.
     - Custom trailing slot renders without nested interactive controls.
2. **Browser Interaction & Parity Tests (`scripts/retail-browser-checks.mjs`)**:
   - Update line 491: change `click("Hoàn tất")` to `click("Đã xong")`.
   - Add assertion for `aria-pressed` on preset segmented buttons.
   - Add test verifying that selecting preset then manually toggling a column clears preset active state (`aria-pressed="false"` for all presets).
   - Add test verifying that searching and toggling does not drop un-searched visible columns.
   - Add test verifying table geometry: Basic preset (7 cols) expands to container width (`table.getBoundingClientRect().width === viewport.clientWidth`).
   - Add test verifying tracking column is sticky and opaque when scrolled.
3. **Retail Unit Tests (`apps/web/test/retail-packages.test.mjs`)**:
   - Verify `RetailColumnPicker` renders header, segmented presets, search input, checklist, and footer "Đã xong".
   - Verify table full width geometry and sticky tracking column behavior.
4. **Form Control Contracts (`apps/web/test/form-control-contracts.test.mjs`)**:
   - Verify zero undeclared tokens, no fallback misuse, and valid semantic palette bindings across `@nexora/ui` and `@nexora/web`.
