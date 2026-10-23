# NEXORA-030 immutable design snapshot — Customer Statistics API v1

Task ID: NEXORA-030
Plan revision: rev-2026-10-23-customer-stats-v1
Reviewed baseline: b9d02f05c979affa5e0a416ea120efd80c6df0e6

This is a separately approvable design captured on 2026-10-23. NEXORA-029 v8 selects the dependency architecture but its approval does not authorize this backend implementation. Mutable execution evidence belongs in the task and PR, outside these hashed bytes.

## 1. Task Metadata & Classification

- Task title: Customer Statistics API.
- Classification: SIGNIFICANT (query population, security, transaction and generated cross-package contract).
- Documentation Impact: REQUIRED.
- Target branch: feat/customer-statistics-api; target PR: a new Draft design-review PR against main, not PR25.
- Snapshot location: docs/tasks/design-reviews/NEXORA-030-rev-2026-10-23-customer-stats-v1.md.
- Authority: repository owner dinhphuquy2k1 or independently authenticated authorized reviewer under ADR-009.
- Design approval: PENDING_REVIEW. No application/test changes until separate digest-bound approval and explicit implementation continuation.

## 2. Requirements & Boundary Scope

Extend the existing GET /api/customers response with required stats. Preserve exactly eight Customer endpoints. The response is customers, pagination {page,pageSize,total,totalPages}, stats {total,active,inactive}. Stats values are required, non-null, non-negative integers; total = active + inactive. Only canonical ACTIVE and INACTIVE statuses exist.

| Filter                       | Customers and pagination.total        | Stats population    |
| ---------------------------- | ------------------------------------- | ------------------- |
| Authenticated owner          | Always scoped, including ADMIN        | Same owner          |
| q and normalized exact phone | Existing semantics                    | Identical semantics |
| status                       | Applies                               | Ignored             |
| page/pageSize                | Applies to rows, not pagination.total | Ignored             |

For 120 matches (95 ACTIVE,25 INACTIVE), status ACTIVE produces pagination.total95 and stats120/95/25; INACTIVE produces pagination.total25 and the same stats. Successful empty population produces0/0/0; unavailable/error never fabricates0.

Non-goals: new endpoint/port operation, frontend implementation, Shipment/Identity/Carrier changes, aggregates/entities/VOs for counts, generic framework, migration/index/cache/counter, dependencies, historical data repair, deployment or production/shared database access. No ZIP code is executed or imported. Preserve all address/default/phone/profile invariants.

## 3. Relevant Documentation & Canonical Owners

Follow AGENTS.md and docs/ai/README.md routed context, PROJECT_RULES, TASK_WORKFLOW, IMPLEMENTATION_WORKFLOW and DOCUMENT_ROUTER. Governing decisions are tactical-ddd.md (ADR-008) and mandatory-pre-code-design-review.md (ADR-009). Architecture owners: backend.md, api-contract.md, database.md and reusable-components.md. Domain owner: customers.md; Shipment is out of scope. Verification owner: operations/testing.md. Use the pre-implementation-review template and repository skill.

NEXORA-027 documents existing backend invariants; NEXORA-029 and its immutable rev-2026-10-23-frontend-migration-v8 snapshot sections9.1–9.3 supply the selected dependency contract. Their historical execution/approval is not NEXORA-030 execution/approval. During implementation update canonical API/Customer/testing facts and generated contracts together; this design PR only adds this snapshot and its task, without documenting stats as already available.

## 4. Existing Code References & Search Scope

Inspected apps/api/src/customer, apps/api/test/customer\*.test.cjs, apps/api/integration/customer-integration.test.cjs, packages/database/prisma, packages/shared/src, packages/sdk and governance/testing scripts. Searches: CustomerPage, CustomerStats, stats, listQuery, searchPhone, resolveCustomerOwner, transaction, groupBy, CustomerStatus, ownerUserId, count, findMany, statusLabel and test discovery. Current Customer/SDK have no stats implementation.

- application/customer.input.ts owns CustomerQuery/CustomerPage and strict query normalization: page1/pageSize20, pageSize<=100, safe integer/offset bounds, q trimmed nonempty<=200, normalized phone and searchPhone; rejects unknown keys/arrays/invalid status.
- application/customer-owner.ts resolves actor.id; customer.service.ts delegates list through this resolver and listQuery. customer.port.ts owns list(owner,query):Promise<CustomerPage>.
- infrastructure/customer.adapter.ts list builds owner/status/phone/q predicates, count/findMany and bounded summary select. transaction checks ACTIVE user under FOR UPDATE before callback; writes use the same actor lock before parent lock. customer.mapper.ts hydrates write aggregates, unnecessary for list.
- presentation/customer.controller.ts exposes the existing eight operations; customer.dto.ts owns Swagger response; customer.presenter.ts spreads page and maps only summaries, already capable of forwarding an added page field.
- domain/customer-status.vo.ts and packages/shared/src/customer-status.ts own canonical status vocabulary; shared labels are presentation-only. application/customer-error.ts and global ErrorFilter own errors.
- packages/database/prisma/schema.prisma Customer uses status String, owner relation, owner-phone unique and owner-created / owner-status-created indexes. SQL migration enforces ACTIVE/INACTIVE; no schema change needed.
- packages/sdk generation uses openapi-typescript/openapi-fetch. Database package pins Prisma/client/adapter7.10.0; generated client compilation remains an implementation prerequisite, not a design-time PASS claim.
- Existing Customer unit/aggregate suites and real Nest/PostgreSQL integration cover validation, ownership, actor-disable waits, transactions and query instrumentation. Native Node recursive discovery and prerequisites remain unchanged.

## 5. Mandatory Reuse & Design Audit Matrix

All eight audit fields apply independently to each component below. Paths prefixed application/, infrastructure/, presentation/, domain/ are under apps/api/src/customer/.

| Component           | Existing implementations                                                                                        | Domain owner                          | Reuse alternatives                                     | Selected approach                               | Rationale                                | Risks                             | Verification                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------ | ----------------------------------------------- | ---------------------------------------- | --------------------------------- | -------------------------------------------------------- |
| Query read model    | application/customer.input.ts CustomerPage                                                                      | Customer application                  | Extend; new shared DTO; new service                    | Add CustomerStats and required stats here       | Existing query ownership                 | Consumer shape break              | Port/application compile and shape tests                 |
| Port and service    | application/customer.port.ts; customer.service.ts                                                               | Customer application                  | Reuse list; new stats operation                        | Keep list signature, resolver and orchestration | One response/use case                    | Parallel divergent flows          | Application delegation test                              |
| Actor ownership     | application/customer-owner.ts resolveCustomerOwner                                                              | Customer authorization                | Reuse; client owner; ADMIN bypass                      | Reuse actor.id only                             | No cross-owner visibility                | Count inference                   | Real two-owner ADMIN/OPERATOR matrix                     |
| Query normalization | application/customer.input.ts listQuery; domain/customer.value-objects.ts PhoneNumber                           | Customer policy                       | Reuse; duplicate stats validator                       | Normalize once with existing rules              | Exact search semantics                   | Phone/q drift                     | Invalid, national/international cases                    |
| Search predicates   | infrastructure/customer.adapter.ts list                                                                         | Customer persistence                  | Shared local predicate; duplicate SQL; generic builder | baseWhere owner/q/phone, listWhere adds status  | Same population without duplication      | Escaping and owner omission       | Literal wildcard and captured query predicates           |
| Transaction fence   | infrastructure/customer.adapter.ts transaction                                                                  | Customer consistency                  | Reuse; parallel independent queries; isolation change  | All three queries inside existing callback      | Existing application owner serialization | False snapshot claims, contention | Real independent connections/waiter evidence             |
| Status grouping     | adapter Prisma7.10 typed customer delegate; shared customer-status.ts                                           | Customer query projection             | groupBy; two counts; hydrate all                       | One typed groupBy status/\_count.\_all          | Bounded groups, minimal queries          | Unknown persisted status          | Compile generated types; missing/reversed/unknown groups |
| DTO contract        | presentation/customer.dto.ts CustomersResponseDto                                                               | API presentation                      | Extend; parallel transport model                       | CustomerStatsDto plus required stats            | Swagger remains source                   | Optional/noninteger drift         | DTO/OpenAPI/HTTP assertions                              |
| Presenter           | presentation/customer.presenter.ts presentCustomerPage                                                          | API presentation                      | Existing spread; recompute counts                      | Forward stats unchanged using existing spread   | Preserve labels/date/nulls               | Accidental recomputation          | Exact aggregate and summary tests                        |
| Error handling      | application/customer-error.ts; common global ErrorFilter                                                        | Customer/application and neutral HTTP | Existing mapper; new stats framework                   | Reuse existing envelope and mapping             | No duplicate status/message logic        | PII or incorrect400               | Safe500 and existing status regression                   |
| SDK                 | packages/sdk/scripts/generate.mjs and generated source                                                          | Contract transport                    | Generate; hand edit                                    | Generate from canonical OpenAPI only            | One contract source                      | Deployment skew                   | contracts:check and four compatibility combinations      |
| Test infrastructure | customer.test.cjs; customer-aggregate.test.cjs; customer-integration.test.cjs; scripts/check-test-discovery.mjs | Tests/operations                      | Extend discovered suites; custom runner                | Existing native Node discovery, real fixtures   | Preserve builds and cleanup              | Mock-only assurance               | Discovery plus genuine migrated PostgreSQL gates         |

## 6. Alternative Designs & Trade-offs

- Separate stats endpoint/service/port operation: rejected, repeats authorization and predicates, adds response synchronization and endpoint count; selected list extension is bounded.
- Frontend counting page rows or using pagination.total: rejected, wrong for other pages/status filters; no fallback fake zero.
- Hydrate every Customer/address and count in memory: rejected, unbounded transfer, domain hydration and N+1 risk for pure projection.
- Separate ACTIVE/INACTIVE counts: possible but adds queries and repeated predicates; groupBy provides one bounded result.
- Counter table/cache/index/migration or generic query framework: rejected without measured need, invalidation cost and scope expansion. Real measured bottleneck needs a new approved plan, not speculative implementation.

## 7. Selected Design & Tactical DDD Alignment

CustomerStats is an application read projection, not a new business aggregate or VO. CustomerAggregate and encapsulated CustomerAddress remain write consistency owners under ADR-008; none of their invariants changes. No domain repository or write method is added. CustomerPort.list remains Promise<CustomerPage>; CustomerService retains existing owner resolution and parser. No new domain/shared validator is justified for three derived numbers.

Adapter retains literal escaping exactly: `query.q?.replace(/[\\%_]/g, "\\$&")`. baseWhere is typed Prisma.CustomerWhereInput with ownerUserId, normalized exact phone, and the existing OR: insensitive name/code contains, phone substring, optional searchPhone exact alternative. listWhere spreads baseWhere plus optional canonical status. count and findMany use listWhere; groupBy uses baseWhere. Preserve select summary, createdAt DESC/id DESC, skip/take and pagination math. Never expose owner/creator or addresses in summary.

Within transaction(owner,callback), add one typed `tx.customer.groupBy({ by: ["status"], where: baseWhere, _count: { _all: true } })`; generated Prisma7.10 types must compile before acceptance. Fold canonical ACTIVE/INACTIVE groups into initialized zeros, independent of order, and sum counts. Do not cast unknown persisted status as a valid category or invent a status. Unexpected status fails closed with a non-PII internal error through existing global safe500 handling; do not add a Customer validation400 for database corruption. Database CHECK remains intact; controlled malformed-group unit coverage supplements real DB coverage, never disables production constraints. Required output numbers must satisfy nonnegative integer/sum assertions in tests.

Add CustomerStatsDto fields total/active/inactive with required integer minimum0 Swagger metadata and required CustomersResponseDto.stats. No nullable/optional fallback. Existing presenter spread already forwards page.stats; keep that behavior and test it, editing presenter only if needed for types. Keep Summary/Detail/Address, statusLabel, dates/nulls, all errors {code,message,requestId} unchanged.

## 8. Security, Concurrency & Performance Analysis

Global SessionGuard remains authoritative; missing/expired/revoked/disabled actors retain current behavior. GET retains read policy; OriginGuard remains mandatory on existing mutations. No owner field accepted, no ADMIN bypass, no PII/search/phone/secrets in diagnostics.

All three queries run in the same existing transaction after ACTIVE actor FOR UPDATE. Application Customer writes acquire the same actor lock before parent locks, so responses cannot interleave those owner writes. Recheck ACTIVE after wait and preserve rollback/errors/lock ordering. Do not change isolation level or claim an independent snapshot protects against DBA/out-of-protocol writes. Tests must observe real lock waiters and committed results, including disable-first and read/write serial orders. Different owners remain independent.

Before: one actor lock query plus two Customer queries (count and bounded summary findMany). After: same lock plus three Customer queries (one groupBy). Group result has at most two valid statuses; no address hydration, detail loop or full-customer scan into application memory. Existing idx_customers_owner_created and idx_customers_owner_status_created are available; grouped scans/search may still cost O(matching population). No assertion of index use, latency or query-plan superiority without measured real EXPLAIN/query instrumentation. Test large multipage fixtures and bounded selects; record timings/plans safely after approval. No speculative performance migration.

## 9. Compatibility Matrix

| Client / server | Required evidence and behavior                                                                |
| --------------- | --------------------------------------------------------------------------------------------- |
| Old / old       | Existing customers/pagination contract baseline remains working                               |
| Old / new       | Old actual parsing/client tolerates additive stats; preserve all existing fields/errors/order |
| New / new       | Generated types and HTTP agree; stats required with valid invariant                           |
| New / old       | Stats unavailable, never fabricated0; Web handles version boundary under NEXORA-029           |

Backend-first deployment coordinated with SDK/Web; additive response alone is not proof of deployed compatibility. Backend task verifies fixtures/types/HTTP and documents remaining consumer deployment evidence, without implementing frontend here. Generate committed OpenAPI/SDK; never hand edit generated files. No DB migration/index/grant/enum/backfill, historical address hydration or persistent metadata change. Existing status CHECK and canonical codes are reused. Until implementation canonical docs describe current no-stats behavior; synchronize API/Customer/testing docs when implementation is approved.

## 10. Test Plan (Test-First / Verification-First)

Write RED characterization before production edits, then minimal implementation and GREEN. These are future requirements, not execution evidence:

1. Zero customers gives0/0/0.
2. All ACTIVE gives total=active, inactive0.
3. All INACTIVE gives total=inactive, active0.
4. Mixed statuses across pages preserves sum.
5. Pages1/2 share stats for same q/phone.
6. Different pageSize shares stats.
7. ACTIVE filter affects list/pagination only.
8. INACTIVE filter affects list/pagination only.
9. q affects both populations identically.
10. Normalized exact phone scopes both identically.
11. Literal percent/underscore/backslash retain escaping.
12. National/international inputs preserve searchPhone semantics.
13. Two owners cannot infer counts, including ADMIN.
14. Same normalized phone across owners never leaks.
15. Missing/expired/disabled session retains authorization error.
16. Create/status commit then refresh sees updates; concurrent writers obey actor lock.
17. Large multipage fixtures prove stats independent of row count and bounded query shape.
18. DTO/OpenAPI/generated SDK/HTTP require exact integer fields and sum invariant.

Additionally: revoked sessions; unknown fields/empty q/arrays/malformed page/status retain rejection; no client ownership override; group order/missing groups/unknown group error safety; presenter preserves labels/dates/null and forwards untouched counts. Test all four compatibility combinations. Application tests verify normalized owner/query forwarding without new port methods. Existing aggregate/default/address/profile tests remain intact. Native recursive discovery must include newly added tests with helpers/integration exclusions; no maintained filename list or orchestrator/Python/PTY rewrite.

Real migrated PostgreSQL under restricted runtime role plus genuine Nest HTTP must establish predicates, owner isolation, ACTIVE wait fencing, refresh consistency, rollback and query shape. Mock groups only test folding/error branches and never replace database evidence. Preserve owned disposable cluster/credential redaction/guaranteed cleanup; never production/shared credentials or volume resets.

After approval run genuine prerequisite generation/build, targeted Customer tests and test:integration; contracts:generate then contracts:check against committed generated files. Canonical checks: format:check, lint, preflight:check, docs:check, typecheck, test, quality; sh scripts/quality-docker.sh, runtime-smoke.sh, public-https-smoke.sh, data-smoke.sh and dev-smoke.sh. Retain real TTY/MFA and all existing regressions. Final-head hosted Preflight and Foundation plus repository implementation-code-review are required; report PASS/FAIL/NOT RUN independently. Historical CI is not evidence for future code.

## 11. Approval Evidence & Governance

PENDING_REVIEW. This snapshot contains no approval attestation. Compute SHA-256 of final formatted raw UTF-8 bytes; bind exact identity/revision/path/digest in task and PR using existing ADR-009 checker. Mutable test/CI logs belong outside the snapshot. Owner posts a separate standalone five-line decision per ADR-009; agent never posts/fabricates it. Verify authenticated author/state/chronology/revocations before implementation. NEXORA-029 approval cannot substitute. Material design changes require new immutable revision and approval.

Current authorization ends at documentation-only Draft design PR and structural checks. Expected hosted Preflight fails closed while approval is pending; do not weaken it. Task/Implementation remain PLANNED and Verification NOT VERIFIED. After independent design approval AND explicit continuation, implement test-first, run full verification and independent implementation review; keep Draft while mandatory evidence/blockers remain. Never merge automatically.

## 12. Unresolved PLAN ISSUES

NONE from current read-only inspection: selected owner contract agrees with existing layering/locks/query semantics. Generated-client compilation, real query-plan/performance measurements, runtime compatibility and full final-head verification remain explicit future acceptance gates, not invented PASS results or new product decisions. If those expose an architectural contradiction, record a concrete PLAN ISSUE and revise/approve before changing the selected architecture.
