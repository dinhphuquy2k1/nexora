# NEXORA-019 — PR18 Runtime Database Privilege Isolation

- **Task ID**: `NEXORA-019`
- **Status**: `VERIFICATION PENDING`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `NOT VERIFIED`
- **Classification**: SIGNIFICANT
- **Branch**: `feat/uniship-carrier-integration`
- **Baseline**: `fb237f9f95efb9fe41a4262fcd6ace320595d3be`

## Scope and preflight

Remediate I1/M1 in existing PR18; do not create another PR or merge. Remote HEAD matches review, worktree clean, main96c2118f, Task019 unused. Read mandatory AI sequence, routed architecture/ADR/operations and historical Task018 evidence; preserve that record. Only role/credential isolation, executable security verification and conditional identifier contract are in scope. Carrier/Identity lifecycle/keyring/live gates remain intact. No Web/UI, worker, shipment sync or MFA.

## Plan and interface preflight

1. RED in an owned PostgreSQL17 container: bootstrap role is superuser and can bypass audit trigger via DDL. Add executable runtime-credential privilege/upgrade test and Uniship conditional-input/OpenAPI checks before changing behavior.
2. Preserve existing credentials/postgres/uploads volumes and admin password. Add runtime_credentials volume, CSPRNG postgres_app_password at /runtime-config, readable only in authorized mounts; init is idempotent and never rotates an existing secret. Dev init maps runtime-file ownership from a read-only checkout stat; release uses UID1000. API mounts runtime secret read-only, no admin mount/env; Web mounts neither.
3. Separate migration-entrypoint (admin) from api-entrypoint (nexora_app). A trusted one-shot db-runtime provisioning service follows schema migrations and precedes API. It alone mounts both credentials. Restricted role has no super/createdb/createrole/replication/bypassrls/memberships/ownership/DDL. Existing unsafe role conflict fails closed without deleting role/data. PostgreSQL schema/data/historical migrations remain unchanged.
4. Idempotent transactional provisioning via native pg driver (pin existing graph's pg8.23.1 directly). Explicit current table allowlist, no broad/default grants. Revoke public schema CREATE and database TEMP/CREATE; grant CONNECT/USAGE and required table DML. Audit INSERT plus SELECT(id) only; PostgresSecurityAudit.create returns id only. No mutation/TRIGGER/DDL/audit-function privileges. Password flows from file to in-memory SQL only, never arguments/logs/fixtures; session statement/error SQL logging disabled before password DDL, sanitized failures.
5. A profile-gated quality test runner, separate from API, may hold administrative credentials to create/drop owned test databases. Production API never receives them. Existing migration/integration fixtures use that isolated runner; a new real runtime-credential suite verifies role attributes, membership, full API business operations and denied audit/DDL/SET ROLE. Canonical smoke checks real container mounts/current_user and fresh/upgrade/restart/down-up preservation.
6. Clarify provider-conditional loginIdentifier: current Uniship request requires trimmed nonblank max128; future OAuth/API-key provider-specific schema may omit it. Keep DB nullable. No polymorphic framework. Regenerate contracts only for truthful schema description change.
7. Synchronize canonical docs and dated ADR clarification, review diff, run pinned/frozen checks plus all4 canonical Docker scripts/current-head CI. Commit/push same branch and update PR18; no force/rebase/merge.

## Runtime grants inventory

- users: SELECT/INSERT/UPDATE (local provisioning and management).
- user_credentials: SELECT/INSERT (Scrypt verification/setup/provisioning).
- sessions: SELECT/INSERT/DELETE (issue/validate/revoke/expiry).
- operator_setup_tokens: SELECT/INSERT/UPDATE (issue/consume/invalidate).
- carrier_connections, carrier_connection_secrets: SELECT/INSERT/UPDATE/DELETE.
- carrier_user_states: SELECT/INSERT/UPDATE (epoch/upsert).
- stored_files: SELECT/INSERT (catalog; storage failure cleanup removes files, not SQL rows).
- security_audit_events: INSERT, SELECT(id) for Prisma RETURNING only.
- No \_prisma_migrations, sequence, schema CREATE, database TEMP/CREATE, function ownership or role elevation grants.

## PLAN ISSUES

None for the requested separation contract. Existing unsafe role/ownership collision must stop provisioning with safe recovery guidance, not silently alter unrelated objects. UNISHIP_LIVE_AUTHORIZATION remains OPEN from Task018; external requests stay hard-closed.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Admin/runtime roles and secret mounts, migration/provision/runtime startup order, isolated test runner, audit privilege boundary and conditional identifier semantics.

### Canonical owners

- docs/architecture/database.md
- docs/architecture/runtime.md
- docs/architecture/backend.md
- docs/architecture/api-contract.md
- docs/operations/setup.md
- docs/operations/configuration.md
- docs/operations/deployment.md
- docs/operations/testing.md
- docs/decisions/multi-carrier-architecture.md (dated clarification)

### Documentation verification

pnpm docs:check, format:check, contracts:check; real Compose mount/startup checks and full canonical Docker CI. Do not rewrite historical Task018 evidence or claim WORM/cryptographic immutability.

## Evidence

| Claim                              | Evidence                                                                                                              | Date       | Result |
| :--------------------------------- | :-------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Review baseline and clean worktree | git fetch origin; HEAD and origin/feat/uniship-carrier-integration equal fb237f9f; PR18 open/unmerged; Task019 unused | 2026-10-16 | PASS   |

| I1 RED reproduction | python3 /workspace/work/pr19-red.py: owned PostgreSQL17 applies real SQL migration files; nexora current role rolsuper=true and DISABLE/DROP audit trigger succeeds; not Prisma history evidence | 2026-10-16 | FAIL |
| M1 RED contract | node --test apps/api/test/carrier-connect-contract.test.cjs: missing/blank/unknown/extra inputs rejected correctly and valid input reaches provider port; generated Uniship conditional description missing | 2026-10-16 | FAIL |

| Native PostgreSQL17 runtime boundary | Actual SCRAM nexora_app connection, audit INSERT RETURNING(id), denied mutation/DDL/SET ROLE, enabled trigger, wrong-password28P01, repeated provisioning; owned SQL-only probe, not Prisma migration evidence | 2026-10-16 | PASS |
| Host frozen install | pnpm10.34.6 install --frozen-lockfile, all7 workspaces | 2026-10-16 | PASS |
| Host genuine Prisma engine | prisma generate --config prisma.config.ts blocked by binaries.prisma.sh checksum HTTP403; no checksum bypass, fake client/history or db push | 2026-10-16 | FAIL |
| Uniship conditional contract | Emitted-JS controller unit missing/blank/unknown/extra rejection, valid flow, required OpenAPI plus nullable metadata | 2026-10-16 | PASS |
| Static checks | pnpm lint, test:lint50 tests, docs:check, format:check; shell/JS/Python syntax and git diff --check | 2026-10-16 | PASS |
| Contracts regeneration | contracts:generate succeeds reproducibly; contracts:check precommit detects expected uncommitted OpenAPI/SDK description updates; repeat after commit required | 2026-10-16 | FAIL |

## Verification still required

Exact-head full Foundation CI must pass genuine Prisma generation/migrations, full quality and all four canonical Docker scripts, including the new real runtime-credential Carrier integration, actual mount/role checks and retained data/secret comparisons. No completion claim is made from native SQL-only probe or emitted-JS tests. Task018 CI is historical evidence only. No provider live call, volume reset or admin fallback is authorized for verification.
