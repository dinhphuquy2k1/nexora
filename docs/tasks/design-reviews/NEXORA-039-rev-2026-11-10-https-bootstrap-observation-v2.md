# NEXORA-039 — HTTPS bootstrap observation, revision 2

Task ID: NEXORA-039
Classification: SPIKE
Plan revision: rev-2026-11-10-https-bootstrap-observation-v2
Reviewed baseline: b9d343514d2986a59b27798bcac6e887064acea9
Branch: test/public-https-login-diagnostics

## Evidence-driven scope delta

Preserve v1 unchanged. Controlled run42784732523 passed exact main and PR38 with
identical observer/config hashes: initial login HTTP200/mfa,50ms/90ms. Both fresh
build-to-HTTPS cohorts passed. This does not explain historical failures.

Full Foundation42784732602 on main production source plus v1 instrumentation
failed before any auth request, at ADMIN_BROWSER_INTERACTIVE_LOGIN: seven script
load failures, zero script responses/certificate failures/runtime exceptions.
The request-layer hypothesis must now include Next static bootstrap. No evidence
warrants changing Auth, Customer, ingress, timeouts, TLS or security assertions.

## Reuse and design matrix

| Field                    | Decision                                                                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Extend existing test-only lifecycle observer to bounded static script GET records                                                                                                           |
| Existing implementations | auth-request-diagnostics.mjs closed failure codes/timing; login-readiness-diagnostics.mjs script counters; existing public browser listener; canonical quality/runtime/public shell scripts |
| Domain owner             | Root browser test infrastructure; no business Domain change or aggregate                                                                                                                    |
| Reuse alternatives       | Extend current observer versus duplicate network mapping or production access logging                                                                                                       |
| Selected approach        | Separate maximum8 same-origin /\_next/static/ JS script records from maximum16 auth records; reuse exact closed failure classification; never read script response bodies                   |
| Rationale                | Distinguish bootstrap transport failures from login HTTP outcomes without retaining asset URLs or credentials                                                                               |
| Risks                    | Script traffic crowding out auth records, snapshot leakage, hiding failure through optional gates                                                                                           |
| Verification             | RED/GREEN static lifecycle/privacy/cap tests; unchanged auth9tests/security assertions; controlled full-prelude comparison with both nonzero exits and owned cleanup preserved              |

## Second controlled experiment

This is the single evidence-driven hypothesis pair allowed by v1, not repeated
same-head retry. Keep exact production main dccbfee and PR38 96e6cd0 on one runner
with identical v2 observation. Replace the shorter build-to-HTTPS experiment with
the actual canonical quality-docker → stop development → runtime-smoke →
public-https-smoke prelude, once per revision. Use distinct run/attempt/cohort-owned
Compose namespaces, and clean development volumes between cohorts; existing
runtime/public traps retain their ownership and exit semantics. Record both
cohorts and fail aggregate result if either execution or cleanup fails. No
continue-on-error/if:always changes in Foundation; no password/MFA retries or
increased assertion deadlines. The existing40-minute comparison budget bounds
two complete preludes; a timeout remains a failed experiment, not a PASS.

Final native PR38 attempt3 was already requested from the first controlled pair;
no additional native retry will be requested if it fails. After this second
controlled pair, stop speculative experiments and record the actual layer/root
cause or explicit limitations. Any proven correction needs a separate fix revision
before test-first implementation. PR38 stays unchanged/Draft until acceptance.

## Documentation Impact

Documentation Impact: REQUIRED

Update testing.md for bounded script observation and full-prelude comparison;
task/PR own outcomes, limits and historical failures. No production contract,
security, dependency, schema or deployment changes. No raw scripts, bodies,
headers, URLs, tokens or exception strings in logs/artifacts.
