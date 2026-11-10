# NEXORA-039 — Public HTTPS login investigation

Status: VERIFICATION PENDING
Capability: IMPLEMENTED
Verification: PARTIALLY VERIFIED

## Design Review & Reuse Decision

Task ID: NEXORA-039
Classification: SPIKE
Plan revision: rev-2026-11-10-https-login-investigation-v1
Design Snapshot: docs/tasks/design-reviews/NEXORA-039-rev-2026-11-10-https-login-investigation-v1.md
Design SHA-256: 5191efb5e50a7d83f46d3efbd06ce7f7c4297edae5ff7fe49b2087e996fbbee7
Reviewed baseline: dccbfee75c5d024d3973504c9c004e4f939799b9
Branch: test/public-https-login-diagnostics

Question: which actual request layer/outcome prevents public ADMIN login from
transitioning to MFA? Scope, hypotheses and bounded experiment budget are in the
immutable snapshot. Separate from Customer PR38; no production Auth/ingress fix.

| Field                    | Decision                                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Component                | Test-only safe auth lifecycle observer and controlled comparison workflow                                                                                                                                    |
| Existing implementations | public-https-browser.mjs request/status maps; login-readiness-diagnostics.mjs counters; browser-login-ready.mjs; smoke-checks.mjs; public-https-smoke.sh; data-smoke.sh; dev-smoke.sh; Web login-outcome.ts  |
| Domain owner             | Root test infrastructure owns observation; Identity/Web retain login/MFA semantics                                                                                                                           |
| Reuse alternatives       | Existing CDP stream/canonical harness versus new browser framework or production logging changes                                                                                                             |
| Selected approach        | Add bounded metadata-only CDP observer to existing listener; reuse loginOutcome for successful JSON classification; compare exact main/PR38 in one fresh hosted job with same instrumentation                |
| Rationale                | Determine terminal request state and layer while avoiding duplicate validation and misleading UI error inference                                                                                             |
| Risks                    | Secret leakage, false PASS, changed observation timing, comparing different configurations                                                                                                                   |
| Verification             | Test-first redaction/closed fields, pending/HTTP/completion/failure/status/elapsed/outcome cases; unchanged security assertions; same-run versions/hashes and owned cleanup; both experiment exits propagate |

## Acceptance

- [x] Safe observer RED/GREEN: request lifecycle, closed fields and no secrets.
- [ ] Controlled exact-main/exact-PR38 comparison on one hosted job.
- [ ] Actual versions/config/fixture differences and outcomes recorded honestly.
- [ ] Root cause or evidence limitation recorded; separate scoped fix if proven.
- [ ] Mandatory final-head Foundation, public HTTPS/data/development outcomes.
- [ ] Independent review, accurate task/PR status, no automatic merge/deploy.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Safe auth lifecycle observation and a bounded controlled HTTPS comparison route.

### Canonical owners

- docs/operations/testing.md

### Documentation verification

pnpm format:check, pnpm docs:check, pnpm preflight:check.

## Evidence

| Claim                      | Evidence                                                                                                                                                               | Date       | Result |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Main historical Foundation | run42757227459 on dccbfee: HTTPS/data/dev actual steps PASS; Ubuntu20261101.360.1, runner2.338.2; not current PR acceptance                                            | 2026-11-10 | PASS   |
| PR38 attempt1/2            | run42775970986 on head96e6cd0, merge b7f5221: HTTPS ADMIN_BROWSER_PENDING_MFA/REQUEST_TIMEOUT; data/dev SKIPPED; same runner image, exact tool versions not all logged | 2026-11-10 | FAIL   |

No code/test edits preceded this plan. Historical runs are not a controlled pair.
Local Docker resource gate unmet (about3GiB available); no user/shared volumes used.

## Implementation checkpoint

| Claim              | Evidence                                                                                                                                       | Date       | Result |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Test-first RED     | node --test scripts/auth-request-diagnostics.test.mjs before implementation failed missing module                                              | 2026-11-10 | FAIL   |
| Targeted GREEN     | auth-request-diagnostics, smoke-checks, browser-login-ready suites: 9/9 PASS, 0 skip; five observer cases                                      | 2026-11-10 | PASS   |
| Independent review | No P1/P2; reviewer independently ran initial diagnostic suites 7/7 PASS; P3 async observation now explicit BODY_PENDING and regression checked | 2026-11-10 | PASS   |
| Structural checks  | node scripts/docs-check.mjs; node scripts/preflight-policy-check.mjs                                                                           | 2026-11-10 | PASS   |

Unknown raw values never reach snapshots; setup JSON observation does not reuse a
Login success contract incorrectly. An intermediate edit had a missing brace;
syntax error was fixed before GREEN without changing assertions. The first lint
invocation could not resolve @eslint/js in the new worktree; installed dependency
links were corrected, not repository dependency versions. Hosted comparison/full
Foundation and current-head closure remain pending. No production files changed.
