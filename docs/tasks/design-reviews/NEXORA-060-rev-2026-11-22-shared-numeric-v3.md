# NEXORA-060 — shared numeric primitives, development processor1 and kilogram

Task ID: NEXORA-060
Classification: SIGNIFICANT
Plan revision: rev-2026-11-22-shared-numeric-v3
Reviewed baseline: f48c80bb313d7983b5ddf326f9415e8f404cfdbe
Branch: feature/uniship-mapping-extension

## 1. Requirements and scope

Owner explicitly requests three refactors in PR59: real API/Web shared pure numeric
algorithms, default Uniship processor1 for unreleased development, canonical kilogram
constant. Mapping V2 stays named V2; identity uniship-parcel-v1, attribute schema1,
observation versions, migrations and generic version fences are separate concepts.
No new PR, DB/schema/migration/read-SQL/registry/UTC+7/activation change or merge.
Historical snapshots, capture digests and executed outcomes stay immutable.

## 2. Inspected source and consumers

Read routed AI governance, ADR008/009/011, Shipment/Sync/testing docs, active060 and
its frozen local-time-v2 snapshot. Repository/remote f48c80b clean. Inspect shared
validation/shipment exports and package metadata, DecimalValue/parser, Uniship
NumericLexeme/count/decimal/ID/page/status code, processor and locked binding, typed
read port/Swagger DTO, Retail response/filter/format/renderers, units and real PG
mapping fixture. Existing shared has no numeric subpath or test task. Boundaries:
API object() checks prototype; Web record() does not. Filters are nonnegative/bounded
and normalize Number values; transport decimal guard is lexical only. Preserve all.

## 3. Mandatory reuse audit for three improvements

| Field                    | Shared numeric                                                                                                                                                       | Processor version                                                                                    | Canonical unit                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Component                | Exact numeric validation/canonicalization                                                                                                                            | Unreleased Uniship default and mapping acceptance                                                    | Shipment kilogram code                                                                                 |
| Existing implementations | shipment.ts DecimalValue; normalizer.ts sourceCount/sourceDecimal/integerText/integer; processor oldStatus regex; response.ts decimal regex; filters distinct policy | UnishipShipmentProcessor(default2), mapping-v2 PG fixture v1/v2 repositories, generic/binding fences | shipment index pure constants; Domain/read port kg types; normalizer/guard/DTO/render/filter kg values |
| Owner                    | Pure algorithm shared; business failures/nonnegative policy Domain/adapter                                                                                           | Provider development declaration; Sync owns generic fences                                           | Browser-safe Shipment contract leaf                                                                    |
| Alternatives             | API-only common cannot serve Web; universal validator mixes policies; keep repeated regex rejected                                                                   | Artificial upgrade test vs same processor1/new observation: latter                                   | Generic unit/currency framework rejected; one as-const kilogram                                        |
| Selected approach        | Five neutral exports in numeric subpath; retain facades/policies                                                                                                     | Default1 and one mapping repository; explicit generic upgrade/mismatch tests untouched               | ShipmentWeightUnit and type; replace equal-meaning comparisons/types/output only                       |
| Rationale                | Single production implementation and true Web consumer with exact parity                                                                                             | Mapping name is not processing upgrade; no production compatibility mandate                          | One actual contract value, unchanged JSON/UI                                                           |
| Risks                    | Lexical edge cases, negative zero, exponent limits, precision, guard narrowing, bundling                                                                             | False reprocessing evidence, observation/version confusion                                           | Accidental schema/display drift or blind property renames                                              |
| Verification             | Frozen pre-refactor output vectors, independent expected cases, API/Web guard parity and builds                                                                      | Real same-version observation1→2, repeat2 and old minimal no fabricated fields; rollback/fences      | Literal wire kg regression, malformed units rejected, unchanged contracts/rendering                    |

## 4. Numeric interfaces and semantics

Add packages/shared/src/numeric/exact-integer.ts, exact-decimal.ts and index.ts;
export only parseNonNegativeInt32, parseUnsignedIntegerText, parseUnsignedSafeInteger,
isDecimalString and parseExactDecimal through @nexora/shared/numeric. All invalid
inputs return null (predicate false); no Domain/Node/framework imports or new deps.
No unused generic bigint parser export.

Count primitive moves existing bounded BigInt algorithm exactly: raw source <=128,
optional minus, decimal fraction, exponent max4digits; zero shortcut before sign/
exponent magnitude checks, integral division only, nonnegative int32 max2147483647.
Preserve count's permissive leading-zero string grammar; actual JSON lexical extraction
remains in infrastructure. Strict ID/status/pagination text instead keeps original
0-or-nonzero-leading-digit max128 grammar (no fraction/exponent/leading zeros).
Safe integer validates bounds with BigInt before Number; same accepted values/output.
OldStatus staged validation reuses that exact text grammar without changing claim policy.

Exact decimal moves current lexical regex and precision/scale/padding/no-rounding
algorithm once; normalize negative zero as before, permit signed decimals according
to caller, reject exponent notation. Preserve existing valid-call-parameter behavior,
including scale0 output and JavaScript regex end-anchor edge cases. Web uses only
isDecimalString, with no precision/scale/nonnegative tightening. Filters retain their
separate numeric function/output; only kilogram display references may change.
DecimalValue.parse remains Domain facade translating null into ShipmentError.
sourceDecimal retains NumericLexeme, Domain facade and provider nonnegative policy.

## 5. Domain and infrastructure boundary

Shipment aggregate/invariants/closed commands and persistence stay unchanged.
Infrastructure retains NumericLexeme, JSON reviver/context.source, object prototype,
envelope/diagnostics/pagination, warehouses, identity/mapping and exact original
UTC+7 helper. Shared owns only neutral math/string validation and Shipment unit code.
No transaction, lock order, owner isolation, root/child hydration or network change.

## 6. Processor1 acceptance design

Use one repo named repo, constructed from default UnishipShipmentProcessor; assert
version1. Seed a minimal root payload with existing legacy children for preservation,
then enrich through a new observation with the same processor1. Verify identity/code,
Nexora fields/history and child IDs preserved, observed source version1→2, staged
processor_version1/source_version2. Repeating identical observation stays2 and children
xmin unchanged. Separate old minimal record repeats with same processor1 and stays
sourceVersion1 with no invented attributes. Keep rollback, conflicts, privacy/isolation.
Do not change explicit generic processor upgrade/mismatch/stale/fence regressions.

## 7. Kilogram contract

ShipmentWeightUnit={KILOGRAM:kg} as const plus ShipmentWeightUnitCode in existing
shipment leaf. Domain/read types, Domain checks/normalized value, adapter value,
Web guard, Swagger enum and matching physical-weight renderer/filter text use it.
Keep weightKg/weight_kg/WEIGHT_FREIGHT names and literal kg test expectations/history.
No g/lb/currency/pricing framework; JSON/API/output must remain identical.

## 8. Compatibility and parity

Before production edits capture deterministic vectors by executing the f48c80b
implementations (TS private helpers extracted for test capture only, Domain facade
and actual old Web lexical predicate). Persist outputs as compact test specification,
not duplicate production algorithms. Include exact stated edge cases, malformed/types,
length/exponent/negative-zero/leading-zero/huge precision/newline behavior. Tests assert
shared outputs and facade/error/wire behavior; direct examples provide independent
expectations. Add shared test discovery task using repository checker; no test skip.
Swagger/SDK must regenerate reproducibly with zero diff despite enum source refactor.

## 9. Security, performance and non-goals

Bounded exact algorithms retain existing work limits; BigInt count powers remain
bounded, safe IDs max128 digits, no float precision decision. No raw payload/PII,
user DB reset, migrations, SQL projection edit, generic engine edit or activation.
No performance claim without measurement. Browser consumers use actual package export;
build/fixture/runtime verifies bundling, not fake imports. UTC+7/058 gate remains.

## 10. Documentation impact

REQUIRED: reusable registry, current Shipment/Sync/Uniship implementation defaults,
testing commands, task060/reuse audit/evidence/PR metadata. Add dated decision;
historical version2 snapshots and CI outcomes are not rewritten. Distinguish mapping,
processor, source identity, attribute schema, observation and migration versions.

## 11. Verification plan

RED shared primitives/version default tests; GREEN direct shared/parity/API/Web,
real owned disposable PostgreSQL complete API integration with same-version tests,
required shared/API builds/tests, format/lint/preflight/docs/typecheck/contracts/test/
build then canonical quality. Preserve fences and negative tests. Independent review
per project skill. If checks fail, fix task-owned causes; no weakened assertion,
workflow workaround or action rerun for green. Record actual FAIL/NOT RUN/BLOCKED.

## 12. Delivery and readiness

Same PR59; formatted new immutable snapshot before SHA/task/five-field PR binding.
Commit coherent refactor plus tests/docs, push and await exact-final-HEAD Preflight,
Sync Targeted/Foundation and other applicable runs. No merge or production enablement.
Live058 three-parcel clock verification remains NOT RUN and gates automatic schedules.
Old CI f48c80b is baseline history only, never proof for this refactor.
