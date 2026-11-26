# NEXORA-064 Design Snapshot (v2) — Design System Refinement & PR #63 Review Remediation

## 1. Task Metadata & Classification

- **Task ID**: `NEXORA-064`
- **Task Title**: Design System Refinement: Control Sizing, Typography & Visual Consistency
- **Classification**: `SIGNIFICANT`
- **Documentation Impact**: `REQUIRED`
- **Target Branch & PR**: `refactor/design-system-refinement` (PR #63)
- **Plan revision**: `rev-2026-11-26-design-system-refinement-v2`
- **Design Snapshot**: `docs/tasks/design-reviews/NEXORA-064-rev-2026-11-26-design-system-refinement-v2.md`
- **Previous Immutable Snapshot**: `docs/tasks/design-reviews/NEXORA-064-rev-2026-11-26-design-system-refinement-v1.md` (SHA-256: `7a07b03e1c99ebd43ddaeb2c549b288caa4c1e274d07d11be7242f53480ebb96`)
- **Reviewed Baseline HEAD**: `75c95d7837880ab18085bc8dd36bc56f65ba9ef9` (PR #63 `REQUEST CHANGES`, base `c44cf4010fe30a6a7bfe0a3d397e65fb56381e15`)

---

## 2. Delta From v1 & Findings Scope

This v2 revision preserves the v1 shared control contract (`36/40/48px` controls, `16/18/20px` icons, `14/14/16px` control fonts, `20/20/24px` line heights, `500` button weight, `400` input weight, `1px` border, `8px` radius, Inter font, preserved Brand Navy/Orange palette, Login/MFA/Setup `size="large"` `48px`, zero API/SDK/DB/business-logic changes) and records the concrete design resolutions for all PR #63 review findings (`P1-01`, `P2-01`–`P2-08`, `P3-01`):

1. **P1-01 — Customer Table Skeleton & Row Geometry (`~44.5px`)**:
   - Observed baseline measurement in Chromium (`75c95d7`): both skeleton and data rows measured `48.5px` (`36px` action button/placeholder + `6px` top + `6px` bottom cell padding + `1px` border), failing `verifyCustomerTableGeometry` (`Math.abs(rowHeight - 44.5) <= 1.5`).
   - Selected resolution: keep `36 × 36px` actual and skeleton action buttons; set `.table td.actionCell { padding-block: var(--space-1); }` (`4px` top/bottom -> `36 + 8 + 1 = 45px`, within `<= 1.5px` of `44.5px`) and scope `td.detailCell a.detailLink` (`(0,2,1)`) without `!important` to protect the documented `26 × 26px` dense-table exception (matching `.skeleton_detail` `26 × 26px`) against CSS chunk injection ordering.
2. **P2-01 — Actual Semantic Typography Consumer Migration**:
   - Add only consumed semantic line-height tokens (`--type-page-title-line-height: 28px;`, `--type-label-line-height: 20px;` in `tokens.css`; `Section heading` `24px` and `Body` `21px` reuse `--line-height-normal` = `1.5` at `16px`/`14px`; `Card/Drawer` headings `14px/600/20px` reuse `--font-size-md`/`--font-weight-semibold`/`--control-line-height`).
   - Migrate `globals.css` (`body` 14/400/21, `h1` 20/600/28, `h2` 16/600/24), `customers.module.css` (`.titleGroup h1`, `.drawerHeader h2`, `.sectionHeading h3`, `.fields label`, `.stateTitle`), `retail-packages.module.css` (`.titleGroup h1`, `.emptyTitle`, `.formLabel` kept `xs`/`semibold` only where dense drawer layout requires or aligned per consumer), `carrier-connections.module.css` (`.heading h1`, `.drawerHeader h2`, `.syncPanel h3`, `.historyHeading h3`), `login.module.css` (`.heading` 20/600/28, `.label` 14/500/20), and `Panel.module.css` (`.title` 16/600/24).
   - Update `scripts/carrier-browser-checks.mjs` line 837 heading weight assertion from `"700"` to `"600"` to match the canonical `20px / 600 / 28px` Page Title contract.
3. **P2-02 — Table Typography Contract (`12px` Canonical Density)**:
   - Observed actual Customer, Retail, and Carrier tables already use `--font-size-sm` (`12px`), which preserves dense multi-column fit (`customer-table` 9 columns and `44.5px` row density, `retail-packages` 20 columns).
   - **Material Delta vs v1**: redefine `--type-table-cell-size: var(--font-size-sm);` (`12px`, superseding v1's unused `13px` draft) and apply `font-size: var(--type-table-cell-size);` across `.table` in `customers.module.css` (removing redundant `.table td` `font-size`), `retail-packages.module.css`, and `carrier-connections.module.css`. Apply `font-variant-numeric: tabular-nums` to numeric/date/count/index cells where missing without altering formatting logic.
4. **P2-03 — `SelectButton` Typography**:
   - Remove `font-size: var(--font-size-xs);` from `.segmentedItem` in `packages/ui/src/SelectButton.module.css` so standard segmented `SelectButton` inherits `Button`'s `--_control-font-size` (`14px`) and weight (`500`).
   - Document `.segmented.textActions .segmentedItem` (`font-size: var(--font-size-xs);` `11px`) as an intentional compact exception for the `336px` `RetailColumnPicker` preset bar (`Tất cả | Cơ bản | Mặc định`), keeping it explicit and immune to CSS injection order.
5. **P2-04 — `Textarea` Multiline Minimum & Explicit `rows` Contract**:
   - Scope the 3-line minimum height to `.textarea:not([rows="1"]):not([rows="2"])` using `min-height: calc(var(--_control-line-height) * 3 + var(--_control-padding-y) * 2 + 2px);` (`78px` default, `86px` medium, `106px` large), while `.textarea` retains `min-height: var(--_control-height);` so explicit `<Textarea rows={1} />` and `<Textarea rows={2} />` remain smaller than 3 lines while default/`rows >= 3` cannot shrink below 3 readable lines during vertical resize.
6. **P2-05 & P2-07 — Test Quality & Browser Verification**:
   - Remove the duplicate test in `apps/web/test/control-sizes.test.mjs`, expand token/weight/table/typography/textarea assertions, add negative mutation cases, replace hardcoded consumer pixel assertions with root-token resolution in browser scripts (keeping `36/40/48px` at the owner contract test and `44.5px` documented Customer row density), and run full Chromium CDP computed-style, runtime token override, responsive, and regression verification.
7. **P3-01 — Search Input & Login Leading Icon Padding Geometry**:
   - Tokenize leading icon offsets and input `padding-left` using `--space-*` + `--icon-control-*` (`customers.module.css`, `carrier-connections.module.css`, `retail-packages.module.css`, `login.module.css`) so runtime `--icon-control-*` overrides cannot cause text/icon overlap.

---

## 3. Mandatory Reuse & Design Audit Matrix

| Field                        | Customer Table (`P1-01`)                                                                       | Typography & Table Density (`P2-01`, `P2-02`)                                                                   | `SelectButton` & `Textarea` (`P2-03`, `P2-04`)                                                                                                   | Input Icon Padding & Tests (`P3-01`, `P2-05`, `P2-07`)                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Component**                | `CustomerTable` action cell & `.detailLink`                                                    | Page/section/card headings, form labels, `.table`                                                               | `SelectButton`, `Textarea`                                                                                                                       | Search inputs, Login inputs, test suites & CDP scripts                                                                               |
| **Existing implementations** | `customers.module.css` (`48.5px` rows at `75c95d7`)                                            | `tokens.css`, `globals.css`, `Panel.module.css`, feature CSS (`16px/700` headings, `12px` tables)               | `SelectButton.module.css` (`11px` override), `Controls.module.css` (`58px` textarea min-height)                                                  | `customers.module.css`, `carrier-connections.module.css`, `retail-packages.module.css`, `login.module.css`, `control-sizes.test.mjs` |
| **Domain owner**             | Customers UI (`apps/web/features/customers`)                                                   | Shared Web Theme (`apps/web/styles`) & Feature CSS                                                              | Shared UI (`packages/ui`)                                                                                                                        | Feature/Auth UI & Test Suites                                                                                                        |
| **Reuse alternatives**       | Reduce `actionCell` `padding-block` vs shrink Button to `32px`                                 | Reuse existing `--font-size-*`/`--line-height-normal` vs second scale; `12px` vs `13px` table                   | Inherit `Button` font in standard `SelectButton`; scope `text-actions` exception; attribute selector for `rows`                                  | Compute `padding-left` from `--space-*` + `--icon-control-*` vs new `InputGroup` wrapper                                             |
| **Selected approach**        | `.table td.actionCell { padding-block: var(--space-1); }`; `td.detailCell a.detailLink` `26px` | `h1` `20/600/28`, `h2` `16/600/24`, `label` `14/500/20`, `--type-table-cell-size: var(--font-size-sm)` (`12px`) | Standard `SelectButton` inherits `Button` (`14px/500`); `textActions` keeps `11px`; `Textarea` 3-line min via `:not([rows="1"]):not([rows="2"])` | Tokenized `calc()` `padding-left`; deduplicate `control-sizes.test.mjs`; browser computed-style & override probes                    |
| **Rationale**                | Preserves `36px` actions & `~44.5px` density without `!important` or fixed `tr` height         | Aligns actual rendered UI and table density (`12px`) with canonical tokens                                      | Eliminates accidental `11px` override while honoring `336px` column picker & `rows={1}`/`rows={2}`                                               | Prevents icon/text overlap under runtime overrides without unnecessary abstraction                                                   |
| **Risks**                    | Table cell borders/baselines pushing row above `46px`                                          | Existing `carrier-browser-checks` expecting `700` heading weight; mobile heading wrap                           | Compact popover wrapping if `text-actions` changed; selector policy checks on `rows` attr                                                        | Test baseline regressions in `pager-filter-browser-checks` / `customer-browser-checks`                                               |
| **Verification**             | `workspace-geometry-checks`, `customer-browser-checks`, Chrome CDP probe                       | `form-control-contracts.test.mjs`, `carrier-browser-checks`, Chrome CDP probe                                   | `shared-ui.test.mjs`, `pager-filter-browser-checks`, Chrome CDP probe                                                                            | `control-sizes.test.mjs`, `retail-browser-checks`, `m1-visual-checks`, full `pnpm quality` & CI                                      |

---

## 4. Tactical DDD & Architectural Boundaries

All Tactical DDD boundaries (`Presentation -> Application -> Domain`, `Infrastructure -> Domain`), Tier A/B/C UI ownership, Brand Navy/Orange palette, and API/SDK/DB zero-drift invariants remain unchanged from v1.

---

## 5. Verification Plan

1. **Phase 1 RED**: Record failing assertions for `P1-01` (`48.5px` vs `<= 46px`), `P2-01` (`custH1`/`retailH1`/`carrierH1` `20px/600/28px`), `P2-02` (`--type-table-cell-size: var(--font-size-sm)` + `.table` consumers), `P2-03` (standard `SelectButton` `14px`), `P2-04` (`Textarea` `min-height: 78px/86px/106px` for `rows >= 3` while allowing `rows={1}`/`{2}`), and `P3-01` (semantic `searchInput` `calc()` padding).
2. **Targeted & Full Quality**: `node --test apps/web/test/control-sizes.test.mjs ...`, `pnpm --filter @nexora/web test`, `pnpm --filter @nexora/web typecheck`, `pnpm quality`, Docker quality + fixture builds + real Chromium CDP measurements (`pager-filter-browser-checks.mjs`, isolated runtime smoke if supported, and GitHub Foundation CI on final HEAD).
