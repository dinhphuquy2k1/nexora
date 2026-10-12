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
