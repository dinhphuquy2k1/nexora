# NEXORA-049 — Shipment domain design

Status: VERIFICATION PENDING
Capability: IMPLEMENTED
Verification: PARTIALLY VERIFIED

## Design Review & Reuse Decision

Task ID: NEXORA-049
Classification: SIGNIFICANT
Plan revision: rev-2026-11-13-shipment-domain-design-v2
Reviewed baseline: ea7b0f58d27257a1e9664044da168de362771f20
Branch: docs/shipment-domain-design
Design Snapshot: docs/tasks/design-reviews/NEXORA-049-rev-2026-11-13-shipment-domain-design-v2.md
Design SHA-256: 0fee82c1254c51c0afb7a90f79133fa7c0b82e4320cfabae154bed00a71a9984

| Field                    | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Documentation correction of Customer source cardinality and processor-aware Shipment history; existing PR/task, no implementation                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Existing implementations | schema.prisma Customer.syncSources is a collection and SyncSourceIdentity.customer_id a nullable nonunique FK; 20261102000000_sync_v1 defines the FK/link-origin check; 20261104000000_sync_fk_indexes adds a nonunique partial customer index; customer-sync-domain.binding.ts validates owner/immutable target per source, not global Customer uniqueness; sync-integration.test.cjs covers 99 distinct Customer links plus one review, retention/processor versions, non-APPLIED proposals and immutable targets; database/test/migration.mjs preserves staged rows and checks indexes |
| Domain owner             | Customer owns Customer linking decisions/cardinality; Shipment keeps its separately selected one-source model; Sync owns source/version/fence/provenance state                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Reuse alternatives       | Customer-owned customer_source_links preserves many-source-to-one cardinality; original customer source_identity_id column intentionally restricts it to 1:1; no polymorphic table, payload rematching, duplicate Customers or arbitrary canonical-source selection                                                                                                                                                                                                                                                                                                                       |
| Selected approach        | PLAN ISSUE — CUSTOMER_SOURCE_CARDINALITY remains OPEN by owner response; document both alternatives and block Customer mapping migration pending a business decision; retain Shipment source linkage and ordered charge rows; history uses one processor-aware NOT NULL key                                                                                                                                                                                                                                                                                                               |
| Rationale                | Current constraints/binding permit many sources per Customer; safe-abort checks prevent loss but cannot decide which business model is intended; explicit unresolved design is truthful and preserves owner authority                                                                                                                                                                                                                                                                                                                                                                     |
| Risks                    | Loss of valid many-source links, human LINKED_EXISTING provenance or owner scope; mistaking CI green for an accepted design; obsolete snapshot history key or nullable composite-key fields allowing duplicate retries                                                                                                                                                                                                                                                                                                                                                                    |
| Verification             | Five local checks, exact PR/task/v2 binding, unchanged v1 raw bytes, docs-only scope, independent review; future genuine PostgreSQL migration tests with two sources to one Customer and history processor/remapping/idempotency cases, not new tests here                                                                                                                                                                                                                                                                                                                                |

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

Reuse Sync ACTIVE user→Carrier epoch→connection→job authorization/lease/version fences; scoped Shipment lock/hydration and provider-only writes, charge operation, history, outcome and final fence commit atomically. No network under locks or in-memory consistency substitute. Shipment source_identity_id remains unique. Required shipment_id plus INTEGER NOT NULL source_version/processor_version use UNIQUE (shipment_id, source_version, processor_version). Same-processor retries do not duplicate history; a new processor can map UNKNOWN using the same source version. Append history only on an actual stage change, never on unchanged stage merely because the processor changed. Unchanged payload with the same processor performs no write. Preserve engine hashes/versions/order/counters and current retry/outcome contracts. Unknown provider code is preserved with UNKNOWN and a warning, not automatically NEEDS_REVIEW.

## Query cost

Owner/stage/created/id and owner/created/id indexes support stable paginated projections; owner/tracking index supports lookup without assuming tracking uniqueness. Partial open-claim and nonnull-customer indexes are planned. List/count predicates share owner/search scope; tab counts are server results, never page sums or invented zeros. Fetch charges for detail only and page history independently; no list aggregate hydration/N+1 or framework/cache. Exact open-claim predicate depends on verified carrier claim semantics; no fabricated codes.

## Backward compatibility and migration

No production, schema, SQL migration, grant, SDK/API, test, dependency or adapter
changes here. Current Customer links are many sources → one Customer, not 1:1;
source inspection does not certify actual production mappings. The original
owner-approved Customer 1:1 target is an intentional future cardinality restriction,
not a representation of the implementation. The owner has left its reconciliation
unresolved. Shipment's selected source_identity_id UUID UNIQUE NULL FK RESTRICT
is distinct and remains unchanged. Customer linkage must leave the Sync engine
only after the following decision and lossless transition are validated.

### PLAN ISSUE — CUSTOMER_SOURCE_CARDINALITY

Status OPEN. Owner explicitly deferred the decision in this session. Required
choice and consequences:

- Preserve supported many-source-to-one behavior with a Customer-domain-owned
  customer_source_links table: source_identity_id UUID NOT NULL UNIQUE;
  customer_id UUID NOT NULL, indexed but not unique; per-link origin with existing
  CREATED_BY_SYNC/LINKED_EXISTING vocabulary; FKs/delete restrictions and owner
  checks. It can preserve every existing link and human linking decision without
  rematching from provider data. This is an unaccepted alternative, not selected SQL.
- Retain the original 1:1 target: customers.source_identity_id UUID UNIQUE NULL
  FK RESTRICT, paired nullable link_origin with existing membership and NULL-pair
  checks. This narrows a currently permitted relationship. An owner-authorized,
  lossless operational reconciliation policy for Customers with multiple sources
  is still required; uniqueness or an abort check does not supply that policy.

Do not implement either alternative or claim the design merge-ready while this
issue is open. No polymorphic cross-domain mapping table and no change to the
Shipment linkage decision.

### Required future migration safety contract

1. Read-only inventory of every existing source-to-Customer mapping, including
   NULL/unlinked sources, per-link origin and available provenance; detect
   Customers referenced by two or more source identities and verify owner scope.
2. Preserve all links, origins and provenance beyond payload retention. No silent
   deletion/overwrite, arbitrary first-source selection, payload rematching,
   cross-owner merge/transfer or duplicate Customer creation without an authorized
   business decision. Retain historical link/provenance data through validation.
3. After the owner settles the model, backfill and compare the complete before/
   after relationship sets and owner/origin/provenance, validate FK/cardinality
   and checks under a reviewed consistent transaction/cutover strategy. No old
   relationship may be removed until the transition is demonstrably lossless.
4. Abort safely/roll back if incompatible mappings remain unresolved; an abort
   protects data but does not resolve the business-model mismatch. No actual
   migration/data audit is performed here. New forward migrations only.
5. Genuine PostgreSQL migration tests must include two distinct sources linked to
   the same Customer: preserve both under the many-source model, or refuse the
   1:1 transition without loss until an authorized remediation is supplied. Also
   cover owner mismatch, NULL links, LINKED_EXISTING durability after retention,
   exact FK/index/CHECK behavior, rollback and repeated deployment.

The eventual scoped implementation includes schema, Customer binding, explicit
worker grants and Sync/migration tests; engine hashes/order/version/outcome state,
job counters, stored_files and security_audit_events stay intact. Cleanup of
unused created_by_sync_job_id/FK/created_sync remains planned, with available
historical provenance preserved/assessed before removal. No schema, grant,
relationship or migration is changed here. New-domain shared subpaths remain
prospective and existing Customer/Sync files do not move.

### Future Shipment history SQL example

Only this one identity contract is selected; this is a design fragment, not DDL
to execute in this PR:

```sql
shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
source_version INTEGER NOT NULL,
processor_version INTEGER NOT NULL,
UNIQUE (shipment_id, source_version, processor_version)
```

NOT NULL closes PostgreSQL UNIQUE's NULL loophole. Append only on a genuine stage
change, permit new-processor UNKNOWN remapping, and retain same-processor retry
idempotency. No history row is added merely because a processor version changes.
Charge order remains line_no SMALLINT NOT NULL from 1 and
UNIQUE (shipment_id, line_no); repeated charge_code values remain separate.

## Test-first plan for later implementation

1. After the cardinality decision: RED PostgreSQL migration tests with two sources sharing one Customer, provenance/owner checks and rollback; only then implement forward migration/schema/binding/grants. No new tests in this PR.
2. Shipment core: RED domain ownership/strict commands, provider-field allowlist, Nexora-field preservation, money/weight, UNKNOWN mapping, immutable copies, charge replacement and transition history; implement minimal aggregate/policies/ports.
3. Genuine migrated PostgreSQL: UUID/code/FK/delete behavior, exact CHECK membership through conkey/convalidated, mutation sensitivity and valid/invalid inserts following sync-status-contract.cjs; source/history uniqueness, lease loss, concurrency/rollback, unchanged-payload no-write and cross-owner isolation.
4. Read API/UI: RED owner/filter/search/pagination/tab-count mapping and unavailable states, generated contract parity and NEXORA-045 reuse before Retail API integration. Adapter only after seven provider verifications and official rights; no new tests in this design task.

## Plan readiness and unresolved prerequisites

Owner response on 2026-11-13: "Chưa quyết định; ghi PLAN ISSUE".
CUSTOMER_SOURCE_CARDINALITY remains OPEN and blocks migration/design merge
readiness, independently of CI. Provider authorization/mapping questions remain
future implementation prerequisites. The verdict is NEEDS DESIGN DECISION.

## Plan

1. Close NEXORA-048 under §1.7 in the first commit.
2. Preserve v1 and record the superseding, formatted v2 plan/snapshot with its raw SHA-256.
3. Accept ADR-011 and add ADR-010/011 to the decisions index.
4. Rewrite shipments.md with the settled first scope, aggregate, ownership, schema draft, sync/read contracts and roadmap.
5. Record vocabulary, database naming and new-domain shared subpath rules.
6. Update only related canonical policy, Sync ADR/guide, document router and architecture overview sections.
7. Execute requested governance/document checks, binding, docs-only scope/inventory and consistency review.
8. Synchronize task/v2 and PR #46 metadata before pushing; require fresh Preflight/Foundation, retain historical failures and report NEEDS DESIGN DECISION while the cardinality issue remains open; never merge.
9. Close this task in the first commit of the next task's PR after merge.

## V2 remediation plan and provenance

Preserve v1 bytes and digest; v2 supersedes its outdated history identity and
Customer transition assumptions. Read-only evidence: nullable nonunique Customer
FK and collection relation, nonunique partial index, source-scoped binding,
existing distinct-link/retention/processor and immutable-target tests. No production
mapping inventory or dedicated future two-source migration test is claimed.

Owner left the Customer choice open; document both alternatives and a lossless
migration/abort contract. Record processor-aware NOT NULL history, retain charge
line ordering and repeated charge types, synchronize canonical docs, verify five
local commands plus metadata/digests/scope, obtain independent review, publish
only to PR #46, and wait for fresh hosted gates. No implementation or merge.

## Historical v1 review delta

PR #46 APPROVE WITH FIXES: three documentation corrections, without changing the
plan revision or immutable snapshot:

1. Charge rows use `line_no SMALLINT NOT NULL` in provider order from 1 and
   `UNIQUE (shipment_id, line_no)`. Repeated charge_code values are allowed;
   no line merging; Sync replaces the complete ordered set in one transaction.
2. Stage history adds processor_version and
   `UNIQUE (shipment_id, source_version, processor_version)`. A new processor can
   reprocess the same source version and record UNKNOWN → mapped stage; identical
   data with the same processor remains idempotent. This corrects the earlier
   two-column history key and qualifies the unchanged-payload no-write statement
   in the recorded design notes; the historical snapshot is preserved.
3. ADR-011 explains that source-to-record mapping outlives payload retention
   (ADR-010), human LINKED_EXISTING decisions cannot be reconstructed from provider
   data, and re-matching risks duplicates and wrong merges.

ADR-011 and database.md specify no concrete charge/history unique key, so no
other key reference needs editing. Shipment remains a documentation design only.

## Acceptance criteria

- [ ] CUSTOMER_SOURCE_CARDINALITY owner decision and unambiguous migration policy.
- [x] V2 canonical consistency and history contract verified.
- [x] Five local checks and exact task/snapshot binding pass; diff only docs, active tasks045–047 and049.
- [x] Independent v2 design review recorded.
- [ ] Final-head hosted Preflight and Foundation pass (or bounded rerun failure reported).
- [ ] Owner merge decision; closure belongs to next task PR.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Shipment design/data ownership and later Sync cleanup; v2 explicitly records current many-source Customer cardinality, the unresolved owner choice/lossless migration contract, and processor-aware NOT NULL history. Existing vocabulary/naming design and NEXORA-048 closure remain. This delivers design docs, not Shipment functionality.

### Canonical owners

- docs/decisions/shipment-domain-data-ownership.md
- docs/decisions/README.md
- docs/domains/shipments.md
- docs/ai/PROJECT_RULES.md
- docs/architecture/database.md
- docs/decisions/product-scope.md
- docs/architecture/sync-extensions.md
- docs/decisions/sync-worker-staging.md
- docs/ai/DOCUMENT_ROUTER.md
- docs/architecture/overview.md
- docs/tasks/completed/NEXORA-048-https-script-load-diagnostics.md

### Documentation verification

format:check, docs:check, preflight:check, test:docs, test:preflight; validatePrTaskBinding and consistency/diff inventory review.

## Evidence

| Claim                                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                        | Date       | Result |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Baseline and unused task ID                        | origin/main d0e75cc83619f11f7b192485d9fdd7a051179b6d; active/completed/design-review inventory and gh pr list --state open show NEXORA-049 unused; branch docs/shipment-domain-design                                                                                                                                                                                                                                                           | 2026-11-13 | PASS   |
| Prior task closure                                 | First commit 719b1bf closes048; PR45 merge d0e75cc83619f11f7b192485d9fdd7a051179b6d and final-head gates from PR description; npx --yes pnpm@10.34.6 docs:check exit0                                                                                                                                                                                                                                                                           | 2026-11-13 | PASS   |
| Formatting                                         | npx --yes pnpm@10.34.6 format:check; exit0; working tree on 2569ed41fd71138601e3219a5b163f0a366cc66f with documentation design delta; checkpoint 2026-11-13T07:44:59Z                                                                                                                                                                                                                                                                           | 2026-11-13 | PASS   |
| Documentation validation                           | npx --yes pnpm@10.34.6 docs:check; exit0; working tree on 2569ed41fd71138601e3219a5b163f0a366cc66f with documentation design delta; checkpoint 2026-11-13T07:44:59Z                                                                                                                                                                                                                                                                             | 2026-11-13 | PASS   |
| Structural governance                              | npx --yes pnpm@10.34.6 preflight:check; local/static mode, exit0; working tree on 2569ed41fd71138601e3219a5b163f0a366cc66f with documentation design delta; checkpoint 2026-11-13T07:44:59Z                                                                                                                                                                                                                                                     | 2026-11-13 | PASS   |
| Documentation regressions                          | npx --yes pnpm@10.34.6 test:docs; 10/10 PASS, 0 skipped, exit0; working tree on 2569ed41fd71138601e3219a5b163f0a366cc66f with documentation design delta; checkpoint 2026-11-13T07:44:59Z                                                                                                                                                                                                                                                       | 2026-11-13 | PASS   |
| Preflight regressions                              | npx --yes pnpm@10.34.6 test:preflight; 24/24 PASS, 0 skipped, exit0; working tree on 2569ed41fd71138601e3219a5b163f0a366cc66f with documentation design delta; checkpoint 2026-11-13T07:44:59Z                                                                                                                                                                                                                                                  | 2026-11-13 | PASS   |
| Task/snapshot binding                              | validatePrTaskBinding with exactly five NEXORA-049 PR metadata lines; valid:true, failures:[], exit0; raw SHA-256 015be8d1a5f4d614ddcf1e6916c5780f0408b6ad38b3c20e2075a9f674a14533; working tree on 2569ed41fd71138601e3219a5b163f0a366cc66f with documentation design delta; checkpoint 2026-11-13T07:44:59Z                                                                                                                                   | 2026-11-13 | PASS   |
| Scope, active inventory and decision consistency   | git diff origin/main --stat: 13 documentation files/rename only; active045,046,047,049; self-review compares ADR-011, shipments.md, PROJECT_RULES.md and database.md to all settled decisions; no apps/packages/scripts/.github changes; working tree on 2569ed41fd71138601e3219a5b163f0a366cc66f with documentation design delta; checkpoint 2026-11-13T07:44:59Z                                                                              | 2026-11-13 | PASS   |
| Independent documentation review                   | Read-only shipment_design_review agent compared owner request, immutable plan, closure and complete docs diff; no remaining P1/P2/P3 findings after removing an added UNKNOWN/open-claim exception to preserve the owner decision; not a claim of runtime implementation or hosted PASS; working tree on 2569ed41fd71138601e3219a5b163f0a366cc66f with documentation design delta; checkpoint 2026-11-13T07:44:59Z                              | 2026-11-13 | PASS   |
| Review delta — format:check                        | npx --yes pnpm@10.34.6 format:check; exit0; PASS; working tree on 7b8517862b5100b13e187d12246d305585ee7e43 with the three review corrections; 2026-11-13T08:11:44.306318+00:00                                                                                                                                                                                                                                                                  | 2026-11-13 | PASS   |
| Review delta — docs:check                          | npx --yes pnpm@10.34.6 docs:check; exit0; PASS; working tree on 7b8517862b5100b13e187d12246d305585ee7e43 with the three review corrections; 2026-11-13T08:11:45.929843+00:00                                                                                                                                                                                                                                                                    | 2026-11-13 | PASS   |
| Review delta — preflight:check                     | npx --yes pnpm@10.34.6 preflight:check; exit0; PASS; working tree on 7b8517862b5100b13e187d12246d305585ee7e43 with the three review corrections; 2026-11-13T08:11:47.821779+00:00                                                                                                                                                                                                                                                               | 2026-11-13 | PASS   |
| Review delta — test:docs                           | npx --yes pnpm@10.34.6 test:docs; exit0; 10/10 PASS, 0 skipped; working tree on 7b8517862b5100b13e187d12246d305585ee7e43 with the three review corrections; 2026-11-13T08:11:49.928364+00:00                                                                                                                                                                                                                                                    | 2026-11-13 | PASS   |
| Review delta — test:preflight                      | npx --yes pnpm@10.34.6 test:preflight; exit0; 24/24 PASS, 0 skipped; working tree on 7b8517862b5100b13e187d12246d305585ee7e43 with the three review corrections; 2026-11-13T08:11:52.084573+00:00                                                                                                                                                                                                                                               | 2026-11-13 | PASS   |
| Review delta — immutable snapshot and scope        | sha256sum retains 015be8d1a5f4d614ddcf1e6916c5780f0408b6ad38b3c20e2075a9f674a14533; git diff 7b85178 --stat includes only shipments.md, ADR-011 and task049; no concrete charge/history key in database.md requires editing; git diff --check exit0; 2026-11-13T08:11:52Z                                                                                                                                                                       | 2026-11-13 | PASS   |
| V2 local format:check                              | npx --yes pnpm@10.34.6 format:check; exit0; PASS; working tree on ea7b0f58d27257a1e9664044da168de362771f20 plus seven-document v2 delta; 2026-11-13T09:14:23.129818+00:00                                                                                                                                                                                                                                                                       | 2026-11-13 | PASS   |
| V2 local docs:check                                | npx --yes pnpm@10.34.6 docs:check; exit0; PASS; working tree on ea7b0f58d27257a1e9664044da168de362771f20 plus seven-document v2 delta; 2026-11-13T09:14:25.033009+00:00                                                                                                                                                                                                                                                                         | 2026-11-13 | PASS   |
| V2 local preflight:check                           | npx --yes pnpm@10.34.6 preflight:check; exit0; PASS; working tree on ea7b0f58d27257a1e9664044da168de362771f20 plus seven-document v2 delta; 2026-11-13T09:14:26.739334+00:00                                                                                                                                                                                                                                                                    | 2026-11-13 | PASS   |
| V2 local test:docs                                 | npx --yes pnpm@10.34.6 test:docs; exit0; 10/10 PASS, 0 skipped; working tree on ea7b0f58d27257a1e9664044da168de362771f20 plus seven-document v2 delta; 2026-11-13T09:14:28.828084+00:00                                                                                                                                                                                                                                                         | 2026-11-13 | PASS   |
| V2 local test:preflight                            | npx --yes pnpm@10.34.6 test:preflight; exit0; 24/24 PASS, 0 skipped; working tree on ea7b0f58d27257a1e9664044da168de362771f20 plus seven-document v2 delta; 2026-11-13T09:14:30.898300+00:00                                                                                                                                                                                                                                                    | 2026-11-13 | PASS   |
| V2 metadata/digest binding                         | validatePrTaskBinding with exactly five v2 lines returns valid:true, failures:[], exit0; v1 exact bytes equal git show ea7b0f5 and raw SHA015be8d1a5f4d614ddcf1e6916c5780f0408b6ad38b3c20e2075a9f674a14533; v2 raw SHA0fee82c1254c51c0afb7a90f79133fa7c0b82e4320cfabae154bed00a71a9984; same working tree, checkpoint2026-11-13T09:14:43Z                                                                                                       | 2026-11-13 | PASS   |
| V2 scope and preserved charge contract             | git diff HEAD --check exit0; git diff HEAD --stat/status show six modified docs plus v2 only; charge section byte-equal to ea7b0f58d27257a1e9664044da168de362771f20; no obsolete current two-field history key, no production/schema/test/grant change; checkpoint2026-11-13T09:14:43Z                                                                                                                                                          | 2026-11-13 | PASS   |
| V2 independent documentation review                | shipment_design_review read-only agent: no new P1/P2/P3 defects; P3 corrected, required history fields/processor behavior and unchanged fees verified; intentional P2 CUSTOMER_SOURCE_CARDINALITY remains OPEN; review of ea7b0f58d27257a1e9664044da168de362771f20 working tree plus v2 delta, checkpoint2026-11-13T09:14:43Z; verdict NEEDS DESIGN DECISION, not approval                                                                      | 2026-11-13 | PASS   |
| Read-only current-state finding and owner deferral | schema.prisma Customer.syncSources collection and nullable nonunique source FK; nonunique partial SQL index20261104000000_sync_fk_indexes; Customer binding validates individual source/owner and immutable target; inspected current migrated tests preserve links/retention/processor upgrades, no executed new migration test; owner response2026-11-13: Chưa quyết định; ghi PLAN ISSUE; no policy selected; checkpoint2026-11-13T09:14:43Z | 2026-11-13 | PASS   |

Capability IMPLEMENTED refers only to delivered design documents. Shipment runtime,
schema, adapter, migration and endpoints remain unimplemented. Future task
prerequisites are explicit in the domain roadmap. Final-head hosted results and
actual tested merge SHA will be recorded in the PR description after publication;
no SHA-only evidence commit follows them. This SIGNIFICANT task has an independent
documentation review, not invented owner approval. Status stays VERIFICATION
PENDING until the post-merge closure task; no merge is performed here.

V2 local verification passed; final-head hosted results remain pending publication.
Historical evidence certifies only its stated earlier heads. Production mapping
inventory and future migration/PostgreSQL regressions: NOT RUN (documentation-only
scope; no migration implemented). CI green cannot close CUSTOMER_SOURCE_CARDINALITY.
Owner intentionally left that business decision unresolved; no merge readiness
is claimed. Final-head run/attempt/failure evidence belongs in the PR description
without another SHA-only task commit. VERDICT: NEEDS DESIGN DECISION.
