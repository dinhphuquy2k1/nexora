# NEXORA-059 E2 — runtime then HTTPS, censored before HTTPS

Run [44282193030](https://github.com/dinhphuquy2k1/nexora/actions/runs/44282193030), attempt1, event pull_request, 2026-11-18T10:06:20Z → 2026-11-18T10:10:47Z UTC. Source `e15f23762741fbe6ce50fdd5e31713e4edd6dc92`; actual checkout `14684f3e82d78b89771e9cbe01e0ee0795823676`. Common harness checkpoint e15f23762741fbe6ce50fdd5e31713e4edd6dc92.

**10 runtime FAIL;0 reached HTTPS. HTTPS failure rate is N/A (0 observed executions), not0/10 PASS.** All builds exit0, runtime exit1, HTTPS NOT_RUN. Trial1 fails BROWSER_LAUNCH/ASSERTION_FAILED; trials2–10 fail RETAIL_ISOLATED_FIXTURE/CHECK_FAILED. No replacement/rerun, script/timeout/assertion repair or Phase2 change.

Confirmed prerequisite gap in the new standalone mode: quality-docker.sh line22 normally builds retail/carrier/Pager fixtures during Foundation step4; retail-browser-checks.mjs lines278–288 requires the host artifacts/retail-fixture/bundle.js (missing is failure, never skip). The E2 checkpoint only built release images before the unchanged runtime command and did not generate these host fixtures. This can explain the Retail fixture boundary; the original private runtime exception/errno was not retained, so do not fabricate its text. Trial1 browser startup remains unexplained; safe startup hints were not included in the narrow runtime-status projection.

Per A/B, retain these outcomes and stop changes/extra trials: incomplete environment must not be counted against H1/H2/H3, and the unexplained original browser-launch failure is not repaired. Owner must decide any additional instrumented/prerequisite-complete E2 batch. Current evidence does not fulfill the intended runtime→HTTPS comparison.

PUBLIC_HTTPS_ENVIRONMENT_DIAGNOSTIC: **NOT RUN in all10 trials**, because public-https-smoke.sh never ran. No HTTPS network/interface/Docker-window/script-reason observations exist; no JSON is fabricated. Runtime fixed-vocabulary failure lines are preserved below.

| Trial | Run/attempt, job                                                                                                    | UTC start → end                             | Build/runtime/HTTPS exit | Result / failed stage       | Observer status; dropped      | ADDR/ROUTE interface, Docker ±5s, Script reason | Artifact (verified ZIP SHA-256; expires UTC)                                                                                                            |
| ----: | :------------------------------------------------------------------------------------------------------------------ | :------------------------------------------ | :----------------------- | :-------------------------- | :---------------------------- | :---------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ |
|     1 | [44282193030/1, job134725686192](https://github.com/dinhphuquy2k1/nexora/actions/runs/44282193030/job/134725686192) | 2026-11-18T10:06:43Z → 2026-11-18T10:09:53Z | 0 / 1 / NOT_RUN          | RUNTIME FAIL; HTTPS NOT RUN | NOT RUN (HTTPS did not start) | NOT RUN                                         | 14417452056 `public-https-runtime-then-https-trial-1`; `sha256:af7d2aab033b25013d56497e8caa207cf99169e8f7acad47ba262e8831f90be1`; 2026-11-25T10:09:49Z  |
|     2 | [44282193030/1, job134725686218](https://github.com/dinhphuquy2k1/nexora/actions/runs/44282193030/job/134725686218) | 2026-11-18T10:06:42Z → 2026-11-18T10:10:35Z | 0 / 1 / NOT_RUN          | RUNTIME FAIL; HTTPS NOT RUN | NOT RUN (HTTPS did not start) | NOT RUN                                         | 14417042844 `public-https-runtime-then-https-trial-2`; `sha256:a940b3e49508514043ab95870808279681e2184b74862e604a0ee8e82f21fe93`; 2026-11-25T10:10:33Z  |
|     3 | [44282193030/1, job134725686312](https://github.com/dinhphuquy2k1/nexora/actions/runs/44282193030/job/134725686312) | 2026-11-18T10:06:43Z → 2026-11-18T10:10:45Z | 0 / 1 / NOT_RUN          | RUNTIME FAIL; HTTPS NOT RUN | NOT RUN (HTTPS did not start) | NOT RUN                                         | 14417981173 `public-https-runtime-then-https-trial-3`; `sha256:1fd21227917c78132c608c05503cfdc7cbb174639a9336fafe3ceaf59b6155d8`; 2026-11-25T10:10:42Z  |
|     4 | [44282193030/1, job134725686341](https://github.com/dinhphuquy2k1/nexora/actions/runs/44282193030/job/134725686341) | 2026-11-18T10:06:42Z → 2026-11-18T10:10:47Z | 0 / 1 / NOT_RUN          | RUNTIME FAIL; HTTPS NOT RUN | NOT RUN (HTTPS did not start) | NOT RUN                                         | 14417327659 `public-https-runtime-then-https-trial-4`; `sha256:4809103df83c8b564b6dc621b8851bdf26277ae19839ca120829846ddf2425b6`; 2026-11-25T10:10:44Z  |
|     5 | [44282193030/1, job134725686142](https://github.com/dinhphuquy2k1/nexora/actions/runs/44282193030/job/134725686142) | 2026-11-18T10:06:42Z → 2026-11-18T10:10:43Z | 0 / 1 / NOT_RUN          | RUNTIME FAIL; HTTPS NOT RUN | NOT RUN (HTTPS did not start) | NOT RUN                                         | 14417193608 `public-https-runtime-then-https-trial-5`; `sha256:e4cc14158885867f71ccc4b2c1f27c8ca9d25b77120fd7f92f448f4a3643edae`; 2026-11-25T10:10:40Z  |
|     6 | [44282193030/1, job134725686132](https://github.com/dinhphuquy2k1/nexora/actions/runs/44282193030/job/134725686132) | 2026-11-18T10:06:42Z → 2026-11-18T10:10:35Z | 0 / 1 / NOT_RUN          | RUNTIME FAIL; HTTPS NOT RUN | NOT RUN (HTTPS did not start) | NOT RUN                                         | 14416444390 `public-https-runtime-then-https-trial-6`; `sha256:3b900442939afde61c141091ec57ef82c4b7b99e20e4d9cbdfab309a594d78a5`; 2026-11-25T10:10:33Z  |
|     7 | [44282193030/1, job134725686201](https://github.com/dinhphuquy2k1/nexora/actions/runs/44282193030/job/134725686201) | 2026-11-18T10:06:42Z → 2026-11-18T10:10:24Z | 0 / 1 / NOT_RUN          | RUNTIME FAIL; HTTPS NOT RUN | NOT RUN (HTTPS did not start) | NOT RUN                                         | 14418510154 `public-https-runtime-then-https-trial-7`; `sha256:f5b626dbae7f9d7d917321904c340bb75eb854865d2be1686d8464abff72485e`; 2026-11-25T10:10:22Z  |
|     8 | [44282193030/1, job134725686210](https://github.com/dinhphuquy2k1/nexora/actions/runs/44282193030/job/134725686210) | 2026-11-18T10:06:42Z → 2026-11-18T10:10:28Z | 0 / 1 / NOT_RUN          | RUNTIME FAIL; HTTPS NOT RUN | NOT RUN (HTTPS did not start) | NOT RUN                                         | 14417118675 `public-https-runtime-then-https-trial-8`; `sha256:9a8eb0d17924d5f9ce4ede1f66691b735ac6686f5e5d9b40982bf591ff55c281`; 2026-11-25T10:10:25Z  |
|     9 | [44282193030/1, job134725686479](https://github.com/dinhphuquy2k1/nexora/actions/runs/44282193030/job/134725686479) | 2026-11-18T10:06:42Z → 2026-11-18T10:10:27Z | 0 / 1 / NOT_RUN          | RUNTIME FAIL; HTTPS NOT RUN | NOT RUN (HTTPS did not start) | NOT RUN                                         | 14417357609 `public-https-runtime-then-https-trial-9`; `sha256:48b4af3620f51597673fd2b7576fdf001a2f4e250a9db34dc1be12dd51521713`; 2026-11-25T10:10:25Z  |
|    10 | [44282193030/1, job134725686242](https://github.com/dinhphuquy2k1/nexora/actions/runs/44282193030/job/134725686242) | 2026-11-18T10:06:42Z → 2026-11-18T10:10:39Z | 0 / 1 / NOT_RUN          | RUNTIME FAIL; HTTPS NOT RUN | NOT RUN (HTTPS did not start) | NOT RUN                                         | 14418001696 `public-https-runtime-then-https-trial-10`; `sha256:24484ebb8e38a90fe0792cf32dae7546beea95d1993deba522e1c151c2b69ab7`; 2026-11-25T10:10:35Z |

Trial1 — verbatim projected runtime status:

```text
BROWSER_LOGIN_SMOKE_FAILED
Step: BROWSER_LAUNCH
Category: ASSERTION_FAILED
```

Trial2 — verbatim projected runtime status:

```text
BROWSER_LOGIN_SMOKE_FAILED
Step: RETAIL_ISOLATED_FIXTURE
Category: CHECK_FAILED
```

Trial3 — verbatim projected runtime status:

```text
BROWSER_LOGIN_SMOKE_FAILED
Step: RETAIL_ISOLATED_FIXTURE
Category: CHECK_FAILED
```

Trial4 — verbatim projected runtime status:

```text
BROWSER_LOGIN_SMOKE_FAILED
Step: RETAIL_ISOLATED_FIXTURE
Category: CHECK_FAILED
```

Trial5 — verbatim projected runtime status:

```text
BROWSER_LOGIN_SMOKE_FAILED
Step: RETAIL_ISOLATED_FIXTURE
Category: CHECK_FAILED
```

Trial6 — verbatim projected runtime status:

```text
BROWSER_LOGIN_SMOKE_FAILED
Step: RETAIL_ISOLATED_FIXTURE
Category: CHECK_FAILED
```

Trial7 — verbatim projected runtime status:

```text
BROWSER_LOGIN_SMOKE_FAILED
Step: RETAIL_ISOLATED_FIXTURE
Category: CHECK_FAILED
```

Trial8 — verbatim projected runtime status:

```text
BROWSER_LOGIN_SMOKE_FAILED
Step: RETAIL_ISOLATED_FIXTURE
Category: CHECK_FAILED
```

Trial9 — verbatim projected runtime status:

```text
BROWSER_LOGIN_SMOKE_FAILED
Step: RETAIL_ISOLATED_FIXTURE
Category: CHECK_FAILED
```

Trial10 — verbatim projected runtime status:

```text
BROWSER_LOGIN_SMOKE_FAILED
Step: RETAIL_ISOLATED_FIXTURE
Category: CHECK_FAILED
```

Artifact ZIP digests and source/checkout/stage files were checked locally. Only compact safe metadata is committed; ZIPs, raw job/runtime logs, fixture/session/certificate/browser files remain outside Git. No manual screenshot acceptance is claimed.
