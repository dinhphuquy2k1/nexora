# NEXORA-031 immutable design amendment — Retail Packages UI M3 v6 (Retail Column Picker Visual Parity & SelectButton Appearance Variant)

Task ID: NEXORA-031
Plan revision: rev-2026-10-31-retail-packages-m3-v6
Reviewed baseline: 8043a76eaa7f6a986f11c2b8c9ef4d0c46c92ac5
Reference ZIP: remix-nexora-logistics-management.zip
Reference ZIP SHA-256: 3eacbe20ffcef1a87741b3914bcc35870a7a71bada05026ff7679342b63fb7f4
Classification: MATERIAL ARCHITECTURE & VISUAL REVISION
Documentation Impact: REQUIRED

---

## 1. Context & Motivation

Following the completion of M3 v5 corrective follow-up (PR #29, baseline `8043a76eaa7f6a986f11c2b8c9ef4d0c46c92ac5`), thorough visual inspection against reference ZIP (`remix-nexora-logistics-management.zip` / `src/components/RetailPackagesView.tsx:1720–1863`) and user-provided comparison screenshots identified 10 visual parity discrepancies in the Column Picker popup:

1. **Popup Title Sizing (V1)**: Current title uses 11px (`--font-size-xs`); reference uses 12px bold (`text-xs text-[#172B4D]` in Tailwind).
2. **Preset Layout & Appearance (V2)**: Reference uses a flat action-segmented container with decorative `|` separators, distinctive per-option colors (All: blue `#1D4ED8`, Basic: amber `#B45309`, Default: slate `#475569` + `RotateCcw` reset icon), and no raised selected white pill or border/shadow.
3. **Search Input Accessories (V3)**: Reference search input includes a left `Search` magnifying glass icon and a conditional right clear `X` button with light gray background `#F8FAFC`.
4. **Popup Height & Spacing (V4)**: Current checklist is 280px high with 12px panel gaps; reference checklist is max 208px (`max-h-52`) with 8px section spacing (`mb-2`).
5. **Option Colors (V5)**: Checked options should have navy text `#172B4D` with subtle background `#F8FAFC`; unchecked options should have slate text `#94A3B8` on transparent background; required tracking column retains bold navy text and amber "Cố định" badge.
6. **Checkbox Indicator (V6)**: Checkbox retains native semantic input and standard sizing without custom div replacements.
7. **Trigger Button Parity (V7)**: Trigger button should use `SlidersHorizontal` icon with responsive label `"Cột hiển thị"`, orange icon when open, and badge reflecting `{visible}/{total}`.
8. **Header Alignment (V8)**: Header aligns `SlidersHorizontal` icon, 12px bold title, and compact 32px close button with border divider.
9. **Footer Layout (V9)**: Footer features 11px count text `"Đang bật: x/20 cột"` and compact navy `"Đã xong"` button with top divider.
10. **Panel Width & Bounds (V10)**: Panel width is constrained to `min(336px, calc(100vw - 32px))` with 12px radius and shadow, preventing viewport overflow.

To resolve these discrepancies while preserving the architectural rule that `@nexora/ui` owns reusable presentation primitives and feature code owns domain logic, this amendment introduces the scoped `appearance?: "default" | "text-actions"` variant to `SelectButton`.

---

## 2. Invariants & Tactical DDD Boundaries

1. **Quarantined Domain Boundary**:
   - `SelectButton` in `@nexora/ui` remains strictly domain-agnostic. It does not know about column names, presets, visibility maps, or retail packages.
   - All domain rendering (colors, preset options, reset icon, pinned badge) remains encapsulated in `apps/web/features/retail-packages/`.
2. **Primitive Composition & Zero New Dependencies**:
   - `SelectButton` continues to compose `@nexora/ui` `Button` (single segmented) and `Checkbox` (multiple stacked).
   - Zero external UI libraries (no PrimeVue, PrimeReact, Radix, shadcn) are introduced.
   - Shared control sizing (default 32px, medium 40px, large 48px) is strictly preserved across shared primitives.
3. **Semantic Accessibility & Native Controls**:
   - Segmented buttons continue to output native `<button>` elements with `aria-pressed`.
   - Decorative separators (`|`) are rendered with `aria-hidden="true"` and excluded from option selection.
   - Stacked mode continues to output native `<input type="checkbox">` inside accessible labels.
   - Search clear button uses native button with explicit accessible name `"Xóa tìm kiếm"`.
4. **Controlled State & Search Selection Invariant**:
   - Multi-selection retains all out-of-filter selected IDs during search filtering.
   - Active preset remains derived dynamically from visible column ID set equality.
   - Required tracking column remains permanently checked and disabled.
5. **Data Truthfulness**:
   - Shipment unavailable status and em-dash counts remain authentic; no fake APIs or synthetic data are introduced.

---

## 3. Mandatory Reuse & Design Audit Matrix

| Component                         | Existing Implementations                                        | Domain Owner               | Reuse Alternatives                                                                                              | Selected Approach                                                                                            | Rationale                                                                                                                                    | Risks                                | Verification                                                        |
| :-------------------------------- | :-------------------------------------------------------------- | :------------------------- | :-------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------- | :------------------------------------------------------------------ |
| Shared `SelectButton` Appearance  | Default segmented pill with white background, border and shadow | `@nexora/ui`               | 1. Inline styles in feature. 2. Abandon SelectButton for raw buttons. 3. Add `appearance` prop to SelectButton. | Add `appearance?: "default" \| "text-actions"` to `SelectButtonProps`                                        | Provides clean, reusable, token-bound text-action segmented appearance without raised pill; preserves keyboard navigation and `aria-pressed` | Specificity clash with Button styles | `packages/ui/test/select-button.test.mjs` unit and SSR render tests |
| Preset Separators & Icons         | Hardcoded text in ad-hoc row                                    | Web / Retail Feature       | 1. Non-selectable options in array. 2. Render in SelectButton when `appearance="text-actions"`.                 | Render decorative `aria-hidden="true"` `\|` between items in `SelectButton` when `appearance="text-actions"` | Avoids polluting option values with fake items; accessible to screen readers                                                                 | Separator misaligned                 | Visual check across all 6 viewports                                 |
| Column Search Wrapper             | Standalone `TextInput` without icon or clear button             | Web / Retail Feature       | 1. Modify shared TextInput globally. 2. Feature-owned wrapper around shared `TextInput`.                        | Feature-owned search wrapper in `RetailColumnPicker.tsx` with `Search` icon and clear `X` button             | Preserves shared `TextInput` public API and global 32px height while matching ZIP visual design                                              | Duplicate clear buttons on Webkit    | Hide Webkit native search cancel button via CSS; test clear action  |
| Column Checklist Height & Spacing | 280px max-height and 12px panel gap                             | Web / Retail Feature       | 1. Keep 280px. 2. Reduce to 208px (`max-h-52`) and 8px panel gap.                                               | Reduce checklist max-height to 208px and panel gap to `var(--space-2)` (8px)                                 | Matches ZIP geometry; compact and balanced without sacrificing scrollability of 20 columns                                                   | Content cutoff on small screens      | Viewport testing from 375px to 1440px                               |
| Option Label & Row Colors         | Dark text for both checked and unchecked rows                   | Shared UI / Retail Feature | 1. Feature overrides. 2. Align shared stacked styles with design system tokens.                                 | Update `SelectButton.module.css` stacked item colors: muted slate for unchecked, navy for checked            | Directly satisfies ZIP visual contrast; unchecked items appear light while selected items are prominently highlighted                        | Consumer contrast regression         | WCAG contrast checks on checked/unchecked states                    |
| Trigger Button Parity             | `Columns3` icon and `"Cột"` label                               | Web / Retail Feature       | 1. Keep Columns3. 2. Update to `SlidersHorizontal` and `"Cột hiển thị"` responsive label.                       | Use `SlidersHorizontal` with dynamic orange/slate tone, responsive `"Cột hiển thị"`, and 3-state badge       | Matches reference ZIP trigger visual structure exactly                                                                                       | Layout break on narrow screen        | Responsive CSS hides text below xs viewport                         |
| Popup Header & Footer Chrome      | Basic title and shared popover footer                           | Web / Retail Feature       | 1. Keep 11px title. 2. 12px bold title, dedicated `colPickerFooter`, 11px count, navy "Đã xong" button.         | Use 12px bold title (`--font-size-sm`), dedicated `.colPickerFooter`, and navy 32px "Đã xong" button         | Perfect alignment with reference ZIP while maintaining 32px shared control height contract                                                   | Vertical overflow                    | Verified on CDP headless browser across all 6 viewports             |

---

## 4. Technical Specifications

### 4.1. Shared `SelectButton` Specification (`@nexora/ui`)

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
  appearance?: "default" | "text-actions";
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

#### Behavior & Styling (`appearance="text-actions"`)

- When `appearance="text-actions"`, the segmented container renders `styles.textActions`.
- Between option items (index > 0), a decorative `<span className={styles.textActionsSeparator} aria-hidden="true">|</span>` is rendered.
- Button items in `text-actions` mode:
  - Default background: transparent.
  - No border, no box-shadow.
  - Hover background: `var(--color-surface)` (`#FFFFFF`).
  - Selected state (`aria-pressed="true"`): transparent background without raised white pill, border, or shadow.
  - Height: compact 24px within the 32px-padded container.

#### Multiple Stacked Mode Styling

- Unchecked item: `color: var(--color-text-muted)` (`#94A3B8`), background transparent.
- Unchecked hover: `background-color: var(--color-surface-subtle)` (`#F1F5F9`).
- Checked item: `color: var(--color-primary)` (`#172B4D`), `background-color: var(--color-surface-muted)` (`#F8FAFC`).
- Checked hover: `background-color: var(--color-surface-subtle)`.
- Disabled item: `opacity: 0.8`.

### 4.2. Retail Column Picker Feature Specification (`apps/web`)

#### File Updates

- `apps/web/styles/tokens.css`: Add semantic tokens `--color-colpicker-preset-all`, `--color-colpicker-preset-basic`, `--color-colpicker-preset-default`.
- `apps/web/features/retail-packages/RetailColumnPicker.tsx`:
  - Header: 12px bold title (`--font-size-sm`), `SlidersHorizontal` icon, close button.
  - Preset SelectButton: `appearance="text-actions"`, `renderOption` rendering blue/amber/slate colors and `RotateCcw` reset icon.
  - Search: feature wrapper with `Search` icon, `TextInput` (32px), and clear `X` button.
  - Checklist: `max-height: 208px`, item styling with navy checked labels and amber "Cố định" badge.
  - Footer: `.colPickerFooter`, 11px count, navy "Đã xong" button.
  - Trigger: `SlidersHorizontal` icon, responsive label `"Cột hiển thị"`, 3-state styling.
- `apps/web/features/retail-packages/retail-packages.module.css`: Update classes for popup header, search wrapper, checklist height, preset colors, and footer.

---

## 5. Verification & Acceptance Criteria

1. **Title**: Computed font-size is 12px with font-weight 700 and primary navy tone.
2. **Presets**: Rendered with text-actions appearance, distinct blue/amber/slate tones, decorative `|` separators, and `RotateCcw` reset icon. No raised white pill on selected item.
3. **Search**: Magnifying glass icon on left, clear `X` button on right when text is present. Clearing resets search and returns focus to input.
4. **Checklist**: Scrollable container bounded at 208px max height. Unselected items render slate text; selected items render navy text.
5. **Required Tracking Column**: Disabled checkbox with "Cố định" badge and bold navy text.
6. **Trigger**: `SlidersHorizontal` icon with responsive `"Cột hiển thị"` label and 3-state visual feedback.
7. **Footer**: 11px count label with compact navy "Đã xong" button.
8. **Regression & CI**: Zero regressions in SelectButton default mode, form control contracts, retail unit tests, and Chromium CDP checks. Preflight and Foundation CI pass on final HEAD.
