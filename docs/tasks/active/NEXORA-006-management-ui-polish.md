# Task: NEXORA-006 — Management UI Polish, Header Cleanup & Collapsed Sidebar Fix

- **Task ID**: `NEXORA-006`
- **Status**: `VERIFICATION PENDING`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `PARTIALLY VERIFIED`

---

## 1. Provenance & Starting Baseline

- **Repository**: `https://github.com/dinhphuquy2k1/nexora`
- **Starting Main SHA**: `bb3645af9c5ad0d12efa491d6b40a05b73aebede` (PR #4 merged)
- **Working Branch**: `feat/management-ui-polish`
- **Task Classification**: `BOUNDED`

---

## 2. Objective & Scope

Refine Nexora's management UI shell into a clean, professional logistics management interface by addressing user-reported defects and visual distractions:

1. **Header Cleanup (Issue F1 & F4)**: Remove local-first badge ("Không gian cục bộ") and pseudo-user menu from Header. Remove duplicate Nexora branding when Sidebar is collapsed. Add a direct Settings navigation shortcut.
2. **Sidebar Technical Footer Removal (Issue F2)**: Remove the version and local-runtime footer from the Sidebar, reserving technical version details for `/settings`.
3. **Collapsed Sidebar Overflow & Layout (Issue F3)**: Eliminate horizontal scrollbar occurrences while preserving collapsed tooltip clarity, accessible names, and expanded vertical scrolling.
4. **Overview Page Hierarchy (Issue F5)**: Upgrade `/` from an oversized presentation to a crisp, enterprise information layout with clear cards and prominent connection test shortcut without inventing fake business data or KPIs.
5. **Sidebar UX Polish**: Standardize icon alignments, row heights, group spacing, and active states.

---

## 3. Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- Cleaned Header layout: removed "Không gian cục bộ" badge, removed pseudo-user menu, removed collapsed duplicate branding, and added direct Settings shortcut (`<Link href="/settings">`).
- Cleaned Sidebar layout: removed technical runtime footer note, dedicating the sidebar entirely to navigation.
- Verified absence of horizontal document scrollbar across desktop viewports in collapsed and expanded modes (`scrollWidth <= clientWidth`).
- Restructured Overview page (`/`) information hierarchy with concise headings, compact notice, and structured capability cards (`01. Khách hàng & Vận đơn`, `02. Theo dõi & Lịch sử trạng thái`, `03. Đồng bộ đối tác vận chuyển`).
- Preserved existing `/system` real API health checks and `/settings` technical configuration.

### Canonical owners

- `docs/architecture/frontend.md`

### Documentation verification

- `pnpm docs:check`

---

## 4. Evidence

| Claim                                                        | Evidence                                                               | Date       | Result |
| :----------------------------------------------------------- | :--------------------------------------------------------------------- | :--------- | :----- |
| Starting baseline confirmed on main with PR #4 merged        | `git rev-parse HEAD` (`bb3645a`)                                       | 2026-10-11 | PASS   |
| Navigation contract and resolver unit tests pass             | `pnpm --filter @nexora/web test` (6 tests passing)                     | 2026-10-11 | PASS   |
| Web application typecheck passes with 0 errors               | `pnpm --filter @nexora/web typecheck` (`tsc --noEmit`)                 | 2026-10-11 | PASS   |
| Monorepo tests and Next.js production build pass             | `pnpm test` (all 6 tasks pass, Next.js build succeeds)                 | 2026-10-11 | PASS   |
| Architecture boundaries and ESLint pass                      | `pnpm lint` (`boundaries.mjs` + `eslint .`)                            | 2026-10-11 | PASS   |
| Prettier formatting passes across all files                  | `pnpm format:check`                                                    | 2026-10-11 | PASS   |
| Documentation links and governance pass                      | `pnpm docs:check`                                                      | 2026-10-11 | PASS   |
| Browser viewport verification (1440×900, 1280×800, 1024×768) | Chrome subagent measurements: `scrollWidth <= clientWidth`, 0 overflow | 2026-10-11 | PASS   |

---

## 5. Verification Gaps & Pre-Merge State

- **Hosted CI on Merge Commit**: Hosted GitHub Actions CI run (`docker-foundation`) on the eventual `main` merge commit cannot be executed or collected until PR #5 is merged.
- **Task Lifecycle Decision**: The task remains `VERIFICATION PENDING` in `docs/tasks/active/` during PR #5. Transition to `docs/tasks/completed/` is explicitly deferred to a dedicated post-merge documentation follow-up once the merge commit SHA and its CI run are inspected.
