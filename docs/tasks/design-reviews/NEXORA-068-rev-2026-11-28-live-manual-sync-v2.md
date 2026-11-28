# NEXORA-068 — PR68 review remediation v2

## 1. Metadata

Task ID: NEXORA-068
Classification: SIGNIFICANT
Documentation Impact: REQUIRED
Plan revision: rev-2026-11-28-live-manual-sync-v2
Reviewed HEAD: ea0c639e02d96d21a22916edb296390859e28bef
Branch: feat/uniship-live-manual-sync-acceptance
PR: 68

## 2. Requirements and boundaries

Resolve F01 placeholder PR metadata, F02 invalid evidence results, F03 confirmed
Reconnect followed by rejected/unknown Rename, F04 behavioral callback regressions,
and F05 capability/acceptance consistency. No new branch/task/PR. Existing live
acceptance remains historical evidence; no additional live operation or owner
runtime change. No backend/SDK/schema/grant/Sync/mapping/CI/dependency/UI redesign.
No backup/restore or related work. Keep actual connection, shipments and credentials.

## 3. Canonical owners

AGENTS, docs/ai routed workflow, ADR009, frontend architecture, design-system and
reusable-components; testing operations; active068 and immutable v1. Current rules
supersede historical approval gating. Documentation owners changed are frontend,
testing and task068; preserve all historical executed evidence and immutable v1.

## 4. Read-only inspection

Inspected CarrierConnectionsLive, CarrierConnectionsPage, CarrierConnectionDrawer,
CarrierLiveSyncDrawer, sync-api, types, presentation, workspace client and existing
Carrier tests/component-harness. Search onEditConnection, flight, mutated, rename,
SyncApiError, reconciliation and Customer mutation-policy. Existing Live finally
refreshes after confirmed Reconnect, but drawer catches subsequent Rename error
without clearing its password. Existing Page stores a selected row snapshot.
Existing component harness runs actual closures but selects first export only;
Drawer module has multiple exports. Add only an optional named-export selector to
that same helper, preserving all existing default consumers. No second harness.

## 5. Reuse audit

| Field                    | Partial edit                                                                                                       | Authoritative read and tests                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Component                | Carrier-local typed partial-success error                                                                          | Existing SDK list read, Page/Drawer recovery, componentHarness                                                                                                                             |
| Existing implementations | CarrierConnectionsLive.tsx, CarrierConnectionDrawer.tsx, sync-api.ts                                               | CarrierConnectionsPage.tsx, CarrierLiveSyncDrawer.tsx, customers/mutation-policy.ts, test/helpers/component-harness.mjs                                                                    |
| Domain owner             | Carrier Web presentation                                                                                           | Carrier Web presentation and existing Web test helper                                                                                                                                      |
| Reuse alternatives       | Generic mutation framework, callback result rewrite, typed error                                                   | Copy Customer hook, assume failed rename, owner-scoped GET through existing API                                                                                                            |
| Selected approach        | Keep Promise<void>; typed error carries only confirmed reconnect, rejected/unknown rename and session-expiry state | Optional reconciliation callback threads existing list read; Page updates selected row after accepted read; Drawer tracks pending read and authoritative name; reuse deterministic harness |
| Rationale                | Minimal local contract, no password/response/cause on error                                                        | Exact affected connection read, no provider I/O or new endpoint, no generic state machine                                                                                                  |
| Risks                    | Retained password, repeated reconnect, 401 confusion                                                               | Unknown outcome mislabeled, stale row, failed read enabling mutation, unmounted read writes                                                                                                |
| Verification             | Actual callback order/count and drawer password/open state                                                         | Unknown committed/not-committed/read-failed tests; read-only retry, abort fence, offline parity                                                                                            |

## 6. Alternatives

Reject reversing Rename/Reconnect (moves partial success); refreshing alone does not
clear local secrets. Do not copy Customer mutation framework or create durable queue.
Keep existing synchronous flight guard and generated SDK/workspace client. An
explicit 4xx is a rejection; transport/malformed/5xx is unknown. Unknown read failure
must block further writes; no automatic mutation retry or invented rollback.

## 7. Internal contracts and ownership

New feature-local CarrierPartialEditError has reconnectSucceeded=true, renameOutcome
(rejected or unknown), and sessionExpired boolean; fixed safe message, no credential,
raw response/body or error cause. Live tracks confirmed reconnect separately, wraps
only subsequent Rename failures and refreshes confirmed mutations in finally.

Keep onSubmit/onEditConnection Promise<void>. Add optional onReadConnection(row,
signal) callback from Live to Page and optional onReconcile(signal) returning current
displayName or null to Drawer. Reuse api.connections with owner-scoped ID match;
map only existing row presentation fields. Page updates its selected row from the
accepted read so later edit comparisons use authoritative name, not old snapshot.

Drawer clears password on partial success before awaiting any read, preserves the
requested name and stays open. For rejected or unknown Rename, read the current
connection; accepted name matching the draft prevents redundant Rename. A differing
name establishes a fresh baseline and permits user-driven retry. Failed/missing
read retains a write block with a GET-only retry action. Explicit 401 retains the
central session boundary and clears password without further reconciliation calls.
A subsequently entered new password may deliberately reconnect after settlement.

## 8. Security and concurrency

Only synthetic tests; no owner/API/provider/runtime execution. Existing workspace
session policy remains sole 401 authority; provider credential400 is not session
expiry. No secrets on typed errors. Reuse AbortController and generation fencing
for reconciliation reads and cleanup on unmount; flight serializes both submit and
GET-only recovery, disabling dismissal while busy. No polling/timers added. Preserve
refresh generation fences and all backend lifecycle/security contracts.

## 9. Compatibility and DDD

Presentation-only change, no Aggregate/Value Object/application/DB contract needed.
Optional callback means draft-only fixtures retain disabled forms/dialogs and exact
layout. Reuse Button/TextInput/Overlay and existing alert feedback styles. No CSS,
shared component, SDK or template change. Stage3 mandatory warehouse comparison
remains NOT RUN; repeat FULL optional; Stage4/5 deferred, no new task.

## 10. Test-first plan

Before source edits, extend carrier-connections tests to execute Live and Drawer
closures via componentHarness with synthetic SDK/API doubles. Causal RED must show
password retained and redundant reconnect/read omission. Cover connect rejection
and success; rename-only, reconnect-only, ordered combined, reconnect rejection;
partial retry count1 reconnect/2 renames; unknown read committed/not committed/
failed GET-only recovery; session401 and new-password opt-in; disconnect success/
failure, double-submit and callback-less parity. Keep valuable old tests.

Run four requested Carrier suites, full Web, format/lint/testlint/typecheck/contracts/
docs/preflight/testdocs/testpreflight/diff checks with Node24.19.0/pnpm10.34.6. Record
real host limitations, never relabel failures. Required final-source hosted
Preflight/Foundation and other matching workflows; no optional stress or blind rerun.

## 11. Governance and delivery

Format v2 then hash raw bytes, bind task and PR metadata before test/code changes.
Correct evidence schema without changing allowed PASS/FAIL; move unexecuted rows to
limitations, preserve d531582 provenance and old CI failures46159270100/46159270149
(merge15427f99d3446f4d584f96e3469270f252739746). Capability IMPLEMENTED, verification
PARTIALLY VERIFIED and split mixed acceptance. Independent review before delivery;
final hosted receipts in PR description without self-referential evidence commit.
No merge or owner-runtime acceptance repetition.

## 12. Stop conditions

Stop/replan after three unresolved attempts or a required out-of-scope change.
Do not modify harness/workflows/timeouts/assertions to force green. Existing shared
test helper change is limited to export selection, not runtime/CI harness behavior.
Keep all owner decisions, actual runtime and mandatory data limitations intact.
