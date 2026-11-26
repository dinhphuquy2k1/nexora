# NEXORA-064 — Design System Refinement: Control Sizing, Typography & Visual Consistency

Status: VERIFICATION PENDING
Capability: IMPLEMENTED
Verification: PARTIALLY VERIFIED

## Design Review & Reuse Decision

Task ID: NEXORA-064
Classification: SIGNIFICANT
Plan revision: rev-2026-11-26-design-system-refinement-v1
Reviewed baseline: c44cf4010fe30a6a7bfe0a3d397e65fb56381e15
Branch: refactor/design-system-refinement
Design Snapshot: docs/tasks/design-reviews/NEXORA-064-rev-2026-11-26-design-system-refinement-v1.md
Design SHA-256: 7a07b03e1c99ebd43ddaeb2c549b288caa4c1e274d07d11be7242f53480ebb96

| Field                        | Design Tokens (`tokens.css`)                                                                                                                                                            | Shared Controls (`Controls.tsx` / `.module.css`)                                                                                                   | Shell, Auth & Feature Consumers                                                                                                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Component**                | Public size, icon, and semantic typography tokens                                                                                                                                       | `Button`, `TextInput`, `Select`, `Textarea`, `Checkbox`, `IconButton`                                                                              | `LoginForm`, `SetupForm`, `Sidebar`, `AccountMenu`, `Customers`, `Retail`, `Carrier`                                                                                                                        |
| **Existing implementations** | `apps/web/styles/tokens.css` (`32/40/48`, `14/16/18`, `--type-body-size: 13px`)                                                                                                         | `packages/ui/src/Controls.tsx`, `Controls.module.css` (`--_control-*`, weight `600`)                                                               | `login.module.css`, `customers.module.css`, `carrier-connections.module.css`, `retail-packages.module.css`                                                                                                  |
| **Domain owner**             | Shared Web Theme (`apps/web/styles/`)                                                                                                                                                   | Shared UI (`packages/ui`)                                                                                                                          | Owning AppShell / Auth / Feature modules                                                                                                                                                                    |
| **Reuse alternatives**       | Edit canonical tokens vs add duplicate aliases                                                                                                                                          | Extend `--_control-*` private vars vs add new size variants                                                                                        | Use `size="large"` & semantic tokens vs feature-local `32px` hardcodes                                                                                                                                      |
| **Selected approach**        | Update `--control-size-default: 36px`, `--icon-control-*: 16/18/20px`, `--control-font-size: 14px`, `--control-font-size-large: 16px`, `--type-*-size` + `--type-table-cell-size: 13px` | Add `--_control-font-size` & `--_control-line-height` per `data-size`; button weight `500`; preserve `multiple` auto-height & `Textarea` multiline | Auth primary controls use `size="large"`; replace stale `32px`/`14px` hardcodes with tokens; keep dense `.detailLink` (`26px`) and `Switch` track (`40x22`) documented; add `tabular-nums` on numeric cells |
| **Rationale**                | Single source of truth while preserving `13px` table density                                                                                                                            | Uniform `36/40/48` parity and runtime override propagation                                                                                         | Eliminates hardcoded `32px` drift without changing business logic or layout density                                                                                                                         |
| **Risks**                    | Global `14px` body leaking into tables/badges                                                                                                                                           | `font: inherit` or specificity breaking line-height or `Textarea`                                                                                  | `44.5px` customer row height or login `48px` icon alignment                                                                                                                                                 |
| **Verification**             | `form-control-contracts.test.mjs`, runtime override CDP test                                                                                                                            | `control-sizes.test.mjs`, `shared-ui.test.mjs`, CDP computed styles                                                                                | Feature unit tests, browser checks, `pnpm quality`                                                                                                                                                          |

### Domain Invariants & Tactical DDD Boundaries

All Tactical DDD boundaries (`Presentation -> Application -> Domain`, `Infrastructure -> Domain`) and Tier A (`packages/ui`), Tier B (`apps/web/components`), and Tier C (`apps/web/features`) boundaries remain unchanged. Brand Navy `#172B4D` and Brand Orange `#F58A24` with `#FFFFFF` foreground are preserved per `NEXORA-031` v4 color policy; zero API, SDK, database, or domain invariant changes.

## Plan

1. Update `control-sizes.test.mjs` and `form-control-contracts.test.mjs` test-first (RED) for the `36/40/48px` size contract, `14/14/16px` font contract, `16/18/20px` icon contract, `500` button weight, and `13px` table density preservation.
2. Refine canonical tokens in `apps/web/styles/tokens.css` and `packages/ui/src/Controls.module.css` (`--_control-font-size`, `--_control-line-height`, weight `500`), keeping `13px` table density and `globals.css` semantic hierarchy.
3. Align Auth (`LoginForm`, `SetupForm` `size="large"` + `login.module.css` icon/toggle alignment) and feature CSS (`customers.module.css`, `carrier-connections.module.css`, `retail-packages.module.css`, `tabular-nums` on numeric cells).
4. Synchronize `PROJECT_RULES.md`, `design-system.md`, `frontend.md`, `reusable-components.md`, and `testing.md`.
5. Run `pnpm --filter @nexora/web test`, `pnpm --filter @nexora/web typecheck`, `pnpm quality`, Docker/browser checks, and independent code review before creating the PR.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- `docs/architecture/design-system.md`: Default control height `32px` -> `36px`, icon sizing `16/18/20px`, control font sizing `14/14/16px`, line heights `20/20/24px`, button weight `500`, Login/MFA/Setup `size="large"` (`48px`), typography hierarchy (`--type-table-cell-size: 13px`), and radius `8px` alignment.
- `docs/architecture/reusable-components.md`: Updated control sizing/weight contract and `#FFFFFF` foreground on Brand Orange `#F58A24` alignment (preserving historical provenance).
- `docs/architecture/frontend.md` & `docs/ai/PROJECT_RULES.md`: Updated `36/40/48px` default/medium/large contract and Login/MFA/Setup `size="large"` reference.
- `docs/operations/testing.md`: Updated control-size & typography contract assertions.

### Canonical owners

- docs/ai/PROJECT_RULES.md
- docs/architecture/design-system.md
- docs/architecture/frontend.md
- docs/architecture/reusable-components.md
- docs/operations/testing.md

### Documentation verification

- `pnpm docs:check`
- `pnpm preflight:check`

## Acceptance

- [x] Default control height `36px`, medium `40px`, large `48px` with `14/14/16px` font, `16/18/20px` icons, `1px` border, `8px` radius, Inter font, preserved Brand Navy/Orange palette.
- [ ] Button, TextInput, Select, Icon Button, Textarea, Checkbox, SelectButton, Pager, TabBar, and Auth (`size="large"`) verified for computed style parity, runtime token overrides, interaction states, and `13px` table density (unit/static/Docker build verified; live Chromium CDP `runtime-smoke.sh` pending CI Foundation).
- [x] Canonical docs synchronized and `pnpm docs:check` + `pnpm preflight:check` PASS.
- [ ] `pnpm --filter @nexora/web test`, `pnpm --filter @nexora/web typecheck`, `pnpm quality`, and Docker/browser verification PASS (`pnpm quality` + fixture builds in Docker PASS; live Chromium CDP `runtime-smoke.sh` pending CI Foundation).

## Evidence

| Claim                            | Evidence                                                                                                                                                                                                                                                                                                                 | Date       | Result |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| Baseline branch & snapshot       | Branched `refactor/design-system-refinement` from `origin/main` (`c44cf4010fe30a6a7bfe0a3d397e65fb56381e15`); closed `NEXORA-063` (`8ee4aaa`); Snapshot v1 SHA-256 `7a07b03e1c99ebd43ddaeb2c549b288caa4c1e274d07d11be7242f53480ebb96`                                                                                    | 2026-11-26 | PASS   |
| Test-first RED                   | `node --test apps/web/test/control-sizes.test.mjs` failed on `/--control-size-default:\s*36px;/` before implementation                                                                                                                                                                                                   | 2026-11-26 | PASS   |
| Web UI & feature tests           | `node --test apps/web/test/control-sizes.test.mjs ... carrier-connections.test.mjs` — 107/107 PASS (8 suites)                                                                                                                                                                                                            | 2026-11-26 | PASS   |
| Docker `pnpm quality` & fixtures | `docker compose -f compose.yml -f compose.dev.yml run --rm --no-deps -T quality sh -c "NODE_ENV=production API_INTERNAL_URL=http://api:4000 pnpm quality && node scripts/build-retail-fixture.mjs ..."` — format, lint, preflight, docs, typecheck, test, contracts, Next.js build, and 3 browser fixtures PASS (exit 0) | 2026-11-26 | PASS   |
| Post-script-edit static gates    | `pnpm format:check && pnpm lint && pnpm docs:check && pnpm preflight:check` after updating `retail-column-picker-checks.mjs`, `m1-visual-checks.mjs`, `customer-control-checks.mjs`                                                                                                                                      | 2026-11-26 | PASS   |
