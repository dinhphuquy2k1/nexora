# Task: NEXORA-008 — Frontend Architecture & Design System Foundation

- **Task ID**: `NEXORA-008`
- **Status**: `VERIFICATION PENDING`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `PARTIALLY VERIFIED`

---

## 1. Provenance & Starting Baseline

- **Repository**: `https://github.com/dinhphuquy2k1/nexora`
- **Starting Main SHA**: `28c77d788b38f066a3ab0367343939aaf7ac3298`
- **Working Branch**: `refactor/frontend-design-system-foundation`
- **Task Classification**: `SIGNIFICANT`

---

## 2. Objective & Scope

Establish a maintainable frontend architecture and design system foundation for Nexora to prepare for future feature expansion without accumulating component duplication, uncontrolled global styling, or hardcoded visual values:

1. **Component Ownership**: Formalize 3 component tiers:
   - Tier A: Shared UI Primitives (`packages/ui`) - domain-agnostic, typed props, self-contained styles.
   - Tier B: Application-level Components (`apps/web/components/`) - shell layout, cross-page navigation.
   - Tier C: Feature-level Components (`apps/web/features/<feature>/`) - local state/types, consuming shared UI.
2. **Decouple `@nexora/ui` Styling**: Migrate `Panel` and `StatusBadge` from implicit reliance on `apps/web/app/styles.css` global classes to package-owned styling while maintaining full API backwards compatibility.
3. **Design Tokens**: Standardize foundation vs. semantic token layers, introduce semantic spacing (`--space-*`), radius (`--radius-*`), and elevation shadow (`--shadow-*`) tokens, replacing high-impact visual hardcodes.
4. **Token Ownership**: Formalize canonical design token ownership and consumption rules between packages and applications.
5. **Architectural Conventions**: Establish Server/Client component boundaries and feature data-fetching/UI-state conventions.
6. **Component Verification**: Add focused automated tests for shared UI primitives and verify theme override maintainability.

---

## 3. Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- Component ownership model (Shared UI, Application, Feature) and extraction criteria.
- `@nexora/ui` self-contained styling model and public contract.
- Semantic design token layering, spacing/radius scales, and ownership strategy.
- Server vs. Client Component architecture rules and feature data-fetching state guidelines.

### Canonical owners

- `docs/architecture/frontend.md`

### Documentation verification

- `pnpm docs:check`

---

## 4. Evidence

| Claim                                                                              | Evidence                                                                                                                                      | Date       | Result |
| :--------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Starting baseline confirmed on branch `refactor/frontend-design-system-foundation` | `git rev-parse HEAD` (`28c77d7`)                                                                                                              | 2026-10-11 | PASS   |
| `@nexora/ui` package typecheck passes                                              | `pnpm --filter @nexora/ui typecheck` (`tsc --noEmit`)                                                                                         | 2026-10-11 | PASS   |
| `@nexora/web` application typecheck passes                                         | `pnpm --filter @nexora/web typecheck` (`tsc --noEmit`)                                                                                        | 2026-10-11 | PASS   |
| Shared UI, design tokens, and navigation test suite passes                         | `pnpm --filter @nexora/web test` (11 tests passing)                                                                                           | 2026-10-11 | PASS   |
| Next.js production build succeeds with bundled `@nexora/ui` CSS modules            | `pnpm --filter @nexora/web build` (prerenders all routes, 0 errors)                                                                           | 2026-10-11 | PASS   |
| Architecture boundaries and lint checks pass                                       | `pnpm lint` (`boundaries.mjs` + `eslint .`)                                                                                                   | 2026-10-11 | PASS   |
| Prettier code and document formatting passes                                       | `pnpm format:check`                                                                                                                           | 2026-10-11 | PASS   |
| Documentation governance, links, and task schema pass                              | `pnpm docs:check`                                                                                                                             | 2026-10-11 | PASS   |
| Interactive browser verification & theme token override proof                      | Chrome subagent: `scrollWidth <= clientWidth`, Panel/Badge CSS modules verified, `--color-primary`/`--color-accent` dynamic override verified | 2026-10-11 | PASS   |
