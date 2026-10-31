# NEXORA-031 immutable design amendment — Retail Packages UI M3 v4 (Visual Parity Correction: CommandDeck Container, Column Picker States, Reload Label, Desktop Pagination & Search Geometry)

Task ID: NEXORA-031
Plan revision: rev-2026-10-30-retail-packages-m3-v4
Reviewed baseline: 4b3fd8630ce9bae870a2d4a8cba608790bd96484
Reference ZIP: remix-nexora-logistics-management(3).zip
Reference ZIP SHA-256: 3eacbe20ffcef1a87741b3914bcc35870a7a71bada05026ff7679342b63fb7f4
Classification: MATERIAL VISUAL REVISION
Documentation Impact: REQUIRED

---

## 1. Context & Motivation

Following the implementation of Line TabBar in M3 v3 (PR #29), comprehensive visual comparison between the reference ZIP (`remix-nexora-logistics-management(3).zip` / `scratch/RetailPackagesView.tsx`) and the deployed implementation revealed several visual parity divergences in the Retail Packages management view:

1. **Page Header & Command Deck Geometry**:
   - The outer Command Deck lacked an enclosing boundary card with rounded corners (`rounded-xl`), subtle border (`#CBD5E1/80`), and light drop shadow.
   - `.titleRow` vertical padding was 8px (`var(--space-2)`), whereas the reference design specifies 14px (`py-3.5` / `14px`), causing the title row to feel compressed.
   - The brand icon squircle used a light accent icon instead of brand orange (`var(--brand-orange)`), differing from the reference's `bg-[#172B4D] text-[#F58A24]`.
2. **Column Picker Button Visual States**:
   - The column configuration trigger button was rendered as a static neutral secondary button (`<Button variant="secondary">`), failing to communicate popover state or filtering status.
   - The reference specifies three distinct visual presentations:
     - **State A (Popover Open)**: Navy background (`var(--brand-navy)`), navy border, white text, brand-orange icon, translucent white pill badge (`rgba(255, 255, 255, 0.2)`).
     - **State B (Filtered, < 20 columns visible, popover closed)**: Soft amber background (`var(--amber-50)`), amber border (`var(--amber-400-60)`), navy text, and an amber pill badge (`var(--amber-200-80)`) with bold amber text (`var(--amber-900)`).
     - **State C (Full, 20/20 columns visible, popover closed)**: Neutral secondary surface (`var(--color-surface)`), border gray (`var(--color-border)`), neutral text/icon, and neutral badge.
3. **Reload Button Presentation**:
   - The reload button rendered only an icon due to the `icon` prop, missing the text label.
   - The reference specifies both the `RefreshCw` icon and the text label `"Làm mới"`, with standard 32px height.
4. **Pagination Footer Layout & Range Calculation**:
   - The footer wrapped into multiple lines on desktop because `<Select>` in `@nexora/ui` defaults to `width: 100%` and `.paginationInfo` used `flex-wrap: wrap`.
   - The record summary displayed `{total} kiện lẻ` without the item range (`start–end / total`).
   - Legacy dead CSS classes from prior manual implementations (`.pageSizeWrapper`, `.pageSizeSelect`, `.pageBtn`, `.pageBtnActive`, and duplicate `.paginationInfo`) cluttered `retail-packages.module.css`.
5. **Search Input & Filter Button Presentation**:
   - The search input was constrained to `max-width: 340px`, whereas the reference allocates flexible desktop space (`min-width: 220px; flex: 1`).
   - The filter trigger button displayed `"Bộ lọc"` instead of the reference's `"Thêm điều kiện lọc"`.

This design amendment specifies the visual parity corrections while strictly preserving Nexora's architectural boundaries, standard 32px control heights, and production Shipment API truthfulness.

---

## 2. Invariants & Tactical DDD Boundaries

1. **Domain Boundary**: Shipment and Retail Package domain logic remains strictly quarantined. Nexora owns the Shipment domain; no provider integrations, mock entities, or fake reload side-effects are introduced.
2. **Control Sizing Invariant**: Standard shared control height is fixed at 32px (`--control-size-default`). Shared controls are never reduced to 28px.
3. **Data Truthfulness Invariant**: When Shipment API is unavailable, the UI honestly presents disabled action controls and unavailable markers (`—`). No synthetic fixture data is exposed to production builds.
4. **AppShell & Boundary Isolation**: Shared AppShell, Login/MFA, and Customer UI components remain completely untouched.

---

## 3. Reuse & Design Audit Matrix

| component                 | existing implementations                                   | domain owner         | reuse alternatives                                                      | selected approach                                                                                                 | rationale                                                                              | risks                                      | verification                                                                |
| :------------------------ | :--------------------------------------------------------- | :------------------- | :---------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------- | :----------------------------------------- | :-------------------------------------------------------------------------- |
| CommandDeck Container     | `.commandDeck` in `retail-packages.module.css`             | Web / Retail Feature | Create separate wrapper component; or style existing `.commandDeck`     | Enhance `.commandDeck` with border, radius-lg, shadow-sm, and `overflow: visible`                                 | Avoids extraneous DOM elements; maintains CSS module scoping                           | Content clipping if overflow is hidden     | Browser geometry check confirms `overflow: visible` and popover positioning |
| Title Row Spacing         | `.titleRow` in `retail-packages.module.css`                | Web / Retail Feature | Inline style overrides; or tokenized padding in CSS module              | Update `.titleRow` to `padding: 14px var(--space-4)`                                                              | Conforms to reference 14px vertical spacing without affecting global header            | Misalignment with action buttons           | Computed bounding box inspection across viewports                           |
| Brand Icon Squircle       | `.brandIcon` in `retail-packages.module.css`               | Web / Retail Feature | Custom SVG; or reuse Lucide `Package` with brand tokens                 | Style `.brandIcon` with `background: var(--brand-navy); color: var(--brand-orange)`                               | Reuses existing Lucide icon; exact reference parity                                    | Contrast ratio on dark surface             | Verified accessible contrast with orange on navy                            |
| Column Picker Trigger     | `<Button variant="secondary">` in `RetailColumnPicker.tsx` | Web / Retail Feature | Add custom variant to `@nexora/ui`; or compose with feature CSS classes | Add state-specific CSS classes (`.colPickerTrigger_open`, `.colPickerTrigger_filtered`, `.colPickerTrigger_full`) | Keeps `@nexora/ui` Button general; encapsulates retail column states in feature CSS    | Specificity conflict with `.secondary`     | CSS module class composition verified in browser checks                     |
| Column Picker Badge       | Generic `<span>` in `RetailColumnPicker.tsx`               | Web / Retail Feature | Reuse `@nexora/ui` Badge; or scoped `.colPickerBadge`                   | Scoped `.colPickerBadge` with three state variants                                                                | Delivers exact pill styling and font-mono layout matching reference ZIP                | Contrast in dark mode                      | Verified color tokens for amber and navy states                             |
| Reload Button             | `<Button icon variant="secondary">`                        | Web / Retail Feature | Custom link; or standard `<Button variant="secondary">`                 | Remove `icon` prop, add `<span>Làm mới</span>` label                                                              | Shared Button handles icon + label alignment and disabled styling                      | Broken layout if disabled style drops text | Automated component test asserts label visibility when disabled             |
| Desktop Pagination Footer | `.paginationBar` & `RetailPagination.tsx`                  | Web / Retail Feature | Full rewrite with third-party pagination; or refine existing layout     | Refactor `RetailPagination.tsx` to single flex row with `.pageSizeSelectWrapper` (110px) and range display        | Retains existing accessible button navigation and `@nexora/ui` Select                  | Overflow on narrow viewports               | Responsive wrap rule at breakpoint `<= 600px`                               |
| Search Input Width        | `.searchWrapper` max-width 340px                           | Web / Retail Feature | Fixed pixel width; or responsive flex expansion                         | Expand `.searchWrapper` to `flex: 1; min-width: 200px; max-width: 480px;`                                         | Responsive flex fits available space naturally on wide and standard viewports          | Crowding toolbar buttons                   | Tested at 1440px, 1280px, 1024px, 390px viewports                           |
| Filter Button Label       | `"Bộ lọc"` in `RetailFilterPopover.tsx`                    | Web / Retail Feature | Hardcoded string; or localized string `"Thêm điều kiện lọc"`            | Update text to `"Thêm điều kiện lọc"` while preserving `aria-label="Bộ lọc nâng cao"`                             | Matches reference presentation verbatim while preserving existing accessibility labels | Test regression on click selectors         | Existing test uses `aria-label`, remains fully compatible                   |

---

## 4. Visual Parity Technical Specifications

### 4.1. Page Header & Command Deck

- **Container (`.commandDeck`)**:
  - `border: 1px solid var(--color-border);`
  - `border-radius: var(--radius-lg);`
  - `box-shadow: var(--shadow-sm);`
  - `overflow: visible;` (critical: prevents clipping filter/column popovers).
- **Title Row (`.titleRow`)**:
  - `padding: 14px var(--space-4);`
  - `border-bottom: 1px solid var(--color-border);`
  - `align-items: center;`
- **Brand Squircle (`.brandIcon`)**:
  - Dimensions: 32px × 32px (`var(--space-8)`).
  - Background: `var(--brand-navy)`.
  - Icon color: `var(--brand-orange)`.
  - Icon size: 18px.
- **Header Actions**:
  - Xuất Excel: `<Button variant="secondary" disabled>`.
  - Tạo mới kiện hàng: `<Button variant="emphasis" disabled={unavailable}>`.
  - Control height: 32px (`--control-size-default`).

### 4.2. Column Picker (3 Visual States)

- **State Determination**:
  ```typescript
  const visibleCount = visibleColumns(visibility).length;
  const isFiltered = visibleCount < RETAIL_PACKAGE_COLUMNS.length;
  const pickerState = open ? "open" : isFiltered ? "filtered" : "full";
  ```
- **State A (`open`)**:
  - Background: `var(--color-colpicker-open-bg)` (`#172B4D`).
  - Border: `var(--color-colpicker-open-border)` (`#172B4D`).
  - Text: `var(--color-colpicker-open-text)` (`#ffffff`).
  - Icon: `var(--color-colpicker-open-icon)` (`#f58a24`).
  - Badge: `background: rgba(255, 255, 255, 0.2); color: #ffffff;`.
- **State B (`filtered`)**:
  - Background: `var(--color-colpicker-filtered-bg)` (`#fffbeb`).
  - Border: `var(--color-colpicker-filtered-border)` (`rgba(251, 191, 36, 0.6)`).
  - Text: `var(--color-colpicker-filtered-text)` (`#172B4D`).
  - Icon: `var(--color-colpicker-filtered-icon)` (`#64748B`).
  - Badge: `background: rgba(253, 230, 138, 0.8); color: #78350f; font-weight: 700;`.
- **State C (`full`)**:
  - Background: `var(--color-colpicker-full-bg)` (`#ffffff`).
  - Border: `var(--color-colpicker-full-border)` (`#cbd5e1`).
  - Text: `var(--color-colpicker-full-text)` (`#172B4D`).
  - Icon: `var(--color-colpicker-full-icon)` (`#64748B`).
  - Badge: `background: #ffffff; border: 1px solid #cbd5e1; color: #475569;`.

### 4.3. Reload Button

- Replaces `<Button icon variant="secondary" disabled ...><RefreshCw size={14} /></Button>` with:
  ```tsx
  <Button
    variant="secondary"
    disabled
    aria-label="Làm mới dữ liệu (chưa khả dụng)"
    title="Shipment API chưa khả dụng."
  >
    <RefreshCw size={14} />
    <span>Làm mới</span>
  </Button>
  ```
- Retains 32px height, disabled state, and tooltip explaining Shipment API status.

### 4.4. Desktop Pagination Footer

- **Layout**: Single flex row on desktop (`min-height: 44px; padding: var(--space-2) var(--space-4)`).
- **Left Cluster**:
  - Range summary: `"Hiển thị "` + `<strong>{start}–{end}</strong>` + `" / "` + `<span data-retail-count>{total} kiện lẻ</span>`.
  - Range calculation:
    - `start = total === 0 ? 0 : (page - 1) * pageSize + 1`
    - `end = Math.min(page * pageSize, total)`
    - Unavailable state: presents `—` for range and total.
  - Divider: `|` (`color: var(--color-border)`).
  - Page size selector: Label `"Số dòng:"` inline with `<Select>` wrapped in `.pageSizeSelectWrapper { width: 110px; }`.
- **Right Cluster**: Bounded pagination buttons (`[«] [‹] [1] [›] [»]`) right-aligned.
- **Dead CSS Removal**:
  - Remove unused classes `.pageSizeWrapper`, `.pageSizeSelect`, `.pageBtn`, `.pageBtnActive`.
  - Remove duplicate `.paginationInfo` declaration at line 1181.

### 4.5. Additional Discrepancies

- **Search Wrapper**: Flexible width `flex: 1; min-width: 200px; max-width: 480px;`.
- **Filter Trigger**: Text updated to `"Thêm điều kiện lọc"` with `aria-label="Bộ lọc nâng cao"`.
- **Tokens**: Add foundation tokens `--amber-100` (`#fef3c7`), `--amber-200` (`#fde68a`), `--amber-200-80` (`rgba(253, 230, 138, 0.8)`). Add semantic tokens for Column Picker visual states.

---

## 5. Non-Goals

1. No change to shared control size default (32px).
2. No change to global body font size (13px).
3. No modification of Customer UI or Auth/MFA.
4. No fake shipment API or mocked persistence in production.
5. No new dependencies or visual framework abstractions.
