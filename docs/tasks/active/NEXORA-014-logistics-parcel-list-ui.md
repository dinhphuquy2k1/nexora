# Task: NEXORA-014 — Logistics Individual Parcels List UI

- **Task ID**: `NEXORA-014`
- **Status**: `VERIFICATION PENDING`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `VERIFIED`

---

## 1. Provenance & Baseline

- **Repository**: `https://github.com/dinhphuquy2k1/nexora`
- **Starting Main SHA**: `9b4f0b3`
- **Working Branch**: `feat/logistics-parcel-list-ui`
- **Task Classification**: `SIGNIFICANT`

---

## 2. Objective & Scope

Implement the Individual Parcels List ("Kiện hàng lẻ") UI inside the existing Nexora workspace:

1. **Navigation & Routing**:
   - Register `/logistics/parcels` under the `Logistics` navigation group with Vietnamese label "Kiện hàng lẻ".
   - Update navigation contract and unit tests in `apps/web/test/navigation.test.mjs`.
2. **Page & Layout**:
   - Page header with title "Kiện hàng lẻ", operational subtitle, and visibly disabled "Tạo mới" action with accessible "Chưa triển khai" explanation.
   - Status-filter tabs with accurate fixture item counts:
     - Tất cả
     - Đang đến kho gửi
     - Đã về kho gửi
     - Đang về kho nhận
     - Đã về kho nhận
     - Đã giao hàng
     - Khiếu nại
   - Search input for tracking numbers ("Tìm mã vận đơn...") with instant filtering and clear action.
3. **Data & Table Presentation**:
   - Deterministic local fixture dataset covering all statuses, long product names, and missing/in-progress values.
   - Prioritized columns (tracking number, product name, status, weight, key dates, total amount).
   - Secondary operational columns (domestic shipping fee, declared value, quantity of items, services: insurance, inspection, wooden crate, bubble wrap).
   - Right-aligned monetary and numeric values with Vietnamese formatting.
   - Horizontal scrolling on desktop with sticky tracking code; deliberate compact card list layout on mobile (<768px).
4. **State & Interactions**:
   - Search filtering, status filtering, page reset on filter changes, pagination controls.
   - URL query parameter synchronization (`?status=...&q=...&page=...`) with back/forward history support.
   - Accessible empty and no-results states with reset action.
5. **Architectural & Design Standards**:
   - Feature-local component architecture under `apps/web/features/parcels/`.
   - Adhere strictly to 2-tier design tokens and CSS Modules.
   - Zero backend, Prisma, or API modifications.

---

## 3. Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- Added `/logistics/parcels` route and `Logistics` navigation group to navigation configuration.
- Added feature-local parcel management module under `apps/web/features/parcels/`.

### Canonical owners

- `docs/architecture/frontend.md`

### Documentation verification

- `pnpm docs:check`

---

## 4. Evidence

| Claim                                                      | Evidence                                                                                                                                                                                  | Date       | Result |
| :--------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Navigation contract and breadcrumb unit tests pass         | `node --test apps/web/test/navigation.test.mjs` (6 tests passing)                                                                                                                         | 2026-10-13 | PASS   |
| Shared UI primitives and token reference tests pass        | `node --test apps/web/test/shared-ui.test.mjs` (4 tests passing)                                                                                                                          | 2026-10-13 | PASS   |
| Parcels fixtures, column config, and formatters unit tests | `node --test apps/web/test/parcels.test.mjs` (8 tests passing: fixtures, formatters, column defaults, parsing, ordering, page sizes 5/10/20/50/100, parser resilience, clamping)          | 2026-10-13 | PASS   |
| Web application typecheck passes with zero errors          | `pnpm --filter @nexora/web typecheck` (`tsc --noEmit`)                                                                                                                                    | 2026-10-13 | PASS   |
| Repository boundaries and ESLint checks pass               | `pnpm lint` (`boundaries.mjs` + `eslint .`)                                                                                                                                               | 2026-10-13 | PASS   |
| Prettier formatting check passes across all files          | `pnpm format:check` (`prettier --check .`)                                                                                                                                                | 2026-10-13 | PASS   |
| Documentation governance, links, and task schema pass      | `pnpm docs:check` (`node scripts/docs-check.mjs`)                                                                                                                                         | 2026-10-13 | PASS   |
| Next.js production build succeeds with parcels route       | `pnpm --filter @nexora/web build` (prerenders all routes, 0 errors)                                                                                                                       | 2026-10-13 | PASS   |
| Real Docker container build and restart succeeds           | `docker compose build web; docker compose up -d web`                                                                                                                                      | 2026-10-13 | PASS   |
| Interactive Chromium browser verification across viewports | Desktop 1440×900 (0 outer scroll, 805px client=scroll), 1366×768, Tablet 768px, Mobile 390px/320px, page sizes 5/10/20/50, 2-row card hugging, sticky column, and sidebar toggle verified | 2026-10-13 | PASS   |

---

## 5. Verification Gaps & Pre-Merge State

- **Hosted CI on Merge Commit**: Hosted GitHub Actions CI run on the eventual `main` merge commit cannot be executed or collected until the PR is merged.
- **Task Lifecycle Decision**: The task remains `VERIFICATION PENDING` in `docs/tasks/active/` during the PR review. Transition to `docs/tasks/completed/` is performed upon merge to `main`.
