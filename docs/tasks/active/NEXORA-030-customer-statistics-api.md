# NEXORA-030 — Customer Statistics API

Task: PLANNED
Implementation: PLANNED
Verification: NOT VERIFIED
Classification: SIGNIFICANT
Documentation Impact: REQUIRED

## Design Review & Reuse Decision

- **Task ID**: NEXORA-030
- **Classification**: SIGNIFICANT
- **Plan revision**: rev-2026-10-23-customer-stats-v1
- **Design Snapshot**: docs/tasks/design-reviews/NEXORA-030-rev-2026-10-23-customer-stats-v1.md
- **Design SHA-256**: 521ac0a733d0f1afc9be3ffe5ad0d50b1612eea8c612b07defe28b3277bbceea
- **Reviewed baseline**: b9d02f05c979affa5e0a416ea120efd80c6df0e6
- **Approval authority**: dinhphuquy2k1
- **Approval status**: APPROVED
- **Approval evidence**: https://github.com/dinhphuquy2k1/nexora/pull/26#issuecomment-6357379099

## Baseline and interface preflight

Read-only inspection on 2026-10-23: fetched origin/main b9d02f05c979affa5e0a416ea120efd80c6df0e6. GitHub PR25 is merged with that merge SHA. Existing feat/full-frontend-migration worktree remained clean at ace3b986807409ff98271857dfdc0d283630fe07; unrelated worktrees preserved. Created feat/customer-statistics-api from current origin/main in a separate worktree, confirmed clean HEAD at that baseline. No previous local/remote statistics branch, task030 file or CustomerStats/stats implementation in current Customer/SDK. GitHub complete all-state issues/PR inventory returned25 items and no NEXORA-030 reference; existing open PR22/21/14 are untouched. Task030 is selected after these checks, not inferred from frontend approval.

Read mandatory AI entry/rules/workflows/router, Backend/API/Database/Customer/reuse architecture, ADR008/009, Testing, template, repository pre-implementation-review skill, task027 and task029/v8. Inspected actual Customer input/service/port/adapter/presenter/DTO/controller, canonical statuses, schema/indexes, SDK and existing Customer unit/real PostgreSQL integration fixtures. Snapshot sections4–5 record exact ownership and reuse searches. No application/test/dependency/schema or canonical current-behavior documentation edits are authorized in this phase.

## Selected design and reuse audit

The immutable snapshot is the complete twelve-section SIGNIFICANT review and eight-field per-component reuse audit. Extend existing GET /api/customers with required stats {total,active,inactive}, preserving exactly eight endpoints. Reuse CustomerPage/CustomerPort.list, trusted owner resolution, normalization, literal-search escaping, ACTIVE actor lock/transaction, DTO/presenter and generated SDK. baseWhere shares owner/q/phone; listWhere adds status. Add one typed status groupBy; fold canonical ACTIVE/INACTIVE without hydrating aggregates or addresses. Stats excludes status/page/pageSize; pagination retains its existing semantics. Unknown persisted grouping status fails safe through global500. No domain aggregate/VO/repository, migration/index/cache/dependency or generic framework is needed for this read projection.

All three queries remain in existing owner-serialized transaction; no stronger isolation claim against external writes. Three Customer queries plus existing actor lock replace two plus that lock. Performance/index use must be measured later. Preserve security/error envelope and all existing field/label/date/null contracts. Backend-first generated SDK/Web compatibility includes old/new combinations and unavailable handling without fake zeros. No frontend implementation in this task.

### Mandatory Reuse & Design Audit Matrix

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

### Tactical DDD boundaries and domain invariants

CustomerStats is a pure application read projection. Existing CustomerAggregate and its encapsulated addresses retain all write invariants; canonical CustomerStatus/phone policies, initial/default address guarantees and strict commands remain unchanged. No new aggregate/entity/VO or domain repository is justified.

## Milestones after approval and explicit continuation

1. RED characterization: all18 stats cases in snapshot section10, invalid input/auth/ownership/query-shape/folding and four compatibility combinations; preserve existing assertions and native test discovery.
2. Minimal application read model/Prisma projection/DTO/presenter contract implementation using selected reuse. Compile real generated Prisma types and full prerequisites.
3. Generate OpenAPI/SDK, synchronize canonical API/Customer/testing documentation. Run genuine migrated restricted PostgreSQL/Nest, concurrent lock/rollback and all canonical quality/runtime/HTTPS/data/dev regressions.
4. Commit/push focused code to this PR, verify final-head hosted Preflight/Foundation and perform required independent implementation-code-review. Never self-approve or merge; retain Draft until required gates pass.

## Acceptance criteria

- [ ] Separate authenticated digest-bound design approval and explicit continuation verified before code/tests.
- [ ] Required scoped integer stats and unchanged eight-endpoint/security/validation contracts.
- [ ] Shared predicates, typed grouping, bounded summary and existing transaction semantics verified.
- [ ] All18 cases plus compatibility, auth/owner, unknown-group and real concurrency regressions pass.
- [ ] Generated contracts and canonical documentation agree with actual HTTP.
- [ ] Full genuine quality/integration/runtime/HTTPS/persistence/development evidence, final-head hosted checks and independent implementation review recorded.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Current change: new task and immutable design snapshot only.

### Canonical owners

Future implementation changes Customer list response/SDK/read query and testing facts, owned by docs/architecture/api-contract.md, docs/domains/customers.md, docs/operations/testing.md and generated contracts. Database architecture only if documenting measured query facts is necessary; no schema change. Do not change canonical current behavior to claim unimplemented stats.

### Documentation verification

Validation: docs:check, static preflight, raw-byte digest/PR-task binding, formatting, architectural lint and focused governance/docs regressions; runtime gates remain NOT RUN in this phase.

## Evidence

| Claim                           | Evidence                                                                                                                                    | Date       | Result |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Baseline/branch/ID availability | origin/main and PR25 merge SHA b9d02f0; clean separate branch; local/remote branch/task/source and complete GitHub25-item inventory checked | 2026-10-23 | PASS   |
| Immutable design                | Formatted snapshot then Node crypto SHA-256 of raw bytes, value in design metadata above                                                    | 2026-10-23 | PASS   |

### Documentation preparation execution — 2026-10-23

Frozen offline install via pnpm10.34.6 exited0 using the unchanged lockfile; install reported skipped build scripts, so it is not build/Prisma evidence. Executed on the baseline plus these two new documentation files:

- Full `prettier --check .`: PASS, exit0 after formatting both new documents.
- `pnpm lint` (boundaries plus ESLint): PASS, exit0.
- `node scripts/docs-check.mjs`: PASS, exit0.
- `node scripts/preflight-policy-check.mjs`: PASS, exit0 in local/static structural mode only.
- `node --test scripts/docs-check.test.mjs scripts/preflight-policy-check.test.mjs`: PASS35/35, zero skipped, exit0.
- Existing `validatePrTaskBinding` against prepared PR body: PASS, exact task/revision/path/raw-byte digest bound.
- `git diff --check` and final scope inspection: PASS; only this task and the new snapshot are added. Existing code/tests/CI/schema/dependency manifests and prior snapshots unchanged.

Runtime/backend verification: NOT RUN. Independent design approval: NOT VERIFIED (PENDING_REVIEW). Initial docs/static checks failed on missing task audit/documentation sections and unsupported evidence table results; the task structure was corrected without changing policy. Initial combined docs/governance regressions:34 PASS/1 FAIL because the new incomplete task failed the structural scan; after completing that structure35/35 PASS. These are planning diagnostics, not backend results.

Final commit SHA, Draft PR URL and hosted workflow evidence belong in PR metadata after push, avoiding a SHA-only documentation commit loop. Planning/static PASS never upgrades feature Verification NOT VERIFIED. Agent behavioral evaluation and independent implementation-code-review are NOT RUN.

## PLAN ISSUES

NONE identified in read-only inspection. Real generated types/query measurements/compatibility/full runtime evidence remain future gates. Stop before code/tests until separate approval and explicit continuation; material contradictions require a revised immutable snapshot and approval. No production deployment, live Carrier, schema/migration/grant/key/MFA changes or volume deletion.

## Verified authorization — 2026-10-23

Retrieved exact comment6357379099 and complete PR26 comments/reviews through authenticated GitHub connector. Author dinhphuquy2k1/User/OWNER, issue_url PR26, created_at=updated_at2026-10-23T04:27:35Z, exact standalone five-line decision matching task/revision/raw-byte digest. One comment, zero reviews, no later relevant revocation. Existing parseApprovalDecisionBlock/computeDesignDigest/verifyGitHubApprovalEvidence accepted the real fetched payloads through a connector response adapter; this is not hosted CI or a second parser. Owner explicitly authorizes implementation continuation on existing PR26/branch. Snapshot unchanged. Earlier pending-approval statements above describe the historical design stage and are superseded by this verified authorization. Hosted authenticated Preflight result will be recorded in PR after metadata push. Task/Implementation remain PLANNED until actual implementation/testing starts.
