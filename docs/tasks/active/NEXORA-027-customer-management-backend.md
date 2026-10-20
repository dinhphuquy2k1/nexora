# NEXORA-027 — Customer Management Backend V1

Task: VERIFICATION PENDING
Implementation: IMPLEMENTED
Verification: PARTIALLY VERIFIED
Classification: SIGNIFICANT

Current contract: the PR23 revised address contract below requires an initial default address and forbids last/default deletion. Earlier optional-create and deletion passages are historical plans/evidence, superseded by the owner's revised request.

## Baseline and interface preflight

2026-10-20: origin/main ea0fce64f0de5201301d05cfe35fde9f4265e80d, clean separate worktree on feat/customer-management-backend-v1. PR21 Identity/session and PR22 retail UI remain open and are not incorporated. Remote task inventories reserve025/026;027 is unused. Read mandatory AI sequence, backend/database/API/domain/ADR/testing and NEXORA-019 runtime privilege contract. No Workspace/Shop/membership/frontend/Shipment CRUD/sync, auth policy change or historical migration edits.

## Plan and contracts before implementation

1. M1 verification-first: add one forward-only migration20261020010000_customers and exactly customers/customer_addresses plus customer_code_seq. Code default uses the invoker next_customer_code() SQL function with one materialized nextval and minimum-six padding (never truncation); gaps accepted. Runtime receives EXECUTE only on this supporting function as well as sequence USAGE; PUBLIC execution revoked. Owner/creator RESTRICT FKs, owner-phone/global-code uniqueness, status CHECK, customer-address cascade and partial unique default. Add scope/sort indexes. Extend only explicit runtime table grants and USAGE on this exact sequence, never customer DELETE/DDL/audit broadening.
2. M2 test-first: pure CustomerStatus, phone parsing via exactly pinned libphonenumber-js/max, ISO country validation, trimmed bounded fields and strict allowlists. name/recipientName1..200, label1..100 nullable, email1..254 nullable, note1..5000 nullable, addressText1..2000, raw phone1..64. Default VN for national phone input; store E.164. CustomerOwnerResolver returns actor.id only. Service owns strict UUID/query/body parsing, safe error mapping and recipient fallback; ports use normalized internal types, never caller ownership fields.
3. M3: scoped Prisma adapter; lock ACTIVE actor user row before customer row for every transaction, then address operations. Recheck ACTIVE after waits, no slow I/O under locks. All reads and final writes have owner predicates (address scoped through its customer). Concurrent default changes and additions lock the same parent; no default replacement on delete, but a later add when no default exists becomes default. Clear/set default atomically; repeated selection idempotent. Create initial address and customer in one transaction. Concurrent owner-phone conflict maps only the named unique constraint to409 CUSTOMER_PHONE_EXISTS; unknown failures remain safe500.
4. Exactly8 endpoints under /api/customers, normal global SessionGuard; OriginGuard on all mutations. No owner/creator/code in request DTOs or response identity metadata. Summary: id/code/name/phone/email/note/status/createdAt/updatedAt; detail adds addresses (default first, createdAt/id ascending). PATCH customer/detail response and address response wrappers are explicit; no customer hard delete. List page1/pageSize20 max100, q max200 case-insensitive name/code/phone substring with normalized valid-phone alternative, exact phone filter normalized before lookup; status optional, stable createdAt/id DESC. Reject unknown query fields, arrays, noncanonical integers and empty patches. Null only clears nullable fields. DB-scoped count/list in one consistent read transaction.
5. M4: controller DTOs/Swagger, documentation-only OpenAPI module placeholders, generated committed SDK (never hand edits), canonical Backend/Database/API/Overview/Customers domain/Testing/index/router and this task. Customer Frontend/Shipment remain PLANNED; accepted ADR history unchanged.
6. M5: real migrated PostgreSQL runtime role, ownership HTTP matrix, concurrency/default/disable fencing, upgrade/re-provision/constraints and regression suites. Record exact source/status/times, FAIL/NOT RUN if genuine Prisma is still blocked by policy. No checksum/TLS bypass, fake client, db push, user-volume reset, live provider call, merge or deployment. Commit only task files, push new feature branch and open draft PR if mandatory verification remains open.

## PLAN ISSUES

No scope/ownership conflict: approved product scope already includes customer management, and this request authorizes its first backend milestone. National phone default VN is independent of postal countryCode. Address deletion may leave no default; a subsequent added address becomes default when none exists, without silently choosing an existing address. This reconciles the explicit add rule with deletion semantics. Customer ownership is distinct from Carrier ownership and never grants ADMIN cross-owner visibility. Global runtime Carrier privileges remain exactly as previously approved; this feature must not widen them.

## Acceptance criteria

- [ ] Exactly2 business tables and1 sequence, upgrade/replay preserves existing identity/MFA/Carrier/file data.
- [ ] Sequence-generated globally unique untruncated KH codes, owner-scoped normalized phone uniqueness.
- [ ] Domain validation/strict field allowlists/owner resolver and8 endpoints implemented.
- [ ] Owner predicates, ACTIVE-user locking, atomic initial/default address and concurrency verified.
- [ ] nexora_app CRUD/sequence minimum grants and denied Customer DELETE/DDL/audit/history verified.
- [ ] Real Nest/PostgreSQL HTTP/session/Origin/PII/foreign owner matrix passes.
- [ ] OpenAPI/SDK generated and drift check passes; existing regressions pass.
- [ ] Canonical docs synchronized, exact execution evidence and outstanding gates recorded.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Customer backend ownership/schema/sequence/grants,8 HTTP contracts, normalization/default-address rules and new tests; no frontend or shipment implementation.

### Canonical owners

- docs/architecture/database.md
- docs/architecture/backend.md
- docs/architecture/api-contract.md
- docs/architecture/overview.md
- docs/domains/customers.md and shipments.md
- docs/README.md and docs/ai/DOCUMENT_ROUTER.md
- docs/operations/testing.md

### Documentation verification

pnpm docs:check, format:check, contracts:check and task evidence review. Full canonical/runtime tests are independent gates.

## Evidence

| Claim                                | Evidence                                                                                                         | Date       | Result |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Isolated baseline and unused task ID | git fetch origin; separate clean worktree at ea0fce6; remote task inventories025/026 only; open PR21/22 excluded | 2026-10-20 | PASS   |

## Milestone implementation and precommit outcomes

M1: exactly two business tables plus one sequence/invoker formatter function committed in one new forward migration; existing migrations unchanged. Restricted native PostgreSQL17.11 SQL tests PASS for populated pre-feature preservation, runtime CRUD/sequence, code beyond six digits, separate-connection code/phone races, named uniques, CHECK/NOT NULL/FKs, partial default index, RESTRICT/cascade and re-provisioning. This applies genuine SQL to an owned database, **not** Prisma migration history/drift or Nest authorization. Prisma model/upgrade test implementation is present, but genuine engine-dependent validation remains open.

M2: Customer domain/application and narrow Prisma duplicate-metadata mapping unit groups PASS7, using an explicit subset TypeScript compilation (no generated client, no fake replacement). RED history: missing implementation module; country test caught the library's non-ISO XK extension, now explicitly rejected; duplicate helper missing before implementation. An initial native fixture reused one parameter as UUID/text (42P08), corrected in the test. Native concurrency now uses independent actual PostgreSQL connections rather than queued queries on one client. No expected assertion was weakened.

M3: controller/service/scoped Prisma adapter for all8 operations exist with existing guards, actor→customer locks and transaction boundaries. Genuine full API compile/HTTP/concurrency remains blocked by generated Prisma prerequisites, so operational/security acceptance is not marked complete. The real Nest/PostgreSQL test is wired into canonical integration and includes actual restricted runtime/MFA/session fixtures; no fake authorization path is added. Native SQL PASS is not a substitute.

M4: contracts:generate PASS after compiling the shared package; initial generation failed on missing shared output, then corrected by the normal shared build. Nullable DTOs explicitly use string/null. Generated SDK/OpenAPI include8 Customer operations. Canonical docs/domain/index/router/rules/testing are synchronized. contracts:check is run on committed generated files because the checker deliberately rejects uncommitted generated drift; final exact-head outcome belongs in the PR/handoff.

M5: independent precommit checks pass; workspace required commands and canonical quality remain prerequisite-sensitive. Source for these precommit results is baseline ea0fce64f0de5201301d05cfe35fde9f4265e80d with dirty task implementation, not a future commit. Full exact clean-head verification/CI is recorded separately after commit to avoid SHA-only documentation loops.

| Claim                                                          | Evidence                                                                                                                                                        | Date       | Result |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Domain/application and narrow database error mapping           | pnpm --filter @nexora/api test:customer;7 groups after missing-module/helper and non-ISO-country REDs                                                           | 2026-10-20 | PASS   |
| Native real PostgreSQL upgrade/constraints/runtime authority   | node --test packages/database/test/customer-sql.mjs with DATABASE_URL supplied privately for the owned Docker PostgreSQL cluster; no Prisma history claim       | 2026-10-20 | PASS   |
| Generated OpenAPI/SDK                                          | pnpm --filter @nexora/shared build; pnpm contracts:generate;8 operations and nullable string schema inspected                                                   | 2026-10-20 | PASS   |
| Boundaries/lint/vocabulary                                     | pnpm lint; pnpm test:lint (50 groups, Customer coverage included)                                                                                               | 2026-10-20 | PASS   |
| Documentation and format                                       | pnpm docs:check; pnpm format:check; pnpm test:docs; pnpm test:operations                                                                                        | 2026-10-20 | PASS   |
| Genuine Prisma generation/format prerequisite                  | pnpm --filter @nexora/database generate and exec prisma format: engine commit0edf323efd1d98336f3f0a68684b56f689b900d3/debian-openssl-3.0.x checksum download403 | 2026-10-20 | FAIL   |
| Full workspace execution                                       | pnpm typecheck; pnpm test; pnpm build each exit1 on genuine database build/checksum or EAI_AGAIN prerequisite                                                   | 2026-10-20 | FAIL   |
| Canonical integration command starts but assertions do not run | pnpm test:integration exits1 because @nexora/database generated/built package is unavailable; no claim for Nest/Prisma assertions                               | 2026-10-20 | FAIL   |

## Remaining gates and safe handoff

Run frozen install, genuine Prisma generate/validate, full workspace typecheck/test/build/contracts, canonical quality and migration/integration suites on an authorized Linux Docker environment with normal verified access to binaries.prisma.sh. No checksum/TLS bypass, alternate/fake client/engine or privilege broadening is permitted. The final PR description records the actual canonical Docker attempt and current head CI, not success inferred from YAML. Canonical runtime/public-HTTPS/data/dev and genuine Nest/ownership/MFA/disable/default concurrency remain NOT RUN until the real build prerequisite succeeds. API-runtime privilege/history assertions likewise require that execution even though native SQL proves several physical constraints/grants.

Command order on a dedicated disposable Linux Docker daemon: pnpm install --frozen-lockfile; pnpm --filter @nexora/database generate; sh scripts/quality-docker.sh; sh scripts/runtime-smoke.sh; sh scripts/public-https-smoke.sh; sh scripts/data-smoke.sh; sh scripts/dev-smoke.sh. Quality runs full quality + actual integration + migration tests and uses its own selected COMPOSE_PROJECT_NAME; preflight a unique empty project and clean only its own volumes afterward. Other scripts own their disposable namespaces. Native SQL test must use a separate cluster, never the canonical shared runtime password or user environment. Capture source/status before/after, versions, command exit codes/timestamps and safe logs; keep failed startup separate from assertions that ran. See canonical Testing for command custody. Do not reset user volumes or call live Carrier APIs.

Implementation is in place; mandatory verification is still pending, so no READY FOR REVIEW/merge claim. Customer frontend, Shipment management and synchronization remain PLANNED. No auth/MFA/session/Carrier policy, accepted ADR history, production seed or deployment changed. Only task-owned files may be committed/pushed; draft PR until the outstanding genuine build/security/runtime gates are verified.

## PR23 revised address contract preflight — 2026-10-20

SIGNIFICANT; Documentation Impact: REQUIRED. Fetched branch HEAD matches reviewed d328e0becebfd5bdcf4875b3ba3f46ffad851d0c; clean worktree. This request supersedes the original optional-create/default-deletion business rules above; those passages are historical implementation evidence, not the revised contract. No other PR or Identity/Carrier code is included.

Plan before code:

1. RED domain/service tests for missing/null/empty/array/blank initial address and required normalized create result; preserve PATCH/strict-owner/fallback regressions. Separate normalized create type from PATCH; make address mandatory in service/port/adapter/Swagger and create it unconditionally in the same transaction.
2. Domain deletion policy and errors: scoped parent/child existence first404, then count<=1 LAST_CUSTOMER_ADDRESS409, then default DEFAULT_ADDRESS_REASSIGN_REQUIRED409, otherwise delete. Count and delete remain under ACTIVE actor→Customer row locks; no count outside transaction. Preserve requestId/global error envelope; exact last-address message contains no PII.
3. Update all business API fixtures to supply initial addresses; retain duplicate/owner/Origin/MFA/rollback/code tests. Add HTTP deletion-priority and DELETE/DELETE, DELETE/PUT, POST/DELETE invariant checks. Keep database SQL fixtures explicitly low-level, not claims that invalid API creation is permitted.
4. Physical schema already provides at-most-one default; application transactions supply at-least-one for valid API-created records. No new table/trigger/migration or grant changes. Provide a read-only legacy audit and controlled owner-led Add Address/Set Default runbook; no fabricated address, arbitrary default, automatic data migration or user-resource access. Actual operator data is not available in this workspace and cannot be certified valid.
5. P2 list aggregates: fetched current main and related frontend branch contain only planned Customer navigation, no implemented Customer List consumer or addressCount/statusCounts contract. Defer both fields to explicit Customer Frontend integration; adding aggregates is not required to correct P1 and counts semantics need consumer tests. SDK consumers must not infer counts from a page. No new endpoint/export.
6. P2 GET locks: keep existing actor FOR UPDATE. It preserves ACTIVE fencing and count/page consistency with application writes; no measured contention or genuine concurrency proof for a lighter alternative is available. Follow up with measurements plus real disable/read consistency tests before changing locks. Do not refactor Identity or trade security for hypothetical performance.
7. Generate OpenAPI/SDK, synchronize Customer/API/Backend/Database boundary/Testing and repair guidance; preserve previous FAILs. Run independent checks and real PostgreSQL SQL/legacy-audit tests, attempt genuine Prisma/full canonical verification without bypass, commit/push only this task on existing PR branch and report exact final-head CI. Task stays VERIFICATION PENDING while mandatory evidence is missing.

### Revised contract execution before commit

At source d328e0becebfd5bdcf4875b3ba3f46ffad851d0c with dirty task changes, new tests first failed for accepted missing address and missing deletion policy; after implementation, Customer subset tests PASS10 groups (including prior7, create-policy, deletion-policy/service409 and generated contract checks). Normalized create/PATCH overloads are separate; address is mandatory in the port/adapter/Swagger and no conditional insert remains. Owner check→child check→count→LAST→DEFAULT→delete stays under the existing parent transaction. Global error filter/Identity/Carrier, schema/migration/grants and GET locking remain unchanged.

The real Nest/PostgreSQL HTTP harness was updated, not reported as executed: all otherwise-valid API create fixtures carry initial addresses, and successful mutation checks assert count>=1/exactly-one-default/parent binding. Coverage retains duplicate/owner/ADMIN/Origin/PII/MFA/session/rollback and adds deletion priority, reassignment, concurrent DELETE/DELETE, DELETE/PUT, POST/DELETE, recipient independence and deliberate legacy repair. Operator legacy audit remains NOT RUN: no authorized deployment database is attached. No user data was changed or declared repaired.

Native PostgreSQL SQL/constraint/grant regression and the actual read-only audit script PASS on the owned disposable cluster. Raw SQL deliberately creates zero/no-default profiles, the audit detects them, and existing uniqueness rejects multiple defaults; these are not business API success fixtures or Prisma migration/Nest evidence. Data-smoke was inspected and already supplies an initial default address, so it requires no assertion changes. A temporary fixture-edit helper had a stale source anchor; corrected before formatting/generation; this was a tooling error, not a product test result.

| Claim                                                         | Evidence                                                                                                                                                     | Date       | Result |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| New address-policy RED reproduced                             | pnpm --filter @nexora/api test:customer at baseline production with new tests; missing-address acceptance and absent deletion policy fail                    | 2026-10-20 | FAIL   |
| Customer subset and generated contract regressions            | same command after implementation;10 groups, no generated Prisma substitute                                                                                  | 2026-10-20 | PASS   |
| Physical constraints/grants and actual read-only legacy audit | node --test packages/database/test/customer-sql.mjs using privately supplied owned PostgreSQL17.11 URL; deliberately invalid raw fixture boundaries explicit | 2026-10-20 | PASS   |
| Updated contract generation                                   | pnpm contracts:generate; required address, optional recipients, independent PATCH and DELETE409                                                              | 2026-10-20 | PASS   |
| Independent boundaries/docs/format                            | pnpm lint; pnpm docs:check; pnpm format:check on task changes                                                                                                | 2026-10-20 | PASS   |

Current platform observations are current/restricted/enforced and binaries.prisma.sh remains excluded; final clean-head genuine generate/workspace/canonical attempts and hosted CI are recorded in PR23 after commit. Historical results above remain tied to their original dirty/baseline sources. Do not infer final-head PASS from this precommit record. No new migration, trigger/table, privilege widening, alternate engine/client, checksum/TLS bypass, production deployment or live Carrier call. Full genuine integration/migration/runtime and operator-data verification remain pending; no acceptance checkbox is promoted from static inspection.

### PR23 error handling review (2026-10-20)

BOUNDED follow-up at baseline83b6d9e087949aac7ca9fe883f26a0da05def341. Documentation Impact: REQUIRED; canonical owners updated: PROJECT_RULES and Backend. One feature-local exhaustive map stores status/message together, with mapper outside business operations. CustomerService catches only CustomerError; unexpected errors and global ErrorFilter remain untouched. ESLint no-nested-ternary is error-level for Customer production TypeScript only; config regression tests reject both nested arms and preserve unrelated/generated scope. No generic framework, Identity/Carrier refactor or transport/security change.

Reviewed all Customer domain/application/infrastructure/presentation files: only HTTP mapping and identical body/query status validation required consolidation. Existing shared text/phone/address parsers, owner resolution, address predicates, transaction fencing and DB-conflict classifier already centralize their policies. Recipient fallback during initial normalization and later DB-backed address creation occurs at different boundaries (the latter needs the locked current parent); no speculative cross-layer merge. Repeated owner-bound row-count guards retain operation-specific transaction semantics.

Executed on dirty task changes on 2026-10-20: Customer subset compile/tests PASS12 including exact six-code status/message parity, non-domain passthrough, safe response keys, and a TypeScript in-memory negative compilation proving a new unmapped code fails. Format/lint/test:lint/docs/test:docs/contracts checks PASS. The first broad attempt also exposed missing API_INTERNAL_URL in host tooling; retried with loopback API_INTERNAL_URL=http://127.0.0.1:4096. Full workspace typecheck/test/build remain blocked by the genuine Prisma prerequisite; integration exits before assertions because database dist is unavailable. Runtime/Docker suites NOT RUN for this refactor; prior runtime failures remain historical evidence, not a new-head result. Final commit/check evidence belongs in PR metadata to avoid a self-referencing documentation commit. Task remains VERIFICATION PENDING.

## PR23 verification reliability preflight — 2026-10-20

SIGNIFICANT; Documentation Impact: REQUIRED. Baseline e47ba236896c253e213a0a62d723101a7240de2b matches current PR head and clean branch; no new commits/review submissions/inline comments since the supplied review baseline. Do not reimplement address/error fixes. Canonical owners for this follow-up: Testing and this active task; no business/API/schema change planned.

Plan/interfaces before changes:

1. Independently diagnose genuine Prisma generation and hosted Foundation run149; record exact target/version/proxy/cache and runner/check annotations/artifact availability, never infer hosted cause from local logs. Keep official verified downloads and all existing mandatory checks.
2. Frozen install and genuine generate first; run independent unit/docs/lint/contracts checks and record real exits for broad checks. Run real migrated Nest/restricted-role integration, migration/drift, quality and smoke gates only when genuine build prerequisites work. Native SQL remains separate physical evidence, on its own owned cluster.
3. Assess the existing single-scenario Customer harness without speculative split/poll timing changes; inspect dependency and cleanup ordering. Only reproduce-driven code fixes. Preserve GET locks, aggregate deferral, mapper, lint scope, grants and historical migrations.
4. Document concrete environment/admin unblock requirements and distinguish PR code gates from deployment-data audit; commit/push only genuinely new documentation/evidence. Recheck exact final head and update PR metadata after checks. Draft and VERIFICATION PENDING until mandatory gates pass.

PLAN ISSUE — operator-data scope: canonical repair guidance explicitly describes authorized deployment-data audit separately from disposable PR tests, but task history included operator-data verification among remaining gates without a clear statement about gating merge versus deployment. No operator database is attached; audit is NOT RUN. This follow-up does not silently waive it or certify deployment data. Repository/product owner must clarify applicability to an existing deployment before release; genuine Nest/migration/runtime/CI gates unambiguously remain mandatory PR gates.

### Investigation and executed evidence at the reviewed source

On 2026-10-20, Linux x86_64 Node24.19.0/pnpm10.34.6, installed Prisma CLI/client7.10.0, Docker28.4.0/Compose2.40.3, host OpenSSL3.5.7. Genuine engine request identifies commit0edf323efd1d98336f3f0a68684b56f689b900d3/debian-openssl-3.0.x; canonical Docker uses Bookworm with OpenSSL/CA installed. No binary ran, so ABI compatibility is not verified. Frozen installation PASS; no version/lock/dependency changes. Current-user Prisma cache and installed workspace dependencies contain no schema-engine; generated client/database dist is unavailable. A direct-import probe for the transitive @prisma/engines-version package was not resolvable (pnpm isolation); authoritative target/commit evidence is the actual CLI download, not a fabricated version result. A cache inventory probe encountered denied access to /root; no attempt to elevate or reuse another user's cache.

ENVIRONMENT BLOCKER: current observed policy is restricted/enforced, binaries.prisma.sh excluded, inherited proxy/Node CA configured, no VPN/outbound identities/alternative environment. Actual curl through inherited HTTPS proxy exits56 with CONNECT tunnel403 before artifact TLS; generate and canonical Docker fail official checksum fetch403, broader Node attempts may report EAI_AGAIN. No TLS/certificate error or binary runtime fault was observed. No checksum/TLS bypass or custom URL/client. User confirmed no alternative authorized environment. Supported unblock: operator approves official artifact host in managed configuration, or supplies an authorized disposable Linux Docker environment with verified official access. Do not keep rerunning an unchanged denied prerequisite.

Hosted incident is independently bounded: run149 /39393555396 at e47ba236 reports failure; job118530620983 created2026-10-20T08:27:40Z, completed08:27:42Z, runner_id0/name blank/steps empty. GitHub accepted the workflow run, but no allocated runner or checkout/quality execution is evidenced. Check output has one annotation, no summary; artifacts0; dedicated job-log tool returns404 BlobNotFound. Annotation endpoint is rejected by connector INVALID_ARGUMENT; normal gh api returns Forbidden. Exact billing/quota/policy cause is NOT established. Repository administrator must read that annotation and Actions/billing/quota/policy/permissions/runner diagnostics, resolve the confirmed cause and rerun once; this session does not have access or authority to change billing/policy. No workflow edit is justified. No review submissions or inline comments were returned.

All rows below were executed at source e47ba236 with documentation-only worktree edits during the investigation; not clean final-head evidence. Pinned wrapper: npm exec --yes --package=pnpm@10.34.6 -- pnpm; API_INTERNAL_URL=http://127.0.0.1:4096, inherited platform proxy/CA. Exact UTC windows and exits are recorded here; sanitized full logs remain local, final-head results belong in PR metadata.

| Claim                                   | Evidence                                                                   | Date       | Result |
| --------------------------------------- | -------------------------------------------------------------------------- | ---------- | ------ |
| pnpm install --frozen-lockfile          | 2026-10-20T09:04:42.968329+00:00 → 2026-10-20T09:04:44.592350+00:00; exit0 | 2026-10-20 | PASS   |
| pnpm --filter @nexora/database generate | 2026-10-20T09:04:44.592695+00:00 → 2026-10-20T09:04:49.626836+00:00; exit1 | 2026-10-20 | FAIL   |
| pnpm --filter @nexora/api test:customer | 2026-10-20T09:04:49.627184+00:00 → 2026-10-20T09:04:53.830616+00:00; exit0 | 2026-10-20 | PASS   |
| pnpm format:check                       | 2026-10-20T09:04:53.831011+00:00 → 2026-10-20T09:04:58.971805+00:00; exit0 | 2026-10-20 | PASS   |
| pnpm lint                               | 2026-10-20T09:04:58.972221+00:00 → 2026-10-20T09:05:03.587197+00:00; exit0 | 2026-10-20 | PASS   |
| pnpm test:lint                          | 2026-10-20T09:05:03.587587+00:00 → 2026-10-20T09:05:08.182395+00:00; exit0 | 2026-10-20 | PASS   |
| pnpm docs:check                         | 2026-10-20T09:05:08.182850+00:00 → 2026-10-20T09:05:09.401008+00:00; exit0 | 2026-10-20 | PASS   |
| pnpm test:docs                          | 2026-10-20T09:05:09.401427+00:00 → 2026-10-20T09:05:10.822986+00:00; exit0 | 2026-10-20 | PASS   |
| pnpm test:operations                    | 2026-10-20T09:05:10.823652+00:00 → 2026-10-20T09:05:12.398040+00:00; exit0 | 2026-10-20 | PASS   |
| pnpm contracts:check                    | 2026-10-20T09:05:12.398728+00:00 → 2026-10-20T09:05:18.020537+00:00; exit0 | 2026-10-20 | PASS   |
| pnpm typecheck                          | 2026-10-20T09:05:18.020947+00:00 → 2026-10-20T09:05:33.865046+00:00; exit1 | 2026-10-20 | FAIL   |
| pnpm test                               | 2026-10-20T09:05:33.865727+00:00 → 2026-10-20T09:05:52.280502+00:00; exit1 | 2026-10-20 | FAIL   |
| pnpm test:integration                   | 2026-10-20T09:05:52.280884+00:00 → 2026-10-20T09:05:54.154835+00:00; exit1 | 2026-10-20 | FAIL   |
| pnpm build                              | 2026-10-20T09:05:54.155280+00:00 → 2026-10-20T09:06:08.867600+00:00; exit1 | 2026-10-20 | FAIL   |
| git diff --check                        | 2026-10-20T09:06:08.868067+00:00 → 2026-10-20T09:06:08.875782+00:00; exit0 | 2026-10-20 | PASS   |

Customer subset tests PASS12; lint tests52, docs6, operations5. contracts:check regenerates and finds no contract drift. Broad typecheck/test/build fail at genuine database generation, not Customer type/HTTP assertions. Integration command exits before assertions for unavailable @nexora/database/dist/index.js. No full API/Nest ownership/concurrency claim.

Actual canonical sh scripts/quality-docker.sh ran on a separate clean detached e47ba236 checkout2026-10-20T09:05:22.067309Z–09:05:46.387692Z, exit1. Unique initially empty project pr23reliability-7183df1020, loopback38161/55389, unique image tags and existing build_ca secret; genuine db-runtime build checksum403. Cleanup exit0 and no owned containers/volumes/networks remain. Quality/migration/Nest assertions did not start. LOCAL/public-HTTPS/data/dev smoke NOT RUN because quality prerequisite failed. No runtime privilege widening, user volume reset, live carrier or public deployment.

Native SQL first attempt2026-10-20T09:05:35.810053Z–09:05:44.877546Z failed exit1/read ECONNRESET before assertions; the external scratch launcher had accepted temporary Unix-socket pg_isready before final TCP startup. Targeted readiness correction to that scratch launcher (TCP psql SELECT1) then actual native test2026-10-20T09:06:12.848404Z–09:06:18.878798Z PASS exit0 on owned PostgreSQL17.11. Both owned clusters cleaned by exact IDs with exit0. This is test-launcher setup evidence, no repository/Customer code change. Actual raw constraints/grants/upgrade snapshots/audit PASS does not establish Prisma history/drift or real HTTP security. Historical failure is retained above.

Harness assessment: one scenario means later assertions stop after the first failure, and address lifecycle intentionally shares created IDs/state. Existing finally scopes app/adapters/owned DB/temp storage/environment; disable polling observes actual runtime-role lock waiters then releases the blocker. No genuine successful runs or CI step logs exist to measure flakiness, and no proven repository cleanup/polling defect was reproduced. Do not split tests, change timeouts or weaken assertions based on speculation; first unblock genuine execution and capture failure phase. P2 aggregates, GET locks, mapper/lint scope, schema, historical migrations and grants remain unchanged.

New canonical diagnostic/handoff procedure is in docs/operations/testing.md. No application/test/workflow/dependency source is changed. Implementation remains IMPLEMENTED, task VERIFICATION PENDING; no acceptance criterion is promoted from inspection. Operator dataset audit NOT RUN, with scope PLAN ISSUE retained separately. Final head checks/CI will be captured in PR metadata without a SHA-only commit loop.
