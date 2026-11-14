# NEXORA-052 — Retail loading and indicator refinement v2

## Identity and scope

Task ID: NEXORA-052
Classification: SIGNIFICANT
Plan revision: rev-2026-11-14-retail-shipment-ui-v2
Reviewed baseline: 6a30e82f9ae4deda310901c478d7b0a4fdcb9f8e
Branch: feat/retail-shipment-ui; existing PR #51; do not merge.
Documentation Impact: REQUIRED

Supersedes v1 only for the three explicitly owner-requested visual corrections.
Preserve the v1 snapshot byte-for-byte and all historical evidence. No backend,
SDK, dependencies, column registry/width/preset, Customer or Carrier changes.

## Read-only inspection and issue mapping

Read AGENTS, all six AI entry documents, frontend/design-system/reusable-components,
testing, shipments, ADR003/009, active052 and v1; inspect Customer List/Table/Stats/
CSS/read-state/hook and Retail route/List/Table/Pagination/read hook/CSS/columns/
types, shared TabBar/count CSS and the Retail/Customer/TabBar tests and CDP harness.
Search symbols: skeleton, aria-busy, stickyTracking, box-shadow, stats, denied,
AbortController, fixtureMode, visibleColumns and TabCountBadge consumers.

1. ListPage adds an in-flow loading paragraph and textual table empty state.
   Keep existing deck/card/header/footer mounted; Table owns five decorative
   registry-driven skeleton rows and corresponding mobile cards, one hidden status,
   aria-busy/data-stale, reduced motion. Same-query retained rows stay visible.
2. useShipmentRead keys rows by stage/q/page/pageSize; counts are read from those
   same rows' response. Retain accepted statistics separately by q and API identity
   in the existing hook, excluding stage/page/size. Production owner/session is
   bounded by the protected route component lifetime; key the component by the
   authenticated owner and session boundary. Clear on disabled, changed scope/API,
   denied or unsafe response. Preserve abort/generation fencing. Never count rows.
   Feature-local badge class reserves three digits plus existing padding/borders,
   equal font weight in active/inactive states; allow larger counts to expand.
3. stickyTracking shares a box-shadow across header/body; browser computed-style
   comparison must confirm before fixing. If confirmed, override only header
   box-shadow to none; retain common border, sticky positioning and body shadow.

## Reuse and impact audit

| Field                    | Loading                                         | Statistics and badges                                       | Sticky header                                             |
| ------------------------ | ----------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------- |
| Component                | RetailPackageTable                              | useShipmentRead/ListPage                                    | Retail CSS                                                |
| Existing implementations | CustomerTable/CSS five rows, hidden status      | Customer List separately scoped stats; shared TabCountBadge | stickyTracking header/body rule                           |
| Domain owner             | Retail presentation                             | Retail read state; backend authoritative counts             | Retail presentation                                       |
| Reuse alternatives       | feature-local pattern vs global framework       | local hook state vs global cache/shared badge change        | header override vs removing all shadows                   |
| Selected approach        | local pattern, existing visible columns         | local scope retention and badge class                       | browser-confirmed header-only correction                  |
| Rationale                | semantic table, no cross-feature CSS            | smallest change preserving honest unavailable/zero          | preserve sticky body separation                           |
| Risks                    | mobile height, animation, duplicate live status | auth/scope invalidation, late responses, large counts       | stacking/scroll repaint                                   |
| Verification             | RED/GREEN SSR and real viewport geometry        | real hook scheduling and Chromium rectangles/keyboard       | Chromium computed styles before/after, scroll/tab changes |

## Route boundary

Retail query hook does not use Next navigation suspension; route awaits searchParams
and server session before returning. Remove the redundant local Suspense text
fallback rather than mount a second fetching client or duplicate skeleton lifecycle.
Retain server session boundary and parent guard.

## Alternatives, contracts and security

Reject fabricated zero, fake Shipment records, global skeleton/cache, Customer
imports, changed registry and broad shared badge CSS. API/DB/shared interfaces stay
unchanged. No domain commands, aggregates, writes or provider activation. Keep
same-query row retention; incompatible rows immediately disappear. API identity and
protected owner/session mount bound stats; denied/unsafe reads clear retained data.
One list request per effective query, existing cancellation and generation checks.

## Test-first and verification

Add failing table loading/visible-column/mobile/accessibility and real-hook stats
retention/invalidation tests before implementation. Extend existing Chromium harness
for initial/tab/back loading, row/header/footer geometry, unavailable/0/1/10/100 and
large counts, scroll positions, sticky computed styles and reduced motion at the
six existing viewports. Keep all existing tolerances and Column Picker assertions.
Run targeted Retail/Customer/TabBar, pinned format/lint/typecheck/docs/preflight and
supporting suites; canonical Docker gate if available. Record RED/GREEN and every
failure honestly. Update canonical frontend/testing/reuse facts as necessary.
Format before raw SHA-256, bind five task/PR metadata fields, push without force,
verify exact final-head hosted workflows, request independent review. Never merge.

## Plan issues

NONE for product contracts. Docker availability and dependency downloads are
verification-environment checks; unavailable checks must remain NOT RUN.
