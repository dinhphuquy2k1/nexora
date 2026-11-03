# ADR-010 — PostgreSQL Sync Worker and Current-State Staging

Status: Accepted. Date: 2026-11-02. Authority: owner's Sync V1 implementation instruction, NEXORA-034.

This adds the explicitly requested Sync worker to the Modular Monolith. Earlier
ADR-002/007 on-demand-only milestones remain historical; this decision authorizes
one separate Nest application-context process in the existing API image, not a
new app/microservice, broker or HTTP listener. PostgreSQL is the durable queue.

Five main tables own config/job/item/source identity/current payload. Source
identity/mapping survives resolved-payload retention and connection hard delete,
within the original owner/provider/account/type/key scope. No cross-owner mapping
reuse, implicit domain rollback, raw-payload snapshots or extra review queue.

Claim uses SKIP LOCKED in a short transaction. Every subsequent write transaction
locks ACTIVE user→Carrier epoch→connection→job and checks captured generation,
lifecycle version, lease/version/expiry and current execution authorization. The
same transaction owns staging/items/checkpoint or domain/mapping/outcome. No HTTP
or crypto under locks. Disable/delete cancel jobs atomically; reactivation does
not restore them. Scheduling is completion-based, not a guaranteed hourly SLA.

A dedicated nexora_sync runtime role/secret mounts no administrator or Identity
key material. It reads and locks authorization metadata and accesses Sync tables;
it cannot mutate sessions/credentials or implement domain writes without an
explicit valid domain handler/grant. API and worker share a PostgreSQL provider
acquisition budget, retaining existing safety limits rather than inventing quotas.

No authorized Uniship fetch contract, payload-retention permission or Shipment
schema exists at this baseline. Ports and mock verification are infrastructure
only. Production capabilities remain unavailable until an actual provider/domain
handler is supported and authorized; runtime flags alone never authorize live
traffic. No new synthetic System User or Customer invariant bypass. Retention has
no invented default duration; unresolved payloads are not automatically purged.

Alternatives rejected: Redis/event bus, in-memory source of truth, worker per
provider, page/job payload snapshots, changing hard delete to soft delete, phone-only
Customer identity, invented Shipment schema. Costs: explicit SQL fencing/coordination
and restart tests; benefits: durable progress and clear owner/security boundaries.
See the NEXORA-034 snapshot/task for interfaces, migration and verification.

## 2026-11-03 scoped review corrections

Authorization facts use worker FOR SHARE read locks, which still block ordinary
lifecycle/status updates; jobs/sources/items keep exclusive write locks. PostgreSQL
requires UPDATE for direct row-locking SELECT even in SHARE mode. Fixed read-only
SECURITY DEFINER functions with schema-qualified tables/pinned search_path and
worker-only execution supply this lock capability without metadata UPDATE grants.
API parent locking and privileges remain unchanged. This is a bounded privilege
correction, not a new role/table/business module or a different locking order.

Provider reservations renew their unique token while the operation runs and abort
transport on loss; success, cooldown/reset and release are ownership-fenced. Existing
quota/backoff and endpoint/validation policy remain. Six review fixes and their
actual regressions are recorded in the NEXORA-034 scoped review revision.

## 2026-11-03 final source-order clarification

A missing order remains valid for genuinely unordered sources (prior order NULL)
using full-fetch hash comparison. Once an identity has a nonnull order, a changed
hash with missing or equal order cannot prove a newer observation: reject the
entire page with existing SOURCE_CONFLICT before bulk writes/checkpoint changes.
This also fails closed for coarse timestamps; order is not assumed to be a unique
provider revision. Older observations are ignored; same hash/equal or missing
order is physically unchanged; greater order advances metadata or payload version
as applicable. Identical-hash page duplicates retain the greatest nonnull order.
No provider contract, record outcome, retry/watermark policy or schema is added.

## 2026-11-03 runtime reliability and privilege corrections

Scheduler selection filters ACTIVE/CONNECTED/capable/inactive lanes before LIMIT;
expected/transient admission failures continue through a bounded keyset scan. A
process-local continuation prevents repeated failed windows pinning later lanes;
it never advances persisted due dates. Existing atomic admission and completion-
based scheduling remain authoritative, including terminal technical failure.

Expired RUNNING reclaims count failed execution attempts. Exhausted candidates
release the selection lock, recheck under canonical lifecycle locks and atomically
become FAILED with a new lease version and completion schedule. Checkpoint/source
state is retained; last success/successful watermark do not advance. Record retry
exhaustion remains technical FAILED, never synthetic NEEDS_REVIEW/SUCCEEDED.
API reads use shared authorization locks; API writes and worker F5 capabilities
remain. Shared reads can still block lifecycle/login writers. API staging DELETE
is removed while worker retention DELETE remains. M4 shared-client work is deferred
until a canonical system-wide mechanism exists; none is invented here. Unicode
SourceKey normalization is explicitly withdrawn and byte distinctions remain.

## Outcome Classification Contract

SyncDomainProcessor classifies a successful valid Domain transition as APPLIED.
With a stable source identity, deterministic invalid payload (missing/empty required
field, wrong type, invalid weight/date or policy limit) is REJECTED_SOURCE, resolved
without Domain application. Valid data needing a business decision (ambiguous
matching, ownership/state conflict or link confirmation) is NEEDS_REVIEW.

RETRYABLE_ERROR is only for transient technical failures with a bounded retry policy,
such as lock timeout, serialization conflict or temporary dependency outage. Its
exhaustion makes the Job FAILED; database/network/programming failures must never
be converted to business review or application to advance successful watermark.
Unexpected faults retain existing rollback/retry/failure behavior. Invalid or missing
source identity follows the existing safe ingestion failure policy, not silent
rejection/skipping. Domain writes use the supplied fenced session without network I/O.

The first production processor must run domain-specific contract fixtures covering
all four outcomes and deterministic validation versus transient technical errors.
No production processor exists at this baseline: this classification contract is
documented, but production conformance remains PENDING. Existing infrastructure
fixtures do not certify a future processor; see the testing requirements.
