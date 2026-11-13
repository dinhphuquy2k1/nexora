# NEXORA-044 — Provider length single source

## 1. Task metadata and classification

Task ID: NEXORA-044
Classification: BOUNDED
Plan revision: rev-2026-11-13-provider-length-v4
Reviewed baseline: f32101e6bda74e1e13dc195fbbad3823974dcdde
Branch: refactor/provider-length-single-source

## 2. Reuse & design audit

| Field                    | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Component                | Provider column length limit shared by Carrier, Sync and audit persistence; Foundation step 8 public HTTPS harness failure diagnostics and wait budget                                                                                                                                                                                                                                                                                                                                                                                     |
| Existing implementations | literal 32 in apps/api/src/sync/infrastructure/sync-capability.registry.ts; VARCHAR(32) provider columns in carrier_connections, security_audit_events, sync_jobs, sync_source_identities, sync_provider_budget; CarrierProvider vocabulary in apps/api/src/carrier/domain/carrier.ts; scripts/smoke-checks.mjs failure categories; scripts/public-https-browser.mjs until() 100×100 ms and CDP send() 15 s timeout as plain Error; browser-login-smoke.mjs 200-poll precedent; public-https-browser.mjs Chromium launch gate 100 × 100 ms |
| Domain owner             | Carrier domain (owns carrier provider vocabulary); operations test harness (docs/operations/testing.md)                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Reuse alternatives       | keep literal; constant in packages/shared; constant in sync; constant in Carrier domain next to CarrierProvider; rerun only; raise all harness deadlines; opt-in diagnostics plus bounded wait aligned with existing precedent                                                                                                                                                                                                                                                                                                             |
| Selected approach        | CARRIER_PROVIDER_MAX_LENGTH in carrier.ts, imported by the Sync registry; DB parity fixture in the existing migrated Sync integration suite; opt-in diagnostics in createSmokeChecks, TimeoutError for CDP timeout, until() 200 polls; Chromium launch gate 200 × 100 ms                                                                                                                                                                                                                                                                   |
| Rationale                | one owner for provider vocabulary; Sync already imports carrier/domain (ConnectionStatus); parity test is the only guard that ties the TypeScript constant to actual column lengths; failures move between sub-steps and categories under runner load; current output cannot distinguish slowness from defects                                                                                                                                                                                                                             |
| Risks                    | constant and column lengths drift; a new table adds a provider column without the guard; a longer wait could hide a real regression (mitigated by elapsed-time diagnostics); diagnostics could leak data (mitigated by allowlist, no message text); shared until() changed login-readiness deadline (corrected in v4)                                                                                                                                                                                                                      |
| Verification             | registry unit test (limit accepted, limit+1 rejected); PostgreSQL parity fixture over the exact provider-column table set; hosted Preflight, Sync Targeted and Foundation; smoke-checks unit tests (RED/GREEN), test:operations, hosted Foundation step 8 PASS                                                                                                                                                                                                                                                                             |

## 3. Plan

1. Record and format the versioned snapshot; hash raw bytes before tests.
2. Add registry boundary and migrated PostgreSQL parity tests; execute RED before implementation.
3. Implement the Carrier-owned constant and replace the Sync registry literal.
4. Synchronize database and Sync extension documentation.
5. Run local build, Sync units/integration where available, formatting, lint, documentation, governance, boundaries and quality where resources permit; preserve snapshot digest.
6. Stabilize Foundation step 8 per v2 delta; v2 hosted failures stop without rerun.
7. Publish a new PR and verify final-head Preflight, Sync Targeted and Foundation; retain all failed attempts and permit only one bounded runtime/HTTPS failed-job rerun when the diff does not affect that code.
8. Close after merge under §1.7 together with NEXORA-043 in a separate documentation PR; link resolution of the completed NEXORA-042 PLAN ISSUE there, not in this PR.

## Delta from v1

Owner extended scope to stabilize Foundation step 8 (Public HTTPS) after intermittent failures on PR #42 (240a01c, CANONICAL_HTTPS_REMOTE_OPERATOR_SETUP, CHECK_FAILED) and PR #43 (cadece5, attempt 1: REAL_HTTPS_BROWSER, ASSERTION_FAILED; attempt 2: ADMIN_BROWSER_RECOVERY_VERIFY, REQUEST_TIMEOUT). Changes: opt-in failure diagnostics (allowlisted error type, step elapsed ms) in scripts/smoke-checks.mjs enabled only by the public HTTPS harness; CDP command timeout classified as TimeoutError; post-login browser condition wait budget raised from 100 to 200 polls of 100 ms, matching browser-login-smoke.mjs. Login-readiness deadlines, authentication assertions and retry policy are unchanged.

## Delta from v2

Attempt 1 (REAL_HTTPS_BROWSER, ASSERTION_FAILED) can only come from assert.ok(executable) or assert.ok(debugPort); the Chromium DevTools launch gate polls 100 × 100 ms. Align it with the existing launch gate in scripts/browser-login-smoke.mjs (200 × 100 ms with the cold-runner comment). Correct testing.md: the browser-login-smoke precedent is the Chromium launch gate; post-login conditions use the same 20 s bound.

## Delta from v3

v2 raised until() to 200 polls, and waitForInteractiveLogin receives that until(), so login-readiness deadlines also doubled, contradicting the documented decision to keep them unchanged. Restore readiness to its original 100 polls by passing a 100-poll until to waitForInteractiveLogin at both call sites. Foundation on 9418fad showed 2 Next.js script load failures with 200 ineffective toggle clicks; this is a separate ingress/asset-loading issue, tracked by a new follow-up task, not addressed here.
