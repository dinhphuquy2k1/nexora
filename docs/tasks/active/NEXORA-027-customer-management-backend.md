# NEXORA-027 — Customer Management Backend V1

Task: VERIFICATION PENDING
Implementation: IMPLEMENTED
Verification: PARTIALLY VERIFIED
Classification: SIGNIFICANT

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
