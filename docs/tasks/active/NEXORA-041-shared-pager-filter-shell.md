# NEXORA-041 — M5 shared Pager and FilterPopoverShell

Status: VERIFICATION PENDING
Capability: IMPLEMENTED
Verification: PARTIALLY VERIFIED

## Design Review & Reuse Decision

Task ID: NEXORA-041
Classification: SIGNIFICANT
Plan revision: rev-2026-11-11-m5-r2-v2
Design Snapshot: docs/tasks/design-reviews/NEXORA-041-rev-2026-11-11-m5-r2-v2.md
Design SHA-256: 50cb4dc81b567c8389759ef009de08a8f70e160ee2be4e471c01a63ae139a46c
Reviewed baseline: a3fd1049bb994af4982c59c93bf29f3b9dd939c4
Branch: refactor/m5-shared-pager-filter-shell

User revision2 governs scope. Detailed interfaces, read-only inspection, ownership,
risks/non-goals and baseline/test-first strategy are recorded in the snapshot.

| Field                    | Pager                                                                                                                                                                                                                                                                                                         | FilterPopoverShell                                                                                                                                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | packages/ui/src/Pager.tsx and CSS                                                                                                                                                                                                                                                                             | apps/web/components/filter-popover/FilterPopoverShell.tsx and CSS                                                                                                                                                                                                                                           |
| Existing implementations | CustomerPagination.tsx, RetailPagination.tsx, CarrierConnectionList.tsx (CarrierPagination), CarrierSyncPanels.tsx (SyncHistoryPanel); respective feature CSS; packages/ui/src/Controls.tsx                                                                                                                   | RetailFilterPopover.tsx and CarrierFilterPopover.tsx repeat open/ref/effect/useDismissable, trigger/panel/header/close; apps/web/lib/hooks/use-dismissable.ts already implements Escape/outside focus rules                                                                                                 |
| Domain owner             | Tier A presentation; feature models own counts/authority/targets                                                                                                                                                                                                                                              | Tier B Web disclosure; Retail/Carrier own filtering and errors                                                                                                                                                                                                                                              |
| Reuse alternatives       | Keep four copies; build model-aware generic paginator (rejected); extract controlled presentation (selected)                                                                                                                                                                                                  | Copy hook into UI (rejected); controlled duplicate panels (rejected); Web shell with feature form render slot (selected)                                                                                                                                                                                    |
| Selected approach        | Reuse Button, explicit pages/targets/disabled/labels/icon nodes/selectedVariant; summary ReactNode and optional pageSize slot; optional summaryClassName retains existing wrapper. CSS class hooks preserve Customer colors/responsive layout; inline vs grouped numbers retain history vs other DOM geometry | Reuse actual useDismissable; shell owns state/refs/RAF focus/IDs/trigger/header/close. children({close}) supplies form; onDismiss supports Carrier error clearing. Trigger toggle preserves existing draft/error lifetime. Class hooks retain feature surface geometry over low-specificity shared defaults |
| Rationale                | Remove markup duplication without deriving authority or altering reset/URL semantics                                                                                                                                                                                                                          | One interaction owner; no feature imports or new packages; preserve distinct geometry without feature-named shared variants                                                                                                                                                                                 |
| Risks                    | Disabled estimated/unknown data, history <=5 pages, Customer primary overrides, different icon/press-effect geometry, summary DOM                                                                                                                                                                             | Outside dismissal stealing focus; Carrier error clearing vs Retail persistence; mobile anchor positioning; header spacing and generated ID stability                                                                                                                                                        |
| Verification             | Unit callbacks/SSR all4; model suites; browser click/keyboard/page size/variants/unknown/summary, desktop/mobile baseline geometry/styles/screenshots                                                                                                                                                         | Real browser open/toggle/Escape/outside/close/submit, focus/IDs/names, duplicate/max/errors/providers/environment; baseline visual comparison                                                                                                                                                               |

## Tactical DDD boundaries and revision impact

Stateless presentation extraction preserves all domain invariants; no Aggregate,
Entity, Value Object, command, persistence port, hydration, transaction, lock,
authorization or transport contract changes. Omission of new domain modeling is
explicitly reviewed under ADR008. v2 adds only canonical fixture/CI execution and
testing-command documentation; v1 remains immutable. No owner approval gate.

## Acceptance

- [x] Fresh main branch and scoped immutable pre-code plan.
- [x] Baseline unit/browser evidence before production modifications.
- [x] Four Pager consumers; both filters share Web shell.
- [x] Business/visual preservation and intentional ARIA changes verified.
- [x] Targeted tests, local browser comparison and acceptance-only execution.
- [x] Final-source full host quality:625 tests and all gates.
- [ ] Canonical Docker and final-head hosted gates.
- [x] Canonical docs synchronized; fresh branch pushed and new PR41 to main; no merge.
- [ ] Independent reviewer/owner approval obtained.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Tier A Pager and Tier B FilterPopoverShell ownership, interfaces, consumers and
intentional navigation/aria-controls accessibility improvements.

### Canonical owners

- docs/architecture/frontend.md
- docs/architecture/reusable-components.md
- docs/operations/testing.md

### Documentation verification

pnpm docs:check, preflight:check, format:check.

## Evidence

| Claim          | Evidence                                                                                                                             | Date       | Result |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| Fresh baseline | git fetch/switch main/pull --ff-only then new branch; HEAD and origin/main both a3fd1049bb994af4982c59c93bf29f3b9dd939c4, clean tree | 2026-11-11 | PASS   |

## Independent review

Skill-guided self-review completed against v2: no confirmed remaining P1/P2/P3
code findings. Resolved P2 collateral-CSS risk: the removed Retail popoverAnchor
was also used by RetailColumnPicker, and Carrier pageButtons by
CarrierSyncInspection. Restored those rules for those separate consumers; no
scope expansion. Added actual open column-picker comparison at both widths.
No feature model/URL/reset/authority policy or API/SDK/schema/lock change.
Independent review is not yet obtained; request a supported GitHub reviewer after
publication, otherwise require owner review. Self-review is not approval.

## Executed verification checkpoint

Baseline HEAD for these commands: `a3fd1049bb994af4982c59c93bf29f3b9dd939c4`;
implementation/test/CI working diff is uncommitted at execution. Host Node
v24.22.1 and pinned `npx --yes pnpm@10.34.6`. Original unit/browser baseline
executed before production edits; original 10-capture manifest timestamp is
2026-11-11T10:03:08.228Z. Later 14/16-capture baseline renders reuse those retained
pre-change compiled bundles, not current source. Artifacts/logs stay in execution
scratch or ignored CI artifacts with14-day retention; no PNG/log added to Git.

| Claim                              | Evidence                                                                                                                                                                                                                                                                                                                                                                       | Date       | Result |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| Baseline unit characterization     | `node --test apps/web/test/customer-pagination.test.mjs apps/web/test/retail-packages.test.mjs apps/web/test/carrier-connections.test.mjs apps/web/test/carrier-sync-presentation.test.mjs`: 75/75 passed                                                                                                                                                                      | 2026-11-11 | PASS   |
| Baseline browser                   | `node scripts/build-retail-fixture.mjs /workspace/work/m5-baseline/components apps/web/test/fixtures/m5-entry.tsx`, equivalent Retail/Carrier builds, then `node scripts/m5-browser-checks.mjs /workspace/work/m5-baseline /workspace/work/m5-baseline-evidence`: 10 captures; initial-focus/Escape/outside/unknown assertions passed before production edits                  | 2026-11-11 | PASS   |
| Test-first Pager RED               | `node --test packages/ui/test/pager.test.mjs` failed with ENOENT for not-yet-created Pager.tsx before production edits                                                                                                                                                                                                                                                         | 2026-11-11 | FAIL   |
| Test-first integration RED         | `node --test apps/web/test/m5-sharing.test.mjs`: 1 passed / 2 failed for missing navigation/aria-controls; history policy characterization passed                                                                                                                                                                                                                              | 2026-11-11 | FAIL   |
| Intermediate implementation checks | First combined target run: 7 failures, including a leftover Retail effect fragment and shallow callback traversal; corrected syntax and made F9 execute actual stateless Pager. No business algorithm copied                                                                                                                                                                   | 2026-11-11 | FAIL   |
| Targeted GREEN                     | `node --test packages/ui/test/pager.test.mjs apps/web/test/m5-sharing.test.mjs apps/web/test/customer-pagination.test.mjs apps/web/test/retail-packages.test.mjs apps/web/test/carrier-connections.test.mjs apps/web/test/carrier-sync-presentation.test.mjs`: 81/81 passed, no skips                                                                                          | 2026-11-11 | PASS   |
| Web TypeScript                     | `npx --yes pnpm@10.34.6 --filter @nexora/web typecheck`: passed after the Retail syntax correction, including fixture props                                                                                                                                                                                                                                                    | 2026-11-11 | PASS   |
| Lint regressions                   | `npx --yes pnpm@10.34.6 test:lint`: 52/52 passed                                                                                                                                                                                                                                                                                                                               | 2026-11-11 | PASS   |
| First visual sampling              | Candidate comparison caught uncompleted hover transition sampling; 80ms wait was insufficient. Increased settling to250ms and reran retained baseline/candidate, without changing production styles to satisfy the test                                                                                                                                                        | 2026-11-11 | FAIL   |
| Final visual comparison            | `node scripts/m5-browser-checks.mjs /workspace/work/m5-candidate /workspace/work/m5-final-evidence /workspace/work/m5-baseline-final`: 16/16 captures, DOM/styles equal and geometry delta <=0.6px, plus navigation, focus, ARIA and feature regressions passed                                                                                                                | 2026-11-11 | PASS   |
| CI-mode local execution            | `node scripts/m5-browser-checks.mjs /workspace/work/m5-ci-artifacts /workspace/work/m5-ci-final-evidence --acceptance`: 16 captures, actual click/Enter/Tab, native Select keys, empty/single/unknown, history <=5, reset, filters/provider/environment/duplicate/max/error lifecycle passed. Host-generated bundles arranged as canonical artifact layout; not Docker success | 2026-11-11 | PASS   |
| Canonical Docker                   | `NEXORA_COMPOSE_OVERRIDE=/workspace/work/m2-compose.yml sh scripts/quality-docker.sh` blocked during image preparation: ENOSPC on8GB filesystem before canonical assertions. Override supplies platform CA build secret only. Removed failed build cache; never reset user volumes                                                                                             | 2026-11-11 | FAIL   |
| Initial host quality               | `API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 quality` failed runner lint (WebSocket/clearTimeout globals and conditional expression); fixed using globalThis, node:timers and explicit branch                                                                                                                                                  | 2026-11-11 | FAIL   |
| Structural retry                   | Same quality command passed format/lint, then preflight required inline SIGNIFICANT invariants/DDD rationale in task; added the already-reviewed presentation-only omission rationale                                                                                                                                                                                          | 2026-11-11 | FAIL   |
| Broad working-diff check           | Same quality command then passed all gates, 625 tests (scripts132/API186/Web266/database6/UI35), zero failures/skips; contracts/build passed. Final-source recheck follows CSS collateral restoration and runner refinement                                                                                                                                                    | 2026-11-11 | PASS   |

### Visual provenance and limits

Baseline16 manifest SHA256:
`4b239fc9e1f3d80848b6c091ef7e2da9a29130b21e50637935d692962d0767af`.
Candidate16 manifest SHA256:
`64ed1c597c4297dacda3b0bffe6dbf99c641ae64e514e8f2e1335cd7c6865c9d`.
14/16 PNGs are byte-identical. The other two differ only by at most1RGB level:
26 pixels at Retail trigger and1819 pixels in a Retail column-picker button;
measured DOM/styles/geometry agree. Captures cover1440x900/390x844, four actual
pagers and two open filters, genuine Customer hover/keyboard-focus states, full
isolated Retail/Carrier screens and open column picker. Four representative
images were manually viewed (baseline desktop controls/mobile Carrier filter;
candidate desktop Retail filter/mobile controls), not all images. No videos.
Customer browser fixture covers actual pagination composition, not authenticated
Customer full-screen/API acceptance. Existing hosted runtime/browser gates remain
mandatory; static, fixture and host passes do not certify those gates.

### Final-source checkpoint

Non-document source/test/workflow manifest digest: `8c45d0becda8ee895ced2fbc1578aac488c2914aac514c832ce792fa111c28d1`.
Computed as SHA256 over sorted path-to-file-SHA256 JSON (compact separators);
mutable task/docs excluded. Exact HEAD remains the baseline above. This digest
binds the final-source rerun without a self-referential commit SHA.

## Final-source quality result — 2026-11-11

`API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 quality`
exited0 on the final-source manifest above; recomputation after the run matches
`8c45d0becda8ee895ced2fbc1578aac488c2914aac514c832ce792fa111c28d1`.
Formatting, lint/boundaries, structural preflight, docs, TypeScript, all625 tests
and contract drift/builds passed, zero failures/skips. No generated contract or
lockfile changes. Subsequent publication updates change documentation only.

| Claim                     | Evidence                                                                                                                                                                              | Date       | Result |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Final-source host quality | Exact command above, exit0; scripts132/API186/Web266/database6/UI35 =625; manifest unchanged after run                                                                                | 2026-11-11 | PASS   |
| Prepared PR plan binding  | runPreflightCheck with prepared PR body passed exact Task ID/reference/revision/snapshot/raw digest binding                                                                           | 2026-11-11 | PASS   |
| Script syntax and scope   | node --check scripts/m5-browser-checks.mjs; sh -n scripts/quality-docker.sh; git diff --check passed; no duplicate feature-owned open/dismiss/focus logic remains in migrated filters | 2026-11-11 | PASS   |

### Governance correction

The first pre-code static preflight rejected the task's missing inline
SIGNIFICANT DDD/invariants marker. The v1 snapshot already contained the reviewed
presentation-only modeling omission before code, but the task record's inline
marker was corrected later, rather than immediately before tests. This is a
record-structure sequencing deviation, not an owner approval claim. The later
quality/preflight failure and correction are preserved above; final task/snapshot
binding and required rationale now pass. No historical snapshot rewritten.

Canonical/hosted runtime and independent review remain pending, not waived.

## Publication checkpoint — 2026-11-11

Implementation commit: `35bc78aeb2a2149372647897e27bf0dd85e0c63c`.
Pushed upstream: `refactor/m5-shared-pager-filter-shell`.
New PR: [#41](https://github.com/dinhphuquy2k1/nexora/pull/41), OPEN, base main.
`gh pr create --base main --head refactor/m5-shared-pager-filter-shell --title
"refactor(ui): share Pager and filter popover shell" --body-file
/workspace/work/m5-pr.md` succeeded. Tree was clean after publication.

Independent review request through GitHub requested_reviewers API for
copilot-pull-request-reviewer[bot] returned successfully but no assigned reviewer.
Subsequent requested-reviewers, review-list and timeline reads showed no review
assignment/submission. This is not independent approval; owner review remains
required. PR description explicitly requests it. No self-certification or merge.

| Claim                                | Evidence                                                                                                              | Date       | Result |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Commit/push/new PR                   | git commit produced35bc78a; git push -u created new remote branch; gh pr view confirmed41 OPEN/main and expected head | 2026-11-11 | PASS   |
| Implementation-head hosted Preflight | [run43003172448](https://github.com/dinhphuquy2k1/nexora/actions/runs/43003172448) completed success on35bc78a        | 2026-11-11 | PASS   |

Implementation-head [Foundation run43003172441](https://github.com/dinhphuquy2k1/nexora/actions/runs/43003172441)
was running Docker quality/integration; M5 and later runtime steps were pending.
No canonical/hosted PASS claimed from job existence. Final documentation-only
checkpoint HEAD, final-head run status and subsequent independent-review outcome
are tracked in mutable PR metadata, avoiding self-referential SHA update loops.
