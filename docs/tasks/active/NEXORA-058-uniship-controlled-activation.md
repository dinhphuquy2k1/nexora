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
reconciliation policy and operational runbook/evidence. Latest owner implementation
prompt2026-11-24 supersedes the earlier planning-only stub. External live gate stays
closed; no live request, activation, thresholds or merge authorized.

## Design Review & Reuse Decision

Task ID: NEXORA-058
Classification: SIGNIFICANT
Plan revision: rev-2026-11-24-controlled-activation-v1
Reviewed baseline: 5edbcfe1609562f9eb5b6c156cf5cec68b5b71fa
Branch: feature/uniship-controlled-activation
Design Snapshot: docs/tasks/design-reviews/NEXORA-058-rev-2026-11-24-controlled-activation-v1.md
Design SHA-256: 185ac494aab2afc766d19b26bfa33913388db64869f86408a00256882a8652af

Snapshot records12-section ownership/security/interfaces/migration/verification plan
and eight-field reuse audit before source/tests. Reuse existing Carrier lifecycle/
vault/audit/crypto, Sync registry/fences/worker and Shipment policy/binding. Scoped
Worker operations replace broad privilege assumptions; private recovery proof is
necessary to distinguish self-claim from concurrent reconnect after version change.
No owner design approval gate is introduced. Actual external activation is separate.

| Component             | Existing Implementations                                                                             | Domain Owner                                                         | Reuse Alternatives                                            | Selected Approach                                                                                             | Rationale                                                  | Risks                                                | Verification                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------- |
| Runtime/recovery      | sync-runtime-capabilities.ts; app.module.ts; SyncWorkerModule; Carrier lifecycle/vault/adapter/audit | Sync composition; Carrier custody                                    | Shared helper versus copying lifecycle/API module             | One declaration, role-specific construction, existing orchestration                                           | Preserve budgets/CAS/AAD and process isolation             | Secret authority, claim provenance, shutdown         | Real role/mock Nest runtime, recovery/disable/takeover races         |
| HTTP/admission/policy | UnishipHttpClient; PostgresProviderBudget; SyncRepository; reconciliationPolicy                      | Carrier transport/rollout; Sync eligibility; Shipment reconciliation | Existing slots/process Map versus separate scoped SQL permits | Keep acquisition slots; per-dispatch shared permit; generic scoped eligibility; strict existing policy parser | Correct cross-process spacing and OFF/manual-only behavior | Lease/cooldown/abort/old AUTO lane, malformed config | Mock server arrivals, real PG ACL/CAS/queue tests and v3 regressions |

### Tactical DDD and domain invariants

Carrier owns verified credential identity/recovery and scoped rollout policy; Sync
owns immutable job provenance/leases/admission/terminalization; Shipment owns its
existing aggregate and reconciliation v3. No new aggregate or business engine.
Infrastructure scoped operations omit full hydration only for fixed authorization/
CAS/permit facts; application reuses existing lifecycle business rules and audit.
User→epoch→connection→job/operation lock order; no HTTP/crypto/delay under locks.
No password decrypt before committed audit and revalidation, no stale page commit,
no broad Worker secret/Identity grants, no partial visibility or public DTO changes.

## Plan

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

| Claim                                 | Evidence                                                                                            | Date       | Result  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------- | ------- |
| Local technical quality               | Pinned pnpm quality: format/lint/preflight/docs/typecheck,903unit/script tests, contracts and build | 2026-11-24 | PASS    |
| Restricted scoped runtime             | Actual signed roles, real HTTP/Nest manual FULL/recovery/reconciliation and scheduling36/36         | 2026-11-24 | PASS    |
| Forward migration                     | Real19→20 preservation, repeat deploy, drift and fixed functionACLs                                 | 2026-11-24 | PASS    |
| Independent read-only source review   | No remaining P1/P2; implementation agent's repro is distinct from reviewer inspection               | 2026-11-24 | PASS    |
| Controlled live verification          | Not authorized in agent/CI; remaining external matrix and three-parcel timezone gate open           | 2026-11-24 | NOT RUN |
| Production activation/AUTO/thresholds | Hard-close false; no production policy values/activation performed                                  | 2026-11-24 | NOT RUN |
| Local Docker runtime                  | Insufficient disk for missing API/Web/tooling images; genuine host tests do not substitute          | 2026-11-24 | NOT RUN |

Task remains active VERIFICATION PENDING for external/hosted acceptance; technical
implementation does not approve controlled live use, production or automatic scheduling.

Full signed local PostgreSQL integration result reviewed2026-11-27:263/263 PASS,
0skip,391792.266706ms. The previous provider-inventory fixture failure is retained in
implementation evidence; exact inventory and varchar32 assertions remain enforced.
Hosted exact-HEAD verification remains pending.
