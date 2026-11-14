# NEXORA-052 — Retail Shipment API integration

Status: IN PROGRESS
Capability: PLANNED
Verification: NOT VERIFIED

## Design Review & Reuse Decision

Task ID: NEXORA-052
Classification: SIGNIFICANT
Plan revision: rev-2026-11-14-retail-shipment-ui-v1
Reviewed baseline: 08da36dc3599c3af7a4656a12630d978fa7c2fb4
Branch: feat/retail-shipment-ui
Design Snapshot: docs/tasks/design-reviews/NEXORA-052-rev-2026-11-14-retail-shipment-ui-v1.md
Design SHA-256: 7d73314ad6ed82d8f17fba460eb05231a91d9ef5d686bf15ce3c135b4c752174

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

- [ ] API/guard/hooks and read model use current SDK, no claim/client filters or static product data.
- [ ] Original columns/layout/presets/style retained with only D10 deltas.
- [ ] Drawer displays real detail/history/charges/milestones/items with exact values.
- [ ] Synthetic DTO fixture and browser checks cover new states; Pager/filter regression PASS.
- [ ] Local checks, canonical documentation and independent review without blockers.
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
