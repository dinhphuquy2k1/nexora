# NEXORA-064 Design Snapshot — Design System Refinement: Control Sizing, Typography & Visual Consistency

## 1. Task Metadata & Classification

- **Task ID**: `NEXORA-064`
- **Task Title**: Design System Refinement: Control Sizing, Typography & Visual Consistency
- **Classification**: `SIGNIFICANT`
- **Documentation Impact**: `REQUIRED`
- **Target Branch & PR**: `refactor/design-system-refinement`
- **Plan revision**: `rev-2026-11-26-design-system-refinement-v1`
- **Design Snapshot**: `docs/tasks/design-reviews/NEXORA-064-rev-2026-11-26-design-system-refinement-v1.md`
- **Reviewed Baseline HEAD**: `c44cf4010fe30a6a7bfe0a3d397e65fb56381e15`

---

## 2. Requirements & Boundary Scope

- **User Story / Business Need**:
  Refine Nexora's Design System for an enterprise SaaS, clean, compact, data-dense, professional, consistent, and accessible UI without redesigning the application or changing business logic, APIs, database, or architecture.
- **In-Scope Items**:
  1. Elevate canonical default control size from `32px` to `36px` (`--control-size-default: 36px`), keeping `medium: 40px` and `large: 48px`.
  2. Refine control icon sizes to `16px / 18px / 20px` (`--icon-control-default/medium/large`) and control typography to `14px / 14px / 16px` (`--control-font-size` = `14px`, `--control-font-size-large` = `16px`, line heights `20px / 20px / 24px`).
  3. Standardize semantic typography hierarchy (`Page title` 20px/600/28px, `Section heading` 16px/600/24px, `Body` 14px/400/21px, `Form label` 14px/500/20px, `Input` 14px/400/20px, `Button` 14px/500/20px) while preserving `13px` (`--font-size-base` / `--type-table-cell-size`) data density in tables, badges, metadata, sidebar, and compact menus.
  4. Apply `font-variant-numeric: tabular-nums` on numeric table/stat consumers where appropriate without changing formatting logic.
  5. Upgrade Login, MFA, and Setup primary form controls to `size="large"` (`48px`), and resolve or document hardcoded control sizes (`customers.module.css`, `carrier-connections.module.css`, `login.module.css`).
  6. Synchronize canonical documentation (`PROJECT_RULES.md`, `design-system.md`, `frontend.md`, `reusable-components.md`, `testing.md`), update contract/runtime-override/browser tests test-first, and run quality + Docker/browser verification.
- **Explicit Non-Goals & Out-of-Scope Items**:
  - No full dashboard redesign; no Brand Navy/Orange palette changes; no font family change from Inter; no new UI/CSS/browser frameworks (Tailwind, shadcn, MUI, Playwright).
  - No new size variants (`small`, `compact`, `xs`, `xl`, `base`).
  - No API, database, Prisma schema, SDK contract, Sync Engine, Uniship, auth logic, pagination logic, or filter behavior changes.
  - No alteration of historical immutable design snapshots (`NEXORA-008`, `NEXORA-031`, `NEXORA-037`, `NEXORA-045`, `NEXORA-047`); this revision supersedes prior `32px` default sizing and `13px` control font rules.

---

## 3. Relevant Documentation & Canonical Owners

- **Governing ADRs**: `ADR-002` (product scope), `ADR-003` (engineering governance), `ADR-009` (mandatory pre-code design review).
- **Architecture Docs**: `docs/architecture/design-system.md`, `docs/architecture/frontend.md`, `docs/architecture/reusable-components.md`.
- **Operations & Governance Docs**: `docs/operations/testing.md`, `docs/ai/PROJECT_RULES.md`, `docs/ai/IMPLEMENTATION_WORKFLOW.md`, `docs/ai/TASK_WORKFLOW.md`.

---

## 4. Existing Code References & Audit Classification

- **Searched Directories**: `apps/web/styles/`, `apps/web/app/`, `apps/web/components/`, `apps/web/features/`, `packages/ui/src/`, `apps/web/test/`, `scripts/`.
- **Hardcoded Size Audit Classification**:
  1. **Shared control consumer (via tokens)**: `Controls.module.css`, `TabBar.module.css` (`.scrollButton`), `SelectButton.module.css` (`.stackedItem`), `Sidebar.module.css` (`.navItemLink`, `.navItemDisabled`), `customers.module.css` (`min-height: var(--control-size-default)`), `retail-packages.module.css` (column search input/clear).
  2. **Feature-local control sizing override (to refine/tokenize)**:
     - `customers.module.css`: `.skeletonActionBtn` (`32px` -> `var(--control-size-default)`), `.detailLink` & `.skeleton_detail` (`26px` -> evaluate `buttonClassName` vs documented dense-table exception; keep `26px` only if row height `44.5px` density requires it, or migrate if compatible), `.searchIcon` (`14px` -> `var(--icon-control-default)`), `.searchInput` (`padding-left/right: 32px` -> `calc(var(--space-3) + var(--icon-control-default) + var(--space-2))` or `36px`).
     - `carrier-connections.module.css`: `.readonlyField` (`height: 32px` -> `min-height: var(--control-size-default)`), `.switchTarget` (`Button` already uses `--_control-height` while `.switchTrack` stays `40x22px` visual geometry).
     - `login.module.css`: `.inputWrapper input` / `.togglePasswordBtn` / `.inputIcon svg` -> align with `size="large"` (`48px` height, `20px` icon, `padding-left: calc(var(--control-padding-large) + var(--icon-control-large) + var(--space-2))` or `48px` square toggle).
  3. **Container / Decorative / Navigation geometry (do NOT change to 36px)**:
     - `workspace-layout.module.css` (`48x48` spinner/container), `login.module.css` (`.logoMonogram` `44x44`), `Sidebar.module.css` (`34x34` monogram), `carrier-connections.module.css` (`.clockIcon` `28x28`, `.drawerBrand` `36x36`/`32x32`, `.providerLogo` `28x28`, `.typeIcon` `32x32`, `.switchTrack` `40x22`), `retail-packages.module.css` (`.carrierBadge` `32x32`, `.skeleton` `28x28`), `customers.module.css` (`.skeleton_addresses` `44x20`).

---

## 5. Mandatory Reuse & Design Audit Matrix

| Field                        | Design Tokens (`tokens.css`)                                                                                                                                                            | Shared Controls (`Controls.tsx` / `.module.css`)                                                                                                                                                                 | Composite UI (`SelectButton`, `Pager`, `TabBar`, `Overlay`, `Panel`, `StatusBadge`, `Toast`)                                                          | Shell & Auth (`Sidebar`, `AccountMenu`, `Login`, `MFA`, `Setup`)                                                                                                                                                                                      | Feature Consumers (`Customers`, `Retail`, `Carrier`)                                                                                                                                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Component**                | Public size, icon, and semantic typography tokens                                                                                                                                       | `Button`, `TextInput`, `Select`, `Textarea`, `Checkbox`, `IconButton`                                                                                                                                            | `SelectButton`, `Pager`, `TabBar`, `Overlay`, `Panel`, `StatusBadge`, `Toast`                                                                         | `Sidebar`, `AccountMenu`, `LoginForm`, `SetupForm`                                                                                                                                                                                                    | Search inputs, action buttons, `.readonlyField`, `.skeletonActionBtn`, `.detailLink`, `Switch`, numeric cells                                                                                                                                                       |
| **Existing implementations** | `apps/web/styles/tokens.css` (`32/40/48`, `14/16/18`, `--type-body-size: 13px`)                                                                                                         | `packages/ui/src/Controls.tsx`, `Controls.module.css` (`--_control-*`, `font-weight: 600`)                                                                                                                       | `packages/ui/src/*.tsx`, `*.module.css`                                                                                                               | `Sidebar.module.css`, `AccountMenu.tsx`, `LoginForm.tsx`, `SetupForm.tsx`                                                                                                                                                                             | `customers.module.css`, `retail-packages.module.css`, `carrier-connections.module.css`                                                                                                                                                                              |
| **Domain owner**             | Shared Web Theme (`apps/web/styles/`)                                                                                                                                                   | Shared UI (`packages/ui`)                                                                                                                                                                                        | Shared UI (`packages/ui`)                                                                                                                             | AppShell & Auth (`apps/web/components`, `apps/web/app`)                                                                                                                                                                                               | Feature modules (`apps/web/features/*`)                                                                                                                                                                                                                             |
| **Reuse alternatives**       | Edit canonical tokens vs add duplicate aliases                                                                                                                                          | Extend `--_control-*` private vars vs create new variants                                                                                                                                                        | Reuse `Button`/`Select`/tokens vs custom controls                                                                                                     | Use `size="large"` on `TextInput`/`Button` vs CSS overrides                                                                                                                                                                                           | Use semantic tokens & `Controls` vs hardcoded `32px`                                                                                                                                                                                                                |
| **Selected approach**        | Update `--control-size-default: 36px`, `--icon-control-*: 16/18/20px`, `--control-font-size: 14px`, `--control-font-size-large: 16px`, `--type-*-size` + `--type-table-cell-size: 13px` | Add `--_control-font-size` & `--_control-line-height` per `data-size`; button weight `500`; `font: inherit` replaced cleanly so line-height is not clobbered; keep `multiple` auto-height & `Textarea` multiline | Keep `SelectButton`/`Pager`/`TabBar` consuming `--control-size-default`; verify `Overlay`/`Panel`/`StatusBadge`/`Toast` preserve density & typography | `LoginForm` (login + MFA) & `SetupForm` primary inputs/submit use `size="large"`; `AccountMenu` trigger stays `medium` (`40px`), rows `default` (`36px`); `Sidebar` keeps `min-height: var(--control-size-default)` or dedicated nav height if needed | Update `.skeletonActionBtn`, `.readonlyField`, `.searchIcon` to semantic tokens; keep dense `.detailLink` (`26px`) documented exception if `44.5px` row contract requires it; keep `Switch` track `40x22` inside `36px` target; add `tabular-nums` on numeric cells |
| **Rationale**                | Preserves single source of truth and `13px` table density                                                                                                                               | Uniform `36/40/48` parity and runtime override propagation                                                                                                                                                       | Zero duplicate primitives; automatic token propagation                                                                                                | Aligns auth primary ergonomics (`48px`) without changing business logic                                                                                                                                                                               | Eliminates stale `32px` hardcodes while preserving dense table layout                                                                                                                                                                                               |
| **Risks**                    | Global `14px` body leaking into tables/badges                                                                                                                                           | `font: inherit` or specificity breaking line-height or `Textarea`                                                                                                                                                | `SelectButton` total height increase (`38->42px`)                                                                                                     | `login.module.css` icon/toggle alignment at `48px`                                                                                                                                                                                                    | Customer `44.5px` row height or skeleton parity drift                                                                                                                                                                                                               |
| **Verification**             | `form-control-contracts.test.mjs`, runtime override CDP test                                                                                                                            | `control-sizes.test.mjs`, `shared-ui.test.mjs`, CDP computed styles                                                                                                                                              | `pager-filter-sharing.test.mjs`, `shared-ui.test.mjs`, browser checks                                                                                 | `auth-frontend.test.mjs`, `mfa-login.test.mjs`, `setup.test.mjs`, `account-menu.test.mjs`                                                                                                                                                             | `customer-table.test.mjs`, `retail-packages.test.mjs`, `carrier-connections.test.mjs`, browser checks                                                                                                                                                               |

---

## 6. Alternative Designs & Trade-offs

- **Alternative 1: Global search-and-replace `32px` -> `36px` across CSS**:
  - _Why Rejected_: Conflates semantic control height with decorative badges (`carrierBadge`), avatars (`--account-avatar-trigger-size`), and layout spacing (`--space-8`).
- **Alternative 2: Increase `--font-size-base` from `13px` to `14px`**:
  - _Why Rejected_: Violates data-dense table ergonomics in Customer and Retail tables and breaks `44.5px` row density. Keeping `--font-size-base: 13px` and adding `--type-table-cell-size: var(--font-size-base)` while setting `--type-body-size: var(--font-size-md)` (`14px`) separates body prose from dense table cells cleanly.
- **Alternative 3: Add `size="compact"` or `size="small"` variant**:
  - _Why Rejected_: Explicitly prohibited; `default` (`36px`), `medium` (`40px`), and `large` (`48px`) remain the sole three public sizes.

---

## 7. Selected Design & UI Architecture Alignment

- **Tier A (`packages/ui`)**: Owns `Controls.tsx`, `Controls.module.css`, `SelectButton`, `Pager`, `TabBar`, `Panel`, `Overlay`, `StatusBadge`, `Toast`. Private `--_control-*` variables remain scoped to `Controls.module.css`.
- **Tier B (`apps/web/components`)**: `Sidebar`, `Header`, `AccountMenu` consume shared `Button` and semantic tokens.
- **Tier C (`apps/web/features`)**: Feature CSS owns widths, local icon offsets, and table layouts; never shadows `--control-size-*` or overrides `Controls` hover/focus/disabled states.
- **Input Background Assessment**: Keep `--control-bg: var(--color-surface-muted)` (`#F8FAFC`) and `--control-bg-focus: var(--color-surface)` (`#FFFFFF`) unless visual comparison shows white resting background is strictly superior without losing contrast against `--color-surface` cards/drawers. (Current `#F8FAFC` resting background cleanly distinguishes inputs on `#FFFFFF` cards and drawers).

---

## 8. Accessibility, Visual Fidelity & Compatibility

- **Palette Fidelity**: Brand Navy `#172B4D` and Brand Orange `#F58A24` with `#FFFFFF` foreground remain unchanged per `NEXORA-031` v4 color policy.
- **Non-Color Accessibility**: `36px` minimum default interactive targets (`40px` medium, `48px` large), visible `:focus-visible` outlines, accessible names on all icon-only buttons, native `Select`/`Textarea`/`Checkbox` keyboard semantics preserved.
- **API / SDK / DB Compatibility**: Zero backend, schema, migration, or OpenAPI/SDK contract impact.

---

## 9. Test-First & Verification Plan

1. **Test-first (RED -> GREEN)**: Update `apps/web/test/control-sizes.test.mjs`, `apps/web/test/form-control-contracts.test.mjs`, and relevant consumer tests (`auth-frontend.test.mjs`, `mfa-login.test.mjs`, `setup.test.mjs`, `customer-table.test.mjs`, etc.) to assert the `36/40/48px` contract, `14/14/16px` control font sizes, `16/18/20px` icon sizes, `500` button weight, `13px` table density preservation, and runtime token override propagation.
2. **Quality Gates**: `pnpm --filter @nexora/web test`, `pnpm --filter @nexora/web typecheck`, `pnpm quality`, `pnpm docs:check`, `pnpm preflight:check`.
3. **Browser & Docker Verification**: Run `sh scripts/quality-docker.sh` and available Chromium/CDP browser harnesses (`browser-login-smoke.mjs`, `account-menu-browser-checks.mjs`, `customer-browser-checks.mjs`, `retail-browser-checks.mjs`, `carrier-browser-checks.mjs`, `pager-filter-browser-checks.mjs`) against the running local dev/test environment, recording exact viewports and any manual visual review limitations.
