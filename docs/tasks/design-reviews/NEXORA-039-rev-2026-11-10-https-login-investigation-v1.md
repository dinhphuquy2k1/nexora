# NEXORA-039 — Controlled public HTTPS login investigation

Task ID: NEXORA-039
Classification: SPIKE
Plan revision: rev-2026-11-10-https-login-investigation-v1
Reviewed baseline: dccbfee75c5d024d3973504c9c004e4f939799b9
Branch: test/public-https-login-diagnostics

## Question, scope and evidence method

Why does PR38 HTTPS login fail before MFA with generic UI feedback, while the
same-day main Foundation succeeds? Observe actual CDP auth request lifecycle,
not generic alert text. Reuse the real HTTPS/DB/CLI/MFA harness; retain all checks.
No authentication, cookie, ingress, business, database or Customer changes.
Separate diagnostic PR from Customer PR38. This is a bounded investigation, not
an implementation of new business behavior. No Domain aggregate/VO is warranted.

## Inspection and reuse matrix

Current main dccbfee and PR38 head96e6cd0 have byte-identical Auth, ingress,
workflow and HTTPS harness sources. Main push Foundation42757227459 succeeded;
PR38 Foundation42775970986 attempts1/2 failed at ADMIN_BROWSER_PENDING_MFA.
Both report Ubuntu image20261101.360.1/runner2.338.2. Browser request dispatched,
no observed HTTP status in failure logs; loadingFailed was not recorded. The UI
networkFailure flag also covers HTTP errors and exceptions. These historical runs
are not a controlled pair or proof of transport failure/regression.

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

## Controlled experiment and security boundaries

1. Freeze this snapshot and task before tests/code. Keep PR38 unchanged.
2. Test-first observer: only fixed auth path labels, numeric HTTP status/elapsed,
   terminal category, bounded runtime exception count, closed network failure
   code, JSON login outcome and safe allowlisted error code. No URLs, input values,
   raw body/header/cookie/token/exception strings in output or retained state.
   Match exact same-origin auth POST; bound records. Reuse loginOutcome, no new
   frontend/backend mapping or message changes. Transient response parsing only.
3. Integrate observation only into canonical browser listener. No new credential
   submissions, retry, sleeps, timeout increases, TLS exceptions, skipped security
   checks, mocked HTTP or optional Foundation gates.
4. Dedicated hosted experiment checks out fixed baseline dccbfee and PR38
   96e6cd0 in separate directories on one ubuntu24 job, Node24.19.0, pinned pnpm
   from existing tools image. Log Docker/Chromium versions and source hashes.
   Copy exactly the same observer/instrumented browser script to both; build each
   real runtime and execute canonical public-https-smoke.sh once per revision with
   fresh script-owned fixtures/volumes. Continue to the second experiment after
   first failure solely to compare; fail aggregate job if either fails. Foundation
   sequencing stays unchanged. No raw fixture/log artifact upload.
5. Initial controlled pair, at most one evidence-driven hypothesis pair, then final
   verification: no repeated reruns until green. After three unsuccessful attempts,
   stop and record limits/re-plan. No shared/production DB or public listener.
6. If a proven harness/system defect needs correction, record a separate scoped
   fix revision before implementation, preserve this snapshot, write regression
   RED/GREEN and keep fix in this independent PR. Do not merge automatically.
   PR38 cannot inherit an unmerged fix or claim its result as final-head PASS.
7. Reconcile evidence/remaining gates in PR metadata. Run appropriate targeted
   Node tests, quality/docs/preflight/contracts/lint, independent review and hosted
   Foundation. Persistence/development remain mandatory and never if:always.

## Documentation Impact

Documentation Impact: REQUIRED

Update testing.md only for the new safe observer and controlled diagnostic
workflow; task/PR own investigation tables, limitations and historical failures.
Never modify NEXORA-038's immutable snapshot or declare completion from an old run.
Local Docker capacity is insufficient (about3GiB free); use hosted disposable jobs.
