# NEXORA-060 — Uniship canonical and hybrid mapping

Status: COMPLETED
Capability: IMPLEMENTED
Verification: VERIFIED

## Scope

Implement owner Mapping V2, superseding the earlier nine-column baseline before code.35 selected mapping correspondences after owner review v2 plus alias/exclusion validation; new owner-discussion fixture, no new live evidence. Production remains hard-closed under058. No source identity/FULL filter/engine changes, historical capture/migration/evidence rewrite, user-volume reset or merge. First commit ef0cf4e closes merged059 under §1.7;058 remains active.

## Design Review & Reuse Decision

Task ID: NEXORA-060
Classification: SIGNIFICANT
Plan revision: rev-2026-11-22-shared-numeric-v3
Reviewed baseline: f48c80bb313d7983b5ddf326f9415e8f404cfdbe
Branch: feature/uniship-mapping-extension
Design Snapshot: docs/tasks/design-reviews/NEXORA-060-rev-2026-11-22-shared-numeric-v3.md
Design SHA-256: 6eaa62e31a4746d49ca9b180cff9b00fe850af3cbe2cce292e7fa842db578301

| Field                    | Decision                                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Shipment hybrid root/reference state, scoped fee/milestone updates and typed reads                                                                                                                |
| Existing implementations | ShipmentAggregate/parser/DecimalValue; Uniship NumericLexeme/status mapper; existing source/root-locked binding, conditional batch upserts, SQL read projections, SDK and Retail exact formatters |
| Domain owner             | Shipment Aggregate owns invariant state/child decisions; Uniship infrastructure owns wire/timezone dictionary; Sync retains execution/fences                                                      |
| Reuse alternatives       | Extend existing Aggregate/binding versus adapter SQL/new repository/framework: extend; five shared core columns plus bounded actual reference JSONB versus all nine core or raw JSON              |
| Selected approach        | Narrow attribute/charge/milestone patch contracts, merge against locked state then reuse stable-key persistence; explicit ADR011 five-column read/reconciliation exception, no new index/filter   |
| Rationale                | Preserve omitted data/IDs and canonical reporting without per-carrier column proliferation or raw fields in Web                                                                                   |
| Risks                    | Duplicate fee ambiguity, JSON schema/version/namespace, exact money/time, stale staging, grants and read compatibility                                                                            |
| Verification             | Test-first normalizer/Domain, real migrated PostgreSQL/roles/Sync/API/rollback/reprocessing, SDK/UI/quality and independent P1/P2/P3 review                                                       |

## Domain invariants and Tactical DDD boundaries

Shipment is the aggregate root; charges/milestones/items/services are children. Immutable trusted owner/provider/account/source/connection scope, actor/source/root locks and existing final lease/version fence protect one atomic transaction. No network under locks, generic engine or cross-domain writer. DecimalValue, strict shipmentRecord and canonical shared vocabulary reused. Provider reference schema contains only neutral selected values, no Uniship business dictionary in Domain. Independent read projections do not hydrate aggregates and preserve owner-scoped batch queries. Nexora customer/assignee/note/code/owner metadata never accepted from provider.

## Plan

1. Complete routed inspection, storage matrix, ADR011 PLAN ISSUE decision and pre-code snapshot before code; preserve immutable raw SHA.
2. RED Domain/normalizer tests and new discussion-source fixture. Extend strict root/attributes/child patch contracts and default development processor1 (latest owner decision); preserve complete and source identity semantics.
3. Forward migration five canonical fields plus bounded provider_attributes JSONB; exact WEIGHT_FREIGHT CHECK/grants; hydrate and persist validated provider-owned operations under current fences.
4. Add typed list/detail projections, Swagger/generated SDK, Retail units/count/destination/reference/payment presentation and guards; no new filter/endpoint.
5. Genuine SQL migration/grant/parity and Sync preservation/rollback/reprocessing/HTTP tests, old behavior/limits/isolation and capacity; targeted then quality/Docker/hosted final-head gates.
6. Canonical documentation/amendment, independent review and Vietnamese A–J/PM report. No merge/live provider activation.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Owner-confirmed counts/VND amounts/reference dates (retained owner UTC+7 policy; conflicting UTC observation remains documented), storage choice and scoped patch contracts; additive read/API/UI fields and migration/grants. Earlier assumptions remain historical, not retroactive evidence.

### Canonical owners

- docs/decisions/shipment-domain-data-ownership.md
- docs/domains/shipments.md
- docs/integrations/uniship-portal-api.md
- docs/architecture/database.md
- docs/architecture/api-contract.md
- docs/architecture/sync-extensions.md
- docs/operations/testing.md
- docs/tasks/active/NEXORA-058-uniship-controlled-activation.md

### Documentation verification

- pnpm docs:check
- pnpm preflight:check
- pnpm contracts:check

## Acceptance

- [x] All35 selected mapping correspondences; retained UTC+7 policy and new services/items/declared values/count/COUNTING fee verified.
- [x] Scoped patches preserve other fees/milestones and stable IDs; ambiguous fees review, complete snapshots unchanged.
- [x] Typed attributes keys/version/size/depth/provider isolation and merge/hydration proven.
- [x] Forward migration/repeat/constraints/least-privilege/read contracts/UI regression executed.
- [x] Mapping V2 enrichment uses the same processor1/new observation; identity and no-historical-backfill behavior preserved.
- [x] Required quality/independent review and hosted implementation evidence recorded in shared-numeric-v3. Exact final evidence-commit HEAD verification is recorded separately in PR59; earlier runs are not substituted for it.

## Evidence

| Claim                | Evidence                                                                                                                                                        | Date       | Result |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Baseline and closure | origin/main5e96199 includes PR57; final6a9b916 Foundation44492510769 and Preflight44492510779 PASS; separate ef0cf4e closes059 with docs:check PASS             | 2026-11-20 | PASS   |
| Pre-code recorded    | Routed docs/source/tests inspected; signed v1 storage/reuse/DDD/security/contracts/test review frozen before code; no production registry/live transport change | 2026-11-20 | PASS   |

## PLAN ISSUE decisions

STORAGE_PLACEMENT resolved by selected narrow ADR011 amendment: current shared singleton reconciliation/display need justifies five typed root fields despite no new filter. Four source reference facts use the actual closed JSONB schema, not prospective columns. No index/filter framework. Duplicate-target charge ambiguity uses Domain conflict → NEEDS_REVIEW/SOURCE_CONFLICT. Captured fixtures/hashes immutable; owner supplied all four milestone dates and matching ExDate via discussion, retained in a new explicitly labelled fixture. Legacy staged payload remains processable but cannot recover fields never staged; no automatic backfill claim.

## Initial implementation and review evidence (before hosted results)

See [Mapping V2 A–J/PM report](../evidence/NEXORA-060/implementation-report.md).
Domain/normalizer tests executed RED/GREEN; migrated Docker PostgreSQL SQL roles,
forward/repeat/drift, Shipment22/22, Uniship12/12 and Sync61/61 PASS. Independent
review closed threeP2 (count exponent, calendar/TZ coverage, canonical confidence
wording), no open finding in reviewed working tree. Captured fixtures and reference
remain unchanged. Full quality/final-head hosted results pending. Local Chromium
column-picker background assertion FAIL reproduces on unchanged baseline ef0cf4e;
not hidden or fixed outside mapping scope. Production remains hard-closed under058.

## Verification delta on implementation38cce9b

| Claim                        | Evidence                                                                                                                   | Date       | Result |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Full local quality           | pnpm quality after generated contracts committed: scripts182/API264/Web366/UI37/database6 tests, typecheck/contracts/build | 2026-11-20 | PASS   |
| Full real PostgreSQL API     | 179/179 after signed disposable base migration/legacy-role/storage prerequisites; no user volume mutation                  | 2026-11-20 | PASS   |
| Independent review           | 27/27 tests independently executed; no open P1/P2/P3 on38cce9b; snapshot/captures unchanged                                | 2026-11-20 | PASS   |
| Hosted first head            | Preflight44698351386 and Sync44698351380, attempt1, source38cce9b                                                          | 2026-11-20 | PASS   |
| Hosted Foundation first head | 44698351390/job136160428827 attempt1, step7 migration oracle expected16 instead of new17; steps4/5 PASS, step8 NOT RUN     | 2026-11-20 | FAIL   |

Review delta: runtime-smoke.sh migration-count oracle16→17 for the task's new
forward migration, stored_files=0 and all other assertions retained; no workflow
change, retry or timeout adjustment. sh-n and physical migration count17 PASS.
Fresh exact-HEAD checks required after push; no gh run rerun performed.
See [independent RED/GREEN](../evidence/NEXORA-060/review-and-red-green.md) and
[A–J report](../evidence/NEXORA-060/implementation-report.md). Final live CI status
is recorded in PR59 description with source SHA/run IDs, not inferred from local tests.

## Final executed verification on code73d984b

| Claim                       | Evidence                                                                                                                                                                                                           | Date       | Result |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| Hosted code gates           | source73d984b4e6fdd3694369de2cc5dcd3a9335b3aad; merge checkout58439f3d8c77979a7a5331c073e5a1e8ae10423e; Preflight44699768005, Sync44699767860, Foundation44699767849/job136165016539, all attempt1, steps4–10 PASS | 2026-11-20 | PASS   |
| Local actual Retail browser | Compiled TSX/CSS; canonical Page.bringToFront prerequisite added only to temporary runner; all verifyRetailBrowser assertions including native detail/create and six viewports, exit0                              | 2026-11-20 | PASS   |

Earlier local focus failures and Foundation migration-count failure remain
historical evidence. No CSS/assertion/timeout/workflow bypass. No open independent
P1/P2/P3; source code unchanged after reviewed migration oracle correction.
Task remains active pending latest-head CI, owner review and merge under §1.7.
Previously verified implementation results are historical evidence only, not a claim
that subsequent changes passed. Capability mapping is implemented; NEXORA-058
production activation remains separate.

## Follow-up verification after review fixes

- PR head `e1e4357547d54b5dae7e65356955ce6dc39d7f54`: Preflight `44707219991`,
  Sync targeted PostgreSQL `44707219962` and optional Public HTTPS `44707219974` PASS.
  Foundation `44707220283` FAIL at `pnpm format:check` because
  `apps/api/test/uniship/mapping-v2.test.cjs` needed Prettier formatting.
  Browser/runtime acceptance later in Foundation was NOT RUN; missing artifact
  uploads are downstream effects, not additional product failures.
- Follow-up code commit applies Prettier-compatible assertion formatting without
  weakening tests. A new exact-HEAD Foundation PASS remains mandatory.
- The P2 evidence contradiction is resolved by marking current verification PENDING
  and keeping already-green earlier SHA/run results as historical evidence.
  PR description should reference the final current HEAD and its actual workflow runs.

## Review delta v2 — owner decisions2026-11-20, implementation2026-11-21

Prior UTC+7 confirmation is superseded: UTC (owner evidence2026-11-20:
API03:03:16 ↔ UI10:03:16). MD59639 session03:02:35UTC and parcel343558
ModifiedDate03:19:58 before capture03:20:50UTC establish same-instant UTC parsing.
35 selected correspondences now include four numeric service flags, ProductAmount
CNY, ProductNumber, one ProductName item, and CheckFeeVND COUNTING. Existing schema/
DTO/SDK/contracts and processor2 remain; no production/backfill claim.
Snapshotv1 and earlier evidence are immutable historical records, not current
UTC correctness proof. Current verified status stays partial until new tests/CI.

Reuse: existing calendar parser renamed with no offset, exact DecimalValue/sourceCount,
NEXORA-055 complete services/items, existing scoped charge merge with COUNTING.
Services snapshot semantics: numeric flags only; null creates no entry/unknown; when
all flags missing/null omit collection. Nonblank ProductName is a complete one-line
item snapshot; null/blank omits collection. No inferred quantity/value or fee flags.
No migration, grant or public API/SDK change. Preserve warehouse name/ID coupling
and reported-total wording fixes already present at074298d.

Rules A/B: task-owned test/fixture/script/format/environment errors are fixed with
evidence; stop for unrelated existing test failure, Preflight CI failure or need
for out-of-scope Foundation step/fixture-order/browser namespace/retry/timeout/
assertion changes. No merge, CI rerun for green or live activation.

Snapshot v2 carries forward the original v1 inspection inventory; its “no060 task/PR
exists” sentence describes the original v1 inspection, not current state. Current
review baseline074298d already contains task060/PR59 and the appended v2 review
records that fact. Frozen snapshot bytes/digest remain unchanged.

## Review v2 executed local verification

See [review-v2 evidence](../evidence/NEXORA-060/review-v2.md). RED3/10 then GREEN10/10;
all Shipment/Uniship units48/48; genuine owned PostgreSQL Shipment22/22 and
Uniship12/12 PASS. Strict UTC storage, service/item rows, CNY declared value/count,
COUNTING0.00, repeated child ID/xmin and null omission are verified. Required local
format/lint/typecheck/contracts/docs/preflight/test:docs/test:preflight PASS;
independent code review48/48, no P1/P2 code finding. Report corrections applied.
New exact-HEAD CI remains required; no prior green or v1 timestamp claim substitutes.

## V2 hosted verification — code8b24f69

| Claim                 | Evidence                                                                                                                                                                                                                  | Date       | Result |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Owner review v2 gates | source8b24f69482b6275b298f091d0db6b913a251b7b7; actual merge checkout413b2a8f9b77c472ac533865c5441845bb244185; Preflight44908003499, Sync44908003491, Foundation44908003476/job136857611753, all attempt1, steps4–10 PASS | 2026-11-21 | PASS   |

Current UTC/services/products/counting semantics are verified by v2 tests/CI,
not the superseded v1 timestamp interpretation. No open independent finding.
All historical evidence remains. The evidence-only final HEAD is checked separately
and recorded in PR59 metadata; task stays active for owner review/merge under§1.7.
NEXORA-058 production activation remains outside this capability verification.

## Latest owner decision — retain Vietnam local time, local-time-v2

The latest request supersedes the immediately preceding UTC interpretation and
UTC-only readiness claims as current policy. Restore original
parseUnishipLocalTimestamp exactly, with UTC+7→UTC conversion. Keep all35 mappings,
services/items/COUNTING/product semantics and count caveat. New separately named
local-time-v2 snapshot preserves both frozen earlier snapshots. Conflicting MD59639
API03:03:16/UI10:03:16 remains review evidence, not resolved by unit/CI.

Add mandatory058 post-first-real-sync, pre-auto-schedule comparison of three parcels'
warehouse milestones;7-hour discrepancy requires schedules stopped/disabled, a
separate UTC correction task and fresh sync overwriting provider-owned timestamps.
No live request or activation here. Web formatter already uses Asia/Ho_Chi_Minh;
add explicit time-of-day/host-TZ regression. Earlier PASS/FAIL rows remain historical.
Current local-time-v2 technical verification/CI is pending.

## Retained-local-time v2 executed local evidence

See [review-local-time-v2](../evidence/NEXORA-060/review-local-time-v2.md).
Policy RED13/17 then related GREEN72/72; Retail143/143; actual owned PostgreSQL
Shipment22/22 and Uniship12/12 PASS. Original helper byte-equivalent to074298d.
Required local format/lint/typecheck/contracts/docs/preflight/test:docs/test:preflight
PASS; independent55/55 plus17/17, no open finding. Technical policy verification
is distinct from058's actual three-parcel comparison, which remains NOT RUN.
No new exact-HEAD green is claimed before hosted checks finish.

## Retained-local-time v2 hosted technical verification

| Claim                        | Evidence                                                                                                                                                                                                                   | Date       | Result |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Local-time policy code gates | source b6bb4c02d63365f27d62f30aadc7427542835efc; actual merge checkout4cf06cc818ca15b8de383a0483be2e587a1cd05c; Preflight44918310509, Sync44918310211, Foundation44918310218/job136888597383, all attempt1, steps4–10 PASS | 2026-11-21 | PASS   |

VERIFIED here means implementation of the latest owner-selected UTC+7 policy and
existing35 mappings, not a proven external timezone. NEXORA-058 live comparison
of3parcels remains NOT RUN and blocks automatic schedules. Task stays active
for owner review/merge; evidence-only final HEAD/run IDs are recorded in PR59.

## Owner shared-numeric refactor — revision v3 (2026-11-22)

Three explicit owner decisions: pure @nexora/shared/numeric algorithms with real
API/Web consumers and exact behavior parity; default Uniship processor.version1
for unreleased development; ShipmentWeightUnit.KILOGRAM canonical kg. Mapping V2
name, uniship-parcel-v1, attributes schemaVersion1 and generic observation/processor
fences remain distinct/unchanged. No SQL read adapter/schema/migration/registry/
UTC+7/activation change. Scope remains this PR59; no new PR.

Mandatory three-component reuse matrix and interfaces are frozen in shared-numeric-v3
snapshot§3–8. Shared owns neutral string/math algorithms, Domain facade/error and
nonnegative field rules remain, NumericLexeme/reviver/provider/page/clock policy stay
in infrastructure. Web lexical guard is not narrowed to Domain precision; filters
retain separate bounded policy. Single mapping repo uses processor1 for seed/new
observation/repeat; generic upgrade/mismatch/security tests are retained.

Documentation Impact remains REQUIRED: current domain/Sync defaults, numeric/unit
ownership, reusable registry, testing, task/evidence and PR metadata. Historical
processor2 decisions, snapshots and PASS/FAIL rows remain history, not current
default or new-head verification. New refactor quality/CI pending.

### Shared-numeric v3 implementation evidence

See [shared-numeric-v3](../evidence/NEXORA-060/shared-numeric-v3.md) for extraction
parity RED/GREEN, genuine PostgreSQL179/179, targeted regression194/194 and independent
review. Full local quality PASS (scripts182/API271/Web368/shared2/UI37/database6;866 total). Narrow boundary adaptation permits the numeric leaf and Node test harness while
enforcing numeric purity and blocking production imports of shared tests. Generic processor
security tests, UTC+7 and058 live gate remain unchanged. Final hosted exact-HEAD
verification is pending and is not inferred from prior green commits.

### Shared-numeric v3 hosted acceptance

Implementation ca41a5355050cf505f2039b7b217fef915d983e1 checked out actual merge
60639691d073392abc9aae344bd6bb3b3f6298a8. All attempt1 PASS: Preflight44989381569,
Sync44989381573, Foundation44989381561/job137106874206 (steps4–10).
See [hosted evidence](../evidence/NEXORA-060/shared-numeric-v3.md#hosted-implementation-verification).
This supersedes earlier v3 pending notes for implementation acceptance. The final
evidence-only HEAD and its own CI remain separately tracked in PR59.058 real
three-parcel gate remains NOT RUN and automatic scheduling stays blocked.

## Closure after PR59 merge —2026-11-22

Closed by NEXORA-061 under Task Workflow §1.7. GitHub API confirms PR59 merged
on2026-11-22T06:16:31Z (13:16:31 Asia/Ho_Chi_Minh), merge
4708721661b00781d0581840cca548a11e971ad5. Original HEAD
97a6b6d6f7928431f0b5fabdf78fc8c39ef976af had Preflight44991036178,
Sync44991036183 and Foundation44991036204/job137111922905 attempt1 PASS;
actual merge checkout ea1bcd478793fd04e7e8dec3726890612002de6a, steps4–10 PASS.
Historical evidence/snapshots remain immutable. Live/external authorization/custody
and required three-parcel time comparison remain NOT RUN in the named
[NEXORA-058 follow-up](NEXORA-058-uniship-controlled-activation.md),
Status PLANNED. No live/production/automatic schedule gate is promoted to PASS.

| Claim                     | Evidence                                                                                                                                                                   | Date       | Result |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| PR59 merged and060 closed | gh api repos/dinhphuquy2k1/nexora/pulls/59: merged=true; merge4708721661b00781d0581840cca548a11e971ad5; merged_at2026-11-22T06:16:31Z. Verified by061 before first commit. | 2026-11-22 | PASS   |
