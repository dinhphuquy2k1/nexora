# NEXORA-035 — Sync Provider & Domain Extension Architecture

Status: VERIFICATION PENDING
Capability: IMPLEMENTED
Verification: PARTIALLY VERIFIED

## Design Review & Reuse Decision

Task ID: NEXORA-035
Classification: SIGNIFICANT
Plan revision: rev-2026-11-08-sync-extension-v1
Design Snapshot: docs/tasks/design-reviews/NEXORA-035-rev-2026-11-08-sync-extension-v1.md
Design SHA-256: fd6b4419022e7c5cbdc82344883ceef54dc8f85652495c692b0fdb8a2747f29d
Reviewed baseline: 6a52c2ff90a1173a25053caf6fb7061b82f6b8dd
Branch: feat/sync-extension-architecture

PR32 merged as baseline above; GitHub merged=true, fresh origin/main ancestry and clean working tree verified2026-11-08. No prior branch reused. No NEXORA-035 task/reference found before creation. Selected interfaces, full eight-field reuse audit, scope/alternatives/security/compatibility and test-first plan are in the versioned snapshot. ADR-009 does not require owner approval.

### Reuse audit summary

| Field                    | Selected Phase A implementation                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Component                | Exact-pair resolver and fenced Domain invocation                                                                        |
| Existing implementations | SyncProvider/SyncDomainProcessor ports; SyncRepository; SyncJobExecutor; existing Customer link and lock capabilities   |
| Domain owner             | Sync technical orchestration, Customer-owned link persistence, runtime composition roots                                |
| Reuse alternatives       | Existing composite ports, static registry, dynamic plugins or public transaction callback                               |
| Selected approach        | Small static registry, shared empty production factory, trusted deferred domain binding; preserve queue/policies/schema |
| Rationale                | Explicit dispatch/version consistency and neutral APPLIED without invented business writes                              |
| Risks                    | Wrong pair/version, fake APPLIED, scope leakage, rollback and retained-session lifetime                                 |
| Verification             | Unit RED/GREEN, genuine two-capability PostgreSQL persistence/fencing, all existing regressions and final-head CI       |

## Milestones

- [x] A1 audit, scoped plan, snapshot and preflight.
- [x] A2 static exact-pair capability resolution and shared composition.
- [x] A3 provider contract regressions.
- [x] A4 neutral Domain invocation and Customer-owned link boundary.
- [x] A5 API/Worker wiring, empty production capabilities.
- [x] A6 compatibility and developer extension guide.
- [ ] A7 real multi-capability PostgreSQL/quality/runtime/hosted verification.
- [ ] Three independent review rounds and final-head evidence.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Static capability composition, neutral fenced Domain invocation and extension procedure.

### Canonical owners

- docs/architecture/backend.md
- docs/architecture/runtime.md
- docs/architecture/database.md (unchanged schema/grants, Domain mapping ownership)
- docs/operations/testing.md
- docs/decisions/sync-worker-staging.md (additive Phase A clarification)
- New developer guide under docs/architecture/ linked from canonical backend.

### Documentation verification

pnpm docs:check, pnpm preflight:check, pnpm format:check.

## Evidence

| Claim                                               | Evidence                                                                                                                                    | Date       | Result |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Initial structural preflight                        | Missing inline eight-field task audit; corrected before implementation and recheck PASS                                                     | 2026-11-08 | FAIL   |
| Baseline build before engine cache                  | Genuine Prisma checksum download denied403; no checksum/TLS bypass                                                                          | 2026-11-08 | FAIL   |
| Genuine prerequisite recovery                       | Verified public CI artifact SHA256 and pinned schema-engine version, then complete API dependency build PASS                                | 2026-11-08 | PASS   |
| Static capability/application/worker unit contracts | node --test apps/api/test/sync/\*.test.cjs20/20PASS,0skip; resolver module absent RED before implementation                                 | 2026-11-08 | PASS   |
| Independent source reviews                          | Round1 correctness9/9unit PASS; Round2 security11/11unit PASS, no confirmed P1/P2; actual PG/hosted acceptance still required               | 2026-11-08 | PASS   |
| Fresh merged baseline and new branch                | PR32 merged=true; origin/main6a52c2ff90a1173a25053caf6fb7061b82f6b8dd; merge-base ancestry PASS; clean new feat/sync-extension-architecture | 2026-11-08 | PASS   |
| Frozen prerequisites                                | pnpm10.34.6 install --frozen-lockfile on Node24.19.0; 427 locked dependencies, no lockfile change                                           | 2026-11-08 | PASS   |

## PLAN ISSUES

PRODUCTION_DOMAIN_WRITE_CONTRACT remains a pre-Live B/C gate: no authorized production write/provider/grant is invented. Controlled test-owned transactional persistence must prove the Phase A boundary. If it cannot, retain AC7/AC8 BLOCKED and do not weaken invariants. Issue33 remains deferred.

## Verification re-evaluation — fixture isolation

Before further fixture edits, three actual PostgreSQL attempts were reviewed:
initial launcher FAIL57P03 because its default socket readiness observed temporary
bootstrap; changed only the external owned launcher to TCP plus SELECT1. Next run
52tests/45PASS/7FAIL: six new cases and parent failed because configure schedules
in the future, not immediately; make only the owned AUTO fixture due and clean each
case on failure. Third run52tests/46PASS/6FAIL demonstrated neutral APPLIED/cursor
restart and other new contracts, but lease fixture SELECT pg_sleep exposed Prisma's
unsupported void decoding, and leftover fixture rows invalidated unchanged legacy
10005-source/99-retention assertions (with subsequent cascading failures).

Re-plan within the same architecture: keep real lease expiry but select a supported
scalar from pg_sleep; remove only extension-owned table/items/payloads/identities/
jobs/connections after the fixture, including deliberately substituted source IDs.
Use canonical payload hashes for valid isolation controls. Keep every existing
assertion and production algorithm/timeout unchanged. Re-run the complete suite;
these historical failures are not PASS or evidence of a production-policy change.
No immutable snapshot or owner approval gate changes. Genuine engine recovery used
public artifact13602882132 from target42443725029, ZIP SHA256
bd9b99bc82e7018ec740d41425901026fb7f80832f20e02178ebc583f282057a,
matching pinned Prisma0edf323efd1d98336f3f0a68684b56f689b900d3; no checksum/TLS bypass.

## Implementation checkpoint and executed verification

Implementation is in place on the new branch; new PR/final-head hosted verification
and independent Round3 are pending. Production capabilities remain unavailable.

- Full host quality before final factory test:598/598,0skip (132root/194API/234Web/32UI/6database), contracts reproducible and4/4builds PASS.
- Latest Sync ordinary units22/22PASS include actual Nest API and Worker composition factories with flags true and no added secrets.
- Actual migrated Docker PostgreSQL extension + all prior Sync tests52/52PASS,0skip; owned database and container cleanup PASS.
- Signed disposable provisioning/worker privilege/secret-domain denial script PASS; genuine Prisma legacy/staged/repeat/drift migration script PASS separately; owned cleanup PASS. The standalone provisioning suite's native SQL setup is not claimed as Prisma migration execution.
- Token audit against base6a52c2ff: schedule/claim/heartbeat/wait/cleanup/page method bodies unchanged modulo whitespace/comments. Only registry selection/admission, exact identity/source fencing and Domain invocation boundary changed.
- API/OpenAPI/SDK/shared vocabulary/schema/migrations/grants and NEXORA-034 snapshots/task have zero diff.
- Round1 correctness and Round2 security/architecture independently found no confirmed P1/P2; each ran relevant units. Future arbitrary adapters still require their actual Domain contract tests; trusted binding commit is not a general sandbox or automatic proof.

Historical local build/lint prerequisites initially failed implicit contextual
types/Node-global lint names; corrected annotations/globalThis without suppressions.
Standalone role launcher first used48hex characters for the runtime secret, correctly rejected by the
existing64hex custody guard; external fixture corrected to32 random bytes, policy
unchanged. No false PASS or assertion weakening. Full logs stay outside Git.

Local complete Docker release/dev image builds are NOT RUN at this checkpoint:
the managed executor has about3GiB free versus the documented20GiB build minimum.
Actual local PostgreSQL uses Docker; this is distinct from full Docker/runtime
acceptance. Final-head hosted Foundation must execute canonical Docker quality,
roles/migrations, LOCAL/TTY/browser, HTTPS, persistence, dev and cleanup; only
actual logs can close that verification. Exact final SHA/run/merge/review evidence
is reconciled in new PR metadata after completion to avoid SHA-only doc loops.

## Async processor-version regression

An additional unit first failed with Missing expected rejection when a mutable
processor version changed after asynchronous binding initialization or during its
decision. Customer binding now checks the captured version/support before and
after decision and around commit; a post-write mismatch throws within the same
transaction. Focused Sync units22/22PASS,0skip. Independent security re-review ran
10/10capability tests PASS and found no confirmed P1/P2. Real PostgreSQL and full
quality are re-executed for this source change; earlier52/52 is not substituted.
Final-source PostgreSQL rerun52/52PASS,0skip (197114ms), with owned migrated
database/container cleanup PASS. Full host quality remains running at this checkpoint;
final-head results will be reconciled in PR metadata.

A subsequent host quality invocation without API_INTERNAL_URL failed the existing
Web build configuration gate. Re-run with the documented local upstream variable;
no Web/production configuration code or assertion changed.

## A7 verification clarification — real browser synchronization

Before changing the browser harness, hosted head eea7287cb85536b0309ec2ba63da561bfe543fef
Preflight42469166797 and targeted42469166904 passed. Foundation42469166660
Docker quality600ordinary tests,133integration tests, genuine migration/role
checks and both real PTY harnesses passed, but runtime browser failed CHECK_FAILED
at CARRIER_V2_SOURCE_BACKED_SIX_VIEWPORT_MATRIX. Retained artifact13612643217
(raw ZIP SHA256 c863fe2e479c71b7fd62fdbd419aae72c21be9d170f3cbb63a5cabd0c86f0d38)
records87captures, last admin filter768x1024. Account upload subsequently failed
for missing evidence; HTTPS/data/dev skipped and are not PASS.

Read-only diagnosis: Carrier harness and all production Web/UI files have zero
diff from main. The existing navigate helper waits a root present in the previous
document and does not settle fonts before immediate geometry comparisons. A real
Chromium fixture-only run of unchanged compiled TSX independently failed the
status/environment badge-width equality (100.453125 versus104.1875). This is a
separate reproduced readiness defect; it does not establish the exact original
CI timeout's cause. No blind rerun or assertion weakening.

Bounded A7 plan before harness edits: reuse the existing navigate/until/evaluate
path; mark the previous document, require a fresh complete document/root and
settled font/two-frame layout before interactions. Re-run the actual full fixture
and hosted Foundation. Do not alter UI, selectors, assertions, geometry tolerances,
timeouts, credentials or production behavior. This changes test synchronization,
not the immutable approved architecture or capability model.

A7 bounded implementation re-review found no confirmed P1/P2. Full actual local
Chromium Carrier fixture now PASS, including status/environment equality, all six
viewport surfaces, keyboard/history and Sync issues, with owned browser/profile
cleanup PASS. AST assertion inventory remains106before/106after; original
assertions, tolerance values and polling budgets are unchanged. Full host quality
rerun and new-head hosted verification remain pending at this source checkpoint.
The first hosted browser failure remains unattributed, not retroactively PASS.
