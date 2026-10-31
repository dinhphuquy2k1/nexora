# NEXORA-032 — Account Menu ZIP parity

Status: IN PROGRESS
Implementation: IMPLEMENTED
Verification: NOT VERIFIED

## Scope

New branch feat/account-menu-zip-parity from origin/main845c7e68cd9de6e2e90651267a0778e8afebb117 (PR29 already merged). Exactly3 Account entries, true session username/initials and neutral subtitle; no environment notice, fake identity/wallet/VIP, Profile/Carrier placeholder UI, auth/backend/SDK/schema changes, new dependencies, deployment or merge. Do not mutate tasks007/031/history or any PR29-only work.

## Design Review & Reuse Decision

Task ID: NEXORA-032
Classification: SIGNIFICANT
Plan revision: rev-2026-10-31-account-menu-v1
Reviewed baseline: 845c7e68cd9de6e2e90651267a0778e8afebb117
Design Snapshot: docs/tasks/design-reviews/NEXORA-032-rev-2026-10-31-account-menu-v1.md
Design SHA-256: 3b0313bea5971181f468a41b99cfd9a9bd8ae8659bb009d396d675df15b0eac2

Read-only audit/8-field reuse matrix, scoped control appearance assessment, route/API inventory, security boundaries, alternatives and verification are in the immutable snapshot. Both Profile and Carrier Connections UI absent; native disabled planned items, no fake href. SessionUser has only id/username; no role inference. Keep Header compatibility, AccountMenu ownership, useDismissable and real logout POST/status-before-redirect, add single-flight guard.

## Delivery milestones

- [x] Read-only source/ZIP/routes/security audit; new task ID/branch availability checked.
- [x] Record scoped plan, reuse matrix, snapshot/digest before implementation.
- [x] Test-first identity/entries/disabled routes; implement trigger/summary/three entries and preserve logout.
- [ ] Actual browser/ZIP six-viewport comparison, keyboard/loading/error/retry and real ADMIN/OPERATOR revocation.
- [ ] Independent rounds1–3 and targeted/full quality/regressions.
- [ ] Focused commits/push, new PR, final-head Preflight/Foundation/log/artifact/metadata reconciliation.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

AccountMenu presentation uses true session username, neutral subtitle and exactly3 entries; Profile/Carrier items planned; red logout retains actual server revocation. Shared default controls/security unchanged; explicit Account appearance follows owner ZIP request.

### Canonical owners

- docs/architecture/frontend.md
- docs/architecture/design-system.md (scoped Account visual roles)
- docs/operations/testing.md (browser evidence procedure)
- This task and new PR metadata; shared registry only if an exported shared API changes (none planned).

### Documentation verification

Run docs:check, preflight:check and format:check; preserve immutable bytes after pinning.

## Evidence

| Claim                                   | Evidence                                                                                                      | Date       | Result |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Main/branch isolated and unused task032 | git fetch origin main, worktree new branch at845c7e6; rg NEXORA-032 found no previous task                    | 2026-10-31 | PASS   |
| Exact uploaded ZIP provenance           | sha256sum a10065b309004c8771ad937d2f622a7f93e44ef9a496599e7cfc637e198151aa; Header and mockData read directly | 2026-10-31 | PASS   |

## Execution journal

Plan recorded before code/tests. This initial planning checkpoint preceded all implementation/testing. Subsequent execution evidence follows; hosted CI remains pending until the new PR exists. No owner approval gate per current ADR009. ZIP has full demo menu; visual reference will isolate actual account subtree and explicitly document removed mock fields/rows. No ZIP package scripts or live provider services run.

## Reuse audit and domain invariants

| Component       | Existing implementations                   | Domain owner                              | Reuse alternatives                                 | Selected approach                                                       | Rationale                                        | Risks                           | Verification                                                   |
| --------------- | ------------------------------------------ | ----------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------- | -------------------------------------------------------------- |
| Disclosure      | AccountMenu/Header, useDismissable         | AppShell                                  | Replace Header / reuse disclosure                  | Existing component, medium40 trigger, native region, pathname dismissal | Preserve shell and focus policy                  | Mobile bounds/hydration         | SSR and actual keyboard/pointer CDP                            |
| Identity/logout | SessionUser, GET session, POST logout      | Identity contract / AppShell presentation | Mock ZIP callback / real endpoint                  | Existing session fields and res.ok gate; ref single-flight, safe retry  | No role inference or premature redirect          | Failure/double-submit/security  | Actual ADMIN/OPERATOR revocation plus isolated failure/loading |
| Appearance      | shared Button, semantic tokens, ZIP Header | Shared control / Account presentation     | New framework/global defaults / scoped composition | Shared size/focus/disabled; scoped content/icon/gray/rose roles         | Exact requested layout without global regression | CSS load order/disabled entries | Computed tokens/sizing/state and direct ZIP screenshots        |
| Routes          | workspace app tree, navigation metadata    | Feature route owners                      | Fake href/page / planned buttons                   | Profile and Carrier absent: disabled native entries with description    | No404 or premature M4                            | Future route activation         | Exactly3 entries, no invalid links/new APIs                    |

Tactical DDD Boundaries: no new business domain, aggregate, entities, persistence,
commands or schema. Identity owns session revocation and trusted user facts; UI
only presents id/username and calls the existing logout HTTP port. Domain
invariants: no inferred role/profile data, no fake destination or Carrier state;
server success before redirect, no repeated in-flight logout, unchanged Origin,
HttpOnly and MFA behavior. Full eight-field inventory and alternatives remain in
the pinned snapshot. No aggregate/VO adoption is required for this presentation task.

Reference comparison clarification (within pinned scope): actual Tailwind4.3.3
render of exact Account subtree confirms row32px, icon16px, padding8px/12px,
gap10px, panel256px/radius12px and a two-layer shadow distinct from existing
--shadow-lg. Use a new account-only shadow role instead of changing shared
shadows; preserve actual rose600/rose50 OKLCH values from reference and md text
visibility at768px. Trigger uses approved canonical40 instead of ZIP42. Profile/
Carrier disabled opacity and reduced panel height (no VIP/wallet/4 extra entries)
are owner-required differences, not parity failures. Only reference images/manifest
will live under docs/tasks/evidence/NEXORA-032; ZIP mock data stays outside product
source. No ZIP package scripts/App/provider components executed.

### Implementation checkpoint — 2026-10-31 (Asia/Saigon)

Implemented trigger/summary and exactly three entries with canonical shared controls,
scoped gray/rose appearance, native disabled planned destinations and unchanged
POST/status-before-redirect logout plus ref single-flight. Header/AppShell, backend,
SDK/schema and package contracts are unchanged. Reference ChevronDown stays static;
aria-expanded reports disclosure state. Account-only tokens preserve all existing
global defaults. Added actual Account JSX/CSS CDP checks to ADMIN/OPERATOR smoke;
original genuine logout/session401 assertions remain.

Executed local evidence (working tree before first implementation commit):

- Frozen pnpm10.34.6 install PASS (RAM store; unchanged lockfile).
- Test-first Account SSR initially RED on old subtitle/missing content seam, then3/3 PASS.
- Shared build prerequisite PASS; complete Web tests186/186 and UI tests32/32 PASS.
- Web type generation/typecheck PASS; format/lint/boundaries/docs/static preflight PASS.
- Browser expression syntax inventory3/3 PASS.
- Actual TSX/CSS isolated browser, six viewports, keyboard/focus/outside/Notification,
  disabled routes, loading/503/retry, normal and50-character usernames PASS.
  This fixture uses synthetic sessions and does not prove server revocation.
- Exact ZIP subtree18 captures with real fine-pointer hover PASS; source hashes,
  per-image hashes and geometry committed under evidence/NEXORA-032.
  Product comparison intentionally omits mock fields/four rows, disables absent
  routes, and uses canonical40px trigger rather than reference42px.

Preserved diagnostic history: first Web test run lacked built shared dist (fixed by
building dependency); initial preflight required inline reuse/DDD assessment (added
without changing snapshot); isolated Next hook bundle lacked compiler defines
(fixed with pinned Next getDefineEnv, no fake hook/browser process); initial
headless reference reported hover:none (not accepted as hover proof; rerun with
source-verified fine-pointer Blink device settings and real mouse). None of these
failures was reclassified as PASS without rerun.

Independent Round1 architecture/security: no P1/P2. Advisory P3: repeated pointer
click after loading verifies disabled behavior, not adversarial same-tick reentry;
production handler also checks a ref before awaiting. Round2 independent visual/interaction review opened desktop/mobile reference and
product screenshots, checked focus clipping/source hashes, reran6/6 tests and
diff-check: no P1/P2. Fixed confirmed source-comparison differences (row gap10,
account-only shadow, rose OKLCH, static ChevronDown); browser rerun PASS.
Round3 final-head regression remains pending. Full canonical Docker/hosted checks
and genuine ADMIN/MFA/OPERATOR revocation are NOT YET VERIFIED for this task.

Task remains IN PROGRESS / Verification NOT VERIFIED. No merge/deploy performed.
