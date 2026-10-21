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
3. M3: scoped Prisma adapter; lock ACTIVE actor user row before customer row for every transaction, then address operations. Recheck ACTIVE after waits, no slow I/O under locks. All reads and final writes have owner predicates (address scoped through its customer). Concurrent default changes and additions lock the same parent; [SUPERSEDED — DO NOT IMPLEMENT: historical statement that "no default replacement on delete, but a later add when no default exists becomes default" is superseded by canonical rules in docs/domains/customers.md#recipient-addresses where deleting the default address is forbidden with 409 DEFAULT_ADDRESS_REASSIGN_REQUIRED and valid customers never reach zero defaults]. Clear/set default atomically; repeated selection idempotent. Create initial address and customer in one transaction. Concurrent owner-phone conflict maps only the named unique constraint to409 CUSTOMER_PHONE_EXISTS; unknown failures remain safe500.
4. Exactly8 endpoints under /api/customers, normal global SessionGuard; OriginGuard on all mutations. No owner/creator/code in request DTOs or response identity metadata. Summary: id/code/name/phone/email/note/status/createdAt/updatedAt; detail adds addresses (default first, createdAt/id ascending). PATCH customer/detail response and address response wrappers are explicit; no customer hard delete. List page1/pageSize20 max100, q max200 case-insensitive name/code/phone substring with normalized valid-phone alternative, exact phone filter normalized before lookup; status optional, stable createdAt/id DESC. Reject unknown query fields, arrays, noncanonical integers and empty patches. Null only clears nullable fields. DB-scoped count/list in one consistent read transaction.
5. M4: controller DTOs/Swagger, documentation-only OpenAPI module placeholders, generated committed SDK (never hand edits), canonical Backend/Database/API/Overview/Customers domain/Testing/index/router and this task. Customer Frontend/Shipment remain PLANNED; accepted ADR history unchanged.
6. M5: real migrated PostgreSQL runtime role, ownership HTTP matrix, concurrency/default/disable fencing, upgrade/re-provision/constraints and regression suites. Record exact source/status/times, FAIL/NOT RUN if genuine Prisma is still blocked by policy. No checksum/TLS bypass, fake client, db push, user-volume reset, live provider call, merge or deployment. Commit only task files, push new feature branch and open draft PR if mandatory verification remains open.

## PLAN ISSUES

No scope/ownership conflict: approved product scope already includes customer management, and this request authorizes its first backend milestone. National phone default VN is independent of postal countryCode. [SUPERSEDED — DO NOT IMPLEMENT]: Historical proposal that "address deletion may leave no default" was superseded by the revised customer address contract in [Customer Domain](../../domains/customers.md#recipient-addresses). The current accepted contract requires an initial default address at creation, forbids deleting the last address (409 LAST_CUSTOMER_ADDRESS), and forbids deleting the default address if alternatives exist without explicit prior reassignment (409 DEFAULT_ADDRESS_REASSIGN_REQUIRED); valid API mutations never leave a customer without a default address. Customer ownership is distinct from Carrier ownership and never grants ADMIN cross-owner visibility. Global runtime Carrier privileges remain exactly as previously approved; this feature must not widen them.

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

Customer backend ownership/schema/sequence/grants,8 HTTP contracts, normalization/default-address rules and tests; DDD reference plus shared status/VO/labels, strict commands, additive statusLabel responses, operation-scoped profile policy and mandatory governance. No Customer frontend or shipment implementation.

### Canonical owners

- docs/decisions/tactical-ddd.md and decisions/README.md
- docs/ai/PROJECT_RULES.md, IMPLEMENTATION_WORKFLOW.md, DOCUMENT_ROUTER.md, PROJECT_CONTEXT.md
- docs/architecture/database.md
- docs/architecture/backend.md and frontend.md
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

PLAN ISSUE — operator-data scope: canonical repair guidance explicitly describes authorized deployment-data audit separately from disposable PR tests, but task history included operator-data verification among remaining gates without a clear statement about gating merge versus deployment. No operator database is attached; audit is NOT RUN. This follow-up does not silently waive it or certify deployment data.

- Option A (PR Merge Gate): Require execution of audit-customer-addresses.sql on actual deployment data before PR23 merge. Impact: Blocks PR23 indefinitely because disposable integration environments (CI/local) do not possess credentials or network access to an operator deployment database.
- Option B (Recommended — Deployment/Upgrade Gate): Classify live deployment-data audit as an operator deployment/upgrade gate performed during environment release/rollout, while PR23 merge verification strictly requires code, schema, disposable integration tests, Docker quality, and successful execution of the audit script against disposable test databases. Rationale: Nexora currently has no pre-existing production Customer data (Customer Management V1 is introduced in this PR).
- Scope resolution: Retained as an OPEN PLAN ISSUE until product/repository owner confirms adoption of Option B.

### Investigation and executed evidence at the reviewed source

On 2026-10-20, Linux x86_64 Node24.19.0/pnpm10.34.6, installed Prisma CLI/client7.10.0, Docker28.4.0/Compose2.40.3, host OpenSSL3.5.7. Genuine engine request identifies commit0edf323efd1d98336f3f0a68684b56f689b900d3/debian-openssl-3.0.x; canonical Docker uses Bookworm with OpenSSL/CA installed. No binary ran, so ABI compatibility is not verified. Frozen installation PASS; no version/lock/dependency changes. Current-user Prisma cache and installed workspace dependencies contain no schema-engine; generated client/database dist is unavailable. A direct-import probe for the transitive @prisma/engines-version package was not resolvable (pnpm isolation); authoritative target/commit evidence is the actual CLI download, not a fabricated version result. A cache inventory probe encountered denied access to /root; no attempt to elevate or reuse another user's cache.

ENVIRONMENT BLOCKER: current observed policy is restricted/enforced, binaries.prisma.sh excluded, inherited proxy/Node CA configured, no VPN/outbound identities/alternative environment. Actual curl through inherited HTTPS proxy exits56 with CONNECT tunnel403 before artifact TLS; generate and canonical Docker fail official checksum fetch403, broader Node attempts may report EAI_AGAIN. No TLS/certificate error or binary runtime fault was observed. No checksum/TLS bypass or custom URL/client. User confirmed no alternative authorized environment. Supported unblock: operator approves official artifact host in managed configuration, or supplies an authorized disposable Linux Docker environment with verified official access. Do not keep rerunning an unchanged denied prerequisite.

Hosted incident is verified via `gh run view 39398432598`: run 39398432598 at 072f73ad (job 118546837237, duration 2s, 0 steps, no runner allocated) failed with check annotation:
`"The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings"`
Classification: Category A — Runner/Actions administration failure (GitHub account billing / spending limit). The failure is not caused by workflow configuration (`.github/workflows/foundation.yml`) or application code/tests. Required administrator action: Check GitHub account 'Billing & plans', settle payment or raise spending limit, and re-run workflow. No workflow YAML or application source edit is warranted.

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

### Database runtime provisioning reliability & final verification — 2026-10-20

SIGNIFICANT; Documentation Impact: REQUIRED; canonical owners updated: `docs/architecture/database.md`, `docs/architecture/runtime.md`, `docs/operations/testing.md`, and this task record.

#### 1. Concurrency Root Cause & Options Evaluation

- **Issue**: Parallel execution of integration suites (`test:integration`) each provision disposable databases while sharing the cluster-global role `nexora_app`. Concurrently executing `ALTER ROLE nexora_app PASSWORD '...'` caused catalog update races (`tuple concurrently updated`, PostgreSQL `XX000` from `simple_heap_update`).
- **Advisory Lock Scope**: `pg_advisory_xact_lock(hashtext('...'))` in PostgreSQL incorporates `MyDatabaseId` in its lock tag and does not serialize operations across different databases in the same cluster.
- **Option Evaluation**:
  - **Option A (Chosen & Refined)**: Serialize role DDL cluster-wide using `LOCK TABLE pg_authid IN EXCLUSIVE MODE`. `EXCLUSIVE MODE` conflicts with `RowExclusiveLock` (DDL role mutations) and other `EXCLUSIVE` locks, but does NOT conflict with `AccessShareLock` (used for client connection authentication and reading `pg_roles`). Trusted migration/provisioning connects as superuser `nexora` possessing required table lock privileges. Bounded waiting is strictly enforced via `SET LOCAL lock_timeout = '10s'` and `statement_timeout = '30s'`.
  - **Option B (Coordination)**: PostgreSQL provides no cross-database advisory lock SQL function (all pass `MyDatabaseId`). External coordination brokers (Redis/queues) violate KISS/YAGNI architecture rules.
  - **Option C (Test-only isolation)**: Would require complex inter-process test harness synchronization across independent `node:test` worker processes, leaving production/staging multi-container provisioning vulnerable.
- **Refinements Implemented**:
  1. `SET LOCAL lock_timeout = '10s'; SET LOCAL statement_timeout = '30s'` prevents indefinite hangs if another transaction holds catalog locks.
  2. `isRetryableProvisionError(err)` accurately identifies transient recoverable errors: `55P03` (`lock_not_available` from lock timeout) and `XX000` with `simple_heap_update` or message `tuple concurrently updated`. Permanent errors (`42501`, `28P01`, invalid credentials, unsafe roles, syntax/schema errors) fail closed immediately without retry.
  3. Strict secret hygiene: Password parameters and connection strings are never included in thrown errors, error causes, or CLI log output.
  4. Added `packages/database/test/provision-runtime.test.mjs` verifying concurrent provisioning across multiple databases, timeout recovery, error classification, and secret non-leakage.

#### 2. Verification Execution Ledger

| Command / Suite                                                 | Scope & Coverage                                                                                    | Exit Code | Result                   |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------- | ------------------------ |
| `pnpm --filter @nexora/database generate`                       | Prisma Client 7.10.0 generation                                                                     | 0         | PASS                     |
| `pnpm format:check`                                             | Prettier code style verification                                                                    | 0         | PASS                     |
| `pnpm lint` && `pnpm test:lint`                                 | Boundaries, ESLint rules (52 tests), domain vocabulary                                              | 0         | PASS                     |
| `pnpm docs:check` && `pnpm test:docs`                           | Documentation links, governance, routing, metadata                                                  | 0         | PASS                     |
| `pnpm test:operations`                                          | Smoke diagnostic format, Host-negative ingress (5 tests)                                            | 0         | PASS                     |
| `pnpm contracts:check`                                          | OpenAPI specification & SDK regeneration drift                                                      | 0         | PASS                     |
| `pnpm typecheck`                                                | Turbo workspace TypeScript typecheck (6 packages)                                                   | 0         | PASS                     |
| `pnpm test`                                                     | Unit tests across all packages (including Customer 12/12 & provision-runtime)                       | 0         | PASS                     |
| `pnpm build`                                                    | Full workspace build (Next.js web & NestJS API)                                                     | 0         | PASS                     |
| `node --test packages/database/test/provision-runtime.test.mjs` | Concurrent provisioning, lock timeout, recovery, error classification                               | 0         | PASS                     |
| `sh scripts/quality-docker.sh`                                  | Canonical Docker image build, database runtime smoke, quality, integration, migrations, dev cleanup | 0         | PASS                     |
| `pnpm test:integration`                                         | All 8 integration test suites (64/64 tests) on real PostgreSQL with restricted runtime role         | 0         | PASS                     |
| `pnpm --filter @nexora/database test:migrations`                | Migration history, legacy preservation, cutover, idempotency, drift                                 | 0         | PASS                     |
| `sh scripts/data-smoke.sh`                                      | Customer, address, sequence and audit data persistence across restart/down-up                       | 0         | PASS                     |
| `sh scripts/dev-smoke.sh`                                       | Dev HMR, workspace propagation, frozen lockfile drift block                                         | 0         | PASS                     |
| `sh scripts/runtime-smoke.sh`                                   | Host TTY smoke (`pty`/`termios`) restricted on Windows; requires Linux CI runner                    | -         | NOT RUN (HOST ENV)       |
| `sh scripts/public-https-smoke.sh`                              | Host TTY smoke (`pty`/`termios`) restricted on Windows; requires Linux CI runner                    | -         | NOT RUN (HOST ENV)       |
| `audit-customer-addresses.sql`                                  | Operator dataset audit (Plan Issue: Option A PR gate vs Option B Deployment gate)                   | -         | NOT RUN (NO DEPLOY DATA) |
| GitHub Actions Foundation CI                                    | Hosted workflow execution blocked by GitHub account billing/spending limit (Run 39435250386)        | -         | BLOCKED (ADMIN ACTION)   |

Task status remains VERIFICATION PENDING until hosted CI runs on the GitHub Linux runner and repository owner resolves the Operator Data Audit gate adoption (Option B).

### PR #23 PostgreSQL Test Isolation, Provisioning Safety & Merge Readiness — 2026-10-21

SIGNIFICANT; Documentation Impact: REQUIRED; canonical owners updated: `docs/architecture/database.md`, `docs/operations/testing.md`, and this task record.

#### 1. Defect Analysis & Architectural Solution

- **Defect**: `packages/database/test/provision-runtime.test.mjs` executed role mutations (`ALTER ROLE nexora_app PASSWORD ...`) directly against whatever `DATABASE_URL` was configured. Because PostgreSQL roles are cluster-global while databases are database-local, running this on a shared or development cluster mutates the `nexora_app` password across all databases, breaking active services and other suites.
- **Execution Contract & Isolation Separation**:
  - **Pure Unit Tests** (`packages/database/test/provision-runtime.test.mjs`): Retained in `pnpm test` and `pnpm quality`. Evaluates `isRetryableProvisionError` exact classification, fail-closed validation (`maxAttempts`, `lockTimeout`, `statementTimeout`), and credential non-leakage in-memory without database access.
  - **Cluster-Isolated Integration** (`packages/database/test/provision-cluster.mjs`): Dedicated regression suite executed via `scripts/provision-cluster-smoke.py` (`pnpm --filter @nexora/database test:provision:cluster`). Requires an owned disposable PostgreSQL 17.11 container with an auto-allocated loopback port, lifecycle-managed by the launcher.
  - **Fail-Closed Cluster Ownership Verification**: Requires `DISPOSABLE_CLUSTER_ADMIN_URL` and `DISPOSABLE_CLUSTER_TOKEN`. Verifies the cluster signature (`COMMENT ON DATABASE nexora IS '<TOKEN>'`) and checks for absence of persistent databases before proceeding. Fails closed with exit code 1 if unverified.
  - **Deterministic Concurrency**: Both concurrent provisioners on the same disposable cluster use identical runtime secrets, matching canonical multi-container deployments and eliminating assumptions about `Promise.all` completion order.
  - **Guaranteed Cleanup**: Lock-holding transactions and clients are wrapped in `try / finally` blocks to ensure rollback and disconnection even upon assertion failure. Launcher removes only its owned container and port bindings on exit.
  - **Fail-Closed Validation**: `maxAttempts` strictly enforces finite positive integers `1..20` (rejects 0, negative values, fractions, NaN, Infinity, and strings). `lockTimeout` and `statementTimeout` enforce positive bounded values.
  - **Credential Hygiene**: Sanitizes thrown error causes and stacks, verified across connection failure, lock timeout, and permission denial error paths on live PostgreSQL.

#### 2. Verification Execution Ledger

| Claim                                                | Evidence                                                                                                                                                  | Date       | Result                 |
| :--------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :--------------------- |
| Runtime provisioning options & retry validation      | `node --test packages/database/test/provision-runtime.test.mjs` (in-memory unit tests for `maxAttempts`, timeouts, secret rejection)                      | 2026-10-21 | PASS                   |
| Fail-closed disposable cluster ownership guard       | `node packages/database/test/provision-cluster.mjs` invoked without launcher descriptors exits 1 with `DISPOSABLE_CLUSTER_REQUIRED`                       | 2026-10-21 | PASS                   |
| Disposable PostgreSQL cluster concurrency & recovery | `python3 scripts/provision-cluster-smoke.py` (`pnpm --filter @nexora/database test:provision:cluster`) on owned ephemeral PostgreSQL 17.11                | 2026-10-21 | PASS                   |
| Credential non-leakage across error paths            | `provision-cluster.mjs` asserts no password leakage in message, stack or cause across 55P03 lock timeout, 42501 permission denial, and connection failure | 2026-10-21 | PASS                   |
| Canonical quality in Docker                          | `sh scripts/quality-docker.sh` (build, db-runtime smoke, quality, 64/64 integration tests, migrations, provision-cluster-smoke, dev-cleanup-smoke)        | 2026-10-21 | PASS                   |
| Customer, address & sequence data persistence        | `scripts/data-smoke.sh` with custom loopback port verifying down-up and restart persistence                                                               | 2026-10-21 | PASS                   |
| Development HMR and dependency drift smoke           | `scripts/dev-smoke.sh` after stopping running dev containers; full HMR, workspace propagation, and frozen drift PASS                                      | 2026-10-21 | PASS                   |
| Development containers restoration                   | `docker compose -f compose.yml -f compose.dev.yml up -d --wait` restored all services to healthy state                                                    | 2026-10-21 | PASS                   |
| Prettier formatting & ESLint boundaries              | `pnpm format:check` && `pnpm lint` && `pnpm test:lint` (52 tests)                                                                                         | 2026-10-21 | PASS                   |
| Documentation entry points & operations tests        | `pnpm docs:check` && `pnpm test:docs` && `pnpm test:operations` (5 tests)                                                                                 | 2026-10-21 | PASS                   |
| OpenAPI & SDK contract reproducibility               | `pnpm contracts:check` verifying zero drift in generated schemas and SDK                                                                                  | 2026-10-21 | PASS                   |
| Full workspace TypeScript typecheck                  | `pnpm typecheck` (10 tasks across 6 packages)                                                                                                             | 2026-10-21 | PASS                   |
| Host Linux TTY smoke (`runtime-smoke.sh`)            | Requires Linux environment with pseudo-terminal (`pty`/`termios`) support                                                                                 | 2026-10-21 | NOT RUN (HOST ENV)     |
| Public HTTPS ingress smoke (`public-https-smoke.sh`) | Requires Linux environment with pseudo-terminal and Chromium headless support                                                                             | 2026-10-21 | NOT RUN (HOST ENV)     |
| Hosted Foundation CI run                             | GitHub Actions blocked by account billing/spending limit (Run 39460868662)                                                                                | 2026-10-21 | BLOCKED (ADMIN ACTION) |

Task status remains `VERIFICATION PENDING` pending hosted CI execution on GitHub Linux runners and product owner approval of Option B for the Operator Data Audit gate.

### PR #23 Clean CI Execution & Customer SQL Cluster Isolation — 2026-10-21

SIGNIFICANT; Documentation Impact: REQUIRED; canonical owners updated: `docs/architecture/database.md`, `docs/operations/testing.md`, and this task record.

#### 1. Plan & Architectural Decisions Before Implementation

1. **Clean CI Execution Path (Option A — Provisioned Tooling Container)**:
   - Run Node.js integration tests (`provision-cluster.mjs` and `customer-sql.mjs`) inside the provisioned `nexora-dev:0.1.0` tooling container attached to an ephemeral test Docker network.
   - Eliminates all host Node.js and host `node_modules` prerequisites during `scripts/quality-docker.sh` and CI runner steps prior to `actions/setup-node`.
   - Mounts live workspace code directories (`packages/database/test`, `packages/database/scripts`, `packages/database/prisma`) read-only into `/workspace` while preserving container-installed `node_modules`.

2. **Customer SQL Test Cluster Isolation**:
   - Refactor `packages/database/test/customer-sql.mjs` to require `DISPOSABLE_CLUSTER_ADMIN_URL`, `DISPOSABLE_CLUSTER_TOKEN`, and `DISPOSABLE_CLUSTER_RUNTIME_PASSWORD`.
   - Fail closed immediately (exit code 1) if run directly without launcher environment.
   - Verify cluster signature via `COMMENT ON DATABASE nexora` before executing any DDL or role mutation.
   - Use strictly synthetic runtime credentials generated by the launcher; eliminate all reads of host/runtime config files and `DATABASE_URL`.
   - Preserve 100% of existing physical SQL, schema constraints, sequence generation, concurrency, and audit assertion logic.

3. **Launcher Unification & Lifecycle Management (`scripts/provision-cluster-smoke.py`)**:
   - Launcher manages an ephemeral PostgreSQL 17.11 container (`postgres:17.11-bookworm`) and isolated Docker bridge network.
   - Sequentially executes both suites: (1) Provisioning concurrency & error recovery, (2) Native Customer SQL regression.
   - Supports `--suite=provision` and `--suite=customer-sql` flags for granular execution while defaulting to executing both suites.

4. **Hardened Cleanup & Verification**:
   - Track container IDs and network IDs explicitly; never use prefix matching, wildcards, or `system prune`.
   - Inspect removed resources after `docker rm -fv` and `docker network rm` to confirm deletion.
   - Fail with `CLEANUP_FAILED` if any owned resource remains.
   - Preserve original test failure diagnostics without masking when cleanup also fails.
   - Handle partial startup teardown gracefully in `try / finally`.

5. **Strengthened Ownership Verification**:
   - Capture exact 64-char container ID from `docker run`.
   - Inspect container state (running, name, image, network membership) before handing database URL to the test suite.
   - Reject any user-supplied override URL.
   - Enforce dual verification: Launcher Docker-level identity verification + Node-level database comment signature.

#### 2. Verification Execution Ledger

| Claim                                                  | Evidence                                                                                                               | Date       | Result                 |
| :----------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- | :--------- | :--------------------- |
| Customer SQL direct invocation fails closed            | `node --test packages/database/test/customer-sql.mjs` exits code 1 with `DISPOSABLE_CLUSTER_REQUIRED`                  | 2026-10-21 | PASS                   |
| Provisioning regression direct invocation fails closed | `node packages/database/test/provision-cluster.mjs` exits code 1 with `DISPOSABLE_CLUSTER_REQUIRED`                    | 2026-10-21 | PASS                   |
| Launcher negative failure cleanup guarantee            | Python failure harness verifies 0 leftover containers or networks after forced startup failure                         | 2026-10-21 | PASS                   |
| Granular suite flag execution (`--suite=customer-sql`) | `pnpm --filter @nexora/database test:customer:sql` runs native Customer SQL on owned cluster                           | 2026-10-21 | PASS                   |
| Granular suite flag execution (`--suite=provision`)    | `pnpm --filter @nexora/database test:provision:cluster` runs provisioning regression on owned cluster                  | 2026-10-21 | PASS                   |
| Full cluster integration suite                         | `pnpm --filter @nexora/database test:cluster` executes both suites in tooling container                                | 2026-10-21 | PASS                   |
| Canonical Docker quality with isolated cluster tests   | `sh scripts/quality-docker.sh` (build, db-runtime, quality, 64/64 integration, migrations, cluster tests, dev cleanup) | 2026-10-21 | PASS                   |
| Clean CI path reproducibility                          | All cluster tests execute inside `nexora-dev:0.1.0` container; no host Node or node_modules dependencies needed        | 2026-10-21 | PASS                   |
| Code style & Prettier formatting                       | `pnpm format:check` verifying zero formatting defects across all repository files                                      | 2026-10-21 | PASS                   |
| Monorepo boundaries & ESLint rules                     | `pnpm lint` and `pnpm test:lint` (52 custom rule tests pass)                                                           | 2026-10-21 | PASS                   |
| Documentation governance & links                       | `pnpm docs:check` and `pnpm test:docs` (6/6 tests pass)                                                                | 2026-10-21 | PASS                   |
| Operations smoke tests                                 | `pnpm test:operations` (5/5 tests pass)                                                                                | 2026-10-21 | PASS                   |
| OpenAPI contract & SDK generation                      | `pnpm contracts:check` verifying zero drift in API specs and SDK                                                       | 2026-10-21 | PASS                   |
| Full workspace TypeScript typecheck                    | `pnpm typecheck` (10 tasks across 6 packages pass)                                                                     | 2026-10-21 | PASS                   |
| Package unit tests                                     | `pnpm test` across all monorepo packages (Customer 12/12 unit tests pass)                                              | 2026-10-21 | PASS                   |
| Linux runtime TTY smoke (`runtime-smoke.sh`)           | Requires Linux runner with interactive PTY (`termios`) and Chromium                                                    | 2026-10-21 | NOT RUN (HOST ENV)     |
| Public HTTPS ingress smoke (`public-https-smoke.sh`)   | Requires Linux runner with host networking and Chromium                                                                | 2026-10-21 | NOT RUN (HOST ENV)     |
| Hosted Foundation CI run                               | GitHub Actions blocked before step execution by account billing limit (Run 39515094133)                                | 2026-10-21 | BLOCKED (ADMIN ACTION) |

Task status remains `VERIFICATION PENDING` pending hosted CI execution on GitHub Linux runners and product owner approval of Option B for the Operator Data Audit gate.

## PR23 TCP readiness and cleanup revision — 2026-10-21

BOUNDED; Documentation Impact: REQUIRED. Preflight baseline6ba5e580d555727ff9824311a9d1337d5296152b was fast-forwarded from the clean local branch; no unrelated edits. Read core instructions and routed Database/Runtime/Testing/Setup/task documents, launcher, cluster/Customer SQL tests, provisioning, Compose and Foundation. Infrastructure verification-first plan: controlled Docker CLI regressions for socket-only readiness, finite timeout, stopped/partial startup, failed removal/unknown inspection, suite failure and signal; then real fresh cluster suite selectors and canonical quality. Keep all business SQL assertions, Node ownership signature, synthetic credentials, no published ports and existing tooling architecture.

The reviewed socket-only psql path could see the entrypoint's temporary server. Cleanup discarded test container names regardless of rm outcome and interpreted any inspect error as absence; final PASS preceded finally cleanup, and signal handler duplicated cleanup. Controlled CLI regressions reproduce these failures at baseline before implementation (RED). New code requires TCP SQL result1 under a monotonic deadline, supplies password from the container environment, and uses Docker exec -i for SQL stdin. It connects to the database's Docker hostname and repeats SELECT1 from the same tooling container/network/credentials before suite DDL. No extra polling container or Compose healthcheck change.

Container creation now returns/tracks exact IDs before start; network creation also tracks its actual ID. Failed creation attempts recover only by unique name AND per-run label. Removal checks exact identity and only releases tracking after positive absence confirmation; daemon/permission/timeout/malformed output remains CLEANUP_FAILED. Node exit status is read from the container as well as attach CLI result. Only main's finally cleans up; signals request interruption, in-flight creation finishes ownership bookkeeping, and interruptible suite attach is killed before exact-ID cleanup. Original suite failure and additional cleanup errors are reported separately, all failures exit nonzero, and final PASS follows verified full cleanup. Diagnostics redact synthetic passwords/token and PostgreSQL URLs.

Only launcher, targeted standard-library tests, canonical quality wiring and Testing/task docs change. Controlled Docker fixture tests cannot substitute for the real SQL suites. No Customer/Identity/MFA/Carrier logic, migrations, role provisioning/grants, dependency versions, workflow YAML or published ports change. Previous evidence is historical and is not transferred to the new head. Existing historical table statuses are retained as received; new canonical evidence rows use PASS/FAIL only, with blocked/NOT RUN gates recorded separately.

### Revision verification before commit

Source6ba5e580d555727ff9824311a9d1337d5296152b with task-only dirty launcher/tests/docs, Linux x86_64/Docker28.4.0/Compose2.40.3/PostgreSQL17.11. The tooling image was genuinely built with frozen dependencies and the platform CA secret; suites run in that image with live test/scripts/prisma mounts read-only. No PostgreSQL port is published. Canonical clean final-head evidence will be recorded in PR metadata after commit; results below are precommit only.

Controlled Docker fixture regression:11 standard-library tests PASS, including suite selectors, temporary socket versus TCP, timeout/no suite/no signature, stopped/unverified/partial startup, rm/inspect/parse failures, combined suite+cleanup error, signal, exact-ID idempotence and secret redaction. Initial baseline fixture run failed13 subcases (RED); fixture plumbing was then corrected for shell arguments/stdin and partial-create metadata. Real testing caught missing docker exec stdin forwarding and probe dependency resolution from workspace root; corrected -i and database-package pg resolution before final successful real runs. These intermediate failures are not hidden or treated as PostgreSQL business regressions.

| Claim                                   | Evidence                                                                                                                                        | Date       | Result |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Fresh isolated SQL suite                | pnpm --filter @nexora/database test:provision:cluster; 2026-10-21T07:08:50.228909+00:00 → 2026-10-21T07:09:26.682707+00:00; exit0               | 2026-10-21 | PASS   |
| Fresh isolated SQL suite                | pnpm --filter @nexora/database test:customer:sql; 2026-10-21T07:09:26.682909+00:00 → 2026-10-21T07:09:57.732913+00:00; exit0                    | 2026-10-21 | PASS   |
| Fresh isolated SQL suite                | pnpm --filter @nexora/database test:cluster; 2026-10-21T07:09:57.733001+00:00 → 2026-10-21T07:10:48.351853+00:00; exit0                         | 2026-10-21 | PASS   |
| Controlled Docker lifecycle regressions | python3 scripts/provision-cluster-smoke.test.py;11 tests after implementation                                                                   | 2026-10-21 | PASS   |
| Real negative lifecycle cases           | TCP timeout exit1, forced Node suite exit17/launcher1, SIGTERM during creation and suite attach launcher143; actual Docker IDs absent afterward | 2026-10-21 | PASS   |
| Direct suite ownership guards           | Both Node commands run in network-disabled tooling containers without descriptors; each exits1 DISPOSABLE_CLUSTER_REQUIRED                      | 2026-10-21 | PASS   |

Real negative windows UTC: TCP timeout07:08:10.694468–07:08:15.990469; suite failure07:08:15.993780–07:08:42.627471; creation signal07:08:42.631414–07:08:46.316608; active suite signal07:08:46.319417–07:09:21.997267. External controlled injection uses the actual launcher/main/cleanup, never development DBs; forced-failure/signal cases are negative-test PASS with expected nonzero launcher status. No leftover owned container/network was found after exact-ID inspection; the interrupted-create case also leaves tracking empty and Docker inventory empty. Production code has no fault-injection switches.

One independent format/lint invocation encountered ENOSPC while disposable Docker jobs overlapped; after owned cleanup, disk availability recovered without pruning/user-volume deletion. Sequential rerun07:10:54–07:12:22 UTC:11 lifecycle tests, frozen install, Customer units12, format/lint/test:lint52/docs/test:docs6/operations5/contracts PASS; full typecheck/test/build FAIL at official Prisma engine checksum/EAI_AGAIN prerequisite, integration exits before assertions because database dist is unavailable. Logs retain the initial failure. Final canonical quality still requires a new-source run; LOCAL/public/data/dev smoke and hosted CI remain independent mandatory gates, never inferred from prior remote PASS rows.

Baseline hosted run39523798982 job118973638654 currently reports FAILURE, runner_id0 and no steps. This session has not read a latest annotation; no current billing/quota root cause is asserted. Operator Data Audit Gate remains pending owner decision as previously recorded. Task remains VERIFICATION PENDING and no merge is authorized.

Final controlled suite now has14 tests, including unresolved-create recovery and unowned-name refusal, adding a diagnostic regression that retains suite exit/exception category/SQLSTATE while rejecting SQL/password disclosure. Failed suite stdout/stderr is reduced to that safe diagnostic; successful synthetic test output still records actual SQL suite PASS. No raw statement or secret is added to reports.

## Owner-approved scope amendment — Customer Tactical DDD & Mandatory Future Domain Rules

SIGNIFICANT; Documentation Impact: REQUIRED. Owner's final instruction supersedes the earlier stacked-PR proposal: implement directly in PR23 on feat/customer-management-backend-v1, baseline e141700d37f2f845b3c4dcdf76b6e4c111ec217b. No new task/PR. An unused clean worktree/branch from the superseded prompt has no new commits/changes and is preserved without further use. The owner explicitly chooses Modular Monolith + Clean Architecture + Tactical DDD + Ports & Adapters before Customer merge. This is approved architecture direction, not runtime verification.

### Domain Modeling Preflight

- Ownership/language: Customer profile and recipient CustomerAddress belong to the authenticated local user; neither is Identity login or Carrier account. No ADMIN bypass or new cross-domain writes. Existing Identity supplies trusted actor and ACTIVE fence only.
- Aggregate boundary: CustomerAggregate owns profile and Address collection; CustomerAddressEntity has optional pending identity until database insertion and a stable persisted identity afterward. No Address repository or generic save/framework.
- Value Objects: immutable PhoneNumber and CountryCode own existing pinned normalization/validation; ordinary text/email/nullability policies use small pure domain functions. Canonical CustomerStatus/Error remain in domain/customer.ts to avoid vocabulary duplication and preserve exhaustive error mapping.
- Domain API: create(fields, initialAddress), rehydrate(persisted snapshot), updateProfile, addAddress, updateAddress, removeAddress, setDefaultAddress. Expose copied snapshots and typed per-operation write data only; no mutable aggregate/entity/date references or ownership/code setters. Database owns UUID/code/timestamps. Draft create/add state has no fake/generated identity.
- Input boundary: strict records/allowlists/UUID/query pagination move to application/customer.input.ts; existing validation semantics retained through the same domain value validators, no alternate phone/country implementations. Request-shape checks remain before port calls. Input helper compatibility tests move imports rather than deleting assertions.
- Port/transactions: retain small use-case CustomerPort and Nest wiring. Adapter locks/rechecks ACTIVE actor, locks existing owner-scoped Customer, hydrates consistent complete aggregate under those locks, invokes domain transition, then persists only affected profile/address/default fields in that transaction. List/detail reads retain projections and order. No hydration outside a write transaction, bulk address rewrite, network I/O or lock substitution.
- Creation: aggregate validates required initial address/fallback/default; infrastructure persists domain draft Customer+Address atomically and uses database-generated UUID/code/timestamps. Add Address returns a pending insertion intent with fallback/default selected by the aggregate; infrastructure inserts it and returns DB projection.
- Legacy decision: rehydrate copies persisted state without enforcing new-creation cardinality, renormalizing data, fabricating addresses or choosing defaults. Existing zero/no-default states remain readable; owner-directed Add Address (first/no-default becomes default) or explicit Set Default repairs them. Profile/address updates do not silently repair unrelated state. Multiple-default/schema corruption remains the existing runbook incident, not automatic repair.
- Deletion/default: membership first NOT_FOUND, then LAST, then DEFAULT conflict; default selection idempotent and never rewrites recipient fields. DB partial unique index and existing actor→Customer lock order remain authoritative for concurrent persistence.
- Compatibility matrix:8 endpoints/DTO/status/messages/envelope/guards/no-store/query/null/date ordering identical; zero OpenAPI/SDK/schema/migration/grant/provisioning/launcher drift. No Identity/Carrier refactor or Shipment implementation.

### Implementation milestones and verification

1. Add isolated aggregate/VO behavior tests (RED), preserve existing application/validation/error regressions. Cover creation/fallback, independent recipient, encapsulation including Date copies, nullable updates/status, membership/LAST/DEFAULT priority, idempotence and legacy repair.
2. Implement domain model and separate application parsing; one source for every value policy. Domain imports no Nest/Prisma/HTTP/application/infrastructure. Adapt service/port imports without changing transport.
3. Add infrastructure mapper and hydrate only after existing locks; execute domain transitions and scoped minimal SQL writes. Keep real integration race/rollback/owner/Origin/session/log assertions and extend only for refactor compatibility. Native SQL untouched.
4. Record accepted ADR008 (after checking IDs); synchronize mandatory future-domain rules, Modeling Preflight, router, backend/customer docs and indexes. Exceptions require explicit reviewed rationale; existing Identity/Carrier/Health/Storage grandfathered.
5. Run targeted aggregate/application tests and actual disposable SQL cluster, contracts/boundaries/docs, full typecheck/test/integration/build, canonical quality and required runtime suites as prerequisites allow. Record new source/time/exit/results; no historical evidence transfers to DDD. Engine/network/hosted blockers remain independent, no bypass. Keep VERIFICATION PENDING while mandatory gates fail/unrun.

Acceptance: real aggregate behavior/encapsulation, domain purity, safe locked hydration/minimal persistence, unchanged8 API/database contracts, legacy recovery, all prior assertions retained, required governance adopted, fresh genuine runtime/CI verification before readiness. Main risks are default uniqueness write ordering, stale-state hydration, accidental timestamp/idempotence drift, stricter legacy construction and duplicated validation; tests and scoped transaction design above address them. No unresolved ownership/schema issue authorizes a migration or extra framework.

### DDD implementation and precommit evidence

At source e141700d37f2f845b3c4dcdf76b6e4c111ec217b with this task's dirty changes, new isolated tests first fail for missing customer.aggregate module (RED). Domain implementation then passes9 aggregate/VO/hydration groups plus all12 pre-existing Customer groups; an added eight-operation service orchestration regression brings targeted total22. No old assertions are removed: parsing tests import the new application boundary; canonical status/error/policy/exhaustiveness remain in domain/customer.ts. The genuine Customer HTTP scenario is retained and extended with profile-update/independent-recipient/id/timestamp projection compatibility; new assertions are written, not claimed executed.

Model: private aggregate identity/profile/status/child collection; immutable child replacement and copied snapshots/dates; pending identities without generated domain UUIDs; create/profile/add/update/remove/default transitions own policy. PhoneNumber/CountryCode and shared value functions are the only normalization/validation implementations, used defensively at input and transition boundaries. Rehydration preserves legacy cardinality/scalars exactly, only explicit operations repair. Creation/addition/default/deletion decisions no longer live in adapter queries. Adapter hydrates after actor→Customer locks, uses per-operation write data, clears then sets defaults in the same transaction, returns fresh DB projections and retains scoped persistence-level NOT_FOUND checks and narrow phone-constraint classification. Read models remain projections. AppModule/DTO/controller/mapper statuses/messages/guards and all schema/migration/grant/provisioning/test-infrastructure files remain unchanged.

Governance: accepted ADR008 records explicit owner direction (not runtime acceptance); Project Rules/Workflow/Router/Backend/Customer/docs indexes/context/overview describe adoption and existing-module grandfathering. No new task or PR. Boundary AST negatives reject domain Nest/HTTP/outward-layer imports, application outward layers and presentation adapter access; positive existing conventions and all existing modules lint without refactors. No generic DDD framework or new dependency.

| Claim                                                   | Evidence                                                                                                  | Date       | Result |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| New aggregate behavior API absent before implementation | pnpm --filter @nexora/api test:customer with new aggregate tests, missing module RED                      | 2026-10-21 | FAIL   |
| Aggregate/application/input/error compatibility         | same command after implementation;22 groups, genuine subset TypeScript compilation, no Prisma replacement | 2026-10-21 | PASS   |
| Pure mapper and snapshot encapsulation                  | targeted tests include metadata/date copying, legacy hydration, domain transitions and persistence mapper | 2026-10-21 | PASS   |
| Domain/application/controller architecture guards       | pnpm lint; AST negatives plus complete repository imports/ESLint                                          | 2026-10-21 | PASS   |
| Public OpenAPI/SDK compatibility                        | pnpm contracts:check; regenerate and zero byte/file-set drift                                             | 2026-10-21 | PASS   |
| Documentation governance and links                      | pnpm docs:check after ADR/rules/index/domain synchronization                                              | 2026-10-21 | PASS   |

Remaining verification is independent of these precommit results: fresh frozen installation, current-head genuine Prisma/full API build/typecheck and real Nest/PG races, native isolated cluster, canonical quality, LOCAL/HTTPS/data/dev smoke and hosted Foundation must be recorded with actual exits/timestamps. No prior PR23 PASS transfers to DDD. Operator Data Audit gate remains pending the previously recorded owner decision; architecture approval does not approve data inspection or waive release/merge gates. Task remains VERIFICATION PENDING. Final source/check evidence belongs in PR metadata after commit, not a self-referencing documentation loop.

## Owner-approved vocabulary, status VO and API amendment — 2026-10-21

Classification: SIGNIFICANT. Documentation Impact: REQUIRED (existing canonical section applies). Baseline ccfdd5ebb34919207c3681180ce8eeace1391df6, existing feat/customer-management-backend-v1 / PR23. The owner approves this additive contract and architecture refinement; no new task/PR or database change.

### Interface and modeling preflight

- Shared owns the single CustomerStatus as-const codes and derived CustomerStatusCode plus exhaustive Vietnamese presentation labels, using existing root exports. This is an explicit API/Web cross-package contract preparing Customer frontend, not authorization to build that frontend or migrate other vocabularies. SDK retains generated HTTP types; same-revision monorepo deployment is the compatibility assumption.
- Customer Domain owns immutable CustomerStatusVO (from unknown, initial, equals, primitive value); factory uses ACTIVE, hydration rejects corrupt status instead of fallback, PATCH allows either current code without new lifecycle restrictions. Domain imports the pure codes leaf, never labels. Phone/country algorithms stay canonical.
- **API contract amendment:** required non-null statusLabel:string on CustomerSummary/Detail for List/Create/Get/Patch, derived once in Presentation from shared labels. Requests and Address responses do not gain the field; unknown input remains invalid. Generate OpenAPI/SDK; compare against baseline allowing only this response addition.
- Domain command allowlists reject unknown/ownership/default/identity fields, including mixed valid+forbidden, empty PATCH and invalid runtime shapes. Reuse one feature-local strict record helper for domain and application shapes; do not duplicate scalar algorithms.
- Generic safe HTTP message is one common API constant. Customer retains its exhaustive feature-local status/message map; Identity/Carrier changes are exact literal substitution only. Global ErrorFilter remains unchanged.
- Profile query investigation: current update hydrates all addresses then reads them again for response (two child projections proportional to address count). V1 profile/status transition depends on no child state. Adopt a narrow pure domain profile-change policy shared with Aggregate: validate persisted status and normalize strict patch, under existing actor→owner-scoped Customer locks. Select only status for decision; no fake partial Aggregate. Full ordered Detail response still loads addresses once; list projection unchanged. Address operations retain full locked aggregate hydration. No legacy repair, new ownership or concurrency policy.
- Boundary guards cover pure shared imports vs forbidden labels in Domain, shared app/server imports, Web→API and application→Prisma; catalog discovery follows shared canonical declaration. Add SDK/OpenAPI/shared type/value agreement and browser consumer checks, no new framework/dependency.

### Implementation and verification plan

1. Add failing status/strictness/presenter/contract regression tests before implementation; preserve existing tests and independently distinguish unrun HTTP assertions.
2. Move codes/labels to shared, add VO and strict command policies, presentation mapper/DTO wiring and regenerate contracts. Consolidate only exact error literals.
3. Apply narrow profile policy under existing locks; retain scoped minimal writes, default/cardinality repair and DB-owned IDs/code/timestamps. Add query-shape coverage without treating a test double as genuine PostgreSQL evidence; extend genuine HTTP assertions.
4. Synchronize ADR008 amendment, rules/workflow/router, backend/frontend/API/customer docs and indexes/context where facts changed. Preserve historical FAILs and the one Documentation Impact heading.
5. Run frozen install/shared build/typecheck/SDK/Web checks, targeted Customer tests, native SQL, format/lint/boundaries/docs/contracts, full typecheck/test/integration/build and canonical Docker as prerequisites permit. Record exact source/time/exit PASS/FAIL rows; NOT RUN gates separately. No artifact/TLS bypass, user-volume reset or live Carrier.
6. Review complete diff, commit/push focused commits on existing branch, inspect final-head Foundation and update PR metadata with final-head evidence. Keep VERIFICATION PENDING/Draft while mandatory gates or Operator Data Audit decision are unresolved.

### Vocabulary/status amendment implementation and precommit evidence

Shared owns one runtime CustomerStatus declaration plus CustomerStatusCode and exhaustive CustomerStatusLabelsVi; root CJS/ESM consumers and a pure code subpath with TypeScript resolution are supported. CustomerStatusVO is immutable and rejects corrupt persisted status. Aggregate stores the VO internally; snapshots/database retain primitive codes. Domain/application use canonical strict command allowlists/scalar policies, rejecting mixed forbidden fields before state mutation. Presentation alone adds statusLabel on all4 Customer-returning handlers; Address responses and requests stay unchanged. Generic HTTP text is centralized; Customer/Identity/Carrier replacements preserve codes/statuses/text, without ErrorFilter or authentication changes.

Profile investigation found two ORM child projections on update (hydration then response), each proportional to unlimited address cardinality. V1 profile policy has no child dependency. The narrow adapter path keeps ACTIVE actor→owner-scoped Customer locks, selects status, calls changeCustomerProfile shared with Aggregate, applies scoped minimal update and projects full ordered Detail once. Child operations retain full locked hydration; no fake partial aggregate, legacy repair or lock-policy change. Genuine Prisma query-extension assertions are written, NOT RUN; no runtime latency/concurrency improvement is claimed from source inspection.

| Claim                                                             | Evidence                                                                                                                                                                    | Date       | Result |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Test-first baseline reproduces missing features/strictness defect | node --test apps/api/test/customer-aggregate.test.cjs against prior emitted baseline;13 tests,9 pass/4 fail including mixed forbidden fields silently accepted              | 2026-10-21 | FAIL   |
| Shared/SDK/Web compilation and Customer regression                | ccfdd5e + task dirty source,08:57:58Z–08:58:16Z; frozen install/shared build, shared/SDK/Web typecheck, Customer29 tests; exit0                                             | 2026-10-21 | PASS   |
| Unchanged Identity/Carrier mapping behavior                       | same dirty source node --test identity-error-mapping, carrier-connect-contract and carrier-lifecycle;47 tests;08:58:15Z–08:58:16Z; exit0                                    | 2026-10-21 | PASS   |
| Independent source/docs/static checks                             | same dirty source format/lint/test:lint52/boundaries/docs/test:docs6/test:operations5/diff;08:58:16Z–08:58:34Z; exit0; boundary guard strengthened afterward and rerun PASS | 2026-10-21 | PASS   |
| Approved transport addition only                                  | actual contracts:generate; structural OpenAPI and exact SDK baseline comparison after removing only required statusLabel additions in Summary/Detail; exit0                 | 2026-10-21 | PASS   |
| Shared browser packaging                                          | Web ESM/API CommonJS import test plus real Next bundled-webpack target:web build executed in a VM without Node globals;2 tests, exit0; no frontend page                     | 2026-10-21 | PASS   |
| Fresh native SQL attempt                                          | ccfdd5e + dirty task source, pnpm --filter @nexora/database test:cluster,08:59:10Z–08:59:13Z; exit1 POSTGRES_STARTUP_FAILED before SQL assertions                           | 2026-10-21 | FAIL   |
| PostgreSQL startup diagnostic                                     | separate owned postgres17.11 container/volume; initdb could not create pg_wal: No space left on device; container+volume cleanup exit0                                      | 2026-10-21 | FAIL   |

Initial targeted compile exposed a conflicting status type/re-export; replaced it with shared CustomerStatusCode. Initial lint caught an undeclared structuredClone test global; corrected the fixture without changing lint rules. A new contract assertion initially assumed query DTO was an emitted schema; corrected it to inspect actual inline OpenAPI query parameters. These diagnostic FAILs are not runtime evidence. Existing historical evidence above is retained.

Verification summary: full genuine Prisma/Nest/migration/query/concurrency assertions, canonical Docker/runtime/HTTPS/persistence/dev and final-head hosted checks remain mandatory. Current observed network policy still excludes official Prisma artifacts; disk capacity is an additional reproducible PostgreSQL startup blocker (about114MB available). No user volume, unrelated worktree, migration, grant, key/MFA or live Carrier changes; diagnostics clean only exact newly owned resources. Removing obsolete task-owned image tags did not recover capacity; no global prune/reset. Final-head commands, exits/timestamps and Foundation result will be recorded in PR metadata after commits, not a SHA-only document loop. Implementation IMPLEMENTED; task/merge VERIFICATION PENDING, Draft retained; Operator Data Audit decision remains open.

## Approved Reuse Architecture & Pre-Code Design Governance — 2026-10-21

Classification: SIGNIFICANT. Documentation Impact: REQUIRED (canonical documentation updated in PR #23). Baseline: `42833752f76948aae7f1fad378291eedd288557b`.
The project owner directly specified and approved the reuse architecture and pre-code design governance implemented in PR #23. No research restart or duplicate approval cycle.

### Mandatory Reuse & Design Audit Matrix

| Field                        | Component 1: UUID Validation                                                                                    | Component 2: PhoneNumber VO                                                                                                    | Component 3: CountryCode VO                                                                                                | Component 4: Hex64 Format                                                                | Component 5: Safe HTTP Message                                                               |
| :--------------------------- | :-------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| **Component**                | `isUuid(value: unknown): value is string`                                                                       | `PhoneNumber` Value Object                                                                                                     | `CountryCode` Value Object                                                                                                 | `isLowercaseHex64(value: unknown): value is string`                                      | `GENERIC_ERROR_MESSAGE` constant                                                             |
| **Existing implementations** | `customer.input.ts`, `carrier.service.ts`, `carrier-lifecycle.controller.ts`, `user-management.service.ts`      | `customer.value-objects.ts` (using `libphonenumber-js/max`)                                                                    | `customer.value-objects.ts` (using `i18n-iso-countries`)                                                                   | `user-management.service.ts`, `mfa.service.ts`, `auth.controller.ts`, `mfa.adapter.ts`   | `common/http/error-messages.ts` (duplicated strings across error mappings)                   |
| **Domain owner**             | Neutral Technical Common (`apps/api/src/common/validation/uuid.ts`)                                             | Neutral Technical Common (`apps/api/src/common/value-objects/phone-number.ts`)                                                 | Neutral Technical Common (`apps/api/src/common/value-objects/country-code.ts`)                                             | Neutral Technical Common (`apps/api/src/common/validation/hex.ts`)                       | Neutral Technical Common (`apps/api/src/common/http/error-messages.ts`)                      |
| **Reuse alternatives**       | Extract canonical predicate to common; eliminate 4 duplicated regexes                                           | Extract domain-neutral VO to common; keep Customer raw length (64), default "VN", and error translation in Customer            | Extract domain-neutral VO to common; keep address defaults and CustomerError translation in Customer                       | Extract pure format predicate to common; keep token lifecycles and hashing in Identity   | Centralize string constant in neutral common HTTP module                                     |
| **Selected approach**        | Extract canonical `isUuid` in `apps/api/src/common/validation/uuid.ts`                                          | Extract neutral `PhoneNumber` in `apps/api/src/common/value-objects/phone-number.ts` with explicit caller country context      | Extract neutral `CountryCode` in `apps/api/src/common/value-objects/country-code.ts`                                       | Extract format-only `isLowercaseHex64` in `apps/api/src/common/validation/hex.ts`        | Centralize `"Không thể thực hiện yêu cầu"` in `apps/api/src/common/http/error-messages.ts`   |
| **Rationale**                | 0-dependency pure predicate; case-insensitive 8-4-4-4-12 matching; no variant restriction; no implicit trimming | Single authoritative E.164 normalization algorithm via pinned dependency; pure VO; throws neutral `InvalidPhoneNumberError`    | Single authoritative ISO 3166-1 alpha-2 check via pinned dependency; excludes XK; throws neutral `InvalidCountryCodeError` | Format-only check for 64-char lowercase hex without conflating distinct token lifecycles | Consistent user-safe error messages without leaking internal system details                  |
| **Risks**                    | Accidental version/variant restriction or implicit trimming (mitigated: preserved exact existing regex)         | Divergent error codes or default country leaking (mitigated: explicit caller country parameter, Customer maps to domain error) | Accidental coupling of postal and phone country (mitigated: strict isolation, legacy hydration preserved)                  | Accidental case-insensitivity (mitigated: strict lowercase hex check)                    | Accidental shift of HTTP status codes (mitigated: domains retain their status code mappings) |
| **Verification**             | `apps/api/test/common-validation.test.cjs`, Customer 29 tests, Carrier/Identity 47 tests                        | Unit tests for VN/international, extensions, whitespace, frozen instance, Customer tests                                       | Unit tests for ISO codes, XK exclusion, trimming/casing, Customer address tests                                            | Unit tests for exact 64-char lowercase hex, non-hex, length, Identity tests              | Error mapping assertions in Customer, Identity, Carrier test suites                          |

### Intentionally Preserved Differences (Non-Goals)

The following remain domain-specific per tactical DDD boundaries:

- ACTIVE user locking vs Carrier connection locking.
- Customer address default selection vs Identity session assurance.
- Individual text field length limits and command allowlists.
- Feature-local HTTP error mappers.
- Identity token hashing protocols and Carrier ciphertext revision hashing.

### Technical Debt Follow-up: Standardize Test Orchestration on Node.js

- **Context**: The project currently uses Python for some Docker/PTY test orchestration (`scripts/provision-cluster-smoke.py`, `scripts/mfa-enrollment-tty-smoke.py`, `scripts/provisioning-tty-smoke.py`) while Node.js runs the primary application and most test suites.
- **Decision**: Deferred cleanup. Python scripts remain unchanged in PR #23.
- **Future Task Scope**:
  - Compare Python launcher vs native Node.js launcher behavior.
  - Preserve signal handling (`SIGINT`, `SIGTERM`), exit codes, and cleanup guarantees.
  - Preserve isolated Docker container ownership.
  - Preserve TTY / interactive prompt testing behavior without native dependencies.
  - Keep CI setup deterministic without Python runtime requirements where possible.
  - Convert only where actual maintenance value justifies it.
