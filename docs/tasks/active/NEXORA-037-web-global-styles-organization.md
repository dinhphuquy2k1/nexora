# NEXORA-037 — Global stylesheet organization

Status: PLANNED
Capability: PLANNED
Verification: NOT VERIFIED

## Design Review & Reuse Decision

Task ID: NEXORA-037
Classification: BOUNDED
Plan revision: rev-2026-11-09-global-styles-v1
Design Snapshot: docs/tasks/design-reviews/NEXORA-037-rev-2026-11-09-global-styles-v1.md
Design SHA-256: 6a1ca41c89c55862475837d1bee5c1ad8098d79a5a3b7b5ac2c8abdb27c35668
Reviewed baseline: 606e1010ade882172b1d055f1d97e8b52497ddbd
Branch: refactor/web-global-styles-organization

Fresh origin/main and authenticated GitHub PR36 metadata confirm merged=true at
this baseline. Clean worktree, unused proposed branch and absent NEXORA-037 task
references were checked before creation. Independent pre-code scope review found
no P1/P2; stylesheet has only one relative resource reference, its token import.
Installed Next16 app CSS guide requires global imports at layout and warns that
production CSS ordering follows imports; verify output, not merely source paths.

| Field                    | Decision                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| Component                | Relocate existing Global CSS with adjusted token import                                            |
| Existing implementations | app/styles.css, Root Layout, three fixture entries, shared-ui and CSS policy tests                 |
| Domain owner             | Web global source styles; frontend.md owns canonical architecture                                  |
| Reuse alternatives       | Move intact versus duplicate/split/provider; existing tests versus new parser                      |
| Selected approach        | One file, same rules and import positions; extend existing tests                                   |
| Rationale                | Minimal change with explicit source and emitted cascade verification                               |
| Risks                    | Token path404, duplicate imports, CSS order or computed-style regression                           |
| Verification             | Baseline/RED/GREEN, byte equivalence, build CSS/order comparison and final-head browser/Foundation |

## Scope and acceptance

- [ ] globals.css present; old app/styles.css absent; no duplicate.
- [ ] Only first token import changes in stylesheet; all remaining bytes identical.
- [ ] Root Layout and three fixtures change import only, preserving position.
- [ ] Existing shared-ui checks retained and path/import guards strengthened.
- [ ] Tokens, fonts, CSS Modules, UI, business/API/DB and Docker unchanged.
- [ ] No active old imports/read paths; historical records preserved.
- [ ] Canonical frontend ownership synchronized; no duplicated policies.
- [ ] Targeted/full quality/build and cascade/browser checks PASS.
- [ ] Three reviews and final-head Preflight/Foundation; separate PR, no merge/deploy.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

styles/globals.css owns existing global reset/base/typography/layout rules beside
tokens.css; Root Layout imports it once. app owns routing/layouts, assets remain
source assets, and component/feature/shared UI CSS Modules remain colocated.

### Canonical owners

- docs/architecture/frontend.md

### Documentation verification

pnpm format:check, pnpm docs:check, pnpm preflight:check.

## Evidence

| Claim                                | Evidence                                                                                                            | Date       | Result |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Fresh merged baseline and new branch | GitHub PR36 merged=true/merge606e101; git fetch origin main and clean switch from origin/main                       | 2026-11-09 | PASS   |
| Baseline targeted tests              | node --test apps/web/test/shared-ui.test.mjs apps/web/test/m1-foundation.test.mjs:6/6PASS,0skip on606e101           | 2026-11-09 | PASS   |
| Baseline Global CSS bytes            | SHA256210da631277aff07d25525eeeb625d4a554188ed80dc5ca3563feabbc0c52732; original content retained in Git            | 2026-11-09 | PASS   |
| Baseline production build            | API_INTERNAL_URL=http://127.0.0.1:4000 pnpm --filter @nexora/web... build; actual Next webpack build on606e101 PASS | 2026-11-09 | PASS   |

## Reviews and remaining gates

Pre-code independent review: no P1/P2. Post-change structure, cascade/browser and
final CI reviews remain pending. Baseline build/tests above are fresh executed
checks, not PR36 CI reused for this task. Detailed build/browser output stays
outside Git. No owner approval gate, automatic merge or deployment.
