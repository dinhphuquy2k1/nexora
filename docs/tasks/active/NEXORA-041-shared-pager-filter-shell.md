# NEXORA-041 — M5 shared Pager and FilterPopoverShell

Status: VERIFICATION PENDING
Capability: IMPLEMENTED
Verification: PARTIALLY VERIFIED

## Design Review & Reuse Decision

Task ID: NEXORA-041
Classification: SIGNIFICANT
Plan revision: rev-2026-11-11-m5-r2-v3
Design Snapshot: docs/tasks/design-reviews/NEXORA-041-rev-2026-11-11-m5-r2-v3.md
Design SHA-256: be8e7589a235986abebe6d633125a04732f6a09d37c074fac9b193f07763da12
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
- [x] Original business/visual preservation and v2 intentional ARIA behavior verified at c1aa327; v3 a11y corrections await new-head CI.
- [x] Targeted tests, local browser comparison and acceptance-only execution.
- [x] Historical c1aa327 full host quality:625 tests; not v3 evidence.
- [x] New formatting-remediation local quality:626 tests and all gates; final-head hosted verification still required.
- [ ] Canonical Docker and final-head hosted gates on the NEW F1/F2 commit (historical c1aa327 passed; new-head CI required).
- [x] Canonical docs synchronized; fresh branch pushed and new PR41 to main; no merge.
- [ ] Independent reviewer/owner approval obtained.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Tier A Pager and Tier B FilterPopoverShell ownership, interfaces, consumers and
intentional navigation/aria-controls plus v3 ellipsis and Retail landmark-label accessibility improvements.

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

| Claim                                            | Evidence                                                                                                                                                                                                                                                                                                                                                                       | Date       | Result |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| Baseline unit characterization                   | `node --test apps/web/test/customer-pagination.test.mjs apps/web/test/retail-packages.test.mjs apps/web/test/carrier-connections.test.mjs apps/web/test/carrier-sync-presentation.test.mjs`: 75/75 passed                                                                                                                                                                      | 2026-11-11 | PASS   |
| Baseline browser                                 | `node scripts/build-retail-fixture.mjs /workspace/work/m5-baseline/components apps/web/test/fixtures/m5-entry.tsx`, equivalent Retail/Carrier builds, then `node scripts/m5-browser-checks.mjs /workspace/work/m5-baseline /workspace/work/m5-baseline-evidence`: 10 captures; initial-focus/Escape/outside/unknown assertions passed before production edits                  | 2026-11-11 | PASS   |
| Test-first Pager RED                             | `node --test packages/ui/test/pager.test.mjs` failed with ENOENT for not-yet-created Pager.tsx before production edits                                                                                                                                                                                                                                                         | 2026-11-11 | FAIL   |
| Test-first integration RED                       | `node --test apps/web/test/m5-sharing.test.mjs`: 1 passed / 2 failed for missing navigation/aria-controls; history policy characterization passed                                                                                                                                                                                                                              | 2026-11-11 | FAIL   |
| Intermediate implementation checks               | First combined target run: 7 failures, including a leftover Retail effect fragment and shallow callback traversal; corrected syntax and made F9 execute actual stateless Pager. No business algorithm copied                                                                                                                                                                   | 2026-11-11 | FAIL   |
| Targeted GREEN                                   | `node --test packages/ui/test/pager.test.mjs apps/web/test/m5-sharing.test.mjs apps/web/test/customer-pagination.test.mjs apps/web/test/retail-packages.test.mjs apps/web/test/carrier-connections.test.mjs apps/web/test/carrier-sync-presentation.test.mjs`: 81/81 passed, no skips                                                                                          | 2026-11-11 | PASS   |
| Web TypeScript                                   | `npx --yes pnpm@10.34.6 --filter @nexora/web typecheck`: passed after the Retail syntax correction, including fixture props                                                                                                                                                                                                                                                    | 2026-11-11 | PASS   |
| Lint regressions                                 | `npx --yes pnpm@10.34.6 test:lint`: 52/52 passed                                                                                                                                                                                                                                                                                                                               | 2026-11-11 | PASS   |
| First visual sampling                            | Candidate comparison caught uncompleted hover transition sampling; 80ms wait was insufficient. Increased settling to250ms and reran retained baseline/candidate, without changing production styles to satisfy the test                                                                                                                                                        | 2026-11-11 | FAIL   |
| Final visual comparison                          | `node scripts/m5-browser-checks.mjs /workspace/work/m5-candidate /workspace/work/m5-final-evidence /workspace/work/m5-baseline-final`: 16/16 captures, DOM/styles equal and geometry delta <=0.6px, plus navigation, focus, ARIA and feature regressions passed                                                                                                                | 2026-11-11 | PASS   |
| CI-mode local execution                          | `node scripts/m5-browser-checks.mjs /workspace/work/m5-ci-artifacts /workspace/work/m5-ci-final-evidence --acceptance`: 16 captures, actual click/Enter/Tab, native Select keys, empty/single/unknown, history <=5, reset, filters/provider/environment/duplicate/max/error lifecycle passed. Host-generated bundles arranged as canonical artifact layout; not Docker success | 2026-11-11 | PASS   |
| Local canonical Docker (8GB host)                | `NEXORA_COMPOSE_OVERRIDE=/workspace/work/m2-compose.yml sh scripts/quality-docker.sh` blocked during image preparation: ENOSPC on8GB filesystem before canonical assertions. Override supplies platform CA build secret only. Removed failed build cache; never reset user volumes                                                                                             | 2026-11-11 | FAIL   |
| Hosted Foundation/Docker at c1aa327 (historical) | [Foundation run43003465488](https://github.com/dinhphuquy2k1/nexora/actions/runs/43003465488): final-head c1aa327 Docker quality/integration, M5 Chromium, release/runtime, HTTPS, persistence and development smoke passed; completed 2026-11-11T10:44:01Z. Does NOT verify the later F1/F2 changes.                                                                          | 2026-11-11 | PASS   |
| Hosted Preflight at c1aa327 (historical)         | [Preflight run43003465424](https://github.com/dinhphuquy2k1/nexora/actions/runs/43003465424): success on c1aa327; not a substitute for new-head governance validation.                                                                                                                                                                                                         | 2026-11-11 | PASS   |
| Initial host quality                             | `API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 quality` failed runner lint (WebSocket/clearTimeout globals and conditional expression); fixed using globalThis, node:timers and explicit branch                                                                                                                                                  | 2026-11-11 | FAIL   |
| Structural retry                                 | Same quality command passed format/lint, then preflight required inline SIGNIFICANT invariants/DDD rationale in task; added the already-reviewed presentation-only omission rationale                                                                                                                                                                                          | 2026-11-11 | FAIL   |
| Broad working-diff check                         | Same quality command then passed all gates, 625 tests (scripts132/API186/Web266/database6/UI35), zero failures/skips; contracts/build passed. Final-source recheck follows CSS collateral restoration and runner refinement                                                                                                                                                    | 2026-11-11 | PASS   |

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

## PR41 review remediation — Revision v3 (2026-11-12)

Before modifying production code, recorded immutable v3 snapshot
`docs/tasks/design-reviews/NEXORA-041-rev-2026-11-11-m5-r2-v3.md` (raw SHA-256 `be8e7589a235986abebe6d633125a04732f6a09d37c074fac9b193f07763da12`). The review requests
F1: aria-hidden on decorative ellipsis in both Pager layouts; F2: descriptive
Retail nav label and removal of its redundant outer div aria-label; F3: separate
local Docker failure from prior hosted PASS and rerun all gates on new head.

Historical verified head: `c1aa32798674cc6ac3bd4e75701b17fb35312992`.
Previous hosted [Foundation](https://github.com/dinhphuquy2k1/nexora/actions/runs/43003465488)
and [Preflight](https://github.com/dinhphuquy2k1/nexora/actions/runs/43003465424)
PASS only for that head. The local ENOSPC failure is unchanged and historical.

**New F1/F2 head verification:** PENDING. Do not check the acceptance box or claim
625/625 tests on the new head until its own CI completes. Local environment here
has Node v22.16.0 instead of required Node >=24.19; local pnpm full-suite and
Chromium checks NOT RUN. CI is required. Independent owner approval: PENDING.
FU1–FU4 (Pager defaults, Carrier CSS convergence, milestone-named harnesses and
closed-state aria-controls) are explicitly deferred to a separate pre-Shipment UI
follow-up, not bundled into this patch.

### F1/F2 implementation checkpoint — 2026-11-12

Scoped source/test commit: `6ca7fa848650a895a487a8ab5faead0bc5c8ad70`.
Pager decorative ellipsis now always has `aria-hidden="true"` in grouped
and inline layouts; unit test added for each. Retail nav is renamed
"Phân trang kiện lẻ", and the redundant aria-label on its outer div removed;
shared consumer test expects the new accessible label and checks the outer div
has no duplicate label. Changes do not move feature pagination policy.

Local runtime Node v22.16.0 is below repository minimum Node >=24.19 and has no
usable pinned pnpm environment. Targeted Node tests, full host quality, browser
acceptance and canonical Docker are **NOT RUN locally** for these changes.
Historical hosted PASS on c1aa327 remains historical only; do not mark the
new head verified until its own GitHub Preflight and Foundation pass.

### v3 CI event synchronization — 2026-11-12

First v3 push (bd12bed) triggered [Preflight run43188739337](https://github.com/dinhphuquy2k1/nexora/actions/runs/43188739337),
which FAILED the PR plan revision and snapshot/SHA binding because its GitHub
pull_request event was dispatched before the edited v3 PR body was available.
Current live PR body, task record and immutable snapshot all now declare the
same v3 revision, path and raw SHA-256. A follow-up documentation commit triggers
fresh checks with synchronized PR metadata. This failure is preserved, not waived.

| Claim                    | Evidence                                                                                                                                                                                               | Date       | Result |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| First v3 event preflight | [Run43188739337](https://github.com/dinhphuquy2k1/nexora/actions/runs/43188739337) rejected stale PR-event plan revision/digest. Live PR metadata corrected before rerun; no green claim for this run. | 2026-11-12 | FAIL   |

Final-head hosted checks on the subsequent documentation checkpoint remain
PENDING; passing any earlier HEAD does not certify a new HEAD. No owner approval
or merge was performed.

## Foundation formatting remediation — 2026-11-12

Remediation classification: BOUNDED verification/CI correction within the existing
v3 plan, not a new product or architecture revision. Reviewed starting PR HEAD:
`0d0f6009b4ab5fb7c18ba0fbec8aec3e409aecfc`, clean fast-forwarded existing branch.
No newer remote changes at inspection; no reset, new branch or PR.

### Pre-change inspection and selected approach

Before edits, raw v3 SHA256 matched
`be8e7589a235986abebe6d633125a04732f6a09d37c074fac9b193f07763da12`.
Pinned Prettier check reproduced exactly the two document failures. A formatted
preview was written to scratch only; differences are Markdown wrapping/table
alignment, not a new design decision. ADR009 versioned-plan integrity and Project
Rules require preserving immutable historical snapshot bytes; ordinary CI fixes
within the recorded scope proceed without a new owner approval gate.

| Field                    | Decision                                                                                                                                                                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Exact-path formatting exception and mutable task formatting/evidence                                                                                                                                                                                      |
| Existing implementations | .prettierignore already scopes exclusions to explicit generated/runtime paths; v3 raw bytes and digest are checked independently by scripts/preflight-policy-check.mjs; docs-check reads tracked Markdown independently of Prettier                       |
| Domain owner             | Repository verification/governance; no domain or UI implementation                                                                                                                                                                                        |
| Reuse alternatives       | Reformat committed v3 (reject: changes immutable bytes/digest); create a new plan merely to reflow existing intent (unnecessary); preserve v3 and exclude its exact path from formatting (selected, user Option A)                                        |
| Selected approach        | Add only docs/tasks/design-reviews/NEXORA-041-rev-2026-11-11-m5-r2-v3.md to .prettierignore with rationale; format active task normally; leave plan revision/path/raw digest unchanged across snapshot/task/PR                                            |
| Rationale                | Smallest correction satisfying both formatting and historical integrity. No wildcard exclusion, validation bypass, snapshot rewrite or dependency                                                                                                         |
| Risks                    | An overly broad ignore could hide future documents; verify exact path, neighboring snapshots and active task remain subject to Prettier, and preflight/docs still validate v3                                                                             |
| Verification             | Reproduce RED; format/preflight/docs first; required targeted tests, lint regressions, Web typecheck, full quality, fresh compiled M5 Chromium acceptance and actual final-head hosted Preflight/Foundation. Compare all snapshot raw hashes before/after |

F1/F2 inspection confirms unconditional aria-hidden ellipsis and grouped/inline
regression; descriptive Retail navigation label, removed role-less outer label
and updated consumer assertions. They are not reimplemented. No Pager props,
Carrier CSS, closed-state aria-controls, business rules, API/SDK/schema, fixture
names or FU1–FU4 scope changes. Historical v1/v2/v3 snapshots remain unchanged.

### Current versus historical verification

| Claim                       | Evidence                                                                                                                                                                                                                                                      | Date       | Result |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Reviewed-head Preflight     | [Run43189042801](https://github.com/dinhphuquy2k1/nexora/actions/runs/43189042801) SUCCESS on0d0f600; verifies v3 metadata only, not Foundation                                                                                                               | 2026-11-12 | PASS   |
| Reviewed-head Foundation    | [Run43189043111](https://github.com/dinhphuquy2k1/nexora/actions/runs/43189043111) FAIL at pnpm format:check: task and v3 snapshot unformatted. M5 Chromium and subsequent smoke were SKIPPED. Missing artifacts are downstream, not confirmed UI regressions | 2026-11-12 | FAIL   |
| Local formatting RED        | npx --yes pnpm@10.34.6 exec prettier --check docs/tasks/active/NEXORA-041-shared-pager-filter-shell.md docs/tasks/design-reviews/NEXORA-041-rev-2026-11-11-m5-r2-v3.md reproduced both warnings before correction                                             | 2026-11-12 | FAIL   |
| Initial v3 metadata failure | Prior run43188739337 remains historical FAIL due stale PR-event binding; it is not replaced by the later0d0f600 Preflight PASS                                                                                                                                | 2026-11-12 | FAIL   |

Local Docker ENOSPC and c1aa327 hosted PASS remain historical records above;
neither verifies the later v3 correction. Node22 NOT RUN statements above describe
the earlier remediation environment. This session has supported Node v24.22.1 and
pinned pnpm10.34.6; new local results will be recorded separately. New remediation
HEAD hosted verification: PENDING until actually executed. Independent owner
approval: PENDING. Status remains VERIFICATION PENDING; no merge/deployment.

Final hosted HEAD/merge SHA, run outcomes and artifacts will be recorded in mutable
PR metadata, as allowed by the existing publication checkpoint, without repeatedly
committing verification SHAs. The PR v3 binding will be checked before push.

### New local remediation verification — 2026-11-12

Executed against `0d0f6009b4ab5fb7c18ba0fbec8aec3e409aecfc` plus the two-file
formatter/task working diff, using Node v24.22.1 and pnpm10.34.6. Checks executed
2026-11-12T09:43–09:47Z. No application/test/fixture/workflow source changed.

| Claim                          | Evidence                                                                                                                                                                                                                                                                                                                                                                          | Date       | Result |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Formatting GREEN               | npx --yes pnpm@10.34.6 format:check passed after formatting only the mutable task and adding the exact v3 ignore entry                                                                                                                                                                                                                                                            | 2026-11-12 | PASS   |
| Structural governance          | npx --yes pnpm@10.34.6 preflight:check passed; v3 revision/path/raw digest remain unchanged                                                                                                                                                                                                                                                                                       | 2026-11-12 | PASS   |
| Documentation                  | npx --yes pnpm@10.34.6 docs:check passed; historical FAIL rows and snapshot provenance retained                                                                                                                                                                                                                                                                                   | 2026-11-12 | PASS   |
| Narrow exception and integrity | prettier.getFileInfo confirms only v3 ignored, v1/v2/task not ignored; raw SHA256 of all3 snapshots unchanged from pre-edit capture. validatePrTaskBinding accepts captured live PR body and rejects a deliberately incorrect digest without file mutation                                                                                                                        | 2026-11-12 | PASS   |
| Required targeted regressions  | node --test packages/ui/test/pager.test.mjs apps/web/test/m5-sharing.test.mjs apps/web/test/retail-packages.test.mjs apps/web/test/carrier-sync-presentation.test.mjs:51/51 passed, no skips; includes both F1 layouts and F2 navigation/outer-label assertions                                                                                                                   | 2026-11-12 | PASS   |
| Lint regressions               | npx --yes pnpm@10.34.6 test:lint:52/52 passed                                                                                                                                                                                                                                                                                                                                     | 2026-11-12 | PASS   |
| Web typecheck                  | npx --yes pnpm@10.34.6 --filter @nexora/web typecheck passed                                                                                                                                                                                                                                                                                                                      | 2026-11-12 | PASS   |
| Full local quality             | API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 quality exited0; format/lint/preflight/docs/TypeScript/contracts/builds and626 tests passed (scripts132/API186/Web266/database6/UI36), zero failures/skips                                                                                                                                            | 2026-11-12 | PASS   |
| Fresh v3 M5 browser acceptance | Built fixtures with node scripts/build-retail-fixture.mjs into /workspace/work/m5-fix-fixtures/m5-fixture (m5-entry.tsx), retail-fixture (default entry), carrier-fixture (carrier-entry.tsx). node scripts/m5-browser-checks.mjs /workspace/work/m5-fix-fixtures /workspace/work/m5-fix-browser-evidence --acceptance passed16 captures and actual interaction/focus/ARIA checks | 2026-11-12 | PASS   |

Local canonical Docker rerun: NOT RUN in this remediation; the known8GB local
ENOSPC record is preserved. Fresh final-head canonical Docker/runtime verification
will execute in hosted Foundation. Local browser assertions executed and16
screenshots were captured; no new manual image review or baseline visual
comparison claimed for this formatter-only correction. Generated captures/logs
remain outside Git. Scope/diff self-review: two intended files only; no remaining
P1/P2 technical finding from this correction. This is not independent approval.

Before the final push, verify the live PR still has the same v3 revision/path/
SHA binding. New HEAD hosted results remain PENDING here at commit time; record
actual final-head/merge SHA, run URLs/conclusions and artifact evidence in mutable
PR metadata after execution. Owner approval stays PENDING, task stays
VERIFICATION PENDING. Do not append a new SHA-only verification commit afterward.

## Ellipsis test hardening within v3 — 2026-11-12

Delta: siết test ellipsis, không đổi contract. Task classification remains
SIGNIFICANT; plan revision, snapshot, raw digest and PR metadata remain unchanged.
Read-only inspection at a6e2761e475628c31cffa88b81d61d6e0add4fcf confirms
the existing grouped/inline SSR test counts hidden separators but would miss an
additional visible separator. Reuse the actual Pager SSR loader and existing
[1, 2, 5] fixture; add an independent total-character count of exactly one,
retaining the hidden-count assertion of exactly one for both layouts. No new
component, helper, dependency or production change is needed. This test-only
verification delta changes no canonical product fact; existing task Documentation
Impact remains REQUIRED for the broader M5 work, with only execution evidence
updated here. No new DDD modeling, API/DB/authority or accessibility contract.

Verification sequence: run targeted baseline; strengthen the existing test;
temporarily inject one extra non-hidden ellipsis in Pager.tsx, observe the focused
test fail, and restore the exact production bytes before further checks/commits.
Run requested targeted, lint, docs, preflight and full quality checks. Push the
test/evidence delta and inspect final-head Preflight, Foundation Docker quality
and its M5 Chromium acceptance step. Preserve any failed runs. Mark canonical
hosted acceptance only after all required gates pass on the tested head; keep
Status VERIFICATION PENDING and independent reviewer/owner checkbox open.
FU1–FU4, snapshots and .prettierignore are outside this delta.

### Ellipsis delta local evidence

Executed on baseline a6e2761e475628c31cffa88b81d61d6e0add4fcf plus the
two-file test/task delta, Node v24.22.1 and pinned pnpm10.34.6,
2026-11-12T13:31:00Z–13:31:46Z UTC. Production Pager SHA256 before and after
mutation: a03122f701a620819a1fbea04fdae8bbfc95754b5300100ccfde187187594166.
Detailed mutation/lint logs remain outside Git in execution scratch.

| Claim                              | Evidence                                                                                                                                                                                                                                                                                                                                                                    | Date       | Result |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Targeted baseline                  | node --test packages/ui/test/pager.test.mjs apps/web/test/m5-sharing.test.mjs: 7/7 PASS, 0 skipped before test hardening                                                                                                                                                                                                                                                    | 2026-11-12 | PASS   |
| Mutation negative control          | At 2026-11-12T13:31:25Z, temporarily added one extra non-hidden span containing an ellipsis before first navigation. node --test --test-name-pattern="Pager always hides decorative ellipses" packages/ui/test/pager.test.mjs exited1: expected FAIL, total2 versus expected1 in grouped layout. Original Pager bytes restored in finally; no production mutation committed | 2026-11-12 | FAIL   |
| Mutation detection and restoration | Expected negative-control failure confirms the added assertion detects an extra visible ellipsis; Pager.tsx byte-identical to HEAD after restoration                                                                                                                                                                                                                        | 2026-11-12 | PASS   |
| Targeted GREEN                     | node --test packages/ui/test/pager.test.mjs apps/web/test/m5-sharing.test.mjs: 7/7 PASS, 0 skipped; both layouts independently require total1 and hidden1                                                                                                                                                                                                                   | 2026-11-12 | PASS   |
| Lint regression                    | npx --yes pnpm@10.34.6 test:lint: 52/52 PASS, 0 skipped                                                                                                                                                                                                                                                                                                                     | 2026-11-12 | PASS   |
| Documentation                      | npx --yes pnpm@10.34.6 docs:check: PASS                                                                                                                                                                                                                                                                                                                                     | 2026-11-12 | PASS   |
| Structural governance              | npx --yes pnpm@10.34.6 preflight:check: PASS; v3 binding unchanged                                                                                                                                                                                                                                                                                                          | 2026-11-12 | PASS   |

Full quality and new-head hosted gates are pending for this delta. Historical
FAIL evidence above remains intact. Only pager.test.mjs and this task may differ
from a6e2761; snapshots, .prettierignore and all production files stay unchanged.
