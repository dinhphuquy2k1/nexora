# NEXORA-054 — Uniship customer-portal contract and redacted fixtures

Status: VERIFICATION PENDING
Capability: IMPLEMENTED
Verification: PARTIALLY VERIFIED

## Design Review & Reuse Decision

Task ID: NEXORA-054
Classification: BOUNDED
Plan revision: rev-2026-11-15-uniship-portal-contract-v1
Reviewed baseline: 2fe0016b63c1c2c3028d806882dec8541735fa9f
Branch: docs/uniship-portal-contract
Design Snapshot: docs/tasks/design-reviews/NEXORA-054-rev-2026-11-15-uniship-portal-contract-v1.md
Design SHA-256: 90eabacd419af8be3b8b3de554e100ea95ec42d2fabcb2324a5587b21905d44f

## Scope and read-only inspection

Documentation and fixture-only contract for future Shipment integration, based on
owner-confirmed decisions and three owner-supplied files captured2026-11-15.
Close053 first under §1.7. Record read-only portal authorization in ADR007 point6;
retain points1–5 and the production hard-close. Document endpoints, FULL paging,
verified status codes and claim-stage preservation, field confidence, exact numeric
lexemes, timezone assumptions, errors/drift and remaining unknowns. No production
code/schema/API/SDK, adapter/capability activation, real Carrier request or CI live
network traffic. Encrypted saved-password login is authorized policy, not activation.

Read AGENTS and AI entry routes/rules/workflows, ADR007/010/011, shipments/backend,
UnishipHttpClient and existing local mock tests, discovery/format/docs/preflight
checks. Search token auth/verify, UNVERIFIED/live hard-close, providerClaimStatus,
provider timestamps/decimal fields, existing mappings and integration checklists.
Existing client hard-closes external requests even with opt-in; current API flags
are fee-derived and claim filtering unavailable. Future portal/service semantics
are documented explicitly without changing current behavior. No sample/code
contradiction requiring a production change identified in read-only inspection.

## Reuse audit

| Field                    | Decision                                                                                                                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Uniship customer-portal API contract for Shipment sync                                                                                                                                                                                        |
| Existing implementations | ADR007 live gate and NEXORA018 hard-close; uniship-http.client.ts auth/verify with local fake transport; shipments.md provisional labels, summaries and child bounds; native Node test discovery                                              |
| Domain owner             | Carrier owns auth/custody; Shipment owns future source mapping; docs/integrations owns observed portal contract                                                                                                                               |
| Reuse alternatives       | Reuse auth/verify/backend references and Shipment vocabulary; reject implementing an adapter/parser, changing gate code, fetching real responses or inventing observed data                                                                   |
| Selected approach        | Dated ADR owner authorization plus confidence-tagged contract, owner-redacted raw fixtures, clearly derived status cases and recursive fixture hygiene test                                                                                   |
| Rationale                | Preserve source evidence and distinct confirmed/assumed/unknown facts without granting live execution                                                                                                                                         |
| Risks                    | Private fields in fixtures, losing0.0 numeric lexemes or whitespace, confusing captured/derived data, claim codes with physical stages, guessed currency/timezone and false live-authorization claims                                         |
| Verification             | Byte compare/hash original two JSON files, source-field inventory, synthetic credential-marker RED on a temporary copy then clean GREEN, native discovery, requested pinned checks, PR binding simulation and final-head Preflight/Foundation |

## Plan and fixture provenance

1. Commit053 closure, verified main merge/green HEAD, limits/timing and issue50 closure.
2. Record this scoped plan and immutable formatted snapshot before edits/tests.
3. Add dated ADR authorization; create docs/integrations/uniship-portal-api.md with
   every required field/confidence and exhaustive unused-field groups. Update
   shipments, DOCUMENT_ROUTER and testing; preserve unresolved verification gates.
4. Copy transition-page.json and china-stores.json verbatim from owner uploads.
   Captured transition page uses page1/rowsPerPage15, independent from the confirmed
   future FULL request size100. Retain raw0.0/1.0/nulls, key order, warehouse name
   whitespace and envelopes. A fixture-local Prettier override of tabWidth4 for
   only those two files preserves the exact source bytes while keeping root
   format:check; scratch comparison confirmed Prettier3.6.2 reproduces both files.
   Extend supplied README with hashes, capture2026-11-15 (03:49–04:07UTC), redaction
   rules and derived-vs-captured provenance. No tokens/cookies stored.
5. Derive eight synthetic status cases1/2/3/4/5/13(with OldStatus4)/0/99 from the
   captured row, preserving other fields/types. Mark changed synthetic IDs/codes,
   statuses/old status and derived envelope/summary; never claim these were captured.
6. Add native Node recursive scanner for forbidden credential/analytics/old-identity/
   phone patterns and exact personal-field names across every fixture-directory
   file. Root test discovery must include it. Prove FAIL by injecting the required
   auth marker into a temporary fixture copy, then remove it and prove GREEN;
   originals remain unchanged. No real provider access.
7. Run node --test new scanner, format:check, docs:check, preflight:check, test:docs,
   test:preflight and test:lint with pinned pnpm10.34.6. Audit diff allowlist,
   supplied-file hashes and simulated validatePrTaskBinding valid:true. Apply
   implementation-code-review skill to the bounded diff.
8. Push PR with five metadata lines, wait exact-head Preflight and Foundation;
   final green HEAD via gh api, preserving prior failures without a SHA loop.
   Task remains VERIFICATION PENDING/IMPLEMENTED/PARTIALLY VERIFIED. Never merge.

## Error handling and boundaries

Owner Rule A: repair task-owned fixture/test/script, typos, format/lint/docs and
missing prerequisites with retained evidence. An unrelated Foundation5–10 failure
permits one failed-job retry. Rule B: stop and ask for required production/schema/
API changes, sample conflict with current code, unexplained untouched-test failure,
repeated CI failure or Foundation4/Preflight failure. State exact error/options/
recommendation. No additional owner approval for this already-authorized scope.
Snapshot stays frozen; captured bytes must not be reformatted. No unresolved plan
issue; actual authorization/capture provenance is supplied by owner, not independently
reperformed provider verification. Live activation remains a separate gated task.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Owner authorization scope and operational policy; observed portal shape, status
mapping, confidence/unknown ledger and fixture provenance/hygiene.

### Canonical owners

- docs/decisions/multi-carrier-architecture.md
- docs/domains/shipments.md
- docs/integrations/uniship-portal-api.md
- docs/ai/DOCUMENT_ROUTER.md
- docs/operations/testing.md

### Documentation verification

- Pinned format:check, docs:check, preflight:check, test:docs and test:preflight;
  scanner tests, scope/byte audit and PR metadata simulation.

## Evidence

| Claim                                    | Evidence                                                                                                                                                                                                                                                                                                                                                | Date       | Result |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Initial task structure                   | docs:check FAIL because NOT VERIFIED task lacked the required canonical Evidence table. Rule A adds this table in the mutable task; frozen snapshot unchanged.                                                                                                                                                                                          | 2026-11-15 | FAIL   |
| Read-only source and boundary inspection | Main baseline2fe0016b63c1c2c3028d806882dec8541735fa9f; task054 vacant; PR52 merged and issue50 closed; owner-supplied JSON/README captured2026-11-15, preliminary forbidden-marker scan clean; live hard-close unchanged.                                                                                                                               | 2026-11-15 | PASS   |
| Owner source received and byte-preserved | Owner supplied transition-page.json, china-stores.json and README captured2026-11-15 03:49–04:07UTC. cmp against both original uploads PASS; transition SHA-256 b328f42ea39a2870623a7a1c28bc29b98ca6ae90f4690d9f06ba1cd6f4473a2c; stores SHA-256 8fd8c076a0598b8c195eefcea8747cc463b10ec5fce0731043b1350ee59cccdf. No raw credentials included.         | 2026-11-15 | PASS   |
| Intentional fixture RED                  | Temporary copy only: appended the required auth marker to copied README; `UNISHIP_FIXTURE_DIRECTORY=/workspace/work/054-fixture-negative node --test apps/api/test/uniship-fixtures.test.cjs` returned exit1,2 PASS/1 FAIL at the hygiene assertion (authorization marker). The original JSON files were not edited and the temporary copy was deleted. | 2026-11-15 | FAIL   |
| Fixture GREEN after negative cleanup     | `node --test apps/api/test/uniship-fixtures.test.cjs`:3/3 PASS. Recursive whole-directory raw/decoded hygiene checks, source hashes/envelopes and eight derived-status cases with all non-overridden fields/types preserved. No provider request.                                                                                                       | 2026-11-15 | PASS   |
| Discovery                                | `node scripts/check-test-discovery.mjs "apps/api/test/**/*.test.cjs"`:37 suites, baseline36 plus the new scanner; existing pnpm test API discovery unchanged.                                                                                                                                                                                           | 2026-11-15 | PASS   |
| Exact-number mechanism                   | Native Node24 reviver verification retains Weight0.0 and ExchangeRate3980 source text;9007199254740993.01 survives context.source and existing DecimalValue.parse(18,2) exactly. No floating-point reconstruction or production parser added.                                                                                                           | 2026-11-15 | PASS   |
| Field inventory and scope                | All113 parcel keys inventoried:38 mapped/reviewed and75 explicitly unused, disjoint and complete. ADR007 live-gate points1–5 byte-identical to baseline. Production/packages/scripts/root formatter untouched. Scope only docs, Uniship fixture directory and scanner.                                                                                  | 2026-11-15 | PASS   |
| Scanner lint                             | Pinned ESLint executed for apps/api/test/uniship-fixtures.test.cjs, exit0.                                                                                                                                                                                                                                                                              | 2026-11-15 | PASS   |
| Pinned format:check                      | `npx --yes pnpm@10.34.6 format:check`; UTC2026-11-15T04:25:11.418130+00:00–2026-11-15T04:25:23.531826+00:00; exit0.                                                                                                                                                                                                                                     | 2026-11-15 | PASS   |
| Pinned docs:check                        | `npx --yes pnpm@10.34.6 docs:check`; UTC2026-11-15T04:25:23.532091+00:00–2026-11-15T04:25:24.747675+00:00; exit0.                                                                                                                                                                                                                                       | 2026-11-15 | PASS   |
| Pinned preflight:check                   | `npx --yes pnpm@10.34.6 preflight:check`; UTC2026-11-15T04:25:24.748488+00:00–2026-11-15T04:25:25.917682+00:00; exit0.                                                                                                                                                                                                                                  | 2026-11-15 | PASS   |
| Pinned test:docs                         | `npx --yes pnpm@10.34.6 test:docs`; UTC2026-11-15T04:25:25.918096+00:00–2026-11-15T04:25:27.359984+00:00; exit0.                                                                                                                                                                                                                                        | 2026-11-15 | PASS   |
| Pinned test:preflight                    | `npx --yes pnpm@10.34.6 test:preflight`; UTC2026-11-15T04:25:27.360312+00:00–2026-11-15T04:25:28.964213+00:00; exit0.                                                                                                                                                                                                                                   | 2026-11-15 | PASS   |
| Pinned test:lint                         | `npx --yes pnpm@10.34.6 test:lint`; UTC2026-11-15T04:25:28.964522+00:00–2026-11-15T04:25:34.171750+00:00; exit0.                                                                                                                                                                                                                                        | 2026-11-15 | PASS   |

Verification working tree is based on plan commit4d14bfc/main2fe0016b63c1c2c3028d806882dec8541735fa9f.
Closure commit97f313b closes053 first. The frozen054 snapshot remains raw SHA-256
90eabacd419af8be3b8b3de554e100ea95ec42d2fabcb2324a5587b21905d44f.
The fixture-local formatting override preserves both captured byte streams;
no root ignore/configuration exception is introduced. The supplied README forms
the provenance base; derived rows never masquerade as captured observations.

Bounded implementation-code-review checklist applied: ADR authorization scope is
owner-confirmed only; hard-close/remaining gates unchanged, all requested field
confidence and unused-field groups present, identity/claim/services/warehouse
namespaces and future-vs-current behavior distinct. Test error output contains
only relative filename/category, not offending data. No concrete remaining P1/P2
in self-review; no independent approval claimed. This task neither calls Uniship
nor performs account password rotation. Final exact-head hosted chronology will
be recorded in PR description via gh api without an evidence-only SHA loop.
Never merge. Fixture PASS is not live provider conformance or activation.

Final local metadata simulation: validatePrTaskBinding returned valid:true and
failures:[] for the exact five planned PR metadata lines. Complete staged allowlist
contains14 files, only docs/**, apps/api/test/fixtures/uniship/** and the scanner.
Both captured source hashes and the frozen snapshot hash remain unchanged.

## Review delta — remaining P2 scanner and P3 metadata (2026-11-15)

BOUNDED correction under the frozen v1 plan, reviewed/current remote HEAD
bb1fd329a7c4f689714b273988cd3301190358a3. Fetch and PR API confirm no newer commits
and a clean working tree. Read root/routed rules, task/snapshot/contract/provenance,
scanner and API native discovery. Apply pre-implementation-review and
implementation-code-review skills; no new snapshot or production change.

| Field                    | Review correction decision                                                                                                                                                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Existing recursive Uniship fixture hygiene scanner and provenance                                                                                                                                                                                   |
| Existing implementations | apps/api/test/uniship-fixtures.test.cjs raw/decoded checks and hash guards; fixture README redactions; API test/\*_/_.test.cjs discovery; testing.md                                                                                                |
| Domain owner             | Test-only fixture safety and source-provenance documentation                                                                                                                                                                                        |
| Reuse alternatives       | Reuse current walker/raw checks/JSON recursion as one callable function in the same suite; reject a parallel scanner/framework or runtime changes                                                                                                   |
| Selected approach        | JSON-key-aware explicit credential-name set, case/separator normalization, null-only approved FakeCustomer fields, safe canonical diagnostics; test-owned temporary trees for regressions                                                           |
| Rationale                | Reject credential properties even null/empty, reject populated preserved personal fields, retain ordinary README text and legitimate wire fields                                                                                                    |
| Risks                    | Broad key false positives, encoded/nested secrets, unsafe failure output, regression recursion/cleanup and accidentally rewriting captured metadata                                                                                                 |
| Verification             | RED A/B/C and isolated FakeCustomer fields against old policy; GREEN A–E plus key variants/null/empty, nested arrays/decoded keys, legacy raw/contact checks and explanatory-text positives; required pinned checks, hashes/scope and exact-head CI |

P3 authorization check: the original2026-11-15 owner request explicitly directed
committing these response fixtures and creating the PR in the existing Nexora
repository; the follow-up upload instruction said to use the two JSON files
verbatim, retaining all fields/order/types and changing only UID, Username,
CreatedBy and TransactionCode. The existing origin was verified public and owned
by the authenticated repository owner. That publication scope includes the
unchanged record ID and timestamps. Record this precise provenance in the fixture
README; do not call the remaining metadata anonymized or claim a broader provider
publication authorization. No new owner approval is invented or required here.

Documentation Impact remains REQUIRED: update this task, fixture README and the
existing testing owner for credential-property versus null-only personal-field
policy. Four intended files only; preserve both captured JSON bytes, derived data,
snapshot/digest, all old raw-text controls and production hard-close. Rule A/B and
no-merge policy remain. Record actual RED/GREEN and hosted chronology below.

### Review delta RED/GREEN and scope evidence

All local runs below use the working tree based on reviewed HEAD
bb1fd329a7c4f689714b273988cd3301190358a3, UTC2026-11-15. Logs stay only in ignored
artifacts/054-review; test inputs exist only in generated temporary directories,
cleaned through t.after even on failure. Captured source files are never mutated.

| Claim                           | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                           | Date       | Result |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| P2 previous-policy RED          | `node --test apps/api/test/uniship-fixtures.test.cjs` with behavior-preserving extraction of the existing scanner and added regressions:7 PASS/9 FAIL. A/B/C, isolated FakeCustomerName/Address/Phone, credential null/empty/key variants and decoded nested credential keys were missed. Combined D was already caught by the old phone marker, so individual-field cases prove the actual gap. E/null and old raw checks passed.                 | 2026-11-15 | FAIL   |
| P2 stronger-policy GREEN        | Same command after key-aware policy:16/16 PASS. Credential properties fail regardless of populated/null/empty value; preserved FakeCustomer fields accept only null. A–E, per-field cases, casing/separators, nested arrays/decoded keys, existing raw/contact checks and README/noncredential positives all execute. Diagnostic values are excluded and messages remain one safe line.                                                            | 2026-11-15 | PASS   |
| Sensitive-output audit          | Red/green test logs contain none of the injected synthetic credential/contact values; assertions retain only relative filename/category/canonical field identifier. No actual personal data or credentials used in regression payloads.                                                                                                                                                                                                            | 2026-11-15 | PASS   |
| P3 provenance and authorization | Original owner request explicitly required committing owner-redacted response fixtures and creating the PR in the existing public Nexora repo; subsequent upload instruction required the two files verbatim with only four listed substitutions. This includes remaining real record ID/timestamps. README now explicitly calls the result partially redacted, not anonymized; no new provider publication permission or owner approval invented. | 2026-11-15 | PASS   |
| Immutable source/snapshot       | transition-page SHA-256 b328f42ea39a2870623a7a1c28bc29b98ca6ae90f4690d9f06ba1cd6f4473a2c; china-stores8fd8c076a0598b8c195eefcea8747cc463b10ec5fce0731043b1350ee59cccdf; snapshot90eabacd419af8be3b8b3de554e100ea95ec42d2fabcb2324a5587b21905d44f unchanged. Derived JSON also untouched.                                                                                                                                                           | 2026-11-15 | PASS   |
| Discovery and test lint         | Native API discovery37 suites unchanged; all new regressions stay in the existing discovered file. Targeted pinned ESLint PASS. No new dependencies/framework/helper module/package-script change.                                                                                                                                                                                                                                                 | 2026-11-15 | PASS   |
| Review pinned format:check      | `npx --yes pnpm@10.34.6 format:check`; UTC2026-11-15T05:07:47.138283+00:00–2026-11-15T05:07:59.469031+00:00; exit0.                                                                                                                                                                                                                                                                                                                                | 2026-11-15 | PASS   |
| Review pinned docs:check        | `npx --yes pnpm@10.34.6 docs:check`; UTC2026-11-15T05:07:59.469300+00:00–2026-11-15T05:08:00.631333+00:00; exit0.                                                                                                                                                                                                                                                                                                                                  | 2026-11-15 | PASS   |
| Review pinned preflight:check   | `npx --yes pnpm@10.34.6 preflight:check`; UTC2026-11-15T05:08:00.631649+00:00–2026-11-15T05:08:01.794558+00:00; exit0.                                                                                                                                                                                                                                                                                                                             | 2026-11-15 | PASS   |
| Review pinned test:docs         | `npx --yes pnpm@10.34.6 test:docs`; UTC2026-11-15T05:08:01.794792+00:00–2026-11-15T05:08:03.202684+00:00; exit0.                                                                                                                                                                                                                                                                                                                                   | 2026-11-15 | PASS   |
| Review pinned test:preflight    | `npx --yes pnpm@10.34.6 test:preflight`; UTC2026-11-15T05:08:03.203084+00:00–2026-11-15T05:08:04.822445+00:00; exit0.                                                                                                                                                                                                                                                                                                                              | 2026-11-15 | PASS   |
| Review pinned test:lint         | `npx --yes pnpm@10.34.6 test:lint`; UTC2026-11-15T05:08:04.822646+00:00–2026-11-15T05:08:09.717672+00:00; exit0.                                                                                                                                                                                                                                                                                                                                   | 2026-11-15 | PASS   |

Review correction self-review: four authorized files only (scanner, fixture README,
testing.md and this task); complete raw/decoded traversal and old marker gates
remain, property classification is explicit rather than a broad substring rule,
no capture/digest/production/schema/SDK/API/Carrier/auth/live/capability changes.
The existing independent findings are addressed, but this self-review does not
claim independent reviewer approval. Recommendation remains pending exact-head
checks, then READY FOR INDEPENDENT REVIEW. Preserve prior CI/evidence as historical;
new-head result will be recorded in existing PR53 description without a SHA loop.
