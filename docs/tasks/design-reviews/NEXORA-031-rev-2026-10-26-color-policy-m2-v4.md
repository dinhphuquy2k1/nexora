# NEXORA-031 immutable design amendment — Design System Color Policy & Customer M2 v4

Task ID: NEXORA-031
Plan revision: rev-2026-10-26-color-policy-m2-v4
Reviewed baseline: fbc73e1e7688cf922e14283059816bb2e7319605

Captured 2026-10-26 (Asia/Saigon). Classification: SIGNIFICANT. Documentation Impact: REQUIRED. Branch: feat/customer-management-ui; existing PR #28 only. This is a proposed selected design, not implementation authorization. Approval and mutable execution evidence belong in the active task and PR. Do not modify this snapshot after attestation.

## 1. Task metadata and governing decisions

The owner's Design System Color Policy Revision & Customer UI Correction directive settles the following architectural decisions:

1. **Remove mandatory WCAG AA color-contrast enforcement** from the project's frontend color-design requirements. The owner has explicitly chosen visual fidelity to the selected palette over mandatory WCAG AA contrast enforcement. Normal text combinations such as `#F58A24` background + `#FFFFFF` foreground must not be rejected on contrast ratio alone.
2. **Restore the authoritative visual palette**: Primary actions, selected status tabs, and selected pagination pages render Brand Orange `#F58A24` background (hover `#E07716`) with White `#FFFFFF` foreground text and icons.
3. **Selected tab presentation**: Orange `#F58A24` background, White `#FFFFFF` label, White status dot, White 25% translucent count badge (`rgba(255, 255, 255, 0.25)`), and White count text. Unselected tabs use Slate `#475569` text with 80% white hover surface (`rgba(255, 255, 255, 0.8)`) and Navy `#172B4D` text.
4. **Power toggle action**: ACTIVE customer deactivation icon defaults to Slate-400 (`#94A3B8`), hovering to Slate-700 (`#334155`) with Slate-100 (`#F1F5F9`) surface. INACTIVE customer activation icon defaults to Emerald-600 (`#059669`), hovering to Emerald-700 (`#047857`) with Emerald-50 (`#ECFDF5`) surface.
5. **Status badges**: ACTIVE uses Emerald-50 bg (`#ECFDF5`), Emerald-700 text (`#047857`), Emerald-200 border (`#A7F3D0`), and Emerald-500 dot (`#10B981`). INACTIVE uses Slate-100 bg (`#F1F5F9`), Slate-600 text (`#475569`), Slate-200 border (`#CBD5E1`), and Slate-400 dot (`#94A3B8`).
6. **Canonical documentation independence**: The reference ZIP is a temporary input and will not be retained in the repository. All canonical design documentation must be permanent, self-contained, and specify exact hex and rgba values without referencing external files or archives.
7. **Preserve approved architecture**: Standard 32px default controls, nine-column semantic table colgroup with 240px Name width, table-wide Power single-flight lock, stable pagination view-model (`derivePaginationModel`), decoupled statistics freshness, and clean toolbar without unrequested secondary phone filter UI. Unrelated accessibility (semantic HTML, accessible labels, keyboard navigation, focus indicators, ARIA, modal focus) remains strictly preserved.

This revision supersedes conflicting color and contrast enforcement requirements in v3. Preserve v3 bytes and its historical approval: `docs/tasks/design-reviews/NEXORA-031-rev-2026-10-26-design-system-m2-v3.md`. No new task ID, branch or PR.

## 2. Requirements and boundaries

Deliver the owner-requested color policy revision and UI corrections on PR #28:

- Update canonical Design System documentation in `docs/architecture/design-system.md` with a self-contained, permanent Color System specification.
- Remove mandatory WCAG AA contrast gates from frontend acceptance tests and CI checks.
- Update `apps/web/styles/tokens.css` with exact foundation and semantic color mappings.
- Update shared `Button`, Tabs, Count badges, Pagination, Power actions, and StatusBadges to consume canonical semantic tokens.
- Maintain existing 32px control default, table geometry, stable pagination lifecycle, and clean toolbar.
- Preserve all existing backend, security, and data integrity invariants: real backend records, truthful `—` address counts, disabled Excel export, and authenticated owner-isolated mutations.

## 3. Documentation and canonical ownership

- `docs/architecture/design-system.md`: Authoritative owner of the permanent Color System, palette tables, semantic roles, component interaction states, and token ownership rules.
- `apps/web/styles/tokens.css`: Authoritative runtime definition of foundation and semantic CSS custom properties.
- `docs/ai/PROJECT_RULES.md`: Design system token compliance and removal of mandatory WCAG AA contrast enforcement.
- `docs/architecture/frontend.md`: Integration, component consumer architecture, and runtime token overrides.
- `docs/operations/testing.md`: Verification commands, updated color regression policies, and acceptance criteria.
- `docs/tasks/active/NEXORA-031-full-frontend-migration.md`: Mutable task lifecycle, verification evidence, and Git SHA tracking.

## 4. Read-only inventory and provenance

Search scope: `apps/web/styles/tokens.css`, `packages/ui/src/Controls.module.css`, `apps/web/features/customers/customers.module.css`, `scripts/customer-control-checks.mjs`, `apps/web/test/form-control-contracts.test.mjs`.

- Current `--color-text-on-accent` is set to `var(--brand-navy)` (`#172B4D`) due to v3 WCAG AA compromise.
- `scripts/customer-control-checks.mjs` and `apps/web/test/form-control-contracts.test.mjs` enforce `result.ratio >= 4.5`.
- Customer Add button in `CustomerListPage.tsx` renders `variant="primary"` which consumes `--color-text-on-accent`.
- Customer status tabs in `CustomerStatsBar.tsx` consume `variant="primary"` for selected tab.
- Selected pagination page in `CustomerPagination.tsx` consumes `variant="primary"`.

## 5. Eight-field reuse and design audit

| Component                 | Existing implementation             | Domain owner         | Alternatives                                       | Selected approach                                                                                | Rationale                                                                          | Risks                                                          | Verification                                            |
| :------------------------ | :---------------------------------- | :------------------- | :------------------------------------------------- | :----------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------- | :------------------------------------------------------------- | :------------------------------------------------------ |
| **Color System**          | `tokens.css`, `design-system.md`    | Tier A UI / theme    | WCAG AA contrast compromise; local CSS overrides   | Self-contained canonical palette with exact token mappings; remove 4.5:1 contrast enforcement    | Owner decision for visual fidelity; permanent documentation without ZIP dependency | Low contrast for vision-impaired users (acknowledged by owner) | Computed styles match token values; token cascade tests |
| **Primary Accent Button** | `Button variant="primary"`          | Tier A UI            | Feature-local CSS override; darker orange          | `--color-accent: #f58a24; --color-text-on-accent: #ffffff;`                                      | Unified primary action styling across all pages                                    | Divergence from previous navy text                             | Computed style: bg `#f58a24`, text `#ffffff`            |
| **Status Tabs**           | `CustomerStatsBar.tsx`              | Customer feature     | Generic button; custom tab component               | Semantic tab tokens with White text, White dot, and 25% white translucent count badge            | Exact visual parity with permanent design contract                                 | Styling conflicts with unselected state                        | Computed styles for all 3 tabs: All, Active, Inactive   |
| **Pagination Selected**   | `CustomerPagination.tsx`            | Customer feature     | Local class override; dark emphasis                | Semantic pagination tokens: `#f58a24` bg, `#ffffff` text, `#f58a24` border                       | Consistent accent contract across navigation                                       | Unselected page border contrast                                | Computed style: bg `#f58a24`, text `#ffffff`            |
| **Power Actions**         | `CustomerTable.tsx`                 | Customer feature     | Bare SVG color; generic text tokens                | Semantic `.powerDeactivate` and `.powerActivate` classes with status-dependent hover             | Changes icon and background together on interactive button                         | Precedence over ghost hover                                    | CDP mouse simulation: default & hover colors            |
| **StatusBadges**          | `StatusBadge.module.css`            | Tier A UI            | Hardcoded table row styles                         | Semantic status border tokens (`--color-status-success-border`, `--color-status-pending-border`) | Reusable outlined chip with semantic dots                                          | StatusBadge consumer impact                                    | Computed styles for Active and Inactive rows            |
| **Pagination Model**      | `pagination.ts`                     | Customer feature     | Unbounded cache; page reset                        | Pure `derivePaginationModel` reusing same-scope statistics                                       | Zero visible flicker or layout jumps during transitions                            | Metadata mismatch across scopes                                | 5 unit tests covering cold start, transitions, bounds   |
| **Governance / Tests**    | `preflight-policy-check.mjs`, tests | Quality / Operations | Disable all contrast tests; leave stale assertions | Replace `>= 4.5:1` contrast assertions with token/palette fidelity verification                  | Verifies intended colors without blocking on contrast                              | Inadvertent test breakage                                      | Full Node suite (40 tests) PASS; Preflight PASS         |

## 6. Alternatives and tradeoffs

The owner's decision to prioritize visual palette fidelity over mandatory WCAG AA color contrast is explicit and settled. Rejected alternatives:

- Darkening background to `#BF570B` to force WCAG AA compliance (rejected by owner).
- Using Navy `#172B4D` foreground on bright orange `#F58A24` (rejected by owner).
- Hardcoding `#FFFFFF` in local feature CSS classes (violates token architecture).
- Making documentation refer to an external ZIP file (violates permanent self-contained documentation requirement).

Tradeoff: Normal text on `#F58A24` background will have a contrast ratio of ~2.46:1 against `#FFFFFF`. This is an authorized design choice. All other non-color accessibility requirements (keyboard navigation, focus rings, semantic markup, ARIA roles, screen reader announcements) remain strictly enforced.

## 7. Selected design and interfaces

### A. Foundation Palette Tokens (`apps/web/styles/tokens.css`)

```css
--brand-navy: #172b4d;
--brand-navy-dark: #0f1d36;
--brand-navy-light: #1e3a5f;
--brand-orange: #f58a24;
--brand-orange-dark: #e07716;
--brand-orange-light: #fff7ed;
--color-white: #ffffff;

--gray-50: #f8fafc;
--gray-100: #f1f5f9;
--gray-200: #e2e8f0;
--gray-300: #cbd5e1;
--gray-400: #94a3b8;
--gray-500: #64748b;
--gray-600: #475569;
--gray-700: #334155;
--gray-800: #1f2937;
--gray-900: #0f172a;

--emerald-50: #ecfdf5;
--emerald-200: #a7f3d0;
--emerald-500: #10b981;
--emerald-600: #059669;
--emerald-700: #047857;
```

### B. Semantic Component Color Contracts

```css
/* Primary accent action (Button variant="primary" & variant="emphasis") */
--color-accent: var(--brand-orange);
--color-accent-hover: var(--brand-orange-dark);
--color-text-on-accent: var(--color-white);
--color-text-on-accent-hover: var(--color-white);
--color-action-emphasis-bg: var(--brand-orange);
--color-action-emphasis-hover: var(--brand-orange-dark);
--color-action-emphasis-text: var(--color-white);

/* Status tab semantics */
--color-tab-selected-bg: var(--brand-orange);
--color-tab-selected-text: var(--color-white);
--color-tab-unselected-text: var(--gray-600);
--color-tab-unselected-hover-bg: rgba(255, 255, 255, 0.8);
--color-tab-unselected-hover-text: var(--brand-navy);

/* Count badge semantics */
--color-count-selected-bg: rgba(255, 255, 255, 0.25);
--color-count-selected-text: var(--color-white);
--color-count-unselected-bg: var(--color-white);
--color-count-unselected-text: var(--gray-600);

/* Power toggle action semantics */
--color-action-deactivate: var(--gray-400);
--color-action-deactivate-hover: var(--gray-700);
--color-action-deactivate-hover-bg: var(--gray-100);
--color-action-activate: var(--emerald-600);
--color-action-activate-hover: var(--emerald-700);
--color-action-activate-hover-bg: var(--emerald-50);

/* StatusBadge semantics */
--color-status-success-bg: var(--emerald-50);
--color-status-success-text: var(--emerald-700);
--color-status-success-border: var(--emerald-200);
--color-status-pending-bg: var(--gray-100);
--color-status-pending-text: var(--gray-600);
--color-status-pending-border: var(--gray-300);
```

## 8. Security, concurrency and performance

- All mutations maintain existing single-flight locks and CSRF/Session guards.
- No new network requests; statistics revalidation reuses list read lifecycle.
- Zero client-side simulated data or mock arrays.

## 9. Compatibility, risk and rollback

- Breaking change to frontend color tokens: `--color-text-on-accent` transitions from `#172b4d` to `#ffffff`.
- Automated tests updated to assert token fidelity instead of contrast ratio threshold.
- Rollback plan: Revert commit series on `feat/customer-management-ui` back to `fbc73e1`.

## 10. Test-first migration and acceptance

1. Update tests in `apps/web/test/form-control-contracts.test.mjs` and `scripts/customer-control-checks.mjs` to verify canonical token values rather than `>= 4.5:1` contrast ratio.
2. Update tokens in `apps/web/styles/tokens.css` and component styles in `customers.module.css`.
3. Verify with real Chrome CDP session: Add Customer, Selected Tabs, Selected Pagination, Count Badges, Power buttons, and StatusBadges.
4. Run full test suite: Preflight, format check, lint, typecheck, unit tests.

## 11. Approval and evidence integrity

At capture: PENDING_REVIEW. Authority: dinhphuquy2k1.
Publish raw-byte digest in active task metadata and request authenticated owner approval before applying code changes.

## 12. Plan issues and checkpoint boundaries

- COLOR_CONTRAST_POLICY: Owner explicitly supersedes WCAG AA contrast for the selected brand orange/white palette.
- PERMANENT_DOCS: Canonical documentation in `docs/architecture/design-system.md` is self-contained with zero external archive references.
