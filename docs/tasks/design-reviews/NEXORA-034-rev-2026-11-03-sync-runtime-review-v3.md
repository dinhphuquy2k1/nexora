# NEXORA-034 — Sync runtime review corrections

## 1. Metadata

Task ID: NEXORA-034
Classification: SIGNIFICANT
Plan revision: rev-2026-11-03-sync-runtime-review-v3
Reviewed baseline: 2ff53fb994b130cc5e5b1d23778d41e3f7bc732d
Branch: feat/sync-worker-staging-v1; existing Draft PR32 only.
Documentation Impact: REQUIRED. Recorded plan under ADR-009, no new approval.

## 2. Scope

Implement I1, M1, M2, M5, m1, m2; lock existing M3 technical-exhaustion behavior
with tests. M4 is DEFERRED because branch/main have no official shared client
mechanism. m3 is WITHDRAWN: sourceKey Unicode bytes remain distinct. No patch was
attached in this turn; it is optional reference only and is not applied wholesale.
No new table/service/pool framework, business handler/UI/SDK/API contract, broker,
new outcome, automatic success conversion or existing snapshot modification.

## 3. Read-only inspection

Fetch/ff-only pull confirms clean reviewed baseline. Inspected schedule/claim/
connection/apply, Worker bootstrap/loop, app.module factories, provision grants,
Prisma schema/migrations and signed cluster/migration/Sync harnesses. Searched
LazyPrisma/sharedClient/DatabaseModule in branch and origin/main: no canonical
shared client; adapters own independent lazy clients. Searched common logging:
no safe structured failure helper exists. Existing indexes do not lead with the
requested FK/due columns; no equivalent indexes. SourceKey NFC tests already exist.

## 4. Reuse audit

| Component | Existing implementations                                             | Domain owner | Alternatives                                    | Selected approach                                                                                                                                 | Rationale                                     | Risks                                                           | Verification                                                        |
| --------- | -------------------------------------------------------------------- | ------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| I1        | SyncRepository schedule/admit/available and active index             | Sync infra   | Advance due vs eligibility/keyset               | Filter ACTIVE/CONNECTED/capability/active lane before LIMIT; bounded keyset scan with process-local continuation                                  | Preserve completion scheduling, no starvation | Post-selection rejection, transient DB errors, cursor precision | 100invalid+healthy, failures/races/completion, bounded continuation |
| M1        | connection; F5 worker lock functions                                 | Sync infra   | Rewrite locks vs internal mode                  | API read/write mode, shared reads; worker functions unchanged                                                                                     | Preserve owner/lifecycle barriers             | Disable/delete lock order                                       | Real concurrent reads and lifecycle writers                         |
| M2        | claim/fence/wait and terminal config writes                          | Sync infra   | Unlimited reclaim vs count failures             | Count expired RUNNING reclaim; exhausted candidate rechecks under user→epoch→connection→job locks then atomic terminal transition/config schedule | No zombie commits or lock inversion           | Renewal race, lost checkpoint, exhaustion                       | Real crash/reclaim/CAS rollback/resume tests                        |
| M3        | apply record retry/exhaustion                                        | Sync infra   | Convert outcome vs preserve                     | No production outcome change; add failure/watermark/new-job/new-version tests                                                                     | Technical failure is not business review      | False success                                                   | Genuine PG exhausted retry and valid NEEDS_REVIEW                   |
| M4        | app.module, SyncRepository/PostgresProviderBudget plus main adapters | Runtime      | Add manager vs defer                            | DEFERRED, no code                                                                                                                                 | No official shared mechanism to reuse         | Pool count remains known follow-up                              | Exact search evidence; no FIXED claim                               |
| M5        | worker main/module; common directory; SyncError                      | Worker infra | Framework vs local allowlist                    | Minimal infrastructure-local projection/logger for actual Prisma classes, closed Node/SQL codes and typed Sync configuration error                | Safe actionable startup/cycle logs            | Arbitrary names/codes/getters/secrets                           | Native malicious errors and actual worker startup/cycle processes   |
| m1        | schema + explicit migration/legacy harness                           | Database     | Duplicate indexes vs inspected additive indexes | Four forward indexes; regular indexes in Prisma, partial indexes SQL-owned                                                                        | FK/due access paths                           | Drift/preservation/duplicates                                   | Fresh/staged/repeat deploy, catalog and data snapshots              |
| m2        | provision-runtime grant maps, signed cluster tests                   | Runtime DB   | Broad DELETE vs least privilege                 | Remove only API staging DELETE, keep worker retention DELETE                                                                                      | Retention stays worker-owned                  | Old ACLs or broken cleanup                                      | Actual role CRUD/denial/retention and provisioning                  |

## 5. I1 selected behavior

Build provider/type eligibility from distinct configured pairs through existing
available(), not a second SQL business policy. Filter ACTIVE user, CONNECTED and
active lanes before LIMIT100. Order by next_run_at/config UUID. Scan at most200
candidates and admit at most100 per call; continue after expected Sync rejection
and known transient Prisma transaction failures. Retain a process-local keyset
cursor between polling calls so repeated failures beyond the bounded window do
not permanently starve later lanes. Reset at end; restart may restart scanning,
never alters persisted due dates. Unexpected errors propagate after cursor advances
so diagnostics/poll delay remain and a persistent bad row cannot pin the scan.
Only real configure/completion paths modify next_run_at. Atomic admit/index remains.

## 6. M1/M2 locking

Internal read/write literal lock mode affects only API authorization reads; worker
uses existing fixed F5 functions. Reads retain ACTIVE/ownership checks and shared
locks blocking ordinary lifecycle updates; no promise of zero contention.
Expired RUNNING reclaim increments attempt_count; fresh QUEUED/WAITING claims do
not. Successful page reset remains. When an expired candidate would exhaust retry,
release the short selection lock without claiming it, then reacquire normal
user→epoch→connection→job order, recheck status/version/expiry and atomically mark
FAILED, bump lease version, clear owner/expiry, record attempts/error/finished time
and schedule from that completion. No success/watermark or checkpoint writes.
Concurrent renewal/reclaim must make the stale terminal candidate a no-op.

## 7. Ownership/contracts

Technical Sync/runtime fixes only; no new aggregate/domain actor/DDL business
model or endpoint. Global ErrorFilter and envelope remain. Live ports stay
unavailable. M3 remains FAILED on technical exhaustion and honest record metadata;
valid business NEEDS_REVIEW remains terminal warning. No SourceKey normalization.

## 8. Safe diagnostics

Use a minimal Sync infrastructure helper (database imports stay infrastructure),
not a logging framework. Actual Prisma error classes plus explicit P-code lists,
closed Node/database code lists and known Sync/configuration error types project
only fixed errorType/errorCode. Unknown/spoofed/unsafe values return UNKNOWN_ERROR.
Never emit error message/stack/SQL/meta/URL/token/payload. Both startup and cycle
use it. Typed configuration errors preserve existing validation/message behavior.

## 9. Database

Add new forward migration20261104000000_sync_fk_indexes only after confirming
absence: jobs(connection), items(source identity), source identity(customer) WHERE
nonnull and configs(next_run_at) WHERE enabled. No unique/FK/delete changes.
Regular indexes declared in schema; partial SQL ownership noted. Extend staged
legacy harness/runtime expected migration count, preserve old and Sync fixture rows.

## 10. Test-first verification

RED real PostgreSQL scheduler eligibility/failure/continuation, shared-read overlap,
disable/delete writer barriers, expired attempts/terminal atomicity/stale fencing/
page checkpoint resume and exhausted record failure/success watermark separation.
Use actual signed owned cluster for role privilege tests. Logging units include
known classes/codes, unknown/non-Error and secret-bearing messages/codes; actual
compiled worker processes verify startup/cycle call sites. No fake PostgreSQL,
shared role mutation, user-volume reset or new Python. Retain F1–F9 and Unicode.

## 11. Documentation/review/commits

Update task, concise ADR/database/runtime/testing facts; retain all prior failures
and immutable hashes. Three independent rounds: scheduler/data; locks/security/
indexes/roles/logging; full runtime/CI/docs/scope. Group commits by correction.
Run canonical quality, genuine PG/roles/migrations and final-head hosted Preflight,
Sync targeted and Foundation. Evidence includes exact head/merge/steps/logs.

## 12. Handoff

M4 remains explicitly DEFERRED, m3 WITHDRAWN/NOT APPLICABLE. No finding is VERIFIED
from source review alone. Existing Draft/task verification pending and live limits
remain; no force-push/approve/merge/deploy. Final self-referential SHA/CI evidence
may be reconciled in PR metadata after completion.
