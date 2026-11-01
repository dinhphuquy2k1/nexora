# NEXORA-033 — Carrier Connections UI migration

Status: VERIFICATION PENDING
Implementation: IMPLEMENTED
Verification: NOT VERIFIED

## Scope

UI-only route/settings/carrier-connections on existing feat/carrier-connections-ui
at1a4fe7bfcc3571219db28b833aba3a626f6e472f. No backend/SDK/database changes or
Carrier calls, fake records/success in production, timers/schedulers, global
ShippingScope or new Sidebar item. Production empty/unavailable; test-only injected
fixtures exercise populated states. Account Carrier link becomes active, Profile
planned and logout/security unchanged. Overall M4 remains unfinished.

## Design Review & Reuse Decision

Task ID: NEXORA-033
Classification: SIGNIFICANT
Plan revision: rev-2026-11-01-carrier-ui-v1
Reviewed baseline: 1a4fe7bfcc3571219db28b833aba3a626f6e472f
Design Snapshot: docs/tasks/design-reviews/NEXORA-033-rev-2026-11-01-carrier-ui-v1.md
Design SHA-256: 10f55486b6c03d6d71c9209c3d23239e466bb7d12688301c307df968e3214faa

Read-only audit and full12-section design recorded before code. NEXORA-033 absent
from task/roadmap/revision searches; owner reserves033. ZIP raw digest matches
6912f4917756a1c3393e48b34f63f350464cb068351a377c2efb9d5cde6d5a52. Read all
seven specified source modules; reference App/provider/context/select handlers are
not adopted. Installed Next server/client/Link guides read per web AGENTS.

| Component         | Existing implementations                                         | Domain owner         | Reuse alternatives                           | Selected approach                                                                          | Rationale                    | Risks                           | Verification                                                    |
| ----------------- | ---------------------------------------------------------------- | -------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------- | ------------------------------- | --------------------------------------------------------------- |
| Route/navigation  | workspace layout/nav-config/AccountMenu                          | AppShell/Identity    | New shell/Sidebar vs nested route            | Guarded server page, shared wide frame, existing Settings ancestor and native Link         | Preserve composition/auth    | SSR/Tab order                   | Real route/direct auth/nativeLink/breadcrumb tests              |
| Controls/overlays | @nexora/ui Button/TextInput/Select/Checkbox/TabBar/Overlay/Toast | Shared UI            | ZIP copy vs reuse                            | Canonical32 controls, native dialog drawers, feature-local512/540 geometry                 | No duplicate framework       | Focus/scroll                    | Actual keyboard/computed geometry six viewports                 |
| Data/state        | generated CarrierConnectionDto; Retail DI fixture pattern        | Carrier presentation | Fake SDK/globalstore vs local readonly model | SDK-derived status type, pure filters/page/validation, empty production/injected test data | No fake integration          | Credential/fixture/network leak | Source guards + actual browser unavailable/fixture states       |
| Evidence          | Existing fixture compiler/browser-login/CDP/CI artifacts         | Test infrastructure  | New launcher vs extend                       | Dedicated helper reuses existing session/compiler/cleanup                                  | Existing ownership/retention | Expiry/secret capture           | Raw source hashes, logs/manifest SHA/hashes, independent rounds |

Tactical DDD Boundaries: presentation-only over existing Carrier/Identity contracts;
no new domain, Aggregate, persistence or commands. Backend owns provider lifecycle/
credentials; UI only renders SDK-derived labels and local unsaved drafts. No
Aggregate/VO/transaction introduced or omitted business invariant silently.

## Milestones

- [x] Baseline/ZIP/docs/reuse audit, selected design/snapshot before code.
- [x] RED tests then model/list/drawers/sync unavailable presentation.
- [x] Account route/nested breadcrumbs; full authenticated regression pending CI.
- [ ] Actual source ZIP/product browser comparison and six viewport acceptance.
- [ ] Three independent rounds, full canonical checks and final-head CI.
- [ ] Commit/push same branch, new Draft PR, final evidence metadata.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

New guarded UI-only Carrier route and Account destination; backend-dependent actions
remain unavailable; fixture-only populated/sync states; M4 integration is not done.

### Canonical owners

- docs/architecture/frontend.md
- docs/tasks/active/NEXORA-031-full-frontend-migration.md
- docs/operations/testing.md
- This task/new PR. Shared registry/design system only if shared contract changes.

### Documentation verification

Run format/docs/preflight/boundaries; snapshots unchanged after digest pinning.

## Evidence

| Claim                                           | Evidence                                                                                                          | Date       | Result |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Correct existing branch/base; no unrelated work | fetch/clean branch1a4fe7b, main sameSHA; tracking worktree uses specified remote branch                           | 2026-11-01 | PASS   |
| Exact ZIP available/hash verified               | raw SHA2566912f4917756a1c3393e48b34f63f350464cb068351a377c2efb9d5cde6d5a52; seven source modules audited directly | 2026-11-01 | PASS   |

## Execution journal

Plan above precedes all implementation/test changes. Frozen pnpm10.34.6 install
PASS with unchanged lockfile, dependencies in task-owned RAM store. Source worktree
is/workspace/work/nexora-carrier-ui; build/evidence output uses ignored storage.
Historical task031/032 snapshots remain untouched. No owner approval required by
current ADR009. Round1 independent architecture review requested before source;
implementation/test/runtime/visual/CI not yet executed for033.

Implementation clarification before code: production has0 rendered rows but has
not loaded an authoritative backend total. Tabs/pagination therefore display—
(unknown) alongside the unavailable notice, rather than implying verified zero
connections. Injected fixtures show computed counts. This clarifies the UI-only
truthfulness invariant without changing architecture, backend or selected layout.
Round1 independent plan review no P1/P2; production count interpretation, password
clear on unmount and fixture-only progress/history highlighted for verification.

### Implementation and local verification (2026-11-01)

Implemented feature-local pure read/validation/presentation, seven-column list,
filters/chips/reset/pagination, Uniship-only draft form/details/disconnect dialogs,
three-tab sync drawer and fixture-only inspection. Account native Link and Settings
breadcrumb/wide ownership added without a Sidebar item. Shared primitives/auth,
API/database/SDK and lockfile unchanged. No shared public contract changed, so no
shared registry/design-system amendment is necessary.

| Claim                               | Command/evidence                                                                                                                                                                                | Date       | Result  |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------- |
| Focused behavioral regressions      | `node --test apps/web/test/carrier-connections.test.mjs apps/web/test/carrier-navigation.test.mjs apps/web/test/account-menu.test.mjs`:10/10                                                    | 2026-11-01 | PASS    |
| Web regression                      | `pnpm --filter @nexora/web test`:193/193,8 suites,0 skipped                                                                                                                                     | 2026-11-01 | PASS    |
| Shared controls                     | `pnpm --filter @nexora/ui test`:32/32,8 suites,0 skipped                                                                                                                                        | 2026-11-01 | PASS    |
| Build prerequisites/typecheck       | shared build, Next typegen with internal API URL, `pnpm --filter @nexora/web typecheck`                                                                                                         | 2026-11-01 | PASS    |
| Source quality                      | `pnpm format:check`, `pnpm lint` (includes boundaries), `pnpm docs:check`, `pnpm preflight:check`                                                                                               | 2026-11-01 | PASS    |
| Actual Carrier fixture browser      | Existing TSX compiler + Chromium/CDP,42 PNGs/manifest across6 sizes: list,validation,details,status,inspection,schedule,history; filter/page/native keyboard/draft disposal/no-write assertions | 2026-11-01 | PASS    |
| ZIP read-only rendering             | Original CarrierConnectionsView with original provider, original sync drawer, existing external Tailwind4.3.3/compiler;12 captures at6 sizes, no mutation handler invoked                       | 2026-11-01 | PASS    |
| Full Docker/runtime/build/hosted CI | Not run yet for implementation head; local root filesystem28MB free, canonical hosted workflow required                                                                                         | 2026-11-01 | NOT RUN |

Initial native model/navigation RED tests failed because feature/route did not exist,
then passed after implementation. Account test's old two-disabled-entry assertion
failed as intended after Carrier became a Link; updated to Profile-only disabled
and preserved actual logout guards. First nested-dialog Escape browser run failed:
synthetic DOM clicks do not establish native activation groups. Replaced interaction
with genuine CDP pointer events; verified only top modal closes and keyboard focus
remains inside native modal. No shared Overlay behavior/assertion was weakened.
Round2 source reviewer found a cleanup P3: nested finally now guarantees owned
fixture server closure when CDP clear/navigation rejects. No confirmed sourceP1/P2.

Direct reference comparison: original desktop title16px,7 columns, navy tableheader,
36px titleicon, line tabs,32px toolbar, sync540px/form512px and full-width mobile are
preserved within canonical Nexora controls. New table uses explicit colgroup1196px
minimum and no vertical cell borders; names wrap, body scroll remains contained.
Reference fake export/active-count/API-key/sandbox/provider-readiness/worker claims
and simulated success are intentionally excluded. SDK statuses replace demo tabs;
native Select/shared scrollable TabBar replace CustomSelect/wrapped mobile tabs.
Unavailable notice and disabled backend actions are deliberate scope differences,
not claims of pixel equality or integrated backend. Test-only long names,27 rows,
8 sync types and40 history entries exercise stress geometry outside production.

Local ignored evidence lives under /dev/shm/nexora-carrier-local-evidence and
/dev/shm/nexora-carrier-reference-evidence, not durable CI evidence. Product PNG
manifest records SHA-256 and measured geometry; passwords blank before captures.
Foundation now builds the isolated Carrier fixture and runs production/fixture CDP
checks in the existing authenticated session, retaining carrier-ui-browser-evidence
for14 days. Hosted results and final review will be reconciled after push; no prior
run is claimed to verify the new head. Overall M4/backend integration remains open.

Read-only ZIP source provenance (SHA-256):

- `src/components/CarrierConnectionsView.tsx`: `d59f6db5c7019ae6db3a2a9f8a1055e9db1eae7c19ab5788d34a5deeb0583eea`
- `src/components/CarrierDataSyncDrawer.tsx`: `a2b3ba6ae166f684297674d6f310dca89e5400813d5f346182d0ad18f8be4286`
- `src/data/carrierConnectionsData.ts`: `d58ed3428c7a507eec6adcbfa36032b8c9b1bf6f53b5c8c16ba230b525c6301c`
- `src/context/ShippingScopeContext.tsx`: `d501aac055f885dfc259537dc2fe5fcef86f11ee997b4fb1a68f4af88c6c940d`
- `src/components/ShippingScopeSelector.tsx`: `ae8e09f493a9aeeb925303bb8b400faab5234fa118e22fcd4c00d493a5831bb6`
- `src/components/common/CustomSelect.tsx`: `a3f434320c0ee43af591079f33297d2efa6ce5e8c667a3d6261123a66f456179`
- `src/App.tsx`: `593dbf452b982ff1f9f94d6acf99237df3e048676d2217edf9b0d449bac4d54a`

Round2 visual review inspected original/new desktop list, mobile sync and validation
screens. Confirmed P2: table sync cell ignored injected per-stream status/progress
while its adjacent timestamp used that data. Added a failing meaningful regression,
then readonly first-two-stream summary/progress with an actual remaining-type count;
absent data retains unavailable. Centralized sync labels for table/drawer. Rerun
Carrier7/7 and Web194/194 PASS; enhanced CDP6-size/42-capture assertions PASS.
Pagination unknown state also omits the misleading1/1 page total. Snapshot unchanged.
Final local format/lint/boundaries/docs/preflight/typecheck/diff checks PASS.
