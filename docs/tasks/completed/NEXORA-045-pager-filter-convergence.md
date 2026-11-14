# NEXORA-045 — Pager and filter convergence

Status: COMPLETED
Capability: IMPLEMENTED
Verification: VERIFIED

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

- [x] Existing Pager consumers and visual contracts unchanged; omitted selectedVariant equals emphasis.
- [x] Closed aria-controls absent; open link and stable reopen id verified.
- [x] Bounded safe Chromium startup diagnostics and capability names.
- [x] Local targeted/static/browser verification and host quality.
- [x] Final-head hosted Preflight/Foundation and uploaded pager-filter-browser-evidence (PR #48 final evidence below).
- [x] Owner review and merge decision (owner merged PR #48).

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

## Verification checkpoint — fu1-red, fu1-green

| Claim     | Evidence                                                                                                                                                                                                                                                               | Date       | Result |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| fu1-red   | node --test packages/ui/test/pager.test.mjs; working tree on 043aaa7be4e21260f780b8054739377c1f23068f; 2026-11-14T06:56:47.559395+00:00–2026-11-14T06:56:48.361002+00:00 UTC; exit1; expected RED: omitted variant renders primary instead of emphasis (4 PASS/1 FAIL) | 2026-11-14 | FAIL   |
| fu1-green | node --test packages/ui/test/pager.test.mjs; working tree on 043aaa7be4e21260f780b8054739377c1f23068f; 2026-11-14T06:57:00.334850+00:00–2026-11-14T06:57:00.929574+00:00 UTC; exit0                                                                                    | 2026-11-14 | PASS   |

## Verification checkpoint — fu4-red, fu4-green

| Claim     | Evidence                                                                                                                                                                                                                                    | Date       | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| fu4-red   | node --test apps/web/test/m5-sharing.test.mjs; working tree on bcc40024765b34740091a07713f08c3730411d24; 2026-11-14T06:57:42.716355+00:00–2026-11-14T06:57:44.462138+00:00 UTC; exit1; expected RED: closed SSR still exposes aria-controls | 2026-11-14 | FAIL   |
| fu4-green | node --test packages/ui/test/pager.test.mjs apps/web/test/m5-sharing.test.mjs; working tree on bcc40024765b34740091a07713f08c3730411d24; 2026-11-14T06:58:08.419073+00:00–2026-11-14T06:58:10.844234+00:00 UTC; exit0                       | 2026-11-14 | PASS   |

## Verification checkpoint — startup-diagnostics

| Claim               | Evidence                                                                                                                                                                                         | Date       | Result |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| startup-diagnostics | node --test scripts/browser-startup-diagnostics.test.mjs; working tree on 1758db981c40762d304029fe06f5bc3f65f5533f; 2026-11-14T06:59:11.428121+00:00–2026-11-14T06:59:11.551630+00:00 UTC; exit0 | 2026-11-14 | PASS   |

## Verification checkpoint — targeted, format, lint, typecheck, docs, preflight, test-docs, test-preflight, fixture-retail, fixture-carrier, fixture-pager-filter, browser-acceptance, quality

| Claim                | Evidence                                                                                                                                                                                                                                                                     | Date       | Result |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| targeted             | node --test packages/ui/test/pager.test.mjs apps/web/test/pager-filter-sharing.test.mjs scripts/browser-startup-diagnostics.test.mjs; working tree on b2e814c45bc84dec4e22a51b582287b4956a9969; 2026-11-14T06:59:57.819729+00:00–2026-11-14T07:00:00.355993+00:00 UTC; exit0 | 2026-11-14 | PASS   |
| format               | npx --yes pnpm@10.34.6 format:check; working tree on b2e814c45bc84dec4e22a51b582287b4956a9969; 2026-11-14T07:00:48.565435+00:00–2026-11-14T07:01:04.390917+00:00 UTC; exit0                                                                                                  | 2026-11-14 | PASS   |
| lint                 | npx --yes pnpm@10.34.6 lint; working tree on b2e814c45bc84dec4e22a51b582287b4956a9969; 2026-11-14T07:01:04.429397+00:00–2026-11-14T07:01:14.642964+00:00 UTC; exit0                                                                                                          | 2026-11-14 | PASS   |
| typecheck            | env API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 typecheck; working tree on b2e814c45bc84dec4e22a51b582287b4956a9969; 2026-11-14T07:01:14.682778+00:00–2026-11-14T07:02:03.063726+00:00 UTC; exit0                                            | 2026-11-14 | PASS   |
| docs                 | npx --yes pnpm@10.34.6 docs:check; working tree on b2e814c45bc84dec4e22a51b582287b4956a9969; 2026-11-14T07:02:03.108234+00:00–2026-11-14T07:02:04.624728+00:00 UTC; exit0                                                                                                    | 2026-11-14 | PASS   |
| preflight            | npx --yes pnpm@10.34.6 preflight:check; working tree on b2e814c45bc84dec4e22a51b582287b4956a9969; 2026-11-14T07:02:04.662793+00:00–2026-11-14T07:02:06.101707+00:00 UTC; exit0                                                                                               | 2026-11-14 | PASS   |
| test-docs            | npx --yes pnpm@10.34.6 test:docs; working tree on b2e814c45bc84dec4e22a51b582287b4956a9969; 2026-11-14T07:02:06.140568+00:00–2026-11-14T07:02:07.966872+00:00 UTC; exit0                                                                                                     | 2026-11-14 | PASS   |
| test-preflight       | npx --yes pnpm@10.34.6 test:preflight; working tree on b2e814c45bc84dec4e22a51b582287b4956a9969; 2026-11-14T07:02:08.003664+00:00–2026-11-14T07:02:09.926261+00:00 UTC; exit0                                                                                                | 2026-11-14 | PASS   |
| fixture-retail       | node scripts/build-retail-fixture.mjs; working tree on b2e814c45bc84dec4e22a51b582287b4956a9969; 2026-11-14T07:02:09.970390+00:00–2026-11-14T07:02:12.866161+00:00 UTC; exit0                                                                                                | 2026-11-14 | PASS   |
| fixture-carrier      | node scripts/build-retail-fixture.mjs artifacts/carrier-fixture apps/web/test/fixtures/carrier-entry.tsx; working tree on b2e814c45bc84dec4e22a51b582287b4956a9969; 2026-11-14T07:02:12.904396+00:00–2026-11-14T07:02:15.912851+00:00 UTC; exit0                             | 2026-11-14 | PASS   |
| fixture-pager-filter | node scripts/build-retail-fixture.mjs artifacts/pager-filter-fixture apps/web/test/fixtures/pager-filter-entry.tsx; working tree on b2e814c45bc84dec4e22a51b582287b4956a9969; 2026-11-14T07:02:15.949633+00:00–2026-11-14T07:02:18.765424+00:00 UTC; exit0                   | 2026-11-14 | PASS   |
| browser-acceptance   | node scripts/pager-filter-browser-checks.mjs artifacts artifacts/pager-filter --acceptance; working tree on b2e814c45bc84dec4e22a51b582287b4956a9969; 2026-11-14T07:02:18.803576+00:00–2026-11-14T07:02:55.626545+00:00 UTC; exit0                                           | 2026-11-14 | PASS   |
| quality              | taskset -c 0 env API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 quality; working tree on b2e814c45bc84dec4e22a51b582287b4956a9969; 2026-11-14T07:04:12.071504+00:00–2026-11-14T07:07:09.960696+00:00 UTC; exit0                                 | 2026-11-14 | PASS   |

## Scope and evidence availability

BOUNDED scoped self-review follows implementation-code-review; it is not independent
approval. The four explicit consumer files, all CSS, DB/API/SDK/business code,
existing browser visual assertions/viewports/tolerances, prior snapshots and
.prettierignore are unchanged. Renames are restricted to the three specified files
and their authorized references. The completed050 file changed only in commit1.
Expected REDs above remain FAIL history; all subsequent verification commands PASS.

Local Chromium acceptance executed actual assertions and retained16 captures plus
manifest under ignored artifacts/pager-filter; baseline=null (acceptance-only),
not a before/after screenshot comparison or manual visual approval. Images were
not manually reviewed. No generated artifacts/logs enter Git. Host quality executed
scripts137/API212/Web266/UI37/Database6 tests (no cached tests); typecheck10/10,
test pipeline8/8 and build4/4 PASS; cached build/typecheck tasks are distinct.
Frozen pnpm install and @nexora/shared build prerequisites completed exit0; their
original UTC starts were not retained. No new dependency or lockfile change.

The final commit requires fresh hosted gates. Record exact final HEAD/checkout
merge/workflow attempts/UTC/results and pager-filter-browser-evidence upload in
the PR description after execution, without a SHA-only task commit. Owner merge
remains pending. Customer selection colours and FU2 Carrier CSS require the later
Shipment UI visual approval; no approval is requested or invented here.

| Claim                      | Evidence                                                                                                                                                                                                                                                                                                       | Date       | Result |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Capability reference audit | git grep with the requested five-pattern expression, excluding docs/tasks and .prettierignore: no results (git grep exit1 as expected); working tree on b2e814c45bc84dec4e22a51b582287b4956a9969; observed2026-11-14T07:08:29.571660+00:00 UTC; scoped diff13 files; four consumer/CSS/backend/SDK diffs empty | 2026-11-14 | PASS   |
| Snapshot integrity         | sha256sum docs/tasks/design-reviews/NEXORA-045-rev-2026-11-14-pager-filter-convergence-v1.md = 21ad99210aa250580d259facc0bc7cfd60ad4906934f06aa382236ab20c852c8; observed2026-11-14T07:08:29.571660+00:00 UTC; formatted before hashing, bytes unchanged thereafter                                            | 2026-11-14 | PASS   |

Reference-audit expression (exit1/no matches is the expected successful oracle):

```sh
git grep -n -i "m5-\|data-m5\|artifacts/m5\|m5-fixture\|nexora-m5" -- ':!docs/tasks' ':!.prettierignore'
```

## Closure — 2026-11-14

Delivered by PR #48. Final-head hosted gates passed on e8b0344268990ae527620e9b2c9fa164afbb076a. Customer selection colour convergence and FU2 Carrier CSS remain deferred to visual approval. Closed in the first commit of NEXORA-051 under §1.7.

| Claim                   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Date       | Result |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Merged to main          | PR #48 https://github.com/dinhphuquy2k1/nexora/pull/48; REST merged=true; merge SHA e8d5821a370ff1d24424eef18ee6579084e7c943; merged_at2026-11-14T07:35:46Z; git log origin/main --merges confirms merge                                                                                                                                                                                                                                                                        | 2026-11-14 | PASS   |
| Final-head hosted gates | PR #48 Final green HEAD e8b0344268990ae527620e9b2c9fa164afbb076a; Preflight https://github.com/dinhphuquy2k1/nexora/actions/runs/43569886835 PASS at2026-11-14T07:11:24Z; Foundation https://github.com/dinhphuquy2k1/nexora/actions/runs/43569886839 attempt1/job132371749278 PASS steps4–10, completed2026-11-14T07:31:30Z; tested merge7fb462fffad6a7528f5c0364bd4dbb71dbed0adf; pager-filter-browser-evidence artifact14104352842 uploaded; original expected REDs retained | 2026-11-14 | PASS   |
