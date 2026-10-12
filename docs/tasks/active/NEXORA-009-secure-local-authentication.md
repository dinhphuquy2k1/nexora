# Task: NEXORA-009 — Secure Local Authentication & Login UI

- **Task ID**: `NEXORA-009`
- **Status**: `VERIFICATION PENDING`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `PARTIALLY VERIFIED`

---

## 1. Provenance & Starting Baseline

- **Repository**: `https://github.com/dinhphuquy2k1/nexora`
- **Starting Main SHA**: `7cfb01a5756c6787d00cbb940bd406a0157bf5b7` (PR #5 merged into `main`)
- **Working Branch**: `feat/local-authentication`
- **Task Classification**: `SIGNIFICANT` (Security-sensitive, database schema addition, cross-cutting auth)

---

## 2. Objective & Scope

Implement real Nexora local user authentication preserving the local-first, single-instance architecture:

1. **Architecture Pre-flight & ADR Authorization**: Supersede ADR-005 (which deferred authentication) with an accepted local authentication architecture decision.
2. **Database Schema & Migrations**: Add `local_users` and `sessions` tables in `@nexora/database` with explicit Prisma migration `20261012000000_local_authentication`.
3. **Backend Identity Module**: Implement password verification, session token generation/hashing, login rate limiting, and NestJS authentication guards.
4. **First Account Provisioning**: Provide an operator CLI command (`node scripts/user-create.mjs` / `pnpm user:create`) prompting for username/password without echo; no default credentials or public bootstrap endpoints.
5. **Login UI & Layout Separation**: Create `(auth)/login` page matching the approved visual reference with password show/hide toggle and truthful error states; separate authenticated AppShell layout `(workspace)`.
6. **AccountMenu Integration**: Replace unavailable state in `AccountMenu` with active session display and working logout action.
7. **End-to-end Protection**: Protect business routes and internal APIs; keep `/api/health/live` and `/api/health/ready` unauthenticated.

---

## 3. Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- Supersede ADR-005: Authorize local user authentication, PostgreSQL session storage, and HTTP-only cookie transport.
- Update `docs/architecture/backend.md`: Add Identity module, session guard, login throttling, and error codes (`401 UNAUTHORIZED`, `429 TOO_MANY_REQUESTS`).
- Update `docs/architecture/database.md`: Document `local_users` and `sessions` schema.
- Update `docs/architecture/frontend.md`: Document `(auth)` vs `(workspace)` layout separation, login form tokens, and session flow.
- Update `docs/architecture/api-contract.md`: Document `/api/auth/login`, `/api/auth/session`, and `/api/auth/logout`.
- Update `docs/operations/setup.md` & `docs/operations/configuration.md`: Document operator account provisioning command.

### Canonical owners

- `docs/decisions/authentication.md`
- `docs/architecture/backend.md`
- `docs/architecture/database.md`
- `docs/architecture/frontend.md`
- `docs/architecture/api-contract.md`
- `docs/operations/setup.md`

### Documentation verification

- `pnpm docs:check`

---

## 4. Evidence

| Claim                                                            | Evidence                                                    | Date       | Result |
| :--------------------------------------------------------------- | :---------------------------------------------------------- | :--------- | :----- |
| Starting baseline confirmed on main with PR #5 merged            | `git rev-parse HEAD` (`7cfb01a`)                            | 2026-10-11 | PASS   |
| Password hashing with Scrypt and unique salts passes             | `pnpm --filter @nexora/database test` (2 tests passing)     | 2026-10-11 | PASS   |
| Backend identity module, global guard, and OriginGuard pass      | `pnpm --filter @nexora/api test` (11 tests passing)         | 2026-10-12 | PASS   |
| Web auth sanitization, host allowlist, and navigation pass       | `pnpm --filter @nexora/web test` (15 tests passing)         | 2026-10-12 | PASS   |
| Workspace TypeScript compilation passes across all packages      | `pnpm typecheck` (10 tasks successful)                      | 2026-10-12 | PASS   |
| Architectural boundary rules and ESLint pass                     | `pnpm lint` (`boundaries.mjs` + `eslint .`)                 | 2026-10-12 | PASS   |
| Prettier formatting check passes across entire repository        | `pnpm format:check`                                         | 2026-10-12 | PASS   |
| Documentation links and governance pass                          | `pnpm docs:check`                                           | 2026-10-12 | PASS   |
| Next.js production build prerenders `/login` and all routes      | `pnpm --filter @nexora/web build` (prerenders all 6 routes) | 2026-10-11 | PASS   |
| Monorepo turbo build and test suite pass                         | `pnpm test` (all 8 tasks pass)                              | 2026-10-11 | PASS   |
| Hosted Docker CI quality and integration passes on final PR HEAD | GitHub Actions run `38188392464` (`docker-foundation`)      | 2026-10-12 | PASS   |

---

## 5. Verification Gaps & Pre-Merge State

- **Hosted CI on PR HEAD & Merge Commit**: Hosted GitHub Actions run (`docker-foundation`) on the PR HEAD and the eventual `main` merge commit cannot be executed or collected until the PR is submitted and merged.
- **Task Lifecycle Decision**: The task remains `VERIFICATION PENDING` in `docs/tasks/active/` during the PR lifecycle. Transition to `docs/tasks/completed/` will occur in a post-merge documentation follow-up following merge-commit CI inspection.

## 6. PR #7 HTTP ErrorFilter Maintainability Follow-up

- Classification: `BOUNDED`.
- Starting branch: `feat/local-authentication`.
- Starting PR HEAD: `9c1fef1e4d7470ecf17aa5e71a508622512cdcb8`, confirmed against both remote branch and PR #7 ref before editing.
- Follow-up Documentation Impact: NONE. This refactor changes only internal default lookup; no canonical API, architecture, configuration, or runtime fact changes. The parent authentication task retains its REQUIRED impact and existing lifecycle status.
- Plan: characterize the registered filter first, replace duplicated status branches with a module-local readonly typed lookup, rerun targeted checks and review contract drift.
- Inspected: mandatory AI documents, backend/API contract/testing documentation, ADR-004, this task, HTTP configuration, API unit/auth/integration tests, generated SDK error DTO, and web login/session consumers.
- Changes: `apps/api/src/http.ts`, `apps/api/test/http.test.cjs`, and API test script. Code/message defaults share one status lookup with an internal-error fallback; custom code detection is evaluated once.
- Compatibility: preserve 400/401/403/404/429 defaults, string-only custom codes, messages overridden only with both string fields except 404, actual unknown statuses, safe unexpected errors, and exact code/message/requestId body. HTTP middleware, logging, proxy, Swagger, guards, and authentication modules are unchanged.
- Test-first evidence: all 27 API tests passed before changing `http.ts`, including 16 new characterization cases using the actual filter captured through `configure()`; the same suite passed after the refactor. Every case checks exact status/body using two distinct request IDs.
- Tooling: commands below use `npm exec --yes --package=pnpm@10.34.6 -- pnpm ...` to select the repository-pinned pnpm; the environment default pnpm 11.19.0 is incompatible.

| Claim                                                                  | Evidence                                                                                                                                        | Date       | Result |
| :--------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Frozen dependencies installed                                          | `pnpm install --frozen-lockfile` with pinned pnpm                                                                                               | 2026-10-12 | PASS   |
| API compilation passes                                                 | `pnpm --filter @nexora/api build`                                                                                                               | 2026-10-12 | PASS   |
| Existing and characterization API tests pass before and after refactor | `pnpm --filter @nexora/api test` (27/27)                                                                                                        | 2026-10-12 | PASS   |
| Documentation validator regression tests pass                          | `pnpm test:docs` (6/6)                                                                                                                          | 2026-10-12 | PASS   |
| API typecheck passes                                                   | `pnpm --filter @nexora/api typecheck`                                                                                                           | 2026-10-12 | PASS   |
| Architectural boundaries and ESLint pass                               | `pnpm lint`                                                                                                                                     | 2026-10-12 | PASS   |
| Repository formatting passes                                           | `pnpm format:check`                                                                                                                             | 2026-10-12 | PASS   |
| OpenAPI and SDK remain reproducible without drift                      | `pnpm contracts:check`                                                                                                                          | 2026-10-12 | PASS   |
| Documentation governance and links pass                                | `pnpm docs:check`                                                                                                                               | 2026-10-12 | PASS   |
| Full dependency build blocked by environment                           | `pnpm --filter @nexora/api... build`: Prisma engine checksum download receives HTTP 403 from `binaries.prisma.sh`                               | 2026-10-12 | FAIL   |
| Canonical Docker quality blocked by environment                        | `NEXORA_COMPOSE_OVERRIDE=/workspace/work/nexora-cloud-override.yml sh scripts/quality-docker.sh`: Prisma engine HTTP 403 during migration build | 2026-10-12 | FAIL   |

Canonical Docker verification was attempted with `sh scripts/quality-docker.sh`: the first run failed with `SELF_SIGNED_CERT_IN_CHAIN`. Retrying with `NEXORA_COMPOSE_OVERRIDE=/workspace/work/nexora-cloud-override.yml sh scripts/quality-docker.sh` supplied the session CA through the existing build secret and resolved certificate validation, but the migration build was blocked by the same Prisma engine HTTP 403. The override/log remain outside the repository; no Docker files were modified. Full quality, migrated integration, runtime/data/dev smoke, and hosted CI on the new HEAD remain unverified. Verification commands were executed on 2026-10-12 (Asia/Saigon). GitHub CI inspection via `gh pr view 7 --repo dinhphuquy2k1/nexora --json headRefName,headRefOid,statusCheckRollup` receives HTTP 403 from the GitHub API. No merge is performed and no prior hosted-CI evidence is attributed to this follow-up.

## 7. Final Authentication Security Hardening Plan

- Classification: SIGNIFICANT. Starting HEAD: `cd3234531e67da8e43a060ea0b8c6b3c245f268c`, confirmed against branch and PR refs on 2026-10-12.
- Documentation Impact: REQUIRED (extends the existing parent declaration). Canonical owners: authentication ADR; overview/backend/frontend/API contract/runtime; configuration/setup/testing.
- Pre-flight: B1-B6, H1-H2 are CONFIRMED by current implementation inspection; B7 raw forwarded-header trust is CONFIRMED. Existing global SessionGuard, Host matcher covering API, opaque hashed sessions, status-aware AccountMenu, ErrorFilter and shared server API configuration are FIXED and preserved. Hosted CI/review threads are NOT VERIFIED: GitHub API access returns HTTP 403.
- Mutation inventory: LoginForm and AccountMenu issue browser-originated relative POST requests; the server session helper issues GET only. No Server Actions or server-originated authentication mutations exist.
- Identity contract: PostgreSQL username uniqueness and lookup are case-sensitive. Retain case sensitivity, trim the operator/UI username consistently, reject invalid lengths/types before keys or database access. Provisioning retains minimum 8-character passwords; Login rejects empty or over-limit strings without changing existing short-password credential verification.
- Origin contract: strict serialized HTTP(S) origins, scheme/hostname/effective port equality; default loopback origins derive from the supported WEB_PORT binding; explicit ALLOWED_ORIGINS replaces defaults and is validated at startup. Forward WEB_PORT into API configuration so changing its supported port preserves Login. Internal POST without Origin remains forbidden.
- Cookie contract: canonical deployment is loopback HTTP; session and clearing cookies use HttpOnly, SameSite=Lax, Path=/, Secure=false independent of raw forwarded headers. HTTPS/LAN redesign remains outside scope.
- CLI ownership: compiled API CLI delegates database creation/hashing to an identity infrastructure provisioner; raw terminal input has one reader with guaranteed cleanup. Keep explicit password-stdin and never accept password arguments.
- Admission contract: case-sensitive per-account five-failure/five-minute counters with a fixed cap; reserve entries and global tokens synchronously before asynchronous lookup/Scrypt; prune expired entries, evict only oldest non-locked/non-pending entries, reject saturation. Document conservative global burst/refill limits for a small local operator instance.
- Sequence: add failing boundary tests; implement B1-B7; package secure CLI and H1/H2; extend real runtime smoke with CLI, TTY, expiry/outage and browser-form tests; synchronize owners; targeted checks then quality/Docker and final diff review; commit/push the existing branch without merging.
- Runtime verification: isolated disposable Compose projects only, compiled non-root image and entrypoint, no host API/database publication. Do not delete operator volumes. Current Prisma engine downloads and GitHub API are blocked; report actual gaps if they remain blocked.

## 8. Final Hardening Results and Merge Gate

Recorded at 2026-10-12T09:34:07+07:00 (Asia/Saigon). Task remains VERIFICATION PENDING; the parent authentication implementation and prior historical evidence are preserved.

| ID  | Current classification | Root cause and fix                                                                                                                                                                              | Verification evidence                                                                                                                                                   |
| :-- | :--------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | FIXED                  | Hostname-only Origin check replaced with strict origin normalization/comparison, validated startup policy and WEB_PORT-derived defaults. Host ingress and browser POST transport are preserved. | Unit/config and real Nest HTTP tests pass; actual browser form on changed port 3101 passes with an isolated in-memory identity port. Docker proxy test remains pending. |
| B2  | NOT VERIFIED           | Repository CLI omitted from runtime; compiled API CLI delegates to identity infrastructure, included by existing dist packaging.                                                                | API build and provisioner unit tests pass. Non-root image/entrypoint/database execution is blocked before migration build completes.                                    |
| B3  | FIXED                  | Competing readline renderer removed; one raw reader guarantees hidden confirmation, backspace and cleanup.                                                                                      | Unit tests and actual compiled host CLI pseudo-TTY pass; database factory mocked. Container pseudo-TTY remains pending.                                                 |
| B4  | FIXED                  | Catch-all deletion replaced by idempotent deleteMany; errors propagate and prevent cookie clearing/success.                                                                                     | Adapter/controller unit and Nest HTTP 500 tests pass. Real PostgreSQL revocation/outage tests added but not executed locally.                                           |
| B5  | FIXED                  | Unknown credential types validated before keys/database/Scrypt; consistent trimming, case-sensitive usernames and limits.                                                                       | Unit and real HTTP invalid-body cases pass; provisioning uses the same username rules without identity migration.                                                       |
| B6  | FIXED                  | Malformed HTTP 200 payload no longer yields a fake authenticated identity.                                                                                                                      | Web response matrix passes for valid/invalid JSON, missing user/fields, false authenticated, 401/500/network failure.                                                   |
| B7  | FIXED                  | Raw forwarded headers/request security removed as cookie policy input for canonical loopback HTTP.                                                                                              | Controller cookie/clearing assertions pass; Docker forwarding probe added.                                                                                              |
| H1  | FIXED                  | Invalid dummy hash replaced by one generated with existing hashPassword.                                                                                                                        | Real verifier plus Scrypt call spy prove work for unknown/inactive users; no timing-only assertion.                                                                     |
| H2  | FIXED                  | Unbounded/IP-dependent counters replaced by 128 account slots plus burst-10/1-per-second global admission and four concurrent reservations.                                                     | Rotation, concurrency, full/locked/pending cache, expiry, successful counter reset and failure cleanup pass.                                                            |
| H3  | NOT VERIFIED           | Mandatory negative/runtime/TTY/browser scenarios now wired into existing quality/runtime CI.                                                                                                    | 48 API, 16 Web, 2 password tests pass; host browser/TTY pass with explicit fixture limitations. Docker/hosted execution remains blocked.                                |
| H4  | NOT VERIFIED           | Runtime smoke now executes real packaged password-stdin CLI and checks duplicates before authentication.                                                                                        | Smoke script implemented; fresh-install execution cannot pass the Prisma engine download gate in this environment.                                                      |

### Evidence

Commands using pnpm select `npm exec --yes --package=pnpm@10.34.6 -- pnpm ...`. Executed logs are retained under `/workspace/work/nexora-hardening-*.log`; external fixtures/CA overrides stay outside Git. Unit database-factory mocks never stand in for PostgreSQL integration evidence.

| Claim                                                                                        | Evidence                                                                                                                                                                                                                              | Date       | Result |
| :------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------- | :----- |
| New boundary tests reproduce defects before fixes                                            | API/Web characterization runs failed on wrong-port Origin, credential types, case counters, forwarded cookie policy and malformed HTTP 200 session; original admission test failed rotating-user budget                               | 2026-10-12 | PASS   |
| API and compiled CLI build                                                                   | `pnpm --filter @nexora/api build`                                                                                                                                                                                                     | 2026-10-12 | PASS   |
| API/HTTP/CLI/admission/hash regressions                                                      | `pnpm --filter @nexora/api test` (48/48)                                                                                                                                                                                              | 2026-10-12 | PASS   |
| Web regressions                                                                              | `pnpm --filter @nexora/web test` (16/16)                                                                                                                                                                                              | 2026-10-12 | PASS   |
| Real password hashing tests independent of Prisma generation                                 | `pnpm --filter @nexora/database test` (2/2)                                                                                                                                                                                           | 2026-10-12 | PASS   |
| API typecheck                                                                                | `pnpm --filter @nexora/api typecheck`                                                                                                                                                                                                 | 2026-10-12 | PASS   |
| Web production build with explicit upstream                                                  | `API_INTERNAL_URL=http://127.0.0.1:4400 pnpm --filter @nexora/web build`                                                                                                                                                              | 2026-10-12 | PASS   |
| Web typecheck                                                                                | `pnpm --filter @nexora/web typecheck`                                                                                                                                                                                                 | 2026-10-12 | PASS   |
| Architectural boundaries/ESLint                                                              | `pnpm lint`                                                                                                                                                                                                                           | 2026-10-12 | PASS   |
| Repository formatting                                                                        | `pnpm format:check`                                                                                                                                                                                                                   | 2026-10-12 | PASS   |
| Canonical docs/governance                                                                    | `pnpm docs:check`                                                                                                                                                                                                                     | 2026-10-12 | PASS   |
| Documentation validator regression tests                                                     | `pnpm test:docs` (6/6)                                                                                                                                                                                                                | 2026-10-12 | PASS   |
| API/SDK schema drift remains zero                                                            | `pnpm contracts:check`                                                                                                                                                                                                                | 2026-10-12 | PASS   |
| Actual browser form Login/cookie/protected navigation/session/Logout on changed port         | Credential stdin piped to `node scripts/browser-login-smoke.mjs` at `http://127.0.0.1:3101`; production Web build and real Nest controller/service/guards with isolated in-memory identity port                                       | 2026-10-12 | PASS   |
| Actual compiled host CLI hidden-input/confirmation/backspace/cancel/EOF/terminal restoration | Python PTY harness `exercise()` against `node dist/cli/user-create.js`, with external database-factory preload and real hashPassword                                                                                                  | 2026-10-12 | PASS   |
| Full workspace typecheck and quality cannot complete dependency generation                   | `pnpm typecheck`; `API_INTERNAL_URL=http://api:4000 pnpm quality`: required Prisma engine download blocked (403 in Docker; EAI_AGAIN in host quality); initial unconfigured host run also correctly rejected missing API_INTERNAL_URL | 2026-10-12 | FAIL   |
| Canonical Docker quality blocked before migrated integration                                 | `COMPOSE_PROJECT_NAME=nexora-hardening-quality NEXORA_COMPOSE_OVERRIDE=/workspace/work/nexora-hardening-quality.yml sh scripts/quality-docker.sh`: schema-engine checksum HTTP 403                                                    | 2026-10-12 | FAIL   |
| Disposable release runtime smoke blocked before fresh-install/TTY/browser probes             | `NEXORA_COMPOSE_OVERRIDE=/workspace/work/nexora-hardening-runtime.yml sh scripts/runtime-smoke.sh`: migration build engine HTTP 403                                                                                                   | 2026-10-12 | FAIL   |

### Verification gaps and review outcomes

- NOT RUN: migrated PostgreSQL integration (including new idempotent revocation test), real fresh-install CLI creation/duplicates, non-root compiled image CLI execution, container pseudo-TTY, Docker browser Login, persisted/expired DB sessions and database-outage/logout recovery. Docker stops before these checks; host fixtures do not satisfy these merge conditions.
- NOT RUN: `sh scripts/data-smoke.sh` and `sh scripts/dev-smoke.sh`; the shared required image generation is blocked. Existing CI still runs these and all new runtime checks.
- NOT VERIFIED: hosted CI on final HEAD and outstanding review threads. `gh pr view 7 --repo dinhphuquy2k1/nexora --json headRefOid,statusCheckRollup,reviews` receives GitHub GraphQL HTTP 403. The supplied historical run 38191879187 is not attributed to changed code. No review-thread resolution or merge is claimed.
- Known supplied findings are mapped above: B1/B3-B7/H1-H2 are FIXED in implementation with bounded evidence; B2/H3/H4 remain NOT VERIFIED as acceptance gates. No mandatory blocker is deferred.
- Setup's corrected runtime invocation is explicitly marked VERIFICATION PENDING rather than presented as a tested operator command. Expected API path is `/app/dist/cli/user-create.js`, image `nexora-api:0.1.0`, entrypoint `/scripts/api-entrypoint.sh`; runtime verification remains required.
- Preserved: no API/PostgreSQL published ports, existing named volumes/BuildKit/frozen installs/non-root production identity, Login design, shared API configuration, sanitized HTTP logging/request IDs, ErrorFilter and OpenAPI/SDK schemas. Disposable scripts clean only their own project; no operator volumes were reset.

### Follow-up register

- Additional OpenAPI error-response schemas: DEFERRED; no DTO/schema change or immediate consumer breakage is required here. Future contract task may add explicit response schemas and consumer tests.
- Browser E2E beyond required Login/session/Logout: DEFERRED; focused browser transport is covered, wider UI scenarios belong to a later test task.
- HTTPS/LAN and account-management features: DEFERRED outside the approved loopback/single-instance scope; transport/RBAC/recovery require separate architecture decisions. No exposure or workaround is introduced.

Final conclusion: VERIFICATION PENDING. Push this focused change for final hosted CI and runtime review; do not merge automatically.

## 9. Runtime Smoke and Secure Restore Remediation Plan

- Classification: SIGNIFICANT; Starting HEAD `043090baaca6351759f193bdc24c792070dcb70a`, confirmed against remote branch/PR refs.
- Documentation Impact: REQUIRED. Primary owner: backup-restore operations; related database/runtime/authentication ADR/testing and this task. Origin/Host policy and authentication implementations remain unchanged unless a new reproduced application defect requires otherwise.
- R1 pre-flight: current smoke uses fetch to forge Host. An executed Node 24 probe observes 200 with fetch but 400 with node:http for the identical requested untrusted Host, indicating a test transport defect. Add stable sanitized step/status diagnostics, reproduce through actual Web ingress, then make the smallest harness fix. The first failing Docker assertion remains unverified locally until the image download gate is passed; hosted log inspection returns HTTP 403.
- R2 pre-flight: backups are full PostgreSQL custom dumps and contain operator identities/password hashes/session rows when auth exists. Restore currently verifies manifests/new-project guards and restores dump/uploads only; old sessions may reappear. Required order: verified manifest → fresh target PostgreSQL → pg_restore → existing migrate service → invalidate all sessions in target → uploads/permissions → integrity verification → success. API/Web must stay stopped until completion. Failures exit nonzero, preserve partial target for diagnosis and do not alter source volumes.
- Historical compatibility: inspect genuine pre-authentication main history/schema/migration files first. Construct the legacy fixture with that committed migration and Prisma deploy metadata from a filtered migration image, not a current DB with empty auth tables. Restore then runs current committed migrations without changing checksums or manufacturing migration records.
- Plan: tests for diagnostics/Host transport and fail-closed restore ordering/guards; isolated current/legacy data smoke using real CLI/API/operator scripts; canonical doc sync; targeted tests then Docker quality/runtime/data/dev smoke; final diff and branch push; no automatic merge or evidence-only CI commit loop.

## 10. Runtime/Restore Remediation Results

Recorded at 2026-10-12T10:57:00+07:00 (Asia/Saigon), starting HEAD `043090baaca6351759f193bdc24c792070dcb70a`. This pass changes only smoke/backup/restore orchestration, directly related tests, historical fixture and canonical docs. Production authentication, Host/Origin policies, rate limits, compiled provisioning/terminal reader, ErrorFilter, API DTOs and committed migration files are unchanged.

### R1 root-cause checkpoint

| Field       | Observation                                                                                                                                                                                                                                                                                                                                                         |
| :---------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Failed step | HOST_REJECTION                                                                                                                                                                                                                                                                                                                                                      |
| Expected    | Exact HTTP 400 when an untrusted Host reaches Web middleware                                                                                                                                                                                                                                                                                                        |
| Actual      | HTTP 200 with the original Node 24 fetch probe; raw node:http with the same header returns 400                                                                                                                                                                                                                                                                      |
| Evidence    | `WEB_PORT=127.0.0.1:3101 node scripts/auth-runtime-smoke.mjs`, production Web build and real Nest/health/controller/guard code with isolated memory identity fixture; `/workspace/work/nexora-r1-before.log` records step/expected/actual safely                                                                                                                    |
| Root cause  | CONFIRMED harness transport defect: Node 24 fetch rewrites Host, so the negative test sent an allowed Host. No application Host/Origin defect was reproduced. The exact historical hosted log remains inaccessible.                                                                                                                                                 |
| Fix         | Use bounded raw node:http only for the Host-negative probe; retain exact 400 assertion. Add stable steps, expected/actual statuses and allowlisted failure categories without raw errors/payloads/secrets. Internal POST captures only numeric HTTP status for exact 403. Browser smoke gets safe launch/CDP/form/response/navigation/cookie/session/logout stages. |
| Regression  | Raw Host transport test verifies actual received header/400; diagnostics tests verify reset and secret/payload suppression. Updated host HTTP smoke passes Host/session/Origin negatives then correctly stops at ORIGIN_INTERNAL_POST/DOCKER_FAILURE because no Docker API exists.                                                                                  |

R1 actual browser Login executed successfully on the production Web build and real Nest authentication code at port 3101, with an explicitly isolated in-memory identity port (not PostgreSQL). It submitted the real form, received 200/HttpOnly cookie, navigated to settings, validated session and logged out. An earlier host browser attempt failed before stage diagnostics; the failure was not reproduced after adding diagnostics, so no speculative authentication or timeout change was made. Full Docker HTTP/restart/outage/browser verification remains mandatory and pending.

### R2 implementation and compatibility

- Restore remains new-project-only with unchanged default/container/volume guards and manifest/checksum/UUID archive/link validation. No overwrite/reset switch or migration/checksum change is introduced.
- Database dump restoration precedes the existing migrate service; only then `DELETE FROM public.sessions` invalidates every restored session in that target. Zero rows succeeds; migration/invalidation failure exits nonzero before uploads or readiness. API/Web are never launched by restore.
- Upload restoration/ownership is followed by a non-root, non-listening runtime integrity command checking every cataloged file's bytes/size/SHA-256 and empty session set. Failure retains a partial isolated target, does not claim atomicity/readiness, and leaves source resources untouched.
- Current recovery smoke backs up multiple real sessions, revokes one at source, and requires exact 401 UNAUTHORIZED for both old cookies at the restored endpoint. It checks preserved account identity/credentials via real Login and protects additional live source sessions/counts from accidental cross-project invalidation.
- Legacy fixture files are byte-for-byte copies from pre-authentication commit `7cfb01a5756c6787d00cbb940bd406a0157bf5b7`, with recorded hashes. The existing Prisma runner deploys only that historical storage migration into a separate disposable DB, creating genuine migration metadata. Smoke requires no auth tables and exactly one deployed migration before backup. Current restore then requires two migrations, zero accounts/sessions, intact legacy original bytes and first-account CLI/Login recovery. No fake migration records or current empty-auth-schema substitute is used.
- Existing persistence/restart/down-up/catalog/file SHA/corruption/no-overwrite data smoke assertions remain. All source/restored/legacy projects are independently disposable; backup/restore accept the existing cloud override. Backups use private umask/manifest modes and remain format-1 compatible; encryption remains an operator/environment responsibility.

### Evidence

All pnpm commands select the pinned tool with `npm exec --yes --package=pnpm@10.34.6 --`. Logs remain outside Git under `/workspace/work/nexora-r1-*` and `/workspace/work/nexora-r2-*`.

| Claim                                                                                 | Evidence                                                                                                                                                                       | Date       | Result |
| :------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Original harness failure reproduced through actual Web ingress                        | Original Host fetch probe at port 3101 reports HOST_REJECTION expected 400/actual 200; separate raw HTTP reaches ingress and receives 400                                      | 2026-10-12 | PASS   |
| Restore tests detect missing migration/invalidation/integrity behavior before changes | `node --test scripts/restore.test.mjs` against original restore: order and fail-closed assertions fail as expected                                                             | 2026-10-12 | PASS   |
| Host/diagnostic/restore-order/failure/overwrite/container guards                      | `pnpm test:operations` (12/12), included in existing quality                                                                                                                   | 2026-10-12 | PASS   |
| Authentication regression/config cases                                                | `pnpm --filter @nexora/api test` (49/49)                                                                                                                                       | 2026-10-12 | PASS   |
| Web regressions                                                                       | `pnpm --filter @nexora/web test` (16/16)                                                                                                                                       | 2026-10-12 | PASS   |
| Password hashing regressions                                                          | `pnpm --filter @nexora/database test` (2/2)                                                                                                                                    | 2026-10-12 | PASS   |
| API typecheck                                                                         | `pnpm --filter @nexora/api typecheck`                                                                                                                                          | 2026-10-12 | PASS   |
| Exact legacy fixture provenance                                                       | Byte/hash comparison against `git show 7cfb01a:packages/database/prisma/...` for schema, SQL and migration lock                                                                | 2026-10-12 | PASS   |
| Architectural boundaries and ESLint                                                   | `pnpm lint`                                                                                                                                                                    | 2026-10-12 | PASS   |
| Repository formatting                                                                 | `pnpm format:check`                                                                                                                                                            | 2026-10-12 | PASS   |
| API/SDK contracts remain reproducible                                                 | `pnpm contracts:check`                                                                                                                                                         | 2026-10-12 | PASS   |
| Canonical documentation validation                                                    | `pnpm docs:check`                                                                                                                                                              | 2026-10-12 | PASS   |
| Actual browser form/cookie/navigation/session/logout                                  | Credential stdin to `node scripts/browser-login-smoke.mjs` at port 3101; production Web/real Nest with isolated memory identity fixture, successful diagnostic rerun           | 2026-10-12 | PASS   |
| Configured full workspace typecheck blocked at required dependency build              | `API_INTERNAL_URL=http://api:4000 pnpm typecheck`: Prisma schema-engine download DNS EAI_AGAIN                                                                                 | 2026-10-12 | FAIL   |
| Docker quality/migrated integration attempt blocked before tests                      | `COMPOSE_PROJECT_NAME=nexora-r1-r2-quality NEXORA_COMPOSE_OVERRIDE=/workspace/work/nexora-hardening-quality.yml sh scripts/quality-docker.sh`: Prisma engine checksum HTTP 403 | 2026-10-12 | FAIL   |
| Disposable full runtime smoke attempt blocked before HTTP/provisioning/browser probes | `NEXORA_COMPOSE_OVERRIDE=/workspace/work/nexora-hardening-runtime.yml sh scripts/runtime-smoke.sh`: Prisma engine HTTP 403 during application build                            | 2026-10-12 | FAIL   |
| Data smoke attempt blocked before recovery scenarios                                  | `NEXORA_COMPOSE_OVERRIDE=/workspace/work/nexora-hardening-runtime.yml sh scripts/data-smoke.sh`: required nexora-migrate:0.1.0 image unavailable after blocked builds          | 2026-10-12 | FAIL   |
| Development smoke attempt blocked before HMR/dependency assertions                    | `NEXORA_COMPOSE_OVERRIDE=/workspace/work/nexora-hardening-quality.yml sh scripts/dev-smoke.sh`: nexora-migrate:0.1.0 image unavailable                                         | 2026-10-12 | FAIL   |

### Verification Gaps and final gate

- NOT RUN to completion: genuine current/legacy PostgreSQL backup restore, exact old-session rejection on restored API, CLI provisioning after historical recovery, source-session isolation, full original-file/corruption/overwrite recovery checks, canonical runtime restart/outage/browser, and dev HMR/dependency checks. The suites were attempted but stopped at external image/dependency prerequisites. Mocked orchestration/host fixture success is not counted as end-to-end recovery evidence.
- Historical run `38196531087` and stage outcomes were supplied by the request for SHA 043090b; `gh run view --log-failed` could not inspect it (GitHub API HTTP 403). No historical stage is attributed to this changed HEAD. Actual hosted review threads remain NOT VERIFIED (API 403; unauthenticated PR page 404); no reviewer comments are automatically resolved. Supplied findings: R1 transport FIXED, R2 session resurrection path FIXED in implementation, with real recovery verification still open.
- Hosted CI on final HEAD: PENDING. Final hosted status cannot be inspected with current GitHub access. No evidence-only commit will be made for an intermediate CI result.
- Documentation Impact: REQUIRED. Updated owners: backup-restore operations (primary), database/runtime architecture, authentication ADR, testing operations, and this task. Origin/WEB_PORT configuration docs remain unchanged because resolution was already correct.
- No mandatory workstream is deferred. Remaining merge blockers are real Docker recovery/runtime/dev and final hosted CI/review verification. External limitations are Prisma engine host policy/DNS/download and absent authenticated GitHub read access; no policy/TLS/test/security bypass is introduced.

Final verdict: VERIFICATION PENDING. Do not merge automatically.
