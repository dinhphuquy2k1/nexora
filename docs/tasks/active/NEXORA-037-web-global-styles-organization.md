# NEXORA-037 — Global stylesheet organization

Status: VERIFICATION PENDING
Capability: IMPLEMENTED
Verification: PARTIALLY VERIFIED

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

- [x] globals.css present; old app/styles.css absent; no duplicate.
- [x] Only first token import changes in stylesheet; all remaining bytes identical.
- [x] Root Layout and three fixtures change import only, preserving position.
- [x] Existing shared-ui checks retained and path/import guards strengthened.
- [x] Tokens, fonts, CSS Modules, UI, business/API/DB and Docker unchanged.
- [x] No active old imports/read paths; historical records preserved.
- [x] Canonical frontend ownership synchronized; no duplicated policies.
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

## Implementation checkpoint — 2026-11-09

HEAD836704b with the task-owned implementation worktree. Final commit/hosted
merge-ref results and review closure will be reconciled in PR metadata.

| Claim                                | Evidence                                                                                                                                   | Date       | Result |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| Test-first RED                       | node --test apps/web/test/shared-ui.test.mjs before move:3PASS/1FAIL, globals.css must exist                                               | 2026-11-09 | FAIL   |
| Targeted GREEN                       | shared-ui, m1-foundation and form-control-contracts:17/17PASS,0skip; original negative class guards retained                               | 2026-11-09 | PASS   |
| Exact stylesheet equivalence         | git show606e101:app/styles.css compared with new file:only authorized first-line substitution; all bytes after first LF identical          | 2026-11-09 | PASS   |
| Frozen install                       | pnpm10.34.6 install --frozen-lockfile on Node24.19.0                                                                                       | 2026-11-09 | PASS   |
| Full host quality/build              | API_INTERNAL_URL=http://127.0.0.1:4000 pnpm quality:610/610PASS,0skip(132root/186API/254Web/32UI/6DB), contracts/typecheck/4builds PASS    | 2026-11-09 | PASS   |
| Fresh fixture compilation            | build-retail-fixture.mjs for Retail, Carrier and Account actual TSX/CSS entries, all3PASS                                                  | 2026-11-09 | PASS   |
| Initial ordered-build comparison     | Probe deepStrictEqual rejected VM-realm arrays versus JSON native arrays despite identical graph serialization; no CSS failure established | 2026-11-09 | FAIL   |
| Canonical production static delivery | Existing start launcher: emitted CSS/font HTTP200, original font SHA and --font-inter/swap/100–900; owned cleanup PASS                     | 2026-11-09 | PASS   |
| Corrected ordered-build comparison   | Five emitted CSS contents hash-identical; all58route CSS ordered entries JSON byte-identical; normalize VM data realm only                 | 2026-11-09 | PASS   |

The comparison probe is temporary verification, not a new application parser. Its
first failure is preserved; diagnostics proved non-native array prototypes and
exact JSON equality before normalization. No CSS values, tokens, import order,
expected geometry, assertions or timeouts were changed to obtain PASS.

Raw moved stylesheet SHA256 is
1e627c2a9f9f1545b8e51d7c7a0ce09e3cdebd47660b7fe346cc7bf8988279e9;
its expected difference from210da631 is solely the first-line import path.
Source checks show unchanged Root Layout beyond the first import, unchanged
fixture content/order beyond respective imports and no active old-path reads.
The negative absence guard intentionally names the old app/styles.css location.

Baseline canonical browser and full local Docker verification: NOT RUN because
the managed host has about3GiB free against the documented20GiB requirement.
Fresh baseline production CSS was captured instead; no prior PR36 CI is used as
this task verification. Final-head hosted M1/Customer/Retail/Carrier/Account
browser, Docker/runtime and Preflight/Foundation gates remain mandatory/open.
Historical NEXORA-029/031/036 records are unchanged. Independent Round1 source
review verified equality/import positions and reran shared-ui/M1:6/6PASS,0skip,
with no P1/P2. Round2 runtime/browser and final PR review remain pending.

Checkpoint 2026-11-09T06:59:30.244Z UTC. Detailed output/captures outside Git.
