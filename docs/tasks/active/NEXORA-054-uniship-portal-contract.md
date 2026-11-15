# NEXORA-054 — Uniship customer-portal contract and redacted fixtures

Status: IN PROGRESS
Capability: PLANNED
Verification: NOT VERIFIED

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

| Claim                                    | Evidence                                                                                                                                                                                                                  | Date       | Result |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Initial task structure                   | docs:check FAIL because NOT VERIFIED task lacked the required canonical Evidence table. Rule A adds this table in the mutable task; frozen snapshot unchanged.                                                            | 2026-11-15 | FAIL   |
| Read-only source and boundary inspection | Main baseline2fe0016b63c1c2c3028d806882dec8541735fa9f; task054 vacant; PR52 merged and issue50 closed; owner-supplied JSON/README captured2026-11-15, preliminary forbidden-marker scan clean; live hard-close unchanged. | 2026-11-15 | PASS   |
