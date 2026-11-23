# NEXORA-058 — Uniship controlled activation

Status: PLANNED
Capability: PLANNED
Verification: NOT VERIFIED

## Origin

Future task named by the owner in NEXORA-056. Retains external prerequisites from
[NEXORA-055](../completed/NEXORA-055-shipment-services.md) closure and the canonical
[Uniship contract](../../integrations/uniship-portal-api.md).

## Scope

UNISHIP_LIVE_ACTIVATION and remaining ADR007/live-environment, operational custody, hard-gate and owner-controlled activation prerequisites. Requires verified adapter contracts from NEXORA-057 and explicit activation evidence; no implementation or live request is authorized by this planning stub.

Complete the required SIGNIFICANT pre-code review and versioned plan before starting.
This is a planning stub only; no snapshot or runtime implementation is claimed.

## Documentation Impact

Documentation Impact: NONE

### Reason

Follow-up scope bookkeeping only; assess implementation impact when this task starts.

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
