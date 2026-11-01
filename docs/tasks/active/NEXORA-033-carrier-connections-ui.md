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
Plan revision: rev-2026-11-01-carrier-zip-parity-v2
Reviewed baseline: 7ed3ede2e76ed41994ab00d403a70005e9a38174
Design Snapshot: docs/tasks/design-reviews/NEXORA-033-rev-2026-11-01-carrier-zip-parity-v2.md
Design SHA-256: 58e5ccd5d7f55f8c605ba3587a44b08d8182544f45c348be6a2c30c1fd57c245

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
- [ ] Commit/push same existing PR31 branch and reconcile final evidence metadata.

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

### Final source review and first hosted execution

Round3 independent review at46678ed and its focused follow-up found no remaining
confirmed P1/P2. Independently executed Carrier/navigation/Account11/11 then12/12
PASS. Final source audit reproduced an order-dependent last-success presentation
with heterogeneous stream timestamps; added RED→GREEN regression and selected the
newest valid timestamp, skipping invalid/missing timestamps. Enhanced CDP verifies
exact nested breadcrumb, keyboard status selection, edit password blankness,
failed-progress inspection, unsaved schedule disposal, no browser storage writes,
default32 control geometry and no vertical cell borders. Local42 captures rerun
PASS after this correction. Node discovery16 suites / Node script tests128/128 PASS.

| Claim                         | Evidence                                                                                                                                                                                                                                                                                                             | Date       | Result  |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------- |
| Production frontend compiles  | `API_INTERNAL_URL=http://api:4000 pnpm --filter @nexora/web build`: Next16.3.8 production webpack build includes guarded Carrier route; task-owned RAM output, no binaries staged                                                                                                                                    | 2026-11-01 | PASS    |
| Hosted head46678ed governance | [Preflight41299275570](https://github.com/dinhphuquy2k1/nexora/actions/runs/41299275570),24/24; actual checkout synthetic mergec2cdd4d487f27719ede9d590614a69e5a3881237 into main1a4fe7b, not direct head                                                                                                            | 2026-11-01 | PASS    |
| Hosted Foundation attempt1    | [Foundation41299275332 attempt1](https://github.com/dinhphuquy2k1/nexora/actions/runs/41299275332/attempts/1): Docker quality FAIL at unchanged uniship-verify.test.cjs:82, first loopback verify503 with100ms fixture timeout; test duration145ms. Runtime/HTTPS/data/dev SKIPPED; required evidence uploads absent | 2026-11-01 | FAIL    |
| Same-head diagnostic retry    | Failed job rerun once with assertions/config/source unchanged; outcome pending. No API files changed and no timeout/assertion relaxed                                                                                                                                                                                | 2026-11-01 | NOT RUN |

PR31 created Draft on existing feat/carrier-connections-ui and initial commit
46678ed873b6d74af6d6f20266eae466e85e80ba pushed without force. This journal retains
all failures and does not infer final-head success from previous checkpoints.
Final implementation correction and exact-head hosted evidence remain pending;
latest workflow outcomes will be reconciled in PR31 after checks finish, avoiding
self-referential documentation commits. Overall M4 is still incomplete.

Before the follow-up commit: full Web195/195, focused12/12, browser fixture42
captures and format/lint/boundaries/docs/preflight/typecheck/diff checks PASS.
Immutable snapshot digest recomputed unchanged. Task remains active VERIFICATION
PENDING / IMPLEMENTED / NOT VERIFIED until final-head mandatory checks and owner
UI acceptance; no merge/readiness inferred from the initial governance success.

### Final visual acceptance corrections

Actual final-size image review reproduced two additional scoped UI defects before
fixing them: mobile provider Select collapsed to an arrow-only32px width (new
minimum-readable-width browser assertion FAIL), and sync status→history retained
scrollTop351 so history heading/filter were offscreen (new scrollTop0 assertion
FAIL). Mobile search now owns a full row and native filter selects retain140px
minimum width. Keying only the scroll body by selected tab resets its scroll while
parent schedule draft state remains intact. Both verification-first regressions
then PASS with42 actual captures; independent round3 follow-up opened mobile list
and desktop history images and confirmed the fixes/no new P1/P2.

One external local driver's cleanup failed ENOTEMPTY after successful assertions;
it used plain rm immediately after Chromium termination. Reused the repository's
existing cleanupBrowserProfile bounded retries in that external driver and reran
successfully. Canonical browser teardown code was already using this utility and
was not modified. No cleanup failure is represented as a successful overall run.

Intermediate headf7aa9a1c07c1987425cbbbf7023ccc4c0cfb6104 had local production
build and fixture assertions PASS; Preflight41299900895 SUCCESS; its Foundation
41299900833 is still running. Initial head's unchanged-source Foundation retry
passed Docker quality and advanced to genuine runtime (final outcome pending).
These are historical checkpoints only, not verification of the final layout commit.
Final-head hosted outcomes/log/artifact hashes are reconciled in PR31 after CI.

Verification-plan clarification before harness correction: initial Foundation
attempt2 ultimately FAILED at existing RETAIL_COLUMNS_PRESET_ALL before Carrier
checks. A freshly compiled actual Retail fixture reproduced7 rather than20 columns
immediately after clearing emulated viewport/clicking All. Extra geometry diagnostics
with an intervening observation allowed the same single click to complete; this
shows an unsettled interaction/read precondition, not a Carrier product regression.
Keep every original20-column/pressed/visual assertion; wait for viewport frames and
the expected React state, with one pointer click, not retries of the action.

Intermediatef7aa9a1 Foundation also FAILED after Docker quality/integration PASS:
ACCOUNT_REAL_CLIENT_ROUTE_DISMISSAL timed out after returning via full navigation.
The existing check only observed SSR trigger markup, then clicked before hydration.
Reuse the existing browser-login-ready module for an actual harmless client menu
interaction before testing native disclosure/navigation/logout. No route, logout,
request or security assertion is skipped/relaxed, and no production Retail/Auth
code is changed. These are bounded test-precondition corrections within the planned
canonical CDP verification, not a new architecture or business feature.

The fresh Retail fixture reproduced the exact7!=20 assertion; after frame/state
precondition correction, the complete existing Retail fixture CDP checks PASS.
Fresh actual AccountMenu fixture checks also PASS, including keyboard, hover,
loading/failure/retry and preserved no-navigation semantics for Profile. An earlier
Account diagnostic used a stale compiled fixture with disabled Carrier entry and
correctly failed the new Link assertion; rebuilding the current source resolved
that test-input mismatch. Carrier42-capture CDP checks PASS with shared readiness.
No production Retail code, logout retry policy or test assertion was removed.

Independent final harness-delta review found no P1/P2 or weakened assertion.
Final local checks after these fixes: format/lint/boundaries/docs/preflight/Web
typecheck, focused12/12 and Node scripts128/128 PASS. Last full Web195/195 and
shared UI32/32 are earlier checkpoints; final-head canonical quality must rerun all.
No apps/api, database, SDK/lockfile or immutable snapshot change. New final workflow
run required for the layout/readiness commit; PR31 will retain complete failure
history and exact tested merge/head/artifact provenance after completion.

## Corrective ZIP parity v2 — recorded before implementation

Latest owner review rejects the v1 visual simplifications despite historical green
CI. Previous primary binding rev-2026-11-01-carrier-ui-v1 / digest10f55486b6c03d6d71c9209c3d23239e466bb7d12688301c307df968e3214faa remains immutable historical evidence.
The new primary snapshot above records the12-section corrective plan, eight-field
reuse matrix and source/PR file-line visual diff matrix for all13 fixes.
Implementation and verification of this correction are pending. No prior PASS is
evidence of the new visual contract. Reuse pre-implementation and code-review
skills; preserve UI-only/Auth/backend boundaries. Documentation Impact REQUIRED
owners include frontend, design-system scoped exceptions, testing and task031.

### V2 implementation / verification checkpoint (2026-11-01)

Implemented all13 source-audited correction areas in existing feature modules.
Extracted feature-local filter popover, split row menu, sync panels/inspection and
pure schedule/history helpers; shared control/Overlay/TabBar/clipboard/browser
compiler ownership reused. No new framework, dependency, production fixture, API,
SDK, schema, auth/session/MFA, scheduler or Shipping Scope operation. Immutable
v1/v2 snapshots remain unchanged. New reference fixture aligns each account's
stream state independently; production still receives no records.

Root causes: v1 substituted simplified controls/layout for source hierarchy, used
a fixed-height empty/table and fixed column contract, and tested those substituted
shapes. V2 restores source containers/auto widths/row detail/split actions/pagination
and full overlay hierarchy, and compares against measured source geometry. Async
refresh/backend behavior is never simulated. A previously green workflow is not
proof of visual parity. No prior FAIL or v1 evidence has been erased.

| Claim                                 | Evidence                                                                                                                                                                                                                                                       | Date       | Result |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Verification-first source contract    | New deck/default10/filter regressions failed on baseline7ed3ede (nested deck absent, pageSize20, no advanced filter model); /tmp/carrier-v2-red.log                                                                                                            | 2026-11-01 | FAIL   |
| Focused correction tests              | node --test apps/web/test/carrier-connections.test.mjs:13/13,0 skipped before final verification                                                                                                                                                               | 2026-11-01 | PASS   |
| Semantic token policy exposed misuse  | First full Web test caught border roles used as fill/text/shadow; changed to semantic Carrier fill/divider/selected-shadow roles, no exception added                                                                                                           | 2026-11-01 | FAIL   |
| Web regression after token correction | pnpm --filter @nexora/web test:200/200,8 suites,0 failed/skipped                                                                                                                                                                                               | 2026-11-01 | PASS   |
| Actual new browser assertions         | Three initial runs exposed outdated empty-copy selector and schedule horizontal clipping; source grid min-width fixed, copy selector scoped; failed capture aborts with nonzero exit                                                                           | 2026-11-01 | FAIL   |
| Actual local v2 browser               | Existing Chromium/CDP harness, full advanced filter/page/validation/draft disposal, dirty confirmation, calendar rejection, nested focus, no network/storage writes and84 captures against source contract: PASS; current later cosmetic changes require rerun | 2026-11-01 | PASS   |
| Read-only source pairing              | 168 captures,14 surfaces ×6sizes ×source/candidate, original ZIP modules unchanged; initial-state adapters only, no mutation handlers; subsequent header/context fixes require recapture                                                                       | 2026-11-01 | PASS   |

Independent structural Round1: no confirmed security/control-flow P1/P2; identified
non-identical fixture stream states in stale captures, fixed before recapture.
Visual Round2 found a P2 inline header badge/height mismatch; restored inline title
line with mobile wrapping, context Layers icon and source environment badge.
Round2 closure and independent regression Round3 remain pending.

Mandatory differences: canonical shell/font/native32px targets/Select/Overlay;
Uniship login/password replaces unsupported API secret; unavailable backend actions
disabled, real production counters/environment/readiness/job claims unknown. No
extra production availability banner/demo-sync CTA; guidance lives in empty state.
An accessible Details entry wires the source's otherwise unreachable inspection.
Native32px targets enlarge ZIP28/30px controls and footer by4px. Source mobile
search clipping is constrained inside available width while preserving the single
filter/search row and separate refresh wrap. No shared Customer/Retail CSS changed.

Final source checks, visual closure, exact final-head Preflight/Foundation and
artifact integrity are still pending at this checkpoint. Do not infer final-head
PASS from this journal or historical7ed3ede. PR stays Draft; final tested SHA/merge
SHA/workflow URLs belong in PR metadata after completion, without self-SHA loops.

Local pre-push checkpoint: Web202/202 and shared UI32/32 PASS, Web typecheck and
production Next/Web build PASS with documented API_INTERNAL_URL. Actual v2 CDP
matrix rerun PASS (84 principal surface captures plus primary hover/focus), including
sticky header/fixed footer during27-row scrolling; every screenshot password blank.
Full root quality attempt FAIL before runtime: first invocation exposed the ambient
pnpm11 rather than pinned10.34.6; an owned Corepack wrapper corrected the toolchain,
then genuine Prisma generate failed DNS EAI_AGAIN for binaries.prisma.sh. No engine,
checks or assertions bypassed; local full quality/integration NOT PASS. Canonical
Docker/real PostgreSQL/runtime/public/data/dev and exact-head hosted CI remain open.

Final visual follow-up: preserve the source progress modal's full stream title and
Job ID in its header, restore non-empty history-row notes, and use the existing
AA-capable accent-text role for running badge/note text. The repository's previously
authorized shared white-on-orange primary-action exception remains unchanged; no
blanket WCAG AA claim is made. New badge contrast is measured separately below.

Final independent follow-up closed P3 duplicate contrast math: extracted the
existing composed browser contrast expression to a neutral helper and retained
Customer's compatibility export as the same function; no Customer visual logic
changed. Carrier checks both actual badge and note, including ancestor alpha.
Actual opaque running badge contrast4.877:1; no global contrast claim. Explicit
Carrier modal max-width also overrides the native UA six-pixel mobile constraint
so the centered Details width follows the source viewport-minus24px contract.

| Claim                      | Evidence                                                                                                                                                                                                                                                                                                                                                                                  | Date       | Result |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| First v2 hosted checkpoint | Head6d3a3c9, Foundation41313233218/job124867804189 FAIL at unchanged apps/api/test/uniship-verify.test.cjs:82 first loopback verify,100ms client fixture budget, test154ms, SERVICE_UNAVAILABLE503; full decoded log inspected. Later runtime/HTTPS/data/dev SKIPPED, absent browser uploads failed, owned cleanup PASS. https://github.com/dinhphuquy2k1/nexora/actions/runs/41313233218 | 2026-11-01 | FAIL   |
| First v2 governance        | Head6d3a3c9, Preflight41313233277 SUCCESS; v2 snapshot/task/PR binding valid. https://github.com/dinhphuquy2k1/nexora/actions/runs/41313233277                                                                                                                                                                                                                                            | 2026-11-01 | PASS   |
| Final visual geometry      | Same-state pairs at all6 required viewports: deck delta1.344px; maximum row delta0.985px; first6 column widths equal, action column+4px for32px targets. Centered Details corrected to exact512/366/351px source widths; no new screenshot binaries tracked                                                                                                                               | 2026-11-01 | PASS   |
| Review–Fix–Review          | Independent structural/visual/regression rounds and follow-ups close header P2 and duplicate contrast P3; focused16/16, helper4/4 and diff check PASS; final hosted head still mandatory                                                                                                                                                                                                  | 2026-11-01 | PASS   |

No API source, fixture timeout or assertion changed for the hosted failure. Final
follow-up head must run the full workflows;6d3a3c9 is not a passing Foundation head.
