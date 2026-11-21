# NEXORA-060 — independent review and RED/GREEN

Date: 2026-11-20 (Asia/Ho_Chi_Minh). Implementation commit
38cce9b34d8d7df5484884c62e12fa0e6089a832, baseline ef0cf4e.
No self-review is counted as independent approval. Reviewer is a separate read-only
agent; exact-final-HEAD hosted verification is separate.

## Test-first evidence

Command: node --test apps/api/test/shipment/partial-mapping.test.cjs
apps/api/test/uniship/mapping-v2.test.cjs (same two files; later coverage expanded).

| Stage                             | Actual result             | Selected output / cause                                                                                                                                                  |
| --------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Before implementation             | FAIL,0/7                  | scoped fees / ambiguous code / capacity / typed attributes: VALIDATION_ERROR; owner sample lacked mapped facts; milestone patch undefined                                |
| First implementation              | FAIL,6/7                  | Test's two64-emoji values did not exceed compact1024-byte cap. Corrected test input to escaped control characters whose JSON encoding exceeds the cap; limit not relaxed |
| Initial GREEN                     | PASS,7/7                  | All original preservation/validation/normalizer tests passed                                                                                                             |
| Independent review regression RED | FAIL,4/5 normalizer tests | Exact1 represented as0.0000000001e10 was rejected; count overflow guard wrongly included insignificant leading zeros                                                     |
| Review fix GREEN                  | PASS,9/9                  | Significant coefficient length; added exact exponent/max32 count plus leap-day/year rollover and three server timezone cases                                             |
| Final independent test run        | PASS,27/27                | Two new unit files plus Retail model/UI; includes legacy51 child rows and payment940/remain0/detail/count distinction                                                    |

## Independent findings

| Priority | Finding                                                                                | Resolution / evidence                                                                                           |
| -------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| P2       | Exact scientific count rejected                                                        | CLOSED: coefficient.toString().length, exact integer comparisons, normalizer regression                         |
| P2       | Required calendar/TZ boundary coverage missing                                         | CLOSED: valid leap day, invalid calendar/seconds/precision, year rollover and UTC/NewYork/Tokyo execution       |
| P2       | Canonical table still marked selected mapped facts unknown, rate direction overclaimed | CLOSED: selected vs unselected confidence tables/activation text aligned; no unsupported directional rate claim |

Final reviewer conclusion on38cce9b: no open P1/P2/P3 in inspected scope.
Reviewer independently executed27/27 tests and git diff --check ef0cf4e38cce9b.
Frozen snapshot SHA matches e5c3f9ea98e01f96816a59bb277f999004c181653d791f294af7df1155c8af35.
Historical captured fixtures/digests and Retail reference have no diff.

## Local Chromium limitation

Actual Chromium over compiled TSX/CSS, fixtureOnly mode with screenshots:
current38cce9b and a separate unchanged ef0cf4e worktree both fail
scripts/retail-column-picker-checks.mjs:83 through snapshot at
scripts/retail-browser-checks.mjs:582. Search input background:

```text
actual: rgb(248, 250, 252)
expected: rgb(255, 255, 255)
operator: strictEqual
```

Both passed six-viewport geometry before this assertion. Initial temporary runner
cleanup hit ENOTEMPTY and hid the assertion; rerun used canonical browser teardown
and exposed it. Baseline comparison confirms recurrence without this diff; it does
not prove a root cause. No assertion, retry, timeout or unrelated CSS was changed.
Hosted Foundation browser evidence remains necessary. Raw screenshot/log dumps are
not committed; no provider/account data is used by these synthetic Retail fixtures.

### Follow-up: canonical focus prerequisite, local PASS

The canonical browser-login-smoke.mjs:284 calls Page.bringToFront; the temporary
isolated runner had not. After adding that same call only to the temporary runner,
all verifyRetailBrowser assertions passed with screenshots at six viewports, including
RETAIL_DETAIL_AND_CREATE_NATIVE_DIALOG and RETAIL_API_ERROR_EMPTY_AND_ABORT. Exit0.
No source CSS/assertion/timeout changed. This supersedes the local limitation while
retaining the earlier FAILs above. Hosted final-head acceptance remains separate.
