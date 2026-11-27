# NEXORA-058 — Uniship controlled activation

Status: VERIFICATION PENDING
Capability: IMPLEMENTED
Verification: PARTIALLY VERIFIED

## Origin

Future task named by the owner in NEXORA-056. Retains external prerequisites from
[NEXORA-055](../completed/NEXORA-055-shipment-services.md) closure and the canonical
[Uniship contract](../../integrations/uniship-portal-api.md).

## Scope

Technical readiness for one scoped Uniship SHIPMENT FULL production composition,
existing Carrier recovery with restricted Worker custody, cross-process per-request
pacing, cancellation/lifecycle fencing, manual/AUTO gating, strict optional existing
reconciliation policy and operational runbook/evidence. Owner implementation
prompt2026-11-24 and hardening revision2026-11-27 supersede the earlier planning-only stub. External live gate stays
closed; no live request, activation, thresholds or merge authorized.

## Design Review & Reuse Decision

Task ID: NEXORA-058
Classification: SIGNIFICANT
Plan revision: rev-2026-11-27-controlled-activation-v3
Reviewed baseline: 02c2d05a5695ff292cdc2be5a7235170bac39580
Branch: feature/uniship-controlled-activation
Design Snapshot: docs/tasks/design-reviews/NEXORA-058-rev-2026-11-27-controlled-activation-v3.md
Design SHA-256: 728eb7babf573b133ecf3da6a10be6279b401c40307ec132e3e6ba6086dcf2d0

Snapshot v3 records12-section ownership/security/interfaces/migration/verification plan
and eight-field reuse audit before source/tests. Reuse existing Carrier lifecycle/
vault/audit/crypto, Sync registry/fences/worker and Shipment policy/binding. Scoped
Worker operations replace broad privilege assumptions; private recovery proof is
necessary to distinguish self-claim from concurrent reconnect after version change.
No owner design approval gate is introduced. Actual external activation is separate.

| Component       | Existing implementations                                                           | Domain owner                              | Reuse alternatives                                                               | Selected approach                                                                                                                  | Rationale                                                           | Risks                                                  | Verification                                                                                      |
| --------------- | ---------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Purpose readers | carrier-credential-vault.ts; carrier-lifecycle.adapter.ts; worker-carrier-store.ts | Carrier infrastructure                    | Generic selector, separate framework, narrow existing port                       | authorizeRecovery, loadToken, loadRecoveryPassword; shared private metadata authorization                                          | Least credential hydration without new orchestration                | Audit race, accidental token/password query            | Spy reader and native Prisma/role assertions; committed audit race                                |
| Worker SQL      | migration 20261124000000_uniship_controlled_runtime; provision-runtime.mjs         | Carrier persistence                       | Duplicate validators, broad grants, reuse scoped context                         | Metadata-only shared \_sync_carrier_context; private token helper and exact-proof recovery helper; three fixed public capabilities | Existing lock order and bounded store transactions                  | Legacy bypass, proof mismatch, migration compatibility | Restricted role matrix, proof negatives, 19/20 upgrades, repeat/drift/ACL                         |
| Reconnect       | carrier-lifecycle.service.ts; CarrierCredentialPort; uniship-sync.runtime.ts       | Carrier application and rollout authority | Duplicate policy, use recovery claim, narrow precheck plus explicit manual claim | authorizeReconnect delegates existing outbound authority; claimReconnect CAS generation/version allows REAUTH_REQUIRED             | No policy copy or manual/recovery semantic regression               | Race before claim, stale snapshot or disabled owner    | Denials leave version/credentials/jobs unchanged; valid manual statuses; concurrent changes       |
| Environment     | turbo.json; compose.yml; compose.release.yml; loadSyncConfig                       | Runtime infrastructure                    | Global env, loose mode, direct Node, task-scoped pass-through                    | API dev exact allowlist; shared/database watch-only; shared Compose anchors                                                        | Strict isolation and homogeneous settings without changing defaults | Key exposure to Web/build; empty values                | Resolved Turbo/Compose with synthetic env, parser errors, actual PID probe                        |
| Process proof   | scripts/dev-smoke.sh; existing signed Nest runtime fixture                         | Testing infrastructure                    | Container env only, debug endpoint, existing smoke plus proc probe               | Inspect actual HTTP server and Worker /proc environments; output only boolean assertions                                           | Proves process propagation while preserving canonical smoke         | Wrong PID, secret output, dev prerequisites            | Canonical smoke retains enrollment/login/HMR/drift/persistence/cleanup; loopback capability suite |

### Tactical DDD and domain invariants

Carrier owns verified credential identity/recovery and scoped rollout policy; Sync
owns immutable job provenance/leases/admission/terminalization; Shipment owns its
existing aggregate and reconciliation v3. No new aggregate or business engine.
Infrastructure scoped operations omit full hydration only for fixed authorization/
CAS/permit facts; application reuses existing lifecycle business rules and audit.
User→epoch→connection→job/operation lock order; no HTTP/crypto/delay under locks.
No password decrypt before committed audit and revalidation, no stale page commit,
no broad Worker secret/Identity grants, no partial visibility or public DTO changes.

## Original implementation plan (historical v1/v2)

1. Close merged062 in first commit; freeze formatted058 plan and raw SHA before code.
2. RED Carrier runtime/activation/reconciliation config and security/HTTP contracts.
3. Scoped Worker credential/audit persistence, cancellation and recovery lifecycle fences.
4. Per-dispatch SQL permit for GET/POST with mock receive-time/cooldown/lease tests.
5. Shared API/Worker composition; scoped admission/schedule/claim/fence and manual-only.
6. Existing reconciliation config/binding, canonical docs/evidence matrix/runbook.
7. Genuine owned signed PG/mock runtime, readiness, quality/available Docker, independent
   review, commit/push exact-head hosted checks/PR metadata. No live activation/merge.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- Shared technical composition, Worker scoped credential authority/audit and cancellation.
- Cross-process request spacing, scoped deployment/manual/AUTO and optional policy config.
- Stop/recovery/deployment verification and external evidence matrix; technical versus live.

### Canonical owners

- docs/architecture/sync-extensions.md, backend.md, runtime.md, database.md
- docs/operations/configuration.md, deployment.md, testing.md
- docs/integrations/uniship-portal-api.md; docs/domains/shipments.md where changed
- docs/decisions/multi-carrier-architecture.md dated amendment
- This active task, frozen design and docs/tasks/evidence/NEXORA-058/

### Documentation verification

pnpm docs:check,preflight:check,test:docs,test:preflight; final raw snapshot binding.

## Evidence

| Claim              | Evidence                                                                                               | Date       | Result |
| ------------------ | ------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| follow-up-recorded | Named prerequisite transferred during NEXORA-055 closure in NEXORA-056; execution remains NOT VERIFIED | 2026-11-16 | PASS   |

## Additional prerequisites transferred from NEXORA-056 closure

PR55 merge a19aa0d2532b41135a90c6e48e3b6876471ad343 on2026-11-16 closes the
implementation under §1.7. Historical HTTPS/MFA runs43838009175 attempts1/2 and
43848285718 remain FAIL; cause UNKNOWN. Later source3f8aef9 Foundation43889980798
PASS4–10 is current execution evidence, not a causal fix. Before relying on live
activation, retain canonical HTTPS/MFA/runtime gates and actual host/key/certificate/
NTP/custody evidence; no production readiness is inferred from fixture CI. Causal
investigation resumes only on recurrence with bounded diagnostics or a separately
planned targeted reproducer with a concrete hypothesis and observable discriminant.
No new workflow retry or live request is authorized by this bookkeeping entry.

| Claim                    | Evidence                                                                                                                                                                                                                                      | Date       | Result |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Follow-up scope retained | Transferred at NEXORA-056 closure by NEXORA-057; [completed056](../completed/NEXORA-056-auto-provision-sync-configuration.md) retains original FAIL/NOT RUN and final source CI provenance; external/causal verification remains NOT VERIFIED | 2026-11-16 | PASS   |

## Adapter prerequisites retained by NEXORA-057

Fixture-backed implementation does not establish external
UNISHIP_FIELD_SEMANTICS_VERIFICATION or UNISHIP_CLAIM_LIFECYCLE_CAPTURE. Require
new owner-scoped redacted claim-opening/update/ending evidence, actual OldStatus
meaning, provider ID resync stability, cross-page consistency, service null/false
and complete snapshot semantics, monetary alternatives/currencies/units, quantities,
counts, timestamp timezone/export precedence and actual child maxima. Do not infer
these from synthetic tests. Current adapter emits no services/charges/items/
milestones and has no destinationWarehouse schema target; add only separately
verified/necessary normalized contracts, never reuse serviceLevel as a destination.
Before activation also implement/verify agreed per-connection1request/s and provider
stop/drift disablement controls and remaining ADR007/live/host/custody gates.
Production registration and external live hard-close remain unchanged in057.

## Điều kiện bắt buộc trước khi bật lịch tự động — quyết định owner2026-11-20

Owner giữ thời gian Uniship không có múi giờ là giờ Việt Nam(UTC+7), adapter chuyển
sang UTC khi lưu; Web hiển thị Asia/Ho_Chi_Minh. Quan sát MD59639(API03:03:16,
UI10:03:16) còn mâu thuẫn, được giữ để kiểm chứng chứ không kết luận đã giải quyết.

- Sau lần sync thật đầu tiên theo chế độ kiểm soát/thủ công, trước khi bật bất kỳ
  lịch sync tự động nào, owner chọn3kiện có mốc nhập/xuất kho.
- So giờ hiển thị các mốc trên Nexora với giao diện Uniship; ghi bằng chứng đã xóa
  định danh cho từng kiện, mốc và kết quả so sánh. Gate này phải được xác nhận PASS
  trước khi cho phép lịch tự động; hiện NOT RUN.
- Nếu Nexora lệch7tiếng, dừng lịch sync/giữ lịch tự động tắt. Tạo task sửa riêng để
  đổi cách hiểu nguồn sang UTC, rồi sync lại từ dữ liệu hãng mới; các mốc thời gian
  do hãng sở hữu sẽ được ghi đè qua cơ chế source/version/transaction hiện có.
  Không sửa trực tiếp DB, không suy mốc từ stage history, không dùng retry/timeout
  để coi như gate đã đạt.

NEXORA-060 chỉ ghi nhận điều kiện này và kiểm thử kỹ thuật, không chạy sync thật
hay bật lịch. Các điều kiện authorization/custody/operational/live khác vẫn giữ.
Phần mô tả adapter057 ở trên là phạm vi lịch sử;060 bổ sung mapping đã xác minh
nhưng không thay thế kiểm chứng thực về múi giờ trước lịch tự động.

## Reconciliation activation prerequisites retained by NEXORA-062

Missing reconciliation is implemented/tested only with synthetic configurations.
Before any future production auto-hide, approve explicit absolute missing, missing
percentage and observed-drop limits, complete source-ID/query consistency/live
prerequisites and scoped operational review. No thresholds, production registration
or automatic scheduling are enabled here. Query fingerprint transitions require an
explicit migration/repair policy, not automatic baseline replacement. These live/
operational gates remain NOT RUN under this PLANNED task.

## Admission/execution clarification before policy wiring

Preserve existing stop semantics: enabled/due schedule is checked at AUTO admission,
including direct internal AUTO calls, while already admitted execution is not
reinterpreted as a new scheduling decision. Claim/fence still recheck approved
scope/mode and minimum interval60; disabling a persisted schedule alone is not an
immediate active-job cancellation guarantee. Explicit stop/drain/revoke remains the
runbook. This clarifies the existing immutable job/trigger boundary within v1, not
a new scheduling or reconciliation design. Manual admission may replace an old
policy-blocked AUTO lane only under the current owner's normal scoped locks; it
never rewrites schedule intent. Stale Worker cancellation retains worker/lease proof.

## Technical implementation delta — 2026-11-24

Within frozen v1: shared API/Worker scoped runtime, restricted Worker credential
functions/private recovery proof, actual PostgreSQL per-dispatch permits,
cancellation/shutdown, manual/AUTO eligibility and optional existing reconciliation
policy. No mapping/query/version/timezone/reconciliation-v3 rewrite or live bypass.
Independent review identified nullable CAS/permit edges, abort-after-reserve cleanup,
query-lock bounds and failed-recovery active-lane cleanup; native regressions retain
RED/GREEN evidence. Loop drains before runtime clients close.

[Implementation verification](../evidence/NEXORA-058/implementation-verification.md)
records executed checks. [External matrix and stages0–6](../evidence/NEXORA-058/external-gates-and-runbook.md)
separate existing owner evidence from open prerequisites. The adapter057 description
above is historical; Mapping V2 services/items/charges/milestones are retained.
Technical readiness does not close external gates or this task. No production
thresholds/account IDs, live request or AUTO activation are shipped. Final PR/CI
verification remains pending until actual results are recorded.

## Current technical verification — 2026-11-24

| Claim                               | Evidence                                                                                            | Date       | Result |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Local technical quality             | Pinned pnpm quality: format/lint/preflight/docs/typecheck,903unit/script tests, contracts and build | 2026-11-24 | PASS   |
| Restricted scoped runtime           | Actual signed roles, real HTTP/Nest manual FULL/recovery/reconciliation and scheduling36/36         | 2026-11-24 | PASS   |
| Forward migration                   | Real19→20 preservation, repeat deploy, drift and fixed functionACLs                                 | 2026-11-24 | PASS   |
| Independent read-only source review | No remaining P1/P2; implementation agent's repro is distinct from reviewer inspection               | 2026-11-24 | PASS   |

Task remains active VERIFICATION PENDING for external/hosted acceptance; technical
implementation does not approve controlled live use, production or automatic scheduling.

Full signed local PostgreSQL integration result reviewed2026-11-27:263/263 PASS,
0skip,391792.266706ms. The previous provider-inventory fixture failure is retained in
implementation evidence; exact inventory and varchar32 assertions remain enforced.
Hosted exact-HEAD verification remains pending.

## Plan v2 integration delta — 2026-11-27

PR64 source0eb9292 is conflicted with main2b31e7e after063 SQL readability and PR63 UI.
Frozen v2 records mechanical merge/query-builder and lint compatibility before source
changes. Preserve all previous local PASS/fail evidence; none proves merged source.
External live/production/AUTO gates remain closed and unchanged.

Snapshot v2 historical-context clarification: its copied §1 paragraph about PR61's
"exact main revision" refers to the original v1 baseline5edbcfe, not to current
integration baseline2b31e7e. §13 governs the new main integration. Both frozen snapshots
remain unchanged; this explicit erratum avoids rewriting historical plan bytes.

Main-integration v2 validation2026-11-27: quality919/919, signed integration263/263
(374063.186516ms,0skip), scoped runtime36/36 and migration repeat/drift PASS.
Independent read-only integration review: no P1/P2. Snapshot SHA and historical plans
remain unchanged; current hosted verification receipt belongs in PR64 description.

## Canonical discovery correction — 2026-11-27

Foundation45961050403 step4 failed at EXECUTE_SUITE_SHIPMENT-WORKER with
DOCKER_COMMAND_TIMEOUT. Existing launcher bounds each suite at180000ms.058 appended
its new runtime file to that existing timed suite; no individual failing assertion
or active subtest is available in the timeout diagnostic. This is an aggregate
suite timeout, not proof of a product failure or exact subtest cause.

Within v2 discovery scope: reuse the same signed shipment-worker wrapper with one
explicit new runtime-only selector, restore its original two-file default sequence,
and register a separate uniship-runtime entry using the same launcher/mounts/180s
bound. Prepare owned STORAGE_ROOT before either selected invocation. No existing
assertion, timeout, concurrency, retry or Foundation workflow step changes. Preserve
failed run evidence; verify selector/cleanup via existing launcher fixtures and the
runtime-only wrapper against owned signed PostgreSQL before publishing.

## Hardening revision v3 — 2026-11-27

Owner requested purpose-specific credential access, exact Worker recovery proof,
pre-claim reconnect authorization and generation/version CAS, task-specific strict
Turbo ENV and shared Compose runtime settings. Reviewed source02c2d05/main2b31e7e
are unchanged after fetch; no separate merged ENV/MFA fix found. The frozen v3
snapshot contains the full eight-field reuse audit and selected interfaces, forward
migration21, concurrency/custody constraints and causal A/B strategy. v1/v2 and
historical decisions/evidence remain unchanged. No source or test modified before
this design record. Source02c2d05 green CI is baseline evidence only.

Causal RED and candidate implementation are recorded in
[hardening v3 verification](../evidence/NEXORA-058/hardening-v3-verification.md).
Purpose separation/proof, reconnect no-mutation/CAS, strict ENV/Compose and actual
host process A/B passed; quality and migration/repeat/drift passed. Independent
read-only review through e1d66a4 found no concrete P1/P2/P3. Final signed wrapper and
new-HEAD hosted CI receipts are recorded in the linked evidence as they complete. Live/production acceptance remains outside this PR; status stays VERIFICATION
PENDING. Local Docker prerequisite limitation: only PostgreSQL image present and
approximately1.3GiB free, so application/tooling smoke availability must be assessed
without building unpublished release images.

### Historical unexecuted checks — evidence table format correction

These original unexecuted rows are preserved verbatim below as limitations,
not PASS/FAIL claims. Their blocker/provenance remains unchanged.

```text
| Controlled live verification          | Not authorized in agent/CI; remaining external matrix and three-parcel timezone gate open           | 2026-11-24 | NOT RUN |
| Production activation/AUTO/thresholds | Hard-close false; no production policy values/activation performed                                  | 2026-11-24 | NOT RUN |
| Local Docker runtime                  | Insufficient disk for missing API/Web/tooling images; genuine host tests do not substitute          | 2026-11-24 | NOT RUN |
```

### Hardening v3 verification claims

| Claim                                   | Evidence                                                                                                                                                                                                              | Date       | Result |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Causal baseline defects                 | Same-harness baseline02c2d05 RED for combined credentials, missing recovery proof, denied reconnect mutation, strict Turbo ENV and Compose parity; [v3 evidence](../evidence/NEXORA-058/hardening-v3-verification.md) | 2026-11-27 | FAIL   |
| Candidate local quality                 | pnpm quality exit0,928 tests; test:lint, test:docs10/10, test:preflight24/24; migration19→20→21 preservation/repeat/drift; [v3 evidence](../evidence/NEXORA-058/hardening-v3-verification.md)                         | 2026-11-27 | PASS   |
| Credential/reconnect and runtime config | Targeted54/54, native64/64, real restricted role/projection/CAS/audit, host actual-process A/B and resolved Compose/Turbo; final strengthened signed receipt separately linked                                        | 2026-11-27 | PASS   |
| Independent read-only review            | Reviewer inspected e1d66a4 against02c2d05/v3; no concrete P1/P2/P3, pending runtime/hosted gates explicitly retained                                                                                                  | 2026-11-27 | PASS   |

Canonical local Docker gates remain NOT RUN for missing images/insufficient disk;
no local host/process/config check substitutes for their hosted execution. External
production acceptance remains open and task stays VERIFICATION PENDING.

| Claim                                | Evidence                                                                                                            | Date       | Result |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Full native integration              | pnpm test:integration291/291,0skip; [hardening receipt](../evidence/NEXORA-058/hardening-v3-verification.md)        | 2026-11-27 | PASS   |
| Original and separate signed entries | Shipment23/23, Observation47/47, strengthened Uniship runtime64/64,0skip; unchanged discovery/budget, sourcee1d66a4 | 2026-11-27 | PASS   |

### Hosted first-candidate failure retained

Source4013e52: Preflight46014406078/job140557726855 and
Sync46014405914/job140557726326 PASS attempt1 on merge082ec63.
Foundation46014406009/job140557726849 attempt1: steps4–9 PASS; dev step10 FAIL
at the task-added API process probe (DEV_ENV_ACTUAL_PROCESS_NOT_UNIQUE). Controlled
Docker reproduction proved exec-root versus mapped-owner /proc access mismatch;
probe now reuses existing dev-entrypoint UID mapping, with assertions/timeouts/
privileges unchanged. [Detailed evidence](../evidence/NEXORA-058/hardening-v3-verification.md).
This failure remains FAIL; corrected final source requires fresh hosted CI.

| Claim                                | Evidence                                                                                                       | Date       | Result |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| First candidate Preflight/Sync       | Source4013e52, merge082ec63, runs46014406078/46014405914, attempt1                                             | 2026-11-27 | PASS   |
| First candidate Foundation dev probe | Run46014406009, attempt1, exact new probe diagnostic and controlled owner-UID reproduction retained            | 2026-11-27 | FAIL   |
| Final scoped negative coverage       | Original token scope negatives restored with positive precondition; signed runtime64/64,0skip after correction | 2026-11-27 | PASS   |
