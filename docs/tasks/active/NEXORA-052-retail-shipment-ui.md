# NEXORA-052 — Retail Shipment API integration

Status: VERIFICATION PENDING
Capability: IMPLEMENTED
Verification: PARTIALLY VERIFIED

## Design Review & Reuse Decision

Task ID: NEXORA-052
Classification: SIGNIFICANT
Plan revision: rev-2026-11-14-retail-shipment-ui-v2
Reviewed baseline: 6a30e82f9ae4deda310901c478d7b0a4fdcb9f8e
Branch: feat/retail-shipment-ui
Design Snapshot: docs/tasks/design-reviews/NEXORA-052-rev-2026-11-14-retail-shipment-ui-v2.md
Design SHA-256: 543f1fa916c7ad09c9fa4e1d110fffe6cf0e73f46128e78b526fbdc182c06501

## 2. Requirements and scope

Connect the existing protected Retail list/detail to the three current Shipment GET
APIs. Implement owner decisions D1–D11 from the task request, preserving all twenty
column IDs/widths/order/presets, responsive layout, typography, tokens and shared
controls. No API/DTO/SDK/database changes, writes, provider adapter/registration,
server advanced filtering, Customer Pager colours, Carrier CSS, new dependencies,
viewport or browser tolerance changes. Close merged051 first under §1.7.

## 3. Canonical owners and inspection

Read AGENTS and routed PROJECT_CONTEXT/RULES, TASK_WORKFLOW1.4–1.7/2,
IMPLEMENTATION_WORKFLOW, ADR009/template/pre-implementation-review skill, frontend,
design-system/reusable registry, Shipments read summaries/PROVISIONAL mapping/tab
contract, API contract and testing Retail/Pager sections. Web Tier C owns this
presentation/read integration; packages/ui stays transport/domain-neutral.
Documentation impact REQUIRED: frontend.md, shipments.md, testing.md and registry
usage text if affected. Backend remains authoritative and registration stays empty.

## 4. Existing code and reuse search

Inspected retail-packages types/columns/query/filters/useRetailQuery/ListPage/Table/
DetailDrawer/FeeSection/ColumnPicker/FilterPopover/CreateDrawer/Pagination/Dialog,
the production page, Customer api/response/errors/read-state/useCustomerRead/request,
workspace-client/session coordination, generated Shipment DTOs, Shared Shipment
codes, retail and pager-filter fixtures/tests/builders/browser checks. Searches
covered RetailPackage, StatusTabKey, filterPackages, calendarDay, formatCNY/VND,
read lanes, AbortController, MALFORMED_RESPONSE, column registry and browser asserts.
Current production passes unavailable/empty; the fixture carries numeric prices and
fake timelines. Shared TabBar supports disabled items; Pager/FilterPopoverShell and
column-picker already own the required geometry/interaction contracts.

## Reuse audit

| Field                    | Decision                                                                                                                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Feature-local Shipment API/guards/read hooks, presentation/format/row projection, existing Retail page/table/drawer and synthetic browser adapter                                                                                                                                     |
| Existing implementations | customers/api.ts response.ts errors.ts read-state.ts useCustomerRead.ts request.ts; lib/api/workspace-client.ts; existing Retail components/query/filter/columns; packages/ui TabBar/Pager/Overlay/Button and existing fixture CDP harness                                            |
| Domain owner             | Web Tier C Shipment presentation and GET transport; backend owns persistence/auth/stages/counts. No new aggregate, commands, DB or shared business labels                                                                                                                             |
| Reuse alternatives       | Reuse existing components/SDK/workspace client and Customer read pattern; reject cross-feature Customer business imports, generic read framework, client filtering/paging, parallel Shipment screen, hidden columns, claim=open and Number-based decimals                             |
| Selected approach        | SDK-derived aliases, feature-local strict guards/errors and small abort/generation-fenced hooks; exhaustively typed Web labels; string-only formatters; pure toRetailRow; retain existing layout/classes/registry and shared controls; synthetic DTO API only under test fixtures     |
| Rationale                | Preserve UI and exact values while using one authoritative server query/count source; cancellation and scope keys prevent stale/denied data leaks; no new framework/dependency or guessed carrier fields                                                                              |
| Risks                    | Late responses, malformed nested DTOs, invalid/legacy URL filters, unsupported disputed tab, unsafe money conversion, table/card parity, unavailable carrier/account fields, fixture order/async readiness, disabled-action accessibility and accidental browser assertion weakening  |
| Verification             | RED/GREEN pure mapping/format/guard/query/client/read lifecycle; page/drawer render tests; existing viewport/tolerance browser assertions plus explicit D10 delta ledger; pager-filter regression; static/contracts/docs/full quality; independent review and exact-head hosted gates |

## 6. Alternatives and trade-offs

Keep every column, including unsupported values shown as em dash; do not remove
columns or invent account/Carrier service identities. No client-side result filter,
page slice or tab counting. URL filters remain parsed/chipped for old links but do
not affect API queries or rows. Claim tab is disabled/uncounted and never sends a
claim request. Do not create a second Shipment UI, global cache, generic framework
or duplicate shared controls. Customer business/mutation/read-denial policies are
not imported into Retail; use the existing workspace authentication transport.

## 7. Selected interfaces and ownership

api.ts exports createShipmentApi(client=workspace client), GET-only list(stage?,q?,
page,pageSize,signal), get(id,signal), history(id,{page:1,pageSize:100},signal).
Shipments use generated components schema aliases and Shared LogisticsStage
(imported as ShipmentLogisticsStage), charge and milestone values. errors.ts keeps
safe status/code/requestId classification; no raw payload logging. response.ts
checks every required scalar/nested field of page/detail/history, exact decimal
syntax, closed codes and amount states, non-SINGLE null values, unavailable claims
false/null; malformed responses throw MALFORMED_RESPONSE.

useShipmentList(query,api) and useShipmentDetail(id,api) own AbortController,
generation/key fencing and loading/ready/error/retry. Same-key refresh retains
accepted data; different query/ID immediately hides previous data. 401/403 clears
retention. Detail loads get/history with one cancellation scope; late/aborted
responses cannot settle another scope. No global cache or new read framework.
List request key uses only stage/q/page/pageSize; invalid/disputed URL never calls
the API. Preserve the existing URL debounce, Back/Forward and filter parsing.

RetailTabKey retains all/to_origin/at_origin/in_transit/at_dest/delivered/disputed.
Exhaustive mappings bind the five stages, all has no stage, disputed is disabled
and never fetched, UNKNOWN maps to no stage tab and appears in All only. Counts
come from stats.total/byStage; disputed shows em dash/title Chưa hỗ trợ. UNKNOWN
uses the existing notice area and warning chip/icon. Web-only provider/charge/
milestone labels are exhaustive where vocabulary is closed; unknown providers
remain raw and null shows em dash. OTHER uses providerLabel or Khác.

Owner clarification: retain the existing decimal point for fractional display
(including 1.25 and 5.80), preserving all fraction digits. formatDecimal groups
the integer portion in the requested vi-VN style and retains the decimal suffix.
String-only money formatting retains existing VND grouping/đ and CNY ¥ grouping,
without rounding or Number conversion; insignificant zero normalization preserves
value and existing minimum CNY fraction presentation. Other currencies show the
exact formatted number plus code. Dates use Intl with Asia/Ho_Chi_Minh and existing
dd/mm/yyyy display, with explicit time for timeline entries. Null shows em dash.

RetailRow is a pure summary projection: existing column IDs are unchanged; no
account/service invented from provider. Product is firstName plus additional line
count, fee groups are exact SINGLE/Nhiều dòng/em dash, reported milestones provide
four dates/destination name, counts and service flags pass through, and totals/
declared values retain reported currency. Existing client evaluation helpers can
be removed only if unused; keep makeFilter/field/operator policies and standalone
RetailFilterPopover/Pagination behavior for pager-filter acceptance.

List replaces static props with api and keeps initialSearch. Keep table/cards,
column picker and all geometry. New loading/error/retry/empty states are truthful;
Create and advanced filtering are disabled, no Create drawer is rendered, Excel
stays disabled. Detail fetches current detail/history by ID, supports loading/error/
404 and uses existing dialog/focus/close layout. Charges are ordered lines, never
summed; four milestone slots use canonical order/location; items use lineNo and
exact unit values/currency. Timeline reflects observed history with optional
Hãng ghi nhận provider time, never fictional future events.

### Tactical DDD boundaries and domain invariants

Shipment backend remains the Aggregate Root owner and owns child consistency,
validation, owner scoping, money precision and authoritative counts. This Web
feature performs only reads of existing SDK DTO projections and presentation
mapping; it creates no Aggregate, persistence port, domain command or business
write. RetailRow is a view model, never a saved Shipment entity. Read response
validation protects the transport boundary without redefining backend invariants.

## 8. Security, concurrency and performance

Only same-origin generated workspace transport, existing epoch-aware401 handling,
no direct fetch/database/server imports, storage persistence, credentials or parcel
logging. Every changed request aborts its predecessor; generation checks still
reject late transports that ignore abort. One list request per effective API query;
filters/column changes do not add requests. Detail uses two bounded reads, history
page1/100 only. Backend owner/count/transaction contracts remain unchanged.

## 9. Compatibility and permitted visual delta

API/OpenAPI/SDK/schema/migration/role contracts remain unchanged. Existing URL
filters stay accepted and visible but inert. Retain column registry, default19/
basic7/all20, widths/order/sticky cells, typography, shared32px controls, native
modal focus behavior and exact approved viewports/tolerances.

D10 permits only provider-only carrier text without account suffix, Nhiều dòng,
em dashes for unavailable data, disabled uncounted disputed tab, UNKNOWN warning
banner/chip, disabled advanced/Create controls, new loading/error/empty states,
and API-driven drawer items/milestones. Other appearance changes require owner
clarification. For reference-sample, preserve corresponding existing dates/prices/
flags/product text using synthetic DTO strings/ISO timestamps; missing backend
account or separate carrier identity is never fabricated. Record every changed
browser assertion and its D10 reason; keep layout/tolerance assertions intact.

## 10. Test-first and implementation plan

1. Commit051 closure first, preserving old FAIL/snapshots and adding issue50 gate.
2. Record this SIGNIFICANT plan/snapshot, format before raw hash, bind task metadata.
3. Add RED pure format/presentation/row/response/query tests, implement GREEN. Cover
   unsafe-integer strings, fractions/zero/null/currencies/date boundary, all stages/
   UNKNOWN/disputed and malformed nested data; legacy filters never sent/applied.
4. API client/read lifecycle tests with real fake transport: exact GET parameters,
   no claim/filter leakage, abort/late responses, errors/malformed, 401/403 clearing.
5. Page/table/drawer tests and integration, preserving rendering classes/columns and
   dialog focus while replacing data ownership; no static product fallback.
6. Convert synthetic fixtures to summary/detail/history DTOs and fake API q/stage/
   paging/count semantics, reference sample and error/empty/slow modes. Isolate old
   reference source in tests only if required for source comparison. Add UNKNOWN,
   all five stages, nulls, MULTIPLE, many items and unsafe-sized exact money.
7. Adapt only D10-affected browser assertions; add new-state checks. Preserve actual
   viewport/style/tolerance checks and pager-filter consumer behavior. Reuse existing
   Chromium/CDP session and loopback fixture pattern, no new launcher framework.
   If isolated execution needs separation, extract the existing protected-route and
   fixture check phases without skipping either in canonical browser-login smoke.
8. Synchronize canonical docs. Run required Retail/Pager tests, pinned format/lint/
   typecheck/contracts/docs/preflight/test-docs/test-preflight, fixture builds and
   actual browser acceptance, quality and exact metadata binding. Build prerequisites
   first; NOT RUN only with actual availability reason. Record each command/RED/FAIL.
9. Independent read-only review per implementation workflow8; commit implementation,
   docs/evidence; push PR titled feat(web): connect Retail list to Shipment API with
   exact five metadata lines and D10 Visual changes. Wait final-head Preflight,
   Sync Targeted if triggered and Foundation4–10; update Final green HEAD by REST.
   Never merge. Status remains VERIFICATION PENDING/PARTIALLY VERIFIED.

## 11. Governance and error handling

Follow owner rule A for task-added/modified tests/fixtures/doubles/helpers including
wrong assertions about existing behavior, typos, task type/lint/format failures,
missing build/install prerequisites; retain FAIL and correction evidence. Unrelated
Foundation5–10 failure permits one failed-job rerun only. Owner rule B requires stop
and ask for changed API/DTO/SDK/DB/frozen snapshot, unapproved visual delta, unexplained
untouched existing test failure, repeated CI failure or step4/Preflight/Sync failure.
No owner approval attestation is required for the recorded plan. No new snapshots
are edited after hashing; material departures require the owner's B decision.

## 12. Plan issues and deferred work

No unresolved API/design ownership issue. Decimal punctuation clarification is
resolved by owner: keep the current decimal point. Shared export is LogisticsStage,
consumed through the requested ShipmentLogisticsStage alias, with no SDK/shared
change. Issue50 gates any future Shipment capability. Real provider authorization,
Nexora writes, advanced server filters, Customer colours and Carrier CSS remain
separate work. This task integrates existing read contracts only.

## Plan

1. Close merged051 with final-head evidence and child-bound issue50 (first commit).
2. Freeze the design and implement test-first D1–D11 with the owner decimal decision.
3. Preserve UI/browser geometry and record every permitted assertion delta.
4. Verify, independently review, publish PR and collect final-head hosted evidence.
5. Close052 under §1.7 in the next task after merge; no self-merge.

## Acceptance criteria

- [x] API/guard/hooks and read model use current SDK, no claim/client filters or static product data.
- [x] Original columns/layout/presets/style retained with only D10 deltas.
- [x] Drawer displays real detail/history/charges/milestones/items with exact values.
- [x] Synthetic DTO fixture and browser checks cover new states; Pager/filter regression PASS.
- [x] Local checks, canonical documentation and independent review without blockers.
- [ ] Final-head hosted Preflight, optional Sync Targeted and Foundation4–10.
- [ ] Owner review and merge decision.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Retail reads existing Shipment APIs, uses backend pagination/counts and truthful
read states; advanced/Create disabled, claims unavailable, UNKNOWN warning;
string-safe exact formatting and DTO fixture/browser acceptance.

### Canonical owners

- docs/architecture/frontend.md
- docs/domains/shipments.md
- docs/operations/testing.md
- docs/architecture/reusable-components.md (changed usage only)

### Documentation verification

- pnpm docs:check
- pnpm preflight:check
- pnpm format:check

## Evidence

| Claim                                | Evidence                                                                                                                                                                                       | Date       | Result |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Baseline and task identity inspected | origin/main 08da36dc3599c3af7a4656a12630d978fa7c2fb4; PR49 MERGED2026-11-14T12:52:21Z; NEXORA-052 absent from active/completed/design-reviews and open PR list; branch feat/retail-shipment-ui | 2026-11-14 | PASS   |
| Setup fetch failure                  | default git fetch origin referenced a deleted unrelated configured ref: fatal: couldn't find remote ref refs/heads/refactor/customer-api-status-label; no remote config changed                | 2026-11-14 | FAIL   |
| Setup fetch correction               | git fetch origin refs/heads/main:refs/remotes/origin/main; actual main08da36d fetched; rule A environment correction                                                                           | 2026-11-14 | PASS   |
| Closure and issue                    | docs:check PASS on closure working tree; first commit76e93c0df12d347df7d3e2432355842f3ef8be98 closes051 with preserved history; issue50 created from PR49 review as capability prerequisite    | 2026-11-14 | PASS   |
| Frozen dependencies                  | npx --yes pnpm@10.34.6 install --frozen-lockfile; exit0; lockfile current,427 packages reused, no dependency/lockfile change                                                                   | 2026-11-14 | PASS   |

| Initial plan structural check | node scripts/preflight-policy-check.mjs; closure HEAD76e93c0 plus plan working tree; SIGNIFICANT tasks must document domain invariants or Tactical DDD boundaries; task added explicit read-only boundary rationale already selected by snapshot, no snapshot change | 2026-11-14 | FAIL |

Rule A test-double correction: first api-hook-green run passed the real API client test but denied-data assertion failed because the VM test loader created a second ShipmentApiError constructor. The actual hook and test now share the real imported errors module, preserving instanceof identity. No production behavior/assertion change was needed. Historical FAIL retained in command ledger.

Rule A UI correction: ui-green exposed a leftover CreatePackageDrawer render expression after removing the disabled Create state/import. Removed the stale reference as required by D8; no Create drawer is rendered. No design or assertion change.

Implementation details within D5/D7: the shared TabBar already supported disabled tabs but not a native tooltip; a concrete optional tooltip string is passed through to its native button for disputed title Chưa hỗ trợ. Existing callers/defaults/markup classes/geometry are unchanged; no network API/DTO/SDK contract changes. A feature consumption RED/GREEN covers the title. Removed obsolete matchesFilter/filterPackages/normalizeWarehouse only; makeFilter/calendarDay/field/operator/popover policies remain. Legacy matching tests are updated to verify validated URL filters remain inert at the API boundary instead of retaining a dead client evaluator.

Rule A fixture correction: the initial new UI test expected an UNKNOWN row but its two-row sample contained only the first two known stages. The sample now explicitly includes UNKNOWN; the assertion is retained.

Rule A existing test adaptation within changed Retail suite: targeted run58 PASS/1 FAIL still required the old production initialPackages=[] prop. D8 explicitly removes that prop; the assertion now checks initialSearch and absence of static data/availability. All other targeted assertions passed, including unchanged Pager/filter regression.

Rule A new test-double correction: expanded detail-hook test compared VM-created query objects with deepStrictEqual across realms, causing the fake history method to throw before recording calls. Compare serialized query values instead; requests and cancellation assertions stay unchanged.

Rule A type correction: fast Web tsc found that isSummary narrowing erased the additional unknown detail keys before their guards. Keep the candidate as an explicit unknown record while separately validating the summary, then validate every detail field before asserting the SDK detail type. No guard semantics or API changes.

Rule A browser-helper readiness: retail-browser-initial FAIL at retail-column-picker-checks.mjs:83 observed focused input background rgb(248,250,252) while expected rgb(255,255,255). RetailColumnPicker focuses search in requestAnimationFrame, while inspection previously collected animations before that focus could commit. Wait two real frames before collecting/awaiting actual CSS animations. Exact colour assertions, dimensions, viewports and tolerances remain unchanged; no production CSS change.

Browser diagnosis correction: waiting two frames did not resolve the same focused-colour mismatch. The local adapter omitted Page.bringToFront, unlike scripts/browser-login-smoke.mjs:284. Restore that existing session activation step in the ignored local adapter; revert the speculative change to retail-column-picker-checks.mjs. The canonical picker assertions/helper therefore remain unchanged in the final production diff. No CSS/expected colour/tolerance changes.

Independent review checkpoint: two P2 findings (detail Promise.all first-error hides later denial; inert filter removal resets page) are being addressed with new regression RED/GREEN. No plan/API/SDK/schema change required.

Independent P2 corrections with test-first evidence: denial-order-red reproduced retained detail after a transient sibling error followed by403. Detail now settles the two ordinary results together while racing any401/403 denial, so denial immediately clears data in either response order; authoritative404 also clears deleted detail. denial-order-green verifies both orders and existing cancellation/error cases. legacy-filter-page-red reproduced page1 instead of2 after removing an inert chip; both removal handlers now change filters only, preserving effective request/page. Browser regression checks page2 and a single list request. No API/SDK/schema/frozen snapshot changes.

## Browser assertion delta ledger (D10)

- Protected production checks now await settled Shipment GET data and assert known-empty zero counts instead of static unavailable dashes. Three GET paths are allowed; writes and claim/filter parameters remain forbidden.
- Stage/history checks cover the six enabled tabs. Disputed is separately disabled, uncounted and titled Chưa hỗ trợ; Back/Forward uses enabled physical stages.
- Advanced-filter interaction checks become disabled/title checks. Legacy chips remain inert; removal on page2 preserves page2 and the single effective list request.
- Create-dialog interaction checks become disabled/no-rendered-dialog checks. Native detail Tab/Shift+Tab/Escape and return-focus assertions remain.
- Added UNKNOWN warning/chip, MULTIPLE fee, missing-value dashes, exact unsafe-sized item prices, ordered API milestone/item/history and error/retry/empty/malformed/slow-abort checks.
- Reference-sample compares corresponding old cell strings against the independent test-only reference source. Carrier account suffix is intentionally absent. No direct supplied-ZIP pixel parity claim.
- Navigation waits for the new document and API readiness; page-size changes await server results. All existing column presets, widths, sticky cells, geometry, CSS values, viewports and tolerance assertions remain. retail-column-picker-checks.mjs has no final diff.

## Review and execution notes

Independent read-only review resolved both P2 findings with RED/GREEN regression checks; final follow-up reported no new blockers and verified the frozen SHA. Reviewer did not execute tests; execution evidence belongs to the primary agent.

Rule A closure command correction: the initial staging command included the old moved task path and failed; the unpublished rename-only closure commit was amended to include the complete closure and roadmap. No published history rewritten.

Rule A browser diagnosis: the speculative two-frame wait failed and was reverted; Page.bringToFront in the ignored local driver matches the canonical browser-login session. Full Retail and unchanged Column Picker browser acceptance then PASS.

Local fixture-only acceptance does not attest authentication/runtime/Docker services. Hosted Foundation must separately verify the full production sequence; owner review/merge checkbox remains open.

Rule A lint correction: first full quality passed formatting/boundaries but failed ESLint on unused RETAIL_ROWS and undeclared test globals. Removed the unused projection and explicitly sourced AbortController/Response from globalThis and setImmediate from node:timers. No production behavior or assertion change.

## Executed local command ledger

All rows below describe the implementation working tree on the exact HEAD shown, not committed feature proof. UTC intervals and exit codes are captured by the local runner. Logs and images remain ignored/ephemeral, not Git evidence media. Historical FAIL rows are retained.

| Claim                         | Evidence                                                                                                                                                                                                                                                           | Date       | Result |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| model-red                     | `node --test apps/web/test/retail-shipment-model.test.mjs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:08:44.312763+00:00–2026-11-14T13:08:44.510390+00:00; exit 1                                                                | 2026-11-14 | FAIL   |
| build-read-prerequisites      | `npx --yes pnpm@10.34.6 --filter @nexora/shared --filter @nexora/sdk build`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:10:10.339705+00:00–2026-11-14T13:10:14.061301+00:00; exit 0                                               | 2026-11-14 | PASS   |
| model-green                   | `node --test apps/web/test/retail-shipment-model.test.mjs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:11:08.017999+00:00–2026-11-14T13:11:08.383626+00:00; exit 0                                                                | 2026-11-14 | PASS   |
| api-hook-red                  | `node --test apps/web/test/retail-shipment-api.test.mjs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:12:24.786492+00:00–2026-11-14T13:12:25.634021+00:00; exit 1                                                                  | 2026-11-14 | FAIL   |
| api-hook-green                | `node --test apps/web/test/retail-shipment-api.test.mjs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:13:19.082959+00:00–2026-11-14T13:13:21.156606+00:00; exit 1                                                                  | 2026-11-14 | FAIL   |
| api-hook-corrected-green      | `node --test apps/web/test/retail-shipment-api.test.mjs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:13:38.885842+00:00–2026-11-14T13:13:39.835181+00:00; exit 0                                                                  | 2026-11-14 | PASS   |
| ui-red                        | `node --test apps/web/test/retail-shipment-ui.test.mjs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:17:22.085055+00:00–2026-11-14T13:17:24.058735+00:00; exit 1                                                                   | 2026-11-14 | FAIL   |
| ui-green                      | `node --test apps/web/test/retail-shipment-ui.test.mjs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:20:48.030270+00:00–2026-11-14T13:20:50.370376+00:00; exit 1                                                                   | 2026-11-14 | FAIL   |
| ui-corrected-green            | `node --test apps/web/test/retail-shipment-ui.test.mjs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:21:38.071220+00:00–2026-11-14T13:21:41.057928+00:00; exit 1                                                                   | 2026-11-14 | FAIL   |
| ui-fixture-green              | `node --test apps/web/test/retail-shipment-ui.test.mjs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:22:28.248954+00:00–2026-11-14T13:22:31.280356+00:00; exit 0                                                                   | 2026-11-14 | PASS   |
| disputed-title-red            | `node --test apps/web/test/retail-shipment-ui.test.mjs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:22:44.316234+00:00–2026-11-14T13:22:48.091080+00:00; exit 1                                                                   | 2026-11-14 | FAIL   |
| disputed-title-green          | `node --test apps/web/test/retail-shipment-ui.test.mjs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:23:42.528893+00:00–2026-11-14T13:23:45.470376+00:00; exit 0                                                                   | 2026-11-14 | PASS   |
| retail-targeted               | `node --test apps/web/test/retail-*.test.mjs apps/web/test/pager-filter-sharing.test.mjs packages/ui/test/pager.test.mjs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:24:26.407481+00:00–2026-11-14T13:24:35.896946+00:00; exit 1 | 2026-11-14 | FAIL   |
| retail-targeted-corrected     | `node --test apps/web/test/retail-*.test.mjs apps/web/test/pager-filter-sharing.test.mjs packages/ui/test/pager.test.mjs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:25:51.764424+00:00–2026-11-14T13:26:02.745731+00:00; exit 1 | 2026-11-14 | FAIL   |
| retail-targeted-green         | `node --test apps/web/test/retail-*.test.mjs apps/web/test/pager-filter-sharing.test.mjs packages/ui/test/pager.test.mjs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:26:03.793572+00:00–2026-11-14T13:26:12.929901+00:00; exit 0 | 2026-11-14 | PASS   |
| web-types-fast                | `npx --yes pnpm@10.34.6 --filter @nexora/web exec tsc --noEmit`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:26:34.556928+00:00–2026-11-14T13:26:44.539232+00:00; exit 1                                                           | 2026-11-14 | FAIL   |
| api-hook-expanded             | `node --test apps/web/test/retail-shipment-api.test.mjs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:27:06.414960+00:00–2026-11-14T13:27:07.422555+00:00; exit 1                                                                  | 2026-11-14 | FAIL   |
| api-hook-expanded-green       | `node --test apps/web/test/retail-shipment-api.test.mjs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:27:24.151760+00:00–2026-11-14T13:27:25.106820+00:00; exit 0                                                                  | 2026-11-14 | PASS   |
| web-types-corrected           | `npx --yes pnpm@10.34.6 --filter @nexora/web exec tsc --noEmit`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:27:25.149157+00:00–2026-11-14T13:27:34.277901+00:00; exit 0                                                           | 2026-11-14 | PASS   |
| build-retail-fixture          | `node scripts/build-retail-fixture.mjs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:30:29.278121+00:00–2026-11-14T13:30:33.431144+00:00; exit 0                                                                                   | 2026-11-14 | PASS   |
| build-retail-fixture-coherent | `node scripts/build-retail-fixture.mjs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:32:25.895527+00:00–2026-11-14T13:32:29.879406+00:00; exit 0                                                                                   | 2026-11-14 | PASS   |
| build-retail-fixture-final    | `node scripts/build-retail-fixture.mjs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:34:27.501547+00:00–2026-11-14T13:34:31.372603+00:00; exit 0                                                                                   | 2026-11-14 | PASS   |
| retail-browser-initial        | `node /tmp/nexora052-retail-browser-run.mjs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:35:48.329518+00:00–2026-11-14T13:35:56.324068+00:00; exit 1                                                                              | 2026-11-14 | FAIL   |
| retail-browser-focus-ready    | `node /tmp/nexora052-retail-browser-run.mjs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:38:37.702512+00:00–2026-11-14T13:38:45.122943+00:00; exit 1                                                                              | 2026-11-14 | FAIL   |
| denial-order-red              | `node --test apps/web/test/retail-shipment-api.test.mjs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:42:27.923134+00:00–2026-11-14T13:42:29.169213+00:00; exit 1                                                                  | 2026-11-14 | FAIL   |
| legacy-filter-page-red        | `node /tmp/nexora052-retail-browser-run.mjs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:42:36.393973+00:00–2026-11-14T13:42:43.332359+00:00; exit 1                                                                              | 2026-11-14 | FAIL   |
| denial-order-green            | `node --test apps/web/test/retail-shipment-api.test.mjs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:43:18.449721+00:00–2026-11-14T13:43:19.612981+00:00; exit 0                                                                  | 2026-11-14 | PASS   |
| rebuild-browser-p2            | `node scripts/build-retail-fixture.mjs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:43:35.184273+00:00–2026-11-14T13:43:39.231414+00:00; exit 0                                                                                   | 2026-11-14 | PASS   |
| retail-browser-p2-green       | `node /tmp/nexora052-retail-browser-run.mjs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:45:08.437309+00:00–2026-11-14T13:45:33.032315+00:00; exit 0                                                                              | 2026-11-14 | PASS   |
| build-carrier                 | `node scripts/build-retail-fixture.mjs artifacts/carrier-fixture apps/web/test/fixtures/carrier-entry.tsx`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:49:09.496504+00:00–2026-11-14T13:49:17.162875+00:00; exit 0                | 2026-11-14 | PASS   |
| build-pager-filter            | `node scripts/build-retail-fixture.mjs artifacts/pager-filter-fixture apps/web/test/fixtures/pager-filter-entry.tsx`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:49:21.588163+00:00–2026-11-14T13:49:27.699992+00:00; exit 0      | 2026-11-14 | PASS   |
| final-quality                 | `env API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 quality`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:49:07.953182+00:00–2026-11-14T13:49:50.397005+00:00; exit 1                                 | 2026-11-14 | FAIL   |
| targeted-final                | `node --test apps/web/test/retail-*.test.mjs apps/web/test/pager-filter-sharing.test.mjs packages/ui/test/pager.test.mjs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:49:39.365705+00:00–2026-11-14T13:49:56.156855+00:00; exit 0 | 2026-11-14 | PASS   |
| pager-filter-acceptance       | `node scripts/pager-filter-browser-checks.mjs artifacts artifacts/nexora052-pager-filter --acceptance`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:49:37.590537+00:00–2026-11-14T13:50:22.256732+00:00; exit 0                    | 2026-11-14 | PASS   |
| standalone-docs-check         | `npx --yes pnpm@10.34.6 docs:check`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:51:06.489076+00:00–2026-11-14T13:51:10.034956+00:00; exit 0                                                                                       | 2026-11-14 | PASS   |
| standalone-preflight-check    | `npx --yes pnpm@10.34.6 preflight:check`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:51:10.093128+00:00–2026-11-14T13:51:12.360065+00:00; exit 0                                                                                  | 2026-11-14 | PASS   |
| standalone-test-docs          | `npx --yes pnpm@10.34.6 test:docs`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:51:12.433199+00:00–2026-11-14T13:51:16.748154+00:00; exit 0                                                                                        | 2026-11-14 | PASS   |
| standalone-test-preflight     | `npx --yes pnpm@10.34.6 test:preflight`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:51:16.960120+00:00–2026-11-14T13:51:25.629114+00:00; exit 0                                                                                   | 2026-11-14 | PASS   |
| standalone-typecheck          | `env API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 typecheck`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:51:51.066573+00:00–2026-11-14T13:52:00.063339+00:00; exit 1                               | 2026-11-14 | FAIL   |
| quality-corrected             | `env API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 quality`; working tree on cf264d9a1551184eaa5c58b691492654715b67dd; UTC 2026-11-14T13:50:40.366681+00:00–2026-11-14T13:54:16.523757+00:00; exit 0                                 | 2026-11-14 | PASS   |
| sequential-format-check       | `env API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 format:check`; working tree on de0ee6ba1e9523008d9e96e29b1e293d2b4b5a1b; UTC 2026-11-14T13:54:24.518323+00:00–2026-11-14T13:54:43.499231+00:00; exit 0                            | 2026-11-14 | PASS   |
| sequential-lint               | `env API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 lint`; working tree on de0ee6ba1e9523008d9e96e29b1e293d2b4b5a1b; UTC 2026-11-14T13:54:43.558571+00:00–2026-11-14T13:54:55.546151+00:00; exit 0                                    | 2026-11-14 | PASS   |
| sequential-typecheck          | `env API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 typecheck`; working tree on de0ee6ba1e9523008d9e96e29b1e293d2b4b5a1b; UTC 2026-11-14T13:54:55.589675+00:00–2026-11-14T13:55:04.086538+00:00; exit 0                               | 2026-11-14 | PASS   |
| sequential-contracts-check    | `env API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 contracts:check`; working tree on de0ee6ba1e9523008d9e96e29b1e293d2b4b5a1b; UTC 2026-11-14T13:55:04.141309+00:00–2026-11-14T13:55:12.228291+00:00; exit 0                         | 2026-11-14 | PASS   |
| sequential-test-lint          | `env API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 test:lint`; working tree on de0ee6ba1e9523008d9e96e29b1e293d2b4b5a1b; UTC 2026-11-14T13:55:12.269955+00:00–2026-11-14T13:55:19.351332+00:00; exit 0                               | 2026-11-14 | PASS   |

Additional provenance: simulated validatePrTaskBinding with the five frozen v1 metadata lines returned valid:true and no failures on the implementation working tree. Raw snapshot SHA remains 7d73314ad6ed82d8f17fba460eb05231a91d9ef5d686bf15ce3c135b4c752174. Production vocabulary grep finds legacy identifiers only in fixtures/tests and the test-only reference oracle import in the browser script; no production static-data fallback.

Browser assertions executed: full isolated Retail/Column Picker PASS and Pager/filter acceptance PASS. Screenshots captured/retained locally: 108 Retail records and16 Pager/filter records under ignored artifacts. Manually reviewed admin-reference-sample-1440x900.png, admin-reference-sample-390x844.png and admin-detail-api-items-1280x800.png. No direct ZIP comparison or full-stack local claim. Retail manifest SHA-256 8414184f710b40544f7b866e17483010cc91e0d55bbff2b0e327c64dad4b6189; Pager/filter manifest SHA-256 06448e66bf0f1e4952a211ccb6e014411cc864a38899be60a565c5c57714d443. Retail manifest sourceCommit is null because the local fixture driver does not set GITHUB_SHA; runner provenance identifies its working tree accurately.

Rule A environment correction: a redundant standalone typecheck was started while quality was still building Web and failed with “Another next build process is already running.” The redundant process was stopped; primary quality continued. Rerun standalone checks sequentially after quality; retain this FAIL and never interpret it as a source regression.

Verification summary: corrected quality exit0 (2026-11-14T13:50:40–13:54:16Z) includes scripts138/138, Web278/278, API216/216, UI37/37 and database6/6, exact contracts and production build. Standalone pinned format/lint/typecheck/contracts checks and test:lint55/55 subsequently PASS. Final hosted gates remain pending at this documentation commit; exact final-head provenance will be added to the PR description without a documentation-only SHA loop.

## Hosted checkpoint and Rule A browser-helper refinement

| Claim                     | Evidence                                                                                                                                                                                                                                                                                                                               | Date       | Result |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Hosted governance         | Preflight Policy & Design Governance43602272398 attempt1; HEAD6655f6a72af95d96874c1b18450b2bd408eac74a; PR merge8340798abda82f660b3e562d8ebec0290785b21f; UTC2026-11-14T13:56:37Z–13:56:49Z; binding and24 policy tests PASS; https://github.com/dinhphuquy2k1/nexora/actions/runs/43602272398                                         | 2026-11-14 | PASS   |
| Hosted Foundation initial | Nexora foundation43602272368 attempt1; same HEAD/merge; UTC2026-11-14T13:56:37Z–14:08:13Z; steps4–6 PASS,7 FAIL,8–10 SKIPPED; Step: RETAIL_DETAIL_AND_CREATE_NATIVE_DIALOG; Category: CHECK_FAILED; Error: RETAIL_BROWSER_CONDITION at retail-browser-checks.mjs:858; https://github.com/dinhphuquy2k1/nexora/actions/runs/43602272368 | 2026-11-14 | FAIL   |

No same-head rerun performed. This failure is in the modified Retail harness, so it is not classified as unrelated environment failure. Independent read-only diagnosis found insufficient failure-state evidence to distinguish missing/closed/loading/error dialog; no concrete production or DTO defect. All30 fixture detail/history pairs validate locally; actual CPU4× Retail/Column Picker run also PASS. The reload gate is strengthened to require settled page2/pageSize5 API data; focus and fresh-node click are separate with real frames between them. Timeout and every ready/modal/focus/geometry assertion remain unchanged. Added safe state/method-only timeout diagnostics and fixture-only failure capture; no parcel payload, credentials or production behavior changes. These are Rule A changes to this task's modified browser helper, not a design delta.

Artifact14116543514 was downloaded through the GitHub connector after gh download hit an environment403. Its admin manifest has78 capture records and confirms merge8340798abda82f660b3e562d8ebec0290785b21f; it contains no failed-dialog state, so no root-cause claim is made from screenshots alone. Failure screenshots are diagnostic captures at the current viewport, separate from the unchanged six acceptance viewports.

The first run also failed artifact uploads14/15 because Account/Carrier checks were not reached and their evidence directories did not exist. This does not change the primary step7 failure. Downloaded Retail artifact ZIP SHA-256 b5c8b6d34d37b73e6510f16b6340ee7f68d688af27bdf4d2b24f7c3b82b18f1f matches GitHub artifact14116543514.digest; expiry2026-11-28T14:07:57Z. Extracted manifest SHA-256 baaf25ef9b3c15f78ec6abf55c32dd14b2c8ea3017ad6cb9b1823095e673ef37.

The refined local browser run overwrote the local working capture directory; the earlier8414184f… manifest digest is historical, not a claim those bytes remain in that directory. Current108-record manifest SHA-256712c2d1381e09836db096f8cc46a653c19bb2195eee1a33520adccef8bc4a45a. Screenshot/manual-review claims above refer to the earlier execution; the helper-only refinement changes no production UI. Independent read-only review of the stronger gate and safe diagnostics found no blockers; original root cause remains unproven.

| Claim                          | Evidence                                                                                                                                                                                                                                 | Date       | Result |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| hosted-failure-local-throttled | `node /tmp/nexora052-retail-throttled.mjs`; helper working tree on 6655f6a72af95d96874c1b18450b2bd408eac74a; UTC 2026-11-14T14:10:56.375186+00:00–2026-11-14T14:11:39.612310+00:00; exit0                                                | 2026-11-14 | PASS   |
| browser-refined-ready          | `node /tmp/nexora052-retail-browser-run.mjs`; helper working tree on 6655f6a72af95d96874c1b18450b2bd408eac74a; UTC 2026-11-14T14:15:45.777169+00:00–2026-11-14T14:16:10.522975+00:00; exit0                                              | 2026-11-14 | PASS   |
| helper-refinement-quality      | `env API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 quality`; helper working tree on 6655f6a72af95d96874c1b18450b2bd408eac74a; UTC 2026-11-14T14:16:24.187914+00:00–2026-11-14T14:19:05.467240+00:00; exit0 | 2026-11-14 | PASS   |

## Owner-requested v2 visual refinement

The v2 snapshot supersedes v1 for five-row table/mobile loading skeletons, scope-compatible backend count retention and stable badges, and browser-confirmed tracking-header shadow correction. The v1 snapshot remains byte-identical (SHA-256 7d73314ad6ed82d8f17fba460eb05231a91d9ef5d686bf15ce3c135b4c752174). All earlier evidence and failures remain historical. Verification is pending.

### V2 checkpoint before Chromium root-cause confirmation

Baseline HEAD: 6a30e82f9ae4deda310901c478d7b0a4fdcb9f8e. Working-tree runs on 2026-11-14 UTC:
Frozen install PASS. Initial SSR/hook and fixture build attempts FAIL because Shared dist was not built; corrected with `npx --yes pnpm@10.34.6 --filter @nexora/shared build` PASS. Re-run RED: three new assertions FAIL (zero skeleton rows, wrong cell count, missing retained statistics); remaining existing assertions PASS. After implementation, targeted Retail Shipment UI/model/API, retail-packages, Customer presentation/read-state and shared TabBar:75/75 PASS. New loading rows/cards are decorative, registry-driven, with one hidden status and reduced-motion CSS. Stats retain only scope-compatible accepted backend values; changing q/API or unsafe/denied/disabled read clears them. Owner changes remount the protected page; workspace session boundary remains unchanged.

Local Chromium attempts FAIL before navigation: native `socket() failed: Operation not permitted` in process_singleton_posix.cc. Both canonical launcher and direct binary fail; no geometry, screenshot review or CSS-root-cause PASS is claimed. Docker executable is unavailable, so canonical Docker quality is NOT RUN locally. The header production CSS remains unchanged at this checkpoint. A real Chromium computed-style regression was added to the existing harness to record header/body comparison and demonstrate the header shadow problem in hosted execution before correcting it. New hosted evidence is pending; this checkpoint is not merge-ready.
