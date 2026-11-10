# NEXORA-039 — Public HTTPS login investigation

Status: VERIFICATION PENDING
Capability: IMPLEMENTED
Verification: PARTIALLY VERIFIED

## Design Review & Reuse Decision

Task ID: NEXORA-039
Classification: SPIKE
Plan revision: rev-2026-11-10-https-bootstrap-observation-v2
Design Snapshot: docs/tasks/design-reviews/NEXORA-039-rev-2026-11-10-https-bootstrap-observation-v2.md
Design SHA-256: 467a2350faab6899a872476bfa9e9a029d26926e9ba3e12a0b1077d87aa402fa
Reviewed baseline: b9d343514d2986a59b27798bcac6e887064acea9
Branch: test/public-https-login-diagnostics

Question: which actual request layer/outcome prevents public ADMIN login from
transitioning to MFA? Scope, hypotheses and bounded experiment budget are in the
immutable snapshot. Separate from Customer PR38; no production Auth/ingress fix.

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

## Revision 2 investigation checkpoint

The v1 snapshot remains unchanged (5191efb5…). Controlled build-to-HTTPS pair
42784732523 succeeded on exact main/PR38, with identical observation/configuration
and Node24.19/pnpm10.34.6/Docker28.0.4/Compose2.38.2/Chrome156.0.8078.79.
Initial LOGIN HTTP200/mfa:50ms main,90ms PR38; no runtime exceptions. This does
not prove a historical root cause or flakiness and is not native PR38 acceptance.

| Claim                   | Evidence                                                                                                                                                                                                                                 | Date       | Result |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Full host quality at v1 | pnpm quality:615/615 PASS,0skip; pnpm test:lint52/52 PASS; no production changes                                                                                                                                                         | 2026-11-10 | PASS   |
| Controlled short pair   | run42784732523/job129723014444: main dccbfee and PR38 96e6cd0 each canonical HTTPS exit0, actual MFA transition                                                                                                                          | 2026-11-10 | PASS   |
| Full prelude differs    | Foundation42784732602/job129723014473 at b9d343/mergef7035db: HTTPS failed ADMIN_BROWSER_INTERACTIVE_LOGIN at08:56:47Z; scriptLoadFailures7,scriptResponses0,certificateFailures0,runtimeExceptions0; no auth requests; data/dev SKIPPED | 2026-11-10 | FAIL   |

V2 extends observation to static bootstrap and uses the same full canonical
prelude in its one remaining hypothesis pair. No production/Auth/harness wait
correction is justified yet. PR38 native final attempt3 is separately running;
no further native retry will be requested if it fails. Stop speculative attempts
after the second comparison; record root cause or limits honestly.

| Claim                           | Evidence                                                                                                                                                       | Date       | Result |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| V2 test-first RED               | New static-bootstrap tests failed before extension (missing scriptRequests), existing auth tests retained                                                      | 2026-11-10 | FAIL   |
| V2 targeted GREEN               | auth-request-diagnostics7 + smoke-checks3 + browser-login-ready1:11/11 PASS,0skip                                                                              | 2026-11-10 | PASS   |
| Controlled checkout feasibility | Independent clone probe checked exact96e6cd0 with a real .git directory; prevents unmounted Git worktree pointer from invalidating Docker quality index checks | 2026-11-10 | PASS   |

V2 comparison cleans its run/attempt/cohort-owned development namespace and
propagates both execution and cleanup exits. Root observer/configuration changes
are isolated in PR39; PR38 source/snapshot remain unchanged.

## Comparison checkout correction (within v2 setup scope)

Run42787971381/job129733888761 exited128 before either cohort started: unable to
read tree dccbfee after cloning the runner checkout. The earlier full local clone
probe did not model shallow CI object availability. This is a proven defect in
this new comparison setup, not an HTTPS outcome or original Auth root cause.
Use independent init+explicit depth1 fetch of the pinned revision; no production
or security change and no additional native PR38 retry. V2 snapshot unchanged.

| Claim                     | Evidence                                                                                                             | Date       | Result |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| V2 setup failure          | controlled run42787971381 exit128 before cohort; no HTTPS test executed                                              | 2026-11-10 | FAIL   |
| Real Git regression RED   | actual workflow checkout commands against shallow caller missing target tree exited128 before correction             | 2026-11-10 | FAIL   |
| Real Git regression GREEN | same owned Git fixture after init+explicit fetch: exact baseline HEAD/content, real .git directory, caller unchanged | 2026-11-10 | PASS   |

The corrected launch executes the previously planned second hypothesis pair; no
failed HTTPS experiment is reclassified as PASS. Preserve all historical runs.
