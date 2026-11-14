# NEXORA-045 — Pager and filter convergence

Status: IN PROGRESS
Capability: PLANNED
Verification: NOT VERIFIED

## Origin

[NEXORA-041](../completed/NEXORA-041-shared-pager-filter-shell.md) deferred follow-ups FU1–FU4. Must finish before Shipment UI.

## Scope

FU1 canonical Pager configuration and default selectedVariant (no visual change); FU3 rename m5 artifacts to capability names; FU4 aria-controls only while open; align the Pager/filter browser harness Chromium launch with browser-login-smoke and reuse browser-startup-diagnostics. Deferred to Shipment UI: Customer selection colour convergence and FU2 Carrier CSS override removal (require visual approval).

## Design Review & Reuse Decision

Task ID: NEXORA-045
Classification: BOUNDED
Plan revision: rev-2026-11-14-pager-filter-convergence-v1
Reviewed baseline: ad7a7967414f6fe0cb2ccb1a71a4550583c78b05
Branch: refactor/pager-filter-convergence
Design Snapshot: docs/tasks/design-reviews/NEXORA-045-rev-2026-11-14-pager-filter-convergence-v1.md
Design SHA-256: 21ad99210aa250580d259facc0bc7cfd60ad4906934f06aa382236ab20c852c8

BOUNDED because this reuses existing presentation/operations contracts without changing DB/API/SDK/business behavior. New snapshot is mandatory for this task.

## Reuse audit

| Field                    | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Shared Pager defaults/documentation; FilterPopoverShell trigger ARIA; Pager/filter browser harness naming and Chromium launch                                                                                                                                                                                                                                                                                                                                                                                                    |
| Existing implementations | packages/ui/src/Pager.tsx (selectedVariant required; four consumers, Customer primary, others emphasis); docs/architecture/reusable-components.md M5 sections; FilterPopoverShell.tsx:67 aria-controls always set; m5-sharing.test.mjs:178 and m5-browser-checks.mjs:440 assert closed-state aria-controls; m5-browser-checks.mjs launch: stdio ignore,150×100 ms,no early exit; browser-login-smoke.mjs launch (stderr pipe,200×100 ms,BROWSER_STARTUP_DIAGNOSTIC); browser-startup-diagnostics.mjs (tested fixed-hint summary) |
| Domain owner             | packages/ui (Pager); apps/web Tier B (FilterPopoverShell); operations test harness (docs/operations/testing.md)                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Reuse alternatives       | new launcher framework; raw stderr artifact; keep m5 names; reuse browser-login-smoke launch pattern and browserStartupSummary                                                                                                                                                                                                                                                                                                                                                                                                   |
| Selected approach        | optional selectedVariant defaulting to emphasis with consumers unchanged; documented canonical configuration; aria-controls only while open with stable id; capability names; launch gate aligned with browser-login-smoke plus early exit and fixed-hint diagnostics                                                                                                                                                                                                                                                            |
| Rationale                | new screens get one default without changing existing UI; no reference to a non-rendered id; flaky Chromium startup becomes diagnosable without leaking browser output; names describe capability                                                                                                                                                                                                                                                                                                                                |
| Risks                    | rename misses a reference (CI path,artifact,selector); closed-state ARIA assertions; longer startup wait hides slowness (mitigated by diagnostic hints)                                                                                                                                                                                                                                                                                                                                                                          |
| Verification             | Pager and FilterPopoverShell unit tests RED/GREEN; renamed SSR tests; unchanged visual/viewport/tolerance browser acceptance plus deliberate open-only ARIA assertions; git grep for leftover m5 references; hosted Preflight and Foundation                                                                                                                                                                                                                                                                                     |

## Plan

1. Close merged NEXORA-050 under §1.7 in the first commit, preserving historical Evidence.
2. Record BOUNDED review, reuse audit and immutable formatted/hashed snapshot before implementation.
3. FU1: RED default-versus-explicit emphasis HTML equality; optional selectedVariant defaults to emphasis; leave all four consumers unchanged; document canonical new-screen configuration.
4. FU4: RED closed SSR without aria-controls; conditionally emit only while open; browser verifies absent closed attribute, matching open id and stable id after close/reopen. This deliberate accessibility contract change does not change visuals.
5. Align Chromium launch with browser-login-smoke: pipe/drain stderr, bounded16KB startup tail,200×100 ms cold-runner gate, early exit and browserStartupSummary fixed hints; retain Chromium startup assertion. No new launcher framework or script-specific test.
6. FU3: git mv harness/fixture/sharing test to pager-filter names; rename selector,bundle,temp/output/artifact references, Usage and CI commands; preserve CI step names/order, existing browser visual assertions, viewports and tolerances. Do not edit historical snapshots/completed tasks or .prettierignore for renames.
7. Synchronize reusable-components.md and testing.md; preserve historical M5 v3 accessibility wording; defer Customer colours and FU2 Carrier CSS to Shipment UI with visual approval.
8. Execute targeted RED/GREEN, pinned format/lint/typecheck/docs/preflight/test:docs/test:preflight; fixture/browser acceptance with installed Chromium; quality if resources allow; simulate five-field binding; inspect scoped diff and leftover-name grep. Stop on unexpected FAIL or baseline mismatch, without scope expansion.
9. Push scoped PR with exact metadata; wait Preflight/Foundation on final HEAD, including renamed acceptance and uploaded pager-filter-browser-evidence artifact. Runtime6–10 unrelated failure permits one failed-job rerun only; step8 scriptLoadFailures diagnostic goes to issue44. Acceptance startup diagnostic: report exact line,no rerun,stop. Other failures: stop. No merge.
10. NEXORA-045 is closed by the next task's PR.

## Acceptance criteria

- [ ] Existing Pager consumers and visual contracts unchanged; omitted selectedVariant equals emphasis.
- [ ] Closed aria-controls absent; open link and stable reopen id verified.
- [ ] Bounded safe Chromium startup diagnostics and capability names.
- [ ] Local targeted/static/browser verification and final-head hosted gates.
- [ ] Owner review and merge decision.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Canonical Pager configuration and selectedVariant default; aria-controls only while open; renamed harness/fixture/test/artifact; harness launch gate and startup diagnostic.

### Canonical owners

- docs/architecture/reusable-components.md
- docs/operations/testing.md

### Documentation verification

Pinned format:check, docs:check, preflight:check; scoped diff, source-reference grep and browser acceptance.

## Evidence

| Claim                                            | Evidence                                    | Date       | Result |
| ------------------------------------------------ | ------------------------------------------- | ---------- | ------ |
| Follow-up scope recorded from NEXORA-041 FU1–FU4 | Created by NEXORA-043 task closure (PR #42) | 2026-11-12 | PASS   |
