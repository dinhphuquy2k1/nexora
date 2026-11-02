# NEXORA-033 — Corrective ZIP parity v2

## 1. Task metadata and classification

Task ID: NEXORA-033
Classification: SIGNIFICANT
Plan revision: rev-2026-11-01-carrier-zip-parity-v2
Reviewed baseline: 7ed3ede2e76ed41994ab00d403a70005e9a38174
Branch feat/carrier-connections-ui / existing Draft PR31; no new branch/PR.
Documentation Impact: REQUIRED

## 2. Requirements and boundaries

Owner's latest correction makes the supplied ZIP the structural/visual authority.
Restore its command deck, remaining-height table, four presentation tabs, advanced
filter popover, split actions, numbered pagination, account form hierarchy,
centered details/disconnect and full three-tab sync presentation. No redesign.
Preserve UI-only production unknown/empty/unavailable; no API/DB/SDK changes,
provider registration, jobs/timers, simulated success, credential storage or Auth/
MFA/session/AppShell/Customer/Retail visual changes. Test-only injected fixtures
may contain environment/progress/history/extra providers; these are not SDK fields.

## 3. Documentation owners

ADR009 governs recorded plan and immutable revision integrity; prior v1 bytes and
all evidence remain historical. Frontend owns new structure/data boundaries;
design-system owns the Carrier-only divider/switch presentation exceptions;
testing owns paired-reference/CDP assertions; task033/031 retain execution status.

## 4. Read-only inspection and source authority

Fetched PR31/head/main; clean branch matches baseline. Raw ZIP SHA256
6912f4917756a1c3393e48b34f63f350464cb068351a377c2efb9d5cde6d5a52 verified.
Read original CarrierConnectionsView/CarrierDataSyncDrawer, catalog, CustomSelect,
ShippingScopeContext/Selector/App; no ZIP scripts or mutation handlers adopted.
Read required docs/Next client boundary guides; inspected Customer/Retail controls,
RetailFilterPopover, pageWindow, useDismissable, Overlay, tokens and workspace frame.

### Visual parity audit (baseline line references)

| Area         | ZIP source                                          | PR baseline source                                       | Deviation                                                                | Correction                                                                                                                                                                              | Verification                                                                       |
| ------------ | --------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Page         | CarrierConnectionsView859–869,1274–1727; App119–128 | CarrierConnectionsPage93–196; CSS.page/tableScroll/empty | Single card, content-height table,220px empty                            | Separate command deck/table flex; viewport height from workspace/header tokens, sticky header/scroll body/fixed footer                                                                  | DOM parents/remaining height/footer edges at6sizes and Sidebar variants            |
| Header       | View870–935                                         | Page94–122                                               | Missing export/active badge; spacing                                     | Three actions/order,36px navy logo, source typography; unknown badge/no fake count                                                                                                      | Source-matched labels/geometry/default32                                           |
| Tabs         | View938–1021                                        | Page45–65,124–143                                        | Backend-status labels replace ZIP tabs                                   | all/connected/needs_check/sandbox as UI filter union; ERROR+REAUTH_REQUIRED→needs_check; sandbox only from injected preview metadata                                                    | Keyboard/count/filter/overflow                                                     |
| Toolbar      | View1023–1270; configs68–126                        | List31–116                                               | Two external selects/reset/always chip region                            | Filter button before search; right active indicator/refresh; conditional separate chips; shared dismissable native controls in popover                                                  | Multiple/duplicate filters, remove/reset, focus/outside/Escape                     |
| Table        | View1274–1465                                       | List117–260                                              | Fixed/wrapped simplified cells, missing dividers/copy/provider hierarchy | Source auto-layout/minimums measured with identical3-row fixture; logo/provider/account/copy/status/sync/timestamp hierarchy; scoped dividers                                           | Computed column/row/padding/font comparison and sticky scrolling                   |
| Actions      | View1470–1579                                       | List207–240                                              | Four icon buttons                                                        | Split Chi tiết đồng bộ + chevron; contextual dropdown; backend commands disabled                                                                                                        | One-click, keyboard/outside/Escape, disabled no writes                             |
| Pagination   | View1619–1726                                       | List264–352; INITIAL_QUERY                               | 20 default,1/n, wrap                                                     | 10 default; summary/separator/native size select; numbered orange pageWindow/ellipsis/first/prev/next/last                                                                              | Counts/empty/unknown/last-page and geometry                                        |
| Extra banner | No counterpart                                      | Page149–159                                              | Added availability + demo overview button                                | Remove; truthfulness copy solely in empty state/form help                                                                                                                               | Production no demo entry/no fake data                                              |
| Add/Edit     | View1729–1969                                       | Drawer65–199                                             | Flat form/active local-validation CTA                                    | Provider selection cards, numbered sections, credential field substitution, environment placeholders, disabled verify/save, source header/footer                                        | Uniship-only prod, local inline validation/no success/no storage/password disposal |
| Details      | View1980–2108                                       | Drawer201–237                                            | Side drawer                                                              | Centered512 modal, navy logo header/grid/metadata/footer; unknown unsupported fields not invented                                                                                       | Center alignment/grid/close/edit/focus                                             |
| Disconnect   | View2112–2160                                       | Drawer238–259                                            | Generic dialog                                                           | Centered384 alert/red icon/text/button geometry; confirm disabled                                                                                                                       | Geometry/focus/no mutation                                                         |
| Sync         | SyncDrawer397–1368                                  | SyncDrawer58–293                                         | Simplified cards/history; shared footer/schedule                         | 540 drawer/orange header icon; source status rows/progress; switches/5 intervals/dirty confirmation; history filters/KPIs/rows/page; tab-dependent footer; differentiated nested modals | All states/dirty cancellation/long list/native dialogs/6sizes                      |

## 5. Mandatory reuse matrix

| Component          | Existing implementation                                 | Domain owner            | Alternatives                                               | Selected approach                                                                                                                        | Rationale                                                 | Risks                              | Verification                                                            |
| ------------------ | ------------------------------------------------------- | ----------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------- |
| Controls           | packages/ui Controls,TabBar,TabCountBadge,Overlay,Toast | Shared UI               | Copy ZIP controls / new framework / compose                | Compose canonical32 controls/native dialogs; narrow feature slots                                                                        | Preserve focus/disabled semantics                         | Scoped geometry                    | UI regressions + actual pseudo-states                                   |
| Filter/dropdown    | RetailFilterPopover; lib/hooks/use-dismissable.ts       | Carrier presentation    | Generic filter engine / copy whole Retail / feature policy | Reuse dismissal/focus pattern, Carrier-owned field config/pure matcher                                                                   | Different fields; avoid framework                         | duplicate conditions/menu clipping | Behavioral RED tests + CDP                                              |
| Pagination         | lib/pagination.ts pageWindow                            | Shared Web presentation | New algorithm / reuse                                      | Existing bounded helper with Carrier default10                                                                                           | One algorithm                                             | unknown totals                     | Model/page window browser checks                                        |
| Drawer/modal       | Existing CarrierDrawerFrame + shared Overlay            | Carrier presentation    | ZIP fixed div/focus trap / native Overlay                  | Extend feature frame with centered geometry/header/footer slots                                                                          | Native top layer                                          | dirty nested close                 | Keyboard/focus/Escape/backdrop                                          |
| Switch             | Shared Button; no shared Switch consumer exists         | Carrier presentation    | New UI library / raw button / compose                      | Feature-local role=switch Button with22px visual track inside32px target                                                                 | Concrete owner requirement, no shared API/default change  | focus/checked state                | Native keyboard and computed track/target                               |
| Reference evidence | Existing actual TSX compiler/CDP/runtime/artifacts      | Test infrastructure     | Fabricated pixel expectations / paired actual source       | Render ZIP read-only externally; committed compact normalized reference geometry + source hashes; actual paired same-fixture screenshots | CI does not have original attachment; provenance explicit | stale reference/partial coverage   | Baseline RED, measured deltas, negative geometry checks,3 review rounds |

## 6. Alternatives and tradeoffs

Reject retaining the simplified v1 layout: directly violates requested ZIP parity.
Reject importing ZIP App/context/mock handlers: duplicates shell and fabricates API
success. Reject global shared restyling: changes Customer/Retail and approved32px
contracts. Selected direct DOM/geometry migration with necessary UI-only exclusions.

## 7. Selected presentation design and DDD alignment

Carrier remains existing domain owner; this correction creates no aggregate,
command, application port, transaction or provider backend capability. SDK-derived
ConnectionStatus remains unchanged. Separate UI tab/filter/environment/sync states
are readonly presentation and fixture metadata, never persisted values. Account
metadata copy uses actual clipboard success/failure only, never provider success.
History/date filtering and pagination operate on injected readonly data; missing
production totals/timestamps/permissions/environment show unknown/unavailable.
Forms preserve Uniship loginIdentifier/password rather than fake API-key fields.

## 8. Security and resource analysis

Retain workspace guard/account logout and Owner/ADMIN authorization contracts.
No network operations in feature, storage, timers or auto-job simulation. Password
only mounted draft state, discarded close, never in URL/log/capture. Disabled
backend commands remain disabled for fixtures too. Schedule dirty close uses a
nested native confirmation, cancel restores draft, discard closes/reset without
saving. Test fixture resources use existing owned servers/Chromium cleanup.

## 9. Compatibility and scoped exceptions

No API/OpenAPI/SDK/database/shared control API/default change. Canonical viewport
gutters differ from ZIP App shell by mandatory Nexora composition; normalize paired
feature hosts to identical usable bounds for geometry comparison, then independently
verify actual expanded/collapsed/mobile workspace. Reuse native Select in place of
CustomSelect;32px targets replace ZIP28/30/34px controls. Restore Carrier-only table
vertical dividers via semantic root tokens, without changing Customer/Retail tables.
Switch22px visual track/32px target and source badge/logo/form-card geometry are
feature presentation exceptions, not shared-control default overrides. Unsupported
provider cards/environment/scopes/jobs appear only as unknown/disabled slots or
explicit test metadata. No fake worker explanations/readiness/counters in prod.

## 10. Test-first / verification-first strategy

RED contracts for two containers, deck/toolbar order/no external selects/no banner,
presentation tabs/combined status filters, duplicate conditions,10-row default,
split actions/numbered pages, centered detail, tab-specific sync footer/dirty close,
history filtering/KPIs/page and metadata sanitization. Browser baseline RED actual
layout/column/row/table-height vs ZIP measurements before fixes; keep security,
request/storage/password/keyboard assertions. Replace obsolete implementation-shape
assertions with stronger source-backed contracts, not weaker checks. Paired identical
fixture captures at6sizes for all principal surfaces; actual hover/focus/selected/
disabled states; real production empty unavailable separately. Full format/lint/
docs/preflight/typecheck/tests/build; final-head hosted Preflight/Foundation,
actual logs and artifact hashes. Three independent structural, visual and final
regression reviews, correcting/retesting confirmed findings after each.

## 11. Plan readiness and delivery

Recorded before any code/test changes,2026-11-01. Existing PR31/branch only;
reviewable structural, drawer/sync and verification commits; push without force,
update PR metadata to this revision/digest, preserve Draft until acceptance is
verified. No owner attestation required under current ADR009. Do not merge/deploy.

## 12. Resolved plan issues

Prior v1 excludes vertical dividers/source tabs/export and uses a details drawer;
latest explicit owner correction supersedes those choices. Historical snapshot
remains unchanged. No unresolved architectural blocker; implement v2 scope only.
