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
| Web auth sanitization, host allowlist, and navigation pass       | `pnpm --filter @nexora/web test` (13 tests passing)         | 2026-10-12 | PASS   |
| Workspace TypeScript compilation passes across all packages      | `pnpm typecheck` (10 tasks successful)                      | 2026-10-12 | PASS   |
| Architectural boundary rules and ESLint pass                     | `pnpm lint` (`boundaries.mjs` + `eslint .`)                 | 2026-10-12 | PASS   |
| Prettier formatting check passes across entire repository        | `pnpm format:check`                                         | 2026-10-12 | PASS   |
| Documentation links and governance pass                          | `pnpm docs:check`                                           | 2026-10-12 | PASS   |
| Next.js production build prerenders `/login` and all routes      | `pnpm --filter @nexora/web build` (prerenders all 6 routes) | 2026-10-11 | PASS   |
| Monorepo turbo build and test suite pass                         | `pnpm test` (all 8 tasks pass)                              | 2026-10-11 | PASS   |
| Hosted Docker CI quality and integration passes on final PR HEAD | GitHub Actions run `38183466450` (`docker-foundation`)      | 2026-10-12 | PASS   |

---

## 5. Verification Gaps & Pre-Merge State

- **Hosted CI on PR HEAD & Merge Commit**: Hosted GitHub Actions run (`docker-foundation`) on the PR HEAD and the eventual `main` merge commit cannot be executed or collected until the PR is submitted and merged.
- **Task Lifecycle Decision**: The task remains `VERIFICATION PENDING` in `docs/tasks/active/` during the PR lifecycle. Transition to `docs/tasks/completed/` will occur in a post-merge documentation follow-up following merge-commit CI inspection.
