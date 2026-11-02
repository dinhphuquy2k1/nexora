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
