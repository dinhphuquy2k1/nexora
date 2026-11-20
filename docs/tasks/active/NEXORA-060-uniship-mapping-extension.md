# NEXORA-060 — Uniship canonical and hybrid mapping

Status: VERIFICATION PENDING
Capability: IMPLEMENTED
Verification: NOT VERIFIED

## Scope

Implement owner Mapping V2, superseding the earlier nine-column baseline before code.27 selected mapping correspondences plus alias/exclusion validation; new owner-discussion fixture, no new live evidence. Production remains hard-closed under058. No source identity/FULL filter/engine changes, historical capture/migration/evidence rewrite, user-volume reset or merge. First commit ef0cf4e closes merged059 under §1.7;058 remains active.

## Design Review & Reuse Decision

Task ID: NEXORA-060
Classification: SIGNIFICANT
Plan revision: rev-2026-11-20-uniship-mapping-v1
Reviewed baseline: ef0cf4e7e793a3d10844ebfa39b87869b51f6755
Branch: feature/uniship-mapping-extension
Design Snapshot: docs/tasks/design-reviews/NEXORA-060-rev-2026-11-20-uniship-mapping-v1.md
Design SHA-256: e5c3f9ea98e01f96816a59bb277f999004c181653d791f294af7df1155c8af35

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
2. RED Domain/normalizer tests and new discussion-source fixture. Extend strict root/attributes/child patch contracts and default processor2; preserve complete and source identity semantics.
3. Forward migration five canonical fields plus bounded provider_attributes JSONB; exact WEIGHT_FREIGHT CHECK/grants; hydrate and persist validated provider-owned operations under current fences.
4. Add typed list/detail projections, Swagger/generated SDK, Retail units/count/destination/reference/payment presentation and guards; no new filter/endpoint.
5. Genuine SQL migration/grant/parity and Sync preservation/rollback/reprocessing/HTTP tests, old behavior/limits/isolation and capacity; targeted then quality/Docker/hosted final-head gates.
6. Canonical documentation/amendment, independent review and Vietnamese A–J/PM report. No merge/live provider activation.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Owner-confirmed counts/VND amounts/UTC+7/reference dates, storage choice and scoped patch contracts; additive read/API/UI fields and migration/grants. Earlier assumptions remain historical, not retroactive evidence.

### Canonical owners

- docs/decisions/shipment-domain-data-ownership.md
- docs/domains/shipments.md
- docs/integrations/uniship-portal-api.md
- docs/architecture/database.md
- docs/architecture/api-contract.md
- docs/architecture/sync-extensions.md
- docs/operations/testing.md

### Documentation verification

- pnpm docs:check
- pnpm preflight:check
- pnpm contracts:check

## Acceptance

- [ ] All27 selected mapping rows stored/read correctly, zero/null/UTC+7 exact.
- [ ] Scoped patches preserve other fees/milestones and stable IDs; ambiguous fees review, complete snapshots unchanged.
- [ ] Typed attributes keys/version/size/depth/provider isolation and merge/hydration proven.
- [ ] Forward migration/repeat/constraints/least-privilege/read contracts/UI regression executed.
- [ ] Version2/reprocessing preserves source identity; no automatic historical backfill or production activation claim.
- [ ] Required quality/independent review/final-head hosted evidence and PM report.

## Evidence

| Claim                | Evidence                                                                                                                                                        | Date       | Result |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Baseline and closure | origin/main5e96199 includes PR57; final6a9b916 Foundation44492510769 and Preflight44492510779 PASS; separate ef0cf4e closes059 with docs:check PASS             | 2026-11-20 | PASS   |
| Pre-code recorded    | Routed docs/source/tests inspected; signed v1 storage/reuse/DDD/security/contracts/test review frozen before code; no production registry/live transport change | 2026-11-20 | PASS   |

## PLAN ISSUE decisions

STORAGE_PLACEMENT resolved by selected narrow ADR011 amendment: current shared singleton reconciliation/display need justifies five typed root fields despite no new filter. Four source reference facts use the actual closed JSONB schema, not prospective columns. No index/filter framework. Duplicate-target charge ambiguity uses Domain conflict → NEEDS_REVIEW/SOURCE_CONFLICT. Captured fixtures/hashes immutable; owner supplied all four milestone dates and matching ExDate via discussion, retained in a new explicitly labelled fixture. Legacy staged payload remains processable but cannot recover fields never staged; no automatic backfill claim.

## Implementation and review evidence

See [Mapping V2 A–J/PM report](../evidence/NEXORA-060/implementation-report.md).
Domain/normalizer tests executed RED/GREEN; migrated Docker PostgreSQL SQL roles,
forward/repeat/drift, Shipment22/22, Uniship12/12 and Sync61/61 PASS. Independent
review closed threeP2 (count exponent, calendar/TZ coverage, canonical confidence
wording), no open finding in reviewed working tree. Captured fixtures and reference
remain unchanged. Full quality/final-head hosted results pending. Local Chromium
column-picker background assertion FAIL reproduces on unchanged baseline ef0cf4e;
not hidden or fixed outside mapping scope. Production remains hard-closed under058.
