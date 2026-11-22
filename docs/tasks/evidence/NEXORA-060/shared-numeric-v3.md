# NEXORA-060 — shared numeric / development processor1 / canonical kilogram

Date:2026-11-22 (Asia/Ho_Chi_Minh). Reviewed baseline
f48c80bb313d7983b5ddf326f9415e8f404cfdbe. This addendum supersedes earlier
processor2 choices as current development policy; historical snapshots/CI stay intact.
Plan: rev-2026-11-22-shared-numeric-v3; frozen snapshot SHA-256
6eaa62e31a4746d49ca9b180cff9b00fe850af3cbe2cce292e7fa842db578301.

## Ownership and compatibility

- `packages/shared/src/numeric/` owns pure count, plain unsigned integer, safe integer,
  lexical decimal and exact decimal algorithms. Package numeric exports/typesVersions
  and real API/Web consumers exist. No dependency was added.
- Shipment `DecimalValue.parse` delegates the only canonical precision/padding algorithm
  and retains `ShipmentError(VALIDATION_ERROR)`. Count failure remains a Domain error
  translated by the existing provider pipeline; envelope failure remains SOURCE_INVALID.
- Uniship retains NumericLexeme, source JSON numeric context, envelope/object checks,
  ID/status/paging policy, timezone/calendar logic and nonnegative monetary checks.
  Retail consumes only lexical decimal validation; filters and record prototypes stay.
- `ShipmentWeightUnit.KILOGRAM`/`ShipmentWeightUnitCode` own `kg` across Domain,
  normalizer, read type, Swagger and equivalent Web guards/render/filter labels.
  Independent assertions retain the literal wire value. No conversion framework.
- Mapping V2 is a mapping name. Default Uniship processor1 uses one integration
  repository: minimal observation version1, new richer observation2, repeat2.
  Stable root/code/Nexora data/children/history and missing historical facts are checked.
  Generic upgrade/mismatch/stale/final-fence tests are unchanged.
- Boundary adaptation explicitly allows only the pure numeric leaf in Domain and
  enforces numeric-local imports. Node builtins are allowed only in shared test files;
  production-to-test imports are denied. Production framework/database guards remain.

## RED / GREEN and independent review

| Evidence                                                           | Result                                                                                             |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| New shared test before numeric export/implementation               | RED: numeric subpath unavailable, exit1                                                            |
| Actual baseline processor class against default-version1 assertion | RED: actual2, expected1, ERR_ASSERTION                                                             |
| Shared direct suite and discovery                                  | GREEN:2/2, discovery1 suite                                                                        |
| Baseline parity fixture                                            | 53 strings;212 precision/scale output vectors, plus counts/plain/safe integers/Web lexical results |
| Actual API facade + processor / Retail model tests                 | GREEN:10/10                                                                                        |
| Targeted Uniship/Shipment/Retail regression                        | GREEN:194/194                                                                                      |
| Genuine full `pnpm test:integration`                               | GREEN:179/179,0 skipped, PostgreSQL17.11,203744.84805ms                                            |
| `pnpm test:docs`                                                   | GREEN:10/10                                                                                        |
| `pnpm test:preflight`                                              | GREEN:24/24; intentional negative diagnostic output is asserted                                    |

The static parity fixture was captured from the baseline private helpers/DecimalValue/
Web predicate using TypeScript AST extraction before editing implementation. It includes
maxima, overflows, integral exponent/count forms, malformed inputs, negative zero,
leading zeros, lexical-only wide decimals and existing line-terminator behavior.
No production eval or duplicate reference algorithm was added. Wrong-type tests are direct.

PostgreSQL ran on a task-owned signed disposable cluster with private credentials,
loopback random port and tmpfs data, using the existing integration runner and real
migrations/roles/Nest HTTP. No user database or volume was reset.

Independent reviewer executed12/12 focused tests and checked53/212 parity cases.
P2 rollback helper dangling repository name was corrected to `repo.apply` before
successful PostgreSQL completion. P2 production→test boundary bypass was closed with
a narrow deny rule and negative selftests; reviewer reran9 independent probes PASS.
No remaining P1/P2 finding was reported. Initial quality attempts exposed missing
numeric-leaf approval/Node test scope in the old boundary checker; these task-owned
integration gaps were fixed without changing numeric or business behavior.

## Final validation and delivery

Executed local `pnpm quality`: PASS, including format:check, lint, preflight:check,
docs:check, typecheck, root test, contracts:check and build. Root test totals866/866:
scripts182, API271, Web368, shared2, UI37, database6; zero failures/skips.
Separate API/Web test commands also PASS271/271 and368/368. Shared/API builds PASS.
Contracts reproducible PASS with no OpenAPI/SDK diff. Separate docs/preflight tests
PASS10/10 and24/24; targeted194/194 and genuine PostgreSQL179/179 as above.
Final hosted CI is pending; baseline f48c80b results
are historical only. Exact final HEAD, merge checkout SHA, workflow run IDs/attempts
and status will be recorded in PR59 through gh api. No rerun-for-green, merge or activation.

Raw SQL/read projections, schema/migrations/grants, SDK/OpenAPI wire, source identity,
providerAttributes.schemaVersion, generic Sync engine/fences, UTC+7 and captured
fixtures/digests stay unchanged. NEXORA-058 mandatory real three-parcel comparison
remains NOT RUN and blocks automatic schedules.
