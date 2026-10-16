# NEXORA-018 — Uniship Backend Connection Lifecycle

- **Task ID**: `NEXORA-018`
- **Status**: `VERIFICATION PENDING`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `NOT VERIFIED`
- **Classification**: SIGNIFICANT
- **Branch**: `feat/uniship-carrier-integration`
- **Baseline**: `96c2118fd287f70ada19ab0dbd17f209e7dd41ce`

## Preflight and scope

PR17 is merged; origin/main matches the owner baseline; clean worktree, new branch from origin/main, Task018 unused; unrelated PR14 remains open and untouched. Read AGENTS/AI entry sequence, ADR005/007, canonical backend/database/API/runtime/configuration/testing, NEXORA015/017 and relevant Carrier/Identity/crypto/schema/lint source. Apply backend-only, ignore is_verified, no refresh API, encrypted password/token default policy supplied by owner on 2026-10-16. No Web/UI/shipment sync/worker work.

## Implementation plan

1. Test-first loopback transport: observed verify headers/body, strict userid/candidate matching, is_verified ignored, safe bounded errors/timeout/URL/redirect; no live requests.
2. Plain domain failures and provider port/adapter; pure application lifecycle, bounded admission/provider concurrency/backoff and per-connection Promise<void> singleflight. No plaintext in global state.
3. Forward migration: connection lifecycle version plus Carrier-owned per-user epoch (user disable/re-enable fence); audit sink migration only after explicit approval. Preserve all old migrations/data, constraints and no enum declarations.
4. Short user-first transactions: authorized snapshots/claims, atomic verified connection + encrypted token/password + success audit; version/epoch CAS on completion/failure. Disable increments epoch/versions with existing revocation transaction, no locks during HTTP/crypto.
5. Infrastructure credential vault alone decrypts: re-read ACTIVE owner/fence, commit audit before stored-password decrypt, then login/verify/encrypt. Application receives sealed candidates, never stored plaintext password. Access tokens only reach authorized internal operation callbacks; no public token endpoint.
6. Presentation strict POST connect/reconnect + Origin/Session/no-store and existing contracts. Generate OpenAPI/SDK without UI or cross-user admin APIs.
7. Genuine PostgreSQL/Nest/concurrency/migration/append-only/audit fail-closed tests and PR2/3 regressions. Synchronize canonical docs and owner amendment; fresh exact-HEAD canonical Docker CI, commit/push/new PR, no merge.

## Interface preflight and invariants

POST /carrier-connections accepts only provider, loginIdentifier, password, displayName; uniship requires nonblank identifier (max128), password 1..1024 unchanged bytes, displayName trimmed 1..100. POST /:id/reconnect accepts password only and validates UUID; session owner only including ADMIN. Public metadata stays exactly eight fields. Wrong credentials and duplicate account share 400 CANNOT_CONNECT_CARRIER_ACCOUNT and exact approved message. Reconnect credentials/mismatch map 401 PROVIDER_AUTH_FAILED; rate429 RATE_LIMITED, outage/crypto/audit/stale503 SERVICE_UNAVAILABLE, missing/foreign404, disabled401.

Lifecycle snapshots include epoch/version and expiry scheduling metadata, no public secrets. Server UUID precedes encryption AAD. Manual claims invalidate older requests, completion and failure CAS invalidate stale responses, disable increments per-user epoch and connection version; reactivate restores nothing. Metadata PATCH does not change credential version. Existing internal secret writer adopts version CAS and cannot write to REAUTH_REQUIRED. User rows always precede Carrier state/connection/secrets, existing admin advisory lock remains first. No network/CPU crypto under locks. Token verified via provider before sealed persistence; login/verify userid coherence plus existing connection identity required. JWT exp is untrusted scheduling only after provider verification; unknown expiry stays nullable, no 365-day TTL.

Nexora-side safety policy (not provider quota): per-user burst5 per60s, bounded1024 identities; outbound maximum2 concurrent provider HTTP calls with fail-fast admission, exponential temporary failure delay1s doubling to60s, valid Retry-After bounded to5min; no automatic transport retry; at most one lazy recovery + operation retry. Clock injection enables deterministic tests. In-flight recovery map bounded128, keyed by connection UUID, Promise<void> only and always cleaned. Token rejection from a real operation may recover once, unknown/valid token does not verify on every use. REAUTH_REQUIRED suppresses automation; crypto key failures never trigger reauth or overwrite ciphertext.

## PLAN ISSUES

- CARRIER_SECURITY_AUDIT_SINK: RESOLVED, explicit owner chat approval2026-10-16. Approved PostgreSQL security_audit_events, server UUID/time, allowlisted type/outcome/reason, nullable actor/connection UUIDs without FK cascade, provider and UUID correlation. No arbitrary payload/secret fields. Commit append before password decrypt. Trigger blocks UPDATE/DELETE/TRUNCATE under ordinary SQL; privileged DBA/DDL remains outside guarantee. No audit bypass, retention or admin API. Implemented forward migration/sink; real integration and current-head evidence required.
- UNISHIP_LIVE_AUTHORIZATION: OPEN, observed request/200 response proves shape only, not official private API permission, credential retention, automatic re-login terms or quota. This PR's external execution gate remains hard closed even when runtime opt-in is true; loopback mocks only. Mock backend readiness is assessed separately; do not claim live-ready or mark this issue resolved.

## Acceptance criteria

Mock-only backend connect/reconnect, safe identity verification and encrypted atomic storage; audited lazy re-login and no refresh assumption; admission/singleflight/backoff; stale/delete/disable/re-enable fences; ownership/Origin/no secrets in responses/logs; real PG append-only/rollback/migrations/preservation/drift; existing regressions; canonical vocabulary lint and contract/docs; exact HEAD full CI. Audit approval received; production password-decryption uses the committed PostgreSQL gate. Live authorization is a documented deployment blocker outside mock-only completion.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Backend-only PR4 owner amendment, ignored is_verified, observed verify contract, audited encrypted lifecycle/recovery, new persistence/fences and mock-only live gate.

### Canonical owners

- docs/decisions/multi-carrier-architecture.md (dated owner amendments only)
- docs/architecture/backend.md
- docs/architecture/database.md
- docs/architecture/api-contract.md
- docs/architecture/runtime.md
- docs/architecture/frontend.md (UI remains planned)
- docs/operations/configuration.md
- docs/operations/testing.md

### Documentation verification

pnpm docs:check, format:check, contracts:check, complete diff review; preserve historical evidence and distinguish mocked/live authorization.

## Evidence

No historical PR pass is reused for this task. AppModule now wires the approved PostgreSQL sink, lifecycle persistence/vault and POST endpoints; new integration/migration evidence is pending. No commit/push/PR or current-head CI yet; task remains VERIFICATION PENDING / NOT VERIFIED.

| Claim                                          | Evidence                                                                                                                                                                                     | Date       | Result |
| :--------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Verify/parser tests fail before implementation | `node --test apps/api/test/uniship-verify.test.cjs`: 0/3, ignored fields rejected and verify absent; external gate test subsequently hardened with fetch spy to prevent any external attempt | 2026-10-16 | FAIL   |
| Credential audit ordering starts RED           | `node --test apps/api/test/carrier-vault.test.cjs`: missing implementation, then 2/2 after implementation                                                                                    | 2026-10-16 | PASS   |
| API unit regressions and new mock boundaries   | `pnpm --filter @nexora/api test` via pinned pnpm10.34.6: 81/81, emitted JS only                                                                                                              | 2026-10-16 | PASS   |
| Existing canonical vocabulary regression guard | `pnpm test:lint` via pinned pnpm10.34.6: 43/43                                                                                                                                               | 2026-10-16 | PASS   |
| Full host API build                            | `pnpm --filter @nexora/api build`: FAIL, genuine generated Prisma client unavailable on host; TS7006 in baseline Prisma adapters. Emitted JS is not full build verification.                 | 2026-10-16 | FAIL   |

| Frozen dependencies | `pnpm install --frozen-lockfile` via pinned pnpm10.34.6, no lockfile changes | 2026-10-16 | PASS |
| Genuine Prisma generation | `pnpm --filter @nexora/database generate`: schema-engine checksum request rejected 403 by host network policy; no bypass/fake client | 2026-10-16 | FAIL |
| Source lint and boundaries | `pnpm lint` after fixing operation-local string scope and unsafe-token detection | 2026-10-16 | PASS |
| Formatting | `pnpm format:check` | 2026-10-16 | PASS |
| Documentation checker regression tests | `pnpm test:docs`, 6/6 | 2026-10-16 | PASS |
| Operation diagnostic regression tests | `pnpm test:operations`, 3/3 | 2026-10-16 | PASS |

| Reproducible existing contracts | `pnpm contracts:check`, unchanged route schemas/SDK, no new endpoints published | 2026-10-16 | PASS |
| Documentation governance and diff hygiene | `pnpm docs:check`, `pnpm format:check`, `git diff --check` after updates | 2026-10-16 | PASS |

| PostgreSQL SQL syntax / append-only | `python3 /workspace/work/pr4-sql-probe.py`: isolated UUID-owned PostgreSQL17 container, all8 raw SQL migrations, INSERT succeeds and UPDATE/DELETE/TRUNCATE reject; no user volumes touched. Not Prisma drift evidence. | 2026-10-16 | PASS |
| Current audit-vocabulary guard | `pnpm test:lint`: 50/50, includes allowlisted audit event/outcome/reason contexts | 2026-10-16 | PASS |
| Host new real integration start | `node --test apps/api/test/carrier-lifecycle-integration.test.cjs`: cannot load genuine Prisma client after blocked engine download; no fake/bypass | 2026-10-16 | FAIL |
| Generated new API contracts | `pnpm contracts:generate` succeeds; subsequent contracts:check rejects intentional uncommitted generated changes until commit | 2026-10-16 | FAIL |

Not run: new PostgreSQL migration/lifecycle/append-only integration, canonical Docker quality/runtime/data/dev acceptance and exact-head CI. Audit approval is resolved and endpoints/persistence/bindings are implemented; real integration/current-head verification remains pending. This is not a completion or readiness claim.
