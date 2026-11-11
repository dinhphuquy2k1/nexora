# NEXORA-040 — M2 centralize Customer status validation

Status: VERIFICATION PENDING
Capability: IMPLEMENTED
Verification: PARTIALLY VERIFIED

## Design Review & Reuse Decision

Task ID: NEXORA-040
Classification: BOUNDED
Plan revision: rev-2026-11-11-m2-customer-status-guard-v1
Design Snapshot: docs/tasks/design-reviews/NEXORA-040-rev-2026-11-11-m2-customer-status-guard-v1.md
Design SHA-256: fa804503436fe474811e0c7d931a6ef10b8c01175ecf3253427b779240261a9c
Reviewed baseline: aea1c1abcacf0b05164a27bbf490cb67b99c471f
Branch: fix/m2-customer-status-guard

Scoped pre-code review and test-first plan are recorded in the immutable snapshot.
No existing shared predicate; preserve domain VO and input/query policies.

| Field                    | Decision                                                                                                                                                                                                                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | isCustomerStatus runtime type guard and Customer response parsing                                                                                                                                                                                                                                                    |
| Existing implementations | packages/shared/src/customer-status.ts defines codes/type; index.ts exports them. apps/web/features/customers/response.ts explicitly compares codes. apps/api/src/customer/domain/customer-status.vo.ts validates through Object.values and throws CustomerError. Web query.ts/payload.ts validate their own inputs. |
| Domain owner             | Shared Customer code vocabulary; Web response boundary consumes it. API Domain retains VO and transition policy.                                                                                                                                                                                                     |
| Reuse alternatives       | Reuse Domain VO (rejected: app coupling and throwing behavior); keep comparisons (duplicates vocabulary); add shared pure membership guard (selected).                                                                                                                                                               |
| Selected approach        | Derive private ReadonlySet from Object.values(CustomerStatus), unknown-to-CustomerStatusCode predicate; export from existing root; replace only response.ts comparisons. Reuse Web node:test status suite for shared contract tests.                                                                                 |
| Rationale                | One allowed-value source, no dependencies, constant-time lookup, minimal behavior-preserving scope.                                                                                                                                                                                                                  |
| Risks                    | Export or narrowing regression, accidental coercion, lost statusLabel validation. No concurrency, schema or authorization changes.                                                                                                                                                                                   |
| Verification             | Ten required input cases, public ESM/CommonJS/browser exports, TypeScript narrowing, both parser paths and malformed field regression; existing table/Detail SSR tests, lint/typecheck/contracts/quality and canonical Docker quality.                                                                               |

## Acceptance

- [x] Fresh branch starts at updated origin/main; scoped plan recorded before code.
- [x] Public shared guard; response parser reuses it without other condition changes.
- [x] RED/GREEN, invalid shapes and label/SSR regressions.
- [x] Canonical docs and host quality evidence recorded; independent owner review required.
- [ ] Canonical Docker/hosted verification and independent review resolved.
- [ ] Commit/push/new PR to main; no merge.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Shared exports isCustomerStatus; Web response parser consumes it.

### Canonical owners

- docs/architecture/reusable-components.md

### Documentation verification

pnpm docs:check, pnpm preflight:check, pnpm format:check.

## Evidence

Checks executed 2026-11-11T09:27–09:31Z against baseline HEAD
`aea1c1abcacf0b05164a27bbf490cb67b99c471f` plus this task working diff.
Host Node v24.22.1; pinned pnpm invoked as `npx --yes pnpm@10.34.6`.
Detailed logs remain outside the repository in the execution scratch directory;
this table retains command summaries. No screenshots/video captured or reviewed.

| Claim                      | Evidence                                                                                                                                                                                                                                                                                                  | Date       | Result |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Frozen install             | `npx --yes pnpm@10.34.6 install --frozen-lockfile` succeeded without lockfile changes                                                                                                                                                                                                                     | 2026-11-11 | PASS   |
| Baseline characterization  | Shared build, then four targeted suites: 21/21 passed                                                                                                                                                                                                                                                     | 2026-11-11 | PASS   |
| Initial RED attempt        | 21 passed, 2 failed: missing guard plus ENOSPC from concurrent Docker build; not clean RED                                                                                                                                                                                                                | 2026-11-11 | FAIL   |
| Clean test-first RED       | `node --test apps/web/test/customer-status.test.mjs apps/web/test/customer-ui-api.test.mjs apps/web/test/customer-table.test.mjs apps/web/test/customer-detail-status.test.mjs`: 21 passed, 2 failed solely for missing guard (public export and browser execution), before production edits              | 2026-11-11 | FAIL   |
| Targeted GREEN             | `npx --yes pnpm@10.34.6 --filter @nexora/shared build`, then same four-suite command: 23/23 passed, no skips; covers required ten guard inputs, padded/boxed strings, both parser paths/field rejection and actual table/Detail SSR labels and tone/classes                                               | 2026-11-11 | PASS   |
| Lint regressions           | `npx --yes pnpm@10.34.6 test:lint`: 52/52 passed                                                                                                                                                                                                                                                          | 2026-11-11 | PASS   |
| Canonical Docker attempt   | `NEXORA_COMPOSE_OVERRIDE=/workspace/work/m2-compose.yml sh scripts/quality-docker.sh`: failed during dependency image preparation with ENOSPC on 8 GB filesystem; no canonical test assertions executed. Override supplied only platform CA build secret. Removed failed build cache, never reset volumes | 2026-11-11 | FAIL   |
| Initial host quality       | `npx --yes pnpm@10.34.6 quality`: format/lint/preflight passed, docs rejected missing evidence table; corrected with actual evidence                                                                                                                                                                      | 2026-11-11 | FAIL   |
| Host configuration attempt | `npx --yes pnpm@10.34.6 quality` after evidence correction: format/lint/preflight/docs passed, typecheck prerequisite Web build rejected missing API_INTERNAL_URL; retry with documented build environment                                                                                                | 2026-11-11 | FAIL   |
| PR binding                 | `runPreflightCheck(process.cwd(), {prBody})` passed exact task/revision/snapshot/digest binding after removing ambiguous duplicate Task declaration from prepared PR text                                                                                                                                 | 2026-11-11 | PASS   |

## Final host verification checkpoint — 2026-11-11T09:34Z

`API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 quality`
exited 0 against baseline HEAD plus the final implementation diff. All formatting,
lint/boundaries, preflight, docs, TypeScript, tests, contracts and builds passed.
Counts: scripts 132, API 186, Web 263, database 6, UI 32 = 619 tests, zero failures
or skips. Shared narrowing fixture was compiled. Contract regeneration produced
zero OpenAPI/SDK drift. Next's Edge Runtime process.cwd warning and SDK module-type
warning were non-failing; no unrelated workaround introduced.

| Claim                    | Evidence                                                                                                                                           | Date       | Result |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Full host quality        | Exact command above, exit 0; 619/619 tests, contract regeneration unchanged and four build tasks successful                                        | 2026-11-11 | PASS   |
| Documentation checkpoint | `node scripts/docs-check.mjs` and `node scripts/preflight-policy-check.mjs`: passed after evidence updates                                         | 2026-11-11 | PASS   |
| Focused diff             | `git diff --check`: passed; only guard/export/parser, three existing test files, registry/task/snapshot. Fresh remote branch name confirmed unused | 2026-11-11 | PASS   |

Local Docker runtime/integration remains blocked by disk capacity. Hosted
Foundation and independent owner review are pending; host success is not a claim
of canonical Docker success. No user volume reset, merge or deployment.

## Review

Implementation-code-review skill self-review: production diff matches recorded
scope; no new duplicated membership list, app/server imports, dependencies,
unsafe casts, API/schema/SDK changes or UI styling changes. No confirmed P1/P2/P3
code findings. This is self-review, not independent approval. Only collaborator
returned by GitHub is the authenticated PR author, dinhphuquy2k1; an independent
reviewer is unavailable in this environment. Owner review is required and will be
explicitly requested in the PR description. Canonical/hosted checks remain gates.
