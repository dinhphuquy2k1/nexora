# NEXORA-049 — Shipment domain design

## Task metadata and classification

Task ID: NEXORA-049
Classification: SIGNIFICANT
Plan revision: rev-2026-11-13-shipment-domain-design-v1
Reviewed baseline: d0e75cc83619f11f7b192485d9fdd7a051179b6d
Branch: docs/shipment-domain-design

## Reuse & design audit

| Field                    | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Shipment domain design, domain-owned source linkage, shared vocabulary and new-table conventions; documentation only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Existing implementations | docs/domains/shipments.md contains the old planned model; ADR-002 strict exclusion is historical; Sync Phase A in docs/architecture/sync-extensions.md supplies sync_source_identities, provider_source_records and domain binding; apps/api/src/customer/application/customer-owner.ts resolveCustomerOwner, customer/domain/customer.aggregate.ts and owner/status/created indexes are the reference; schema.prisma currently has customer_id/link_origin and created_by_sync_job_id in sync_source_identities; apps/web/features/retail-packages/types.ts supplies six Retail fixture statuses plus all |
| Domain owner             | Nexora Shipment owns the aggregate, charges, append-only stage history and source linkage; Sync owns neutral engine state; Customer owns Customer linkage; canonical docs own policy                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Reuse alternatives       | Reuse Customer owner-resolution, locked aggregate and indexed read-model patterns and Sync fenced binding; rejected workspace, polymorphic link table, API configuration in DB, fixed fee columns, one column per domain in Sync, raw-response lookup on every read                                                                                                                                                                                                                                                                                                                                        |
| Selected approach        | Owner-approved ADR-011: RETAIL_PARCEL/Uniship design, one resolveShipmentOwner, domain source_identity_id, provider/Nexora write separation, three status layers, charge rows and append-only history; document later Sync cleanup, no code or migration                                                                                                                                                                                                                                                                                                                                                   |
| Rationale                | Preserve authoritative ownership and independent business invariants; avoid coupling the engine to each domain; normalized necessary fields support bounded reads without retained raw-response interpretation                                                                                                                                                                                                                                                                                                                                                                                             |
| Risks                    | Unverified provider status codes/identity/API rights; cross-owner leakage; sync overwriting Nexora data; duplicate history; old Customer source linkage migration; premature UI vocabulary persistence                                                                                                                                                                                                                                                                                                                                                                                                     |
| Verification             | Five documentation/governance commands, exact five-line binding, docs-only diff, active inventory and decision consistency; future isolated domain and genuine PostgreSQL parity/concurrency tests before implementation                                                                                                                                                                                                                                                                                                                                                                                   |

## Requirements and boundary scope

Record only the owner's accepted Shipment design and the concrete implementation roadmap. No production code, migration, schema edit, new test, adapter registration, provider API invention or activation. Close merged NEXORA-048 first. ADR-011 supersedes only ADR-002's shipment-table exclusion for the selected scope; manual/Excel remain future capabilities.

## Relevant documentation and inspection

Read AGENTS.md and docs/ai/README.md routes, ADR-002/008/009/010, shipments.md/customers.md, database.md/backend.md/sync-extensions.md/api-contract.md, schema.prisma, Retail types and task048. Searched resolveCustomerOwner, customer_id, link_origin, created_by_sync_job_id and created_sync across API, scripts, schema and migrations. Customer infrastructure owns the present existing-link binding; created_by_sync_job_id has a schema/migration declaration but no application writer. No claim of a production data audit. Reusable Components and the pre-implementation template guide boundaries; no generic framework is introduced.

## Ubiquitous language and bounded context

Shipment is Nexora's parcel record; source is its stable provider identity; provider status is the original carrier code; logistics stage is Nexora's mapped physical stage; claim distinguishes carrier claim status from future internal claim cases; charge is an attributed monetary line; stage history is an append-only transition observation. First scope is RETAIL_PARCEL from Uniship, not bulk shipments or import/export entrustment.

## Aggregate boundaries, invariants and interfaces

Shipment is the root, charges its children. History is append-only, not an editable aggregate child. Lists/search/counts use scoped projections without hydration. Meaningful value policies validate money/currency, weight and closed stage membership without copying Customer phone rules. Domain holds transitions and returns immutable copies; DB generates UUID/code/timestamps. Application resolves owner through resolveShipmentOwner and orchestrates ports; trusted infrastructure binding normalizes and applies only provider fields in a fenced transaction. Future read ports serve list/detail/history, and future Nexora commands remain separate from provider updates. No NestJS/Prisma/HTTP in Domain and no generic save-all/Unit of Work. Charge replacement is an explicit provider-owned operation, not a generic full-aggregate save.

## Alternatives and trade-offs

Workspace is rejected: each instance is one organization and current ownership is the connecting account. Polymorphic link tables lose explicit domain/FK ownership; a dedicated table is reserved for actual multiple-source merging. DB-configured API URLs/auth/paging/keys/validation bypass code review, so adapters own these in code. Fixed fee columns obstruct extensibility; use charge rows. One domain column per Sync table couples the neutral engine to every domain; move linkage onto each domain. Retained raw responses reinterpreted on every read obscure ownership/privacy and query cost; persist only needed normalized fields. Trade-off: explicit per-domain bindings, a later Customer linkage migration and provider verification are required.

## Security and authorization

Current Shipment owner is the connected/synchronizing account, resolved in one function for every query and command; no scattered owner = actor or ADMIN cross-owner bypass. A dedicated company connector account is recommended. Approved future users.is_data_owner and ADMIN/OPERATOR permission matrix is design only, not an authorization change. Both future roles view/link customers/note/tag/assign/manage customers and claim cases; only ADMIN configures connections/sync and finalizes reconciliation. Encrypted secrets remain server-side; minimal authorized payload, no credentials/PII in logs. Official API authorization and the seven Uniship questions block an adapter.

## Concurrency and idempotency

Reuse Sync ACTIVE user→Carrier epoch→connection→job authorization/lease/version fences; scoped Shipment lock/hydration and provider-only writes, charge operation, history, outcome and final fence commit atomically. No network under locks or in-memory consistency substitute. Unique source_identity_id and (shipment_id, source_version) prevent duplicate identity/history; unchanged payload performs no write. Preserve engine hashes/versions/order/counters and current retry/outcome contracts. Unknown provider code is preserved with UNKNOWN and a warning, not automatically NEEDS_REVIEW.

## Query cost

Owner/stage/created/id and owner/created/id indexes support stable paginated projections; owner/tracking index supports lookup without assuming tracking uniqueness. Partial open-claim and nonnull-customer indexes are planned. List/count predicates share owner/search scope; tab counts are server results, never page sums or invented zeros. Fetch charges for detail only and page history independently; no list aggregate hydration/N+1 or framework/cache. Exact open-claim predicate depends on verified carrier claim semantics; no fabricated codes.

## Backward compatibility and migration

This PR changes docs only: schema, API/OpenAPI/SDK, grants and existing Customer/Sync exports are unchanged. DESIGNED never claims implemented persistence. Document the next task's forward migration removing source-side customer_id/link_origin/check/index and unused created_by_sync_job_id/FK/created_sync, adding Customer source_identity_id UUID UNIQUE NULL FK RESTRICT plus paired link_origin checks. Preserve actual mappings with reviewed backfill/constraint validation before dropping old columns, do not rewrite migrations or silently transfer owners; assess cardinality and stop on incompatible data. Keep engine internal fields, stored_files and security_audit_events. New domain shared leaves/subpath exports apply prospectively, without moving Customer/Sync files. Future endpoint/schema work separately coordinates generated contracts and deployments.

## Test-first plan for later implementation

1. Sync cleanup: RED migration/catalog/backfill and Customer binding regressions; then forward migration/schema/binding/worker grants, real PostgreSQL preservation/rollback and role tests.
2. Shipment core: RED domain ownership/strict commands, provider-field allowlist, Nexora-field preservation, money/weight, UNKNOWN mapping, immutable copies, charge replacement and transition history; implement minimal aggregate/policies/ports.
3. Genuine migrated PostgreSQL: UUID/code/FK/delete behavior, exact CHECK membership through conkey/convalidated, mutation sensitivity and valid/invalid inserts following sync-status-contract.cjs; source/history uniqueness, lease loss, concurrency/rollback, unchanged-payload no-write and cross-owner isolation.
4. Read API/UI: RED owner/filter/search/pagination/tab-count mapping and unavailable states, generated contract parity and NEXORA-045 reuse before Retail API integration. Adapter only after seven provider verifications and official rights; no new tests in this design task.

## Plan readiness and unresolved prerequisites

The owner has settled the design; no alternative decision is requested. Provider API/status/claim/key/cursor/money/permissions/exceptions verification and safe Customer linkage data migration remain explicit prerequisites for future tasks, not fabricated evidence or an invitation to implement them here. An independent review checks the documentation against this frozen plan before publication.

## Plan

1. Close NEXORA-048 under §1.7 in the first commit.
2. Record task and immutable formatted design snapshot with raw SHA-256.
3. Accept ADR-011 and add ADR-010/011 to the decisions index.
4. Rewrite shipments.md with the settled first scope, aggregate, ownership, schema draft, sync/read contracts and roadmap.
5. Record vocabulary, database naming and new-domain shared subpath rules.
6. Update only related canonical policy, Sync ADR/guide, document router and architecture overview sections.
7. Execute requested governance/document checks, binding, docs-only scope/inventory and consistency review.
8. Publish PR, wait for Preflight/Foundation and follow the single bounded runtime rerun policy; never merge.
9. Close this task in the first commit of the next task's PR after merge.
