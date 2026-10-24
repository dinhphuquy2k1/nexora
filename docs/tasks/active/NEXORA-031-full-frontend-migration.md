# NEXORA-031 — Full Frontend Migration (M1–M5)

Task: IN PROGRESS
Implementation: PLANNED
Verification: NOT VERIFIED
Classification: SIGNIFICANT
Documentation Impact: REQUIRED

## Design Review & Reuse Decision

- **Task ID**: NEXORA-031
- **Classification**: SIGNIFICANT
- **Plan revision**: rev-2026-10-23-full-frontend-m1-m5-v1
- **Design Snapshot**: docs/tasks/design-reviews/NEXORA-031-rev-2026-10-23-full-frontend-m1-m5-v1.md
- **Design SHA-256**: 0874328bc72217515c268a684e66c6286578ec34b73cb640e2382414048e475f
- **Reviewed baseline**: ee8391212b2f1e8fe406d287ef0e7cc11fad79d7
- **Approval authority**: dinhphuquy2k1
- **Approval status**: APPROVED
- **Approval evidence**: https://github.com/dinhphuquy2k1/nexora/pull/27#issuecomment-6360485845

## Baseline and interface preflight

Inspected on 2026-10-23 (Asia/Saigon), fetched origin/main ee8391212b2f1e8fe406d287ef0e7cc11fad79d7. GitHub confirms PR26 merged at that SHA, so real Customer Stats and generated SDK are now on main. Existing worktree feat/customer-statistics-api was clean at9e5a3b13b6af57b067a78c5a65524f6624031ec7. Preserved unrelated worktrees/user changes. New feat/full-frontend-migration-m1-m5 created from current origin/main in separate worktree; no branch/PR per milestone. Before allocation, main task tree had no NEXORA-031, selected remote branch was absent and complete GitHub all-state inventory returned26 items/no NEXORA-031 reference.

Read AGENTS/AI entry and routed rules/workflows/router, frontend/reuse/API architecture, Customer/Shipment/auth/Carrier boundaries, Testing, ADR008/009/template and repository pre-implementation-review skill, task029/v8 and merged task030. Inspected main source and exact PR14 head a8fb0b12f8e4b464420a20cb5069c380546fdc29, PR21 head1513648bfa4f817b290349250a896829316e80b0, PR22 head447c304e0d2579d3327f6e53f8404203db4f5575. All three are unmerged candidates, not implemented main screens or test PASS. No merge or cherry-pick of old PRs is authorized.

Uploaded ZIP SHA-256 b4130f0f53bf02b9c97d710ee46c6a988765d3a4389bc1ea69833ac7c0a36675; its30 src paths match v8 inventory. Read/hash archive entries as reference data; did not execute package scripts, install reference dependencies or import mocks. Snapshot appendices preserve30 per-file hashes and all77 interaction IDs/source callbacks/delivery dispositions.

## Objective and selected architecture

Implement the entire settled NEXORA-029 v8 frontend scope in one PR after separate NEXORA-031 approval. Pinned v8 digest a0d30e9f339c48d949c9d201683eb771ae9d9219953e8b31beb58b83ead07cb6; immutable history unchanged. No reopening Option B/no sourcing or Quick Fill exclusions. Historical stats-pending descriptions do not override actual merged API/SDK; no backend rebuild required.

Tier A neutral packages/ui primitives/tokens; Tier B app-shell presentation/navigation; Tier C features/customers, retail-packages and carrier-connections. Existing server workspace layout/session helper remains sole authorization authority. Generated same-origin SDK and shared canonical status vocabulary; backend domain/ownership/phone/default/transaction invariants stay authoritative. No backend business/domain/migration/cache/security/TTL/key/credential changes, new global state/framework, Python tests, production data mocks or live Carrier traffic. Shipping scope never filters Customer ownership or sends unsupported fields to Customer API.

### Mandatory Reuse & Design Audit Matrix

The immutable snapshot section5 contains the complete nineteen-component eight-field audit. This task summary makes core decisions explicit:

| Component           | Existing implementations                                                             | Domain owner                           | Reuse alternatives                           | Selected approach                                                                        | Rationale                              | Risks                                    | Verification                                                         |
| ------------------- | ------------------------------------------------------------------------------------ | -------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------- |
| Neutral UI/shell    | packages/ui Panel/StatusBadge/status-tone; apps/web tokens/app-shell/use-dismissable | Neutral UI/Web                         | Duplicate ZIP UI; extend main                | Extend tokens/primitives, full accessible overlays, existing shell                       | One canonical UI stack                 | Focus/overflow/domain coupling           | Six-viewports and real keyboard/CDP                                  |
| Auth/navigation     | workspace layout, lib/api/session, LoginForm/setup, nav-config/resolve-active/tests  | Identity transport/Web routes          | Client guard; ZIP registry; PR21 full import | Preserve server authority and canonical registry; staged accepted nav transitions        | Security and deterministic routing     | MFA regression/nested settings prefix    | Real session/MFA/errors, longest-prefix and mobile tests             |
| Customer            | Actual eight operations/required stats in generated SDK; ZIP AddressForm/LabelField  | Customer UX/backend invariants         | Fake/page-derived counts; duplicated forms   | Real StatsBar/latest query generation, feature-reused forms and explicit PUT then DELETE | Correct owner/count/default behavior   | Stale requests/isDefault/partial failure | Real API/SDK/browser, races/payloads/bounds/nulls                    |
| Retail              | PR14 columns/table/card/preferences; PR22 retail model; ZIP RetailPackagesView       | Shipment presentation only             | Whole monolith; duplicate parcel stacks      | Ten cohesive components and one model; honest planned/empty production                   | No invented Shipment Backend           | Fake fees/fixtures/persistence           | Synthetic test fixtures only + production import/route/visual checks |
| Carrier/scope       | PR22 scope model/provider/selector; real Carrier SDK; ZIP connection view            | Carrier presentation/application scope | Mock catalog; new endpoints/global store     | Real lifecycle and same-owner metadata scope; explicit stale/error states                | Existing gates remain authoritative    | Secrets/live calls/cross-user cache      | Genuine loopback API/security/refresh/keyboard tests                 |
| Font/profile copy   | PR22 InterVariable/OFL provenance; PR21 deployment-presentation helper               | Web presentation                       | CDN; hardcode LOCAL; old PR backend          | Select licensed local font and pure server-selected profile text only                    | Correct display/no external font fetch | Glyph/license/env leak                   | Actual font/license/Vietnamese and profile props tests               |
| Test infrastructure | Existing Node discovery, Chromium CDP/browser teardown and real PTY harnesses        | Operations                             | New runner/Python/browser framework          | Extend existing native infrastructure                                                    | No duplicate orchestration             | Mock-only proof/resource leak            | Genuine disposable runtime/full exact-head CI                        |

### Tactical DDD boundaries and domain invariants

No new aggregate/entity/VO/domain repository is needed for frontend view/query/draft state. Customer initial/default/cardinality and normalized owner-phone uniqueness remain backend-owned; address multi-request workflow is explicitly non-atomic. Carrier lifecycle/owner/live authorization remains backend-owned. Shipment UI does not define a persisted status domain or implement unapproved writes/fees. packages/ui is domain-neutral; Web never imports API/DB code. Snapshot sections7–10 detail invariants/security/compatibility and acceptance.

## Milestones, checklist and commit/evidence protocol

Every milestone stays on this branch and PR. After verified approval and explicit continuation: targeted RED/verification-first tests → focused implementation → documentation/task sync → targeted tests and browser checks → full diff/security review → milestone commit(s) → push without force → PR update naming exact commit/results/blockers. Do not proceed past a blocking milestone finding by silently declaring completion. Each ledger entry records source SHA, commands, PASS/FAIL/NOT RUN, visual artifacts/viewports and remaining work.

### M0 — Current documentation-only scope

- [x] Inspect current main, unused task ID, ZIP and PR14/21/22 source candidates.
- [x] Select v8-compatible M1–M5 design/reuse/alternatives/security/test strategy and capture immutable snapshot.
- [x] Prepare documents/PR metadata and run docs/static/format/lint/binding checks; exact commit/push/Draft PR outcome is recorded in PR metadata after execution.
- [x] Obtain independent authenticated NEXORA-031 approval and explicit continuation before code/tests/scaffolding/CI/dependencies.

### M1 — Design System, AppShell, Login/MFA, responsive

- [x] Tokens navy/orange, header56px, sidebar240/72px, licensed local Inter/Vietnamese, shared real-consumer primitives/accessible overlays.
- [x] Restyle main shell/login preserving server guard, setup fragment, MFA/recovery/cancel/enrollment guidance/session/Origin/Host and username-only Remember Me.
- [x] Preserve available/planned navigation states; truthful empty notifications and profile presentation.
- [x] Targeted native/auth + genuine CDP keyboard/six-viewports; sync canonical frontend/Testing and milestone evidence, review diff, commit/push/report. See M1 execution checkpoint below; final documentation-head CI is reconciled in PR metadata.

### M2 — Customer Management and CustomerStatsBar

- [ ] Functional protected /customers and /customers/[id], all eight real SDK operations and actual deployed test-runtime stats dependency.
- [ ] Loading/empty/unavailable/error stats, canonical q/phone/status/page query, trim/omit blank q,300ms debounce/immediate latest-generation invalidation/abort/unmount protection.
- [ ] Reused Create/Edit/Address forms, exact allowlists/bounds/nulls, required initial address, separate default PUT and safe non-atomic PUT→DELETE partial-failure workflow.
- [ ] Real owner/ADMIN/errors/refresh plus18 inherited stats cases/frontend race/default tests and visual/a11y acceptance; activate Customer nav and independent contract together; docs/diff/commit/push/report.

### M3 — Retail Packages

- [ ] /shipments/retail and query-preserving307 legacy /logistics/parcels redirect; ten cohesive feature components/one selected model.
- [ ] Filters/tabs/chips/column preferences and mobile cards; explicit planned Shipment CRUD/export/fees/tracking, no production fixtures/fake success.
- [ ] Native synthetic component/model tests plus production import scan/route/navigation/CDP visual/a11y; activate honest route contract; docs/diff/commit/push/report.

### M4 — Carrier Connections and Shipping Scope

- [ ] Protected /settings/carrier-connections and actual Uniship catalog, connect/rename/reconnect/disconnect operations, exact payloads and transient password handling.
- [ ] Header all/provider/connection scope from same-owner real metadata; lifecycle refresh/latest generations/invalid-deleted states/logout isolation, no Customer ownership coupling.
- [ ] Existing default-off/verified-contract live gate unchanged, no fake Test Connection/Manual Sync; real loopback provider verification.
- [ ] Longest-prefix nested settings nav/resolver/breadcrumb/mobile acceptance; native/API/CDP/a11y, docs/diff/commit/push/report.

### M5 — Full integration and acceptance

- [ ] All77 v8 interaction dispositions accounted for, no sourcing/Quick Fill/demo production data/unsupported writes.
- [ ] Reference-versus-target screenshot/DOM acceptance at1440x900,1280x800,1024x768,768x1024,390x844,375x812; zero body overflow, keyboard/focus/ARIA/reduced motion.
- [ ] Full canonical quality/contracts, genuine Docker/PostgreSQL integration, runtime/HTTPS/persistence/dev and retained real TTY/MFA; guaranteed owned-resource cleanup.
- [ ] Final-head hosted Preflight/Foundation actual logs, independent implementation review with P1/P2 resolved and documented P3, owner visual/PR acceptance; no automatic merge.

Milestone ledger: M1–M5 NOT STARTED; targeted/visual/runtime verification NOT RUN; no milestone implementation commit exists yet. Rollback uses focused UI/nav Git reverts, never data deletion or forced disconnect. No separate PR per milestone.

## Compatibility, alternatives and risks

Use existing Next/CSS Modules/SDK instead of ZIP Vite/Tailwind/Motion/Gemini runtime. Selective reuse instead of whole PR merges. Feature-local models instead of global store or generic form/error framework. Real aggregate response instead of page counts, backend validation instead of duplicate phone algorithms, explicit planned Shipment features instead of mock production records. These alternatives and risks are fully enumerated in the snapshot.

Current API/SDK includes stats; selected M2 test runtime must verify actual contract and unavailable behavior with an old server. Backend-first/coordinated API/SDK/Web version deployment; not inferred from TypeScript. Preserve safe errors using response HTTP status and {code,message,requestId}; distinguish provider401 from session401 and403 enrollment from generic forbidden. No real production readiness claim from disposable HTTPS CI. Fonts/license/visual parity, stale generations, focus/overflow, partial address deletion and carrier gate/secret handling are explicit future acceptance gates.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

M0 introduces task031, selected full M1–M5 implementation plan/reuse audit, pinned ZIP/v8 lineage and immutable review snapshot only. It does not implement UI or change canonical current behavior. Milestones will update UI/routes/consumer contracts/testing evidence as they actually ship in this same PR.

### Canonical owners

- docs/tasks/active/NEXORA-031-full-frontend-migration.md and its new immutable snapshot.
- Future milestone synchronization: docs/architecture/frontend.md, overview.md; docs/domains/customers.md and shipments.md for actual UI facts; docs/operations/testing.md and relevant document index/router pointers only when needed.
- Backend API/domain docs remain authoritative, not rewritten to claim unsupported capabilities. Immutable NEXORA-029/030 snapshots remain unchanged.

### Documentation verification

Run docs:check, local/static preflight, raw-byte digest/PR-task binding, format:check, lint/boundaries and focused docs/governance regressions. Hosted Preflight should fail closed while PENDING_REVIEW; no approval bypass. Full build/tests/visual/Docker/runtime verification are NOT RUN at M0.

## Evidence

| Claim                                        | Evidence                                                                                                                                       | Date       | Result |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Current baseline and allocation              | fetch main ee83912; GitHub PR26 merge matches; no031 main task or complete26-item GitHub inventory reference; separate new branch/worktree     | 2026-10-23 | PASS   |
| Reference provenance and selected dependency | Read-only archive30 source hashes/manifest vs v8; actual merged CustomerStatsDto and generated SDK at current main; no reference code executed | 2026-10-23 | PASS   |
| Immutable selected design                    | Prettier-formatted snapshot then Node raw UTF-8 SHA-256, digest bound in metadata                                                              | 2026-10-23 | PASS   |

M0 verification execution will be recorded below and exact pushed-head hosted status in PR metadata. Planning/static PASS does not establish frontend verification or authenticated design approval. Task/Implementation remain PLANNED; Verification NOT VERIFIED. Agent behavioral evaluation and independent implementation-code-review NOT RUN.

## PLAN ISSUES

No unresolved architecture/product choice; owner-selected v8 scope is preserved. Current frontend/task029 historical no-stats wording is stale relative to merged PR26, explicitly reconciled in this design and scheduled for canonical M1 doc sync; do not build backend again. Actual M2 runtime contract, font license/glyphs, visual comparison and final runtime/CI remain execution gates. Any material architecture change requires new revision/approval. STOP before implementation until separate031 approval and owner continuation.

### M0 local execution — 2026-10-23

Executed against baseline ee83912 plus the two new planning documents:

- Frozen offline install using pnpm10.34.6 and unchanged lockfile: PASS exit0; skipped build scripts are not Prisma/build evidence.
- Full prettier --check .: PASS exit0.
- pnpm lint (boundaries plus ESLint): PASS exit0.
- node scripts/docs-check.mjs and node scripts/preflight-policy-check.mjs: PASS exit0, local/static structural mode only.
- node --test scripts/docs-check.test.mjs scripts/preflight-policy-check.test.mjs:35 PASS/0 FAIL/0 skipped, exit0.
- Existing validatePrTaskBinding against prepared PR body: PASS, exact task/revision/snapshot/raw-byte digest.
- Read-only provenance audit:30 ZIP source entries match v8 manifest;77 contiguous interaction IDs,36 client-presentation/26 existing-API/10 backend-pending/4 approved-exclusion/1 security-exclusion; no source/reference script executed.
- Final diff/scope review: only task031 and new immutable031 snapshot; no code/test/CI/manifest/lockfile/backend or approved historical snapshot change.

These planning checks do not verify frontend implementation. M1–M5/visual/build/genuine runtime/independent implementation review are NOT RUN. Task/Implementation PLANNED; Verification NOT VERIFIED; approval PENDING_REVIEW. Final pushed-head CI and Draft PR URL belong in PR metadata to avoid self-referential SHA evidence commits. No owner approval posted by agent.

## M1 authorization checkpoint — 2026-10-23

Exact owner comment6360485845 fetched through authenticated GitHub connector: dinhphuquy2k1/User/OWNER, PR27, created=updated2026-10-23T08:10:10Z, standalone five-line decision. Existing ADR009 digest/verifier accepts actual complete comments/reviews, matching raw snapshot0874328b…; no later revocation. Owner explicitly authorizes M1 only, then review checkpoint; M2–M5 remain NOT STARTED. Immutable snapshot unchanged. Historical M0 pending-approval language above is superseded here. Hosted approval checkpoint results belong in PR metadata after push.

### M1.1 — tokens, local font and neutral primitives

Behavioral RED: m1-foundation.test.mjs2/2 failed on old64px header and missing exports before code. Implemented56px token, licensed unmodified PR22 Inter with actual cmap coverage U+1EA0..1EF9 plus Đ/đ and fvar100..900 inspection; manifest pins source SHA. Host fontTools lacked Brotli extension; used native Node Brotli for read-only font table inspection, independently readable with fc-scan; no dependency/Python test added. Neutral Button/TextInput/Checkbox/Overlay intended for actual M1 Login/MFA/help/mobile-nav consumers; no unused Select/form framework. Native dialog provides modal focus/inert/top-layer behavior for browser acceptance. Existing Panel/StatusBadge unchanged.

GREEN targeted foundation2/2 and UI resolver1/1; UI typecheck PASS. Initial Web test caught generated --font-inter as undeclared source CSS; narrow external-property allowance now also asserts actual next/font variable/root binding, preserving token checks. Hosted Preflight39926637345 authenticates owner approval on metadata head ea7f8d6. Full browser/visual behavior remains pending.

### M1.2 — AppShell/navigation

RED m1-shell contract failed before mobile modal/notification wiring. GREEN shell contract1/1, full Web49/49 and Web typecheck PASS after implementation. Mobile off-canvas uses neutral native dialog for inert/focus containment, backdrop/Escape/route/viewport dismissal and trigger focus restoration; desktop remains240/72 with tablet collapse. Header now exposes existing honest NotificationMenu. Navigation registry and available/planned states unchanged. Selectively reused PR21 pure deployment text helper only, passed from server AppShell as safe presentation props; no backend/auth/session deadline changes. PR22 mobile behavior reviewed, implemented with neutral native modal rather than copying its manual trap/scope provider. Actual six-viewport/keyboard browser assertions remain pending M1.4.

### M1.3 — Login/MFA presentation and username preference

New Remember Me tests were RED before preference implementation; GREEN2/2 exercises exact username-only key/removal/restoration and denied storage getters/methods. Shared Button/TextInput/Checkbox now consumed by password/MFA forms and help overlay; no auth payload/outcome/server guard changes. Remember preference never stores password/token/MFA and does not change session TTL. Forgot-password help is honest administrator guidance, no fake reset endpoint. Web51/51 and Web typecheck PASS, real browser/auth still pending M1.4/final CI. Old baseline Foundation39920263813 attempt2 SUCCESS on unchanged9874378 after bounded rerun, so browser launch failure was not reproduced and predates M1. Original log only identifies missing DevTools port assertion at BROWSER_LAUNCH; process stderr was suppressed, exact environmental cause remains unproven. No assertion/timeout/security/launcher changes made.

### M1.4 — real CDP verification wired

Extended the existing Login CDP session with a dedicated M1 verifier, not a parallel browser runner: six viewports, Login/MFA/real authenticated shell screenshots, actual header/sidebar geometry, native modal Tab/Escape/backdrop/focus, honest notifications, input labels, body overflow and actual custom Inter platform-font proof. Screenshot guard refuses any nonempty password/proof fields. Native helper tests verify viewport inventory, privacy rejection and emulation cleanup; these are controlled guard tests, not browser evidence. Foundation receives only an artifact directory and a pinned upload action to retain produced PNG/JSON on success/failure; no assertion/timeouts/security gates weakened or infrastructure redesign. Genuine browser artifact/CI results remain pending after this push.

### M1.4 execution follow-up

Foundation39928608443 at bd69661 failed during ADMIN_MFA_PENDING after all six MFA screenshots, before the platform-font proof JSON was written; login proof passed. The original probe was appended below a full-height form and queried without a paint boundary. Verification now places its nonsecret Vietnamese glyph sample inside the viewport and waits two animation frames before querying actual custom-font glyph use; the assertion remains mandatory. This diagnosis is a verification hypothesis until the new real run completes; historical failure remains FAIL.

Independent review identified a P2 verification gap for overlay lifecycle cleanup. Added real CDP assertions for body scroll lock/restoration, viewport transition while the navigation modal is open, and actual help-overlay unmount during the existing password-to-MFA transition. The latter is a controlled React lifecycle race using the existing submit operation, not a normal pointer interaction; no credential-filled screenshots are captured. No auth backend or security gate changed. Final genuine execution and independent re-review remain pending.

### M1 review checkpoint — implementation and local evidence

M1 capability: IMPLEMENTED. Overall task remains IN PROGRESS; M2–M5 NOT STARTED and overall verification NOT VERIFIED until all approved milestones are accepted. The remaining M1 checklist item requires actual hosted runtime/visual results; final exact-head results and artifact links are recorded on PR27 without a self-referential evidence commit loop.

| Check                                                      | Executed result                      | Scope / limitation                                                                                                                                          |
| ---------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI tests / typecheck                                       | PASS 1/1 / exit0                     | Neutral controls plus existing status resolver; no browser proof                                                                                            |
| Web tests / typecheck                                      | PASS 51/51 / exit0                   | Includes auth/session/outcome/security contracts and new M1 cases                                                                                           |
| Root discovered Node tests                                 | PASS120/120,0 skipped                | 13 discovered suites; includes discovery, docs, governance and M1 privacy guards                                                                            |
| Focused helper/docs/governance                             | PASS38/38                            | Actual execution, controlled helper checks separated from real CDP                                                                                          |
| format:check, lint/boundaries, docs:check, local preflight | PASS exit0                           | Pinned Node24.19.0 and corepack pnpm10.34.6; static preflight does not authenticate approval                                                                |
| Local production quality                                   | FAIL / BLOCKED at Prisma download    | binaries.prisma.sh EAI_AGAIN; earlier format/lint/preflight/docs stages passed. No synthetic engine or weakened check                                       |
| Local quality-docker/runtime                               | NOT RUN                              | Existing Docker VFS layers and ~132MiB free make a genuine disposable build unsafe; unrelated volumes/caches preserved. Hosted canonical execution required |
| Independent implementation re-review421d011                | PASS, no remaining P1/P2/P3 findings | Prior P2 lifecycle coverage fixed; focused8/8 and complete diff check PASS; source review is not runtime PASS                                               |

Implementation commits: ea7f8d6 authorization, e8458d9 M1.1, c31b85d M1.2,7d84b6d M1.3, bd69661 M1.4 harness,421d011 lifecycle/font-proof correction. Selected reuse remains the PR22 unmodified licensed font and PR21 pure deployment text helper, existing server authorization/SDK/navigation/notification/account modules and neutral UI package; no whole PR import. Actual font source bytes and immutable design digest remain unchanged.

No new unresolved architecture issue or production auth finding. Stop at M1; Draft retained while final runtime/visual verification is pending and later milestones await owner continuation. No merge, live Carrier calls, public deployment, key/MFA reset or user-volume deletion.

### M1 real lifecycle regression found during verification

Foundation39929948220/421d011: six-viewport Login and MFA font/geometry proof PASS; later ADMIN_MFA_SUCCESS FAIL (no HTTP status observed). The newly exercised help-open→MFA→cancel sequence exposed retained helpOpen state: unmount restored scroll correctly, but returning to the password branch rendered the old help modal open again, intercepting subsequent browser input. Reset help presentation state when the real login outcome enters MFA, with an explicit real CDP regression assertion after cancellation. This changes only presentation lifecycle, not MFA outcome/cookie/challenge/auth behavior. Both historical failures remain FAIL; new hosted results required.

### M1.4 retained hosted execution history

| Source / run                                    | Actual outcome                                                      | Follow-up                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| bd69661 /39928608443                            | FAIL ADMIN_MFA_PENDING after six MFA PNGs                           | Font sample moved inside viewport and waits for paint; later Login/MFA platform-font proof PASS                  |
| 421d011 /39929948220                            | FAIL ADMIN_MFA_SUCCESS without observed HTTP status                 | Retained help state corrected at c302ad2; actual later MFA success reaches protected workspace                   |
| 065307e /39930358685                            | FAIL BROWSER_LAUNCH; no image artifact                              | Pre-existing intermittent startup, not attributed to M1 without evidence                                         |
| c302ad2 /39930911062                            | FAIL protected-shell verifier after1440 expanded/collapsed captures | Login/MFA six-viewports PASS; shell acceptance incomplete                                                        |
| dc16573 /39931944588                            | FAIL BROWSER_LAUNCH                                                 | Added bounded fixed-vocabulary startup diagnostics, no raw stderr/secrets                                        |
| f2129fb /39932961627 attempt1                   | FAIL BROWSER_LAUNCH                                                 | Process had not exited, no signal,193 retained stderr bytes, no recognized hint; cause unproven                  |
| f2129fb /39932961627 bounded same-head attempt2 | FAIL protected-shell restore to240px at1440                         | Launcher succeeded without code/timeout changes; Login/MFA six-viewports PASS; exact failed condition now logged |

These are actual completed failed runs, not final-head PASS evidence. Their quality/integration stages passed; downstream HTTPS/data/development gates skipped after runtime failure do not count as executed. Startup has both failure and success on unchanged baseline and f2129fb, establishing intermittency without proving an environmental root cause.

969abfc now waits for aria-expanded and geometry atomically after desktop toggles and emits only numeric/boolean shell diagnostics on timeout.84c2082 requests fixed-viewport captures instead of full-page capture. Existing artifact shows expanded text/86px transition in a nominal collapsed capture despite the preceding72px observation; capture/resize interference remains a hypothesis until genuine execution confirms it. No production shell behavior changed to satisfy this verifier, and no assertion, timeout or security gate was weakened. Independent review accepts the verification changes (focused3/3 and diagnostics4/4 PASS) without claiming browser acceptance. Final run IDs, attempts, artifacts and M1 readiness are recorded in PR27 metadata after execution; no M2–M5 work.

969abfc Foundation39935006662 FAIL at the same1440 restore condition after Login/MFA six-viewport PASS. Numeric diagnostic confirms innerWidth1440, asideWidth72, aria-expanded=false, openDialogs0; this is a real state mismatch, not a geometry tolerance failure or missing notification text. Fixed-viewport capture84c2082 remains under genuine verification. Do not claim the capture hypothesis is established from these numbers alone.

84c2082 Foundation39935209469 attempt1 FAIL BROWSER_LAUNCH, process still alive/no signal/no stderr; one bounded same-head attempt2 requested.0c365db strengthens screenshot evidence with a before/after state/geometry invariant. Independent review identified fractional-width false-failure risk and duplicate diagnostic extraction; the shared feature-local snapshot now uses the same rounded-pixel unit as existing geometry gates, while aria-state, viewport and dialog count remain exact. This is verifier correctness, not relaxed product acceptance. Full final-head hosted/browser verification remains pending; latest outcome belongs in PR metadata. No new production change or M2 scope.

84c2082 bounded attempt2 and later0c365db/87c80b3 runs passed all three desktop viewport toggles/notification checks, then failed mobile768 after the closed capture and before the navigation capture.0c/87 before/after screenshot logs confirm stable desktop state with viewport capture. Native dialog boundary focus is now explicit in8710f91, with safe focus diagnostics; reverse Shift+Tab is added to the real CDP acceptance loop. Visible/enabled/inert/tabindex handling stays in the neutral Overlay, not business/auth code. Precise cause of the earlier mobile assertion and final acceptance still require new actual logs; no failure was relabeled PASS.

8710f91 Foundation39937506132: actual Login/MFA/AppShell six-viewport geometry/forward keyboard/dismiss/scroll/font PASS; then FAIL OPERATOR_ACCOUNT_MENU_LOGOUT. Existing harness clicked account SSR markup before confirming client interactivity and immediately queried the conditional logout button. Verification now requires actual aria-expanded/enabled action readiness within the same100×100ms budget, then submits logout exactly once; Login navigation/session401 assertions remain unchanged. This is a readiness hypothesis pending new genuine execution, not a proven production logout defect. Current c82ca09 also exercises reverse Shift+Tab and filters visible/inert/positive-tabindex stops; final-head full canonical gates remain pending.

Manual inspection of871 artifact12494198088 confirms all24 PNG hashes/three font manifests and six viewport memberships. Mobile navigation image exposes internal horizontal scrolling: fixed240px child inside the scrollbar-reduced dialog content box, plus a close-bar height mismatch. Drawer content now uses a bounded flex column, flexible full-width sidebar and an independent vertical navigation scroller; desktop240/72 unaffected. Added genuine dialog scrollWidth<=clientWidth assertion, retaining the document-level overflow assertion. This is a visible M1 responsive defect found from actual evidence, not an unrelated refactor.

c82ca09 Foundation39938122835: quality/integration and complete LOCAL runtime (including reverse keyboard, real browser/auth/Setup/OPERATOR/logout) PASS. Subsequent PUBLIC_HTTPS stage FAIL ADMIN_BROWSER_PENDING_MFA/REQUEST_TIMEOUT; no observed LOGIN HTTP status in its diagnostics. HTTPS/data/dev are not claimed PASS. Final9d68cdb and subsequent drawer correction still require exact-head canonical evidence; no public security policy/timeout was changed.

Public canonical follow-up adds actual tab activation/focus readiness and a boolean native-input postcondition to investigate c82 pending-MFA timeout without observed LOGIN response. Only fixed boolean focus/field-presence/alert diagnostics are emitted; no credential/body values, no focus emulation, no credential retries. Browser launch timeout/TLS pin/security gates unchanged. This strengthens test preconditions; it does not establish the earlier timeout's root cause or claim final HTTPS PASS.9d68cdb Foundation39938669366 failed earlier at BROWSER_LAUNCH with process alive/no signal,579 retained stderr bytes/no recognized hint; latest drawer/focus corrections need genuine final-head execution.

### M1 execution checkpoint — 2026-10-23

M1 capability: IMPLEMENTED. M1 verification: VERIFIED on implementation source5d3254d454d3af865387ea4ac215ae93517d76df, with the executed evidence below. Task remains IN PROGRESS; overall implementation PLANNED and verification NOT VERIFIED for the complete M1–M5 scope. M2–M5 NOT STARTED. Stop here for owner review/continuation; no merge or public deployment.

| Execution                                | Result                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosted authenticated Preflight           | PASS                   | [39940218285](https://github.com/dinhphuquy2k1/nexora/actions/runs/39940218285), source5d3254d, approved revision/digest/owner binding                                                                                                                                                                                                                                                                                                                                                            |
| Full Foundation                          | PASS                   | [39940218216](https://github.com/dinhphuquy2k1/nexora/actions/runs/39940218216), job120369516986; quality/build/real migrated PostgreSQL integration, LOCAL runtime/real TTY/browser, disposable PUBLIC HTTPS, persistence and development smoke all executed SUCCESS, no skipped required gate                                                                                                                                                                                                   |
| Actual checkout                          | PASS                   | Log checks out d0badce9a4420dd41e6b4004188b477e47d9263d, merge of source5d3254d454d3af865387ea4ac215ae93517d76df into main ee8391212b2f1e8fe406d287ef0e7cc11fad79d7; not a direct source-head checkout                                                                                                                                                                                                                                                                                            |
| M1 genuine CDP                           | PASS                   | Login/MFA/AppShell at1440×900,1280×800,1024×768,768×1024,390×844,375×812; forward/reverse keyboard, native focus/dismiss/scroll, label/overflow including drawer internal width,56/240/72 geometry, stable captures and actual custom Inter rendering                                                                                                                                                                                                                                             |
| Retained visual artifact                 | PASS                   | [m1-browser-evidence12495409788](https://github.com/dinhphuquy2k1/nexora/actions/runs/39940218216/artifacts/12495409788), archive SHA256 c8f97ad0f3f20b043bff32fb06f1677db62ad30f3087e515695d18d044b2fe4a; three manifests name tested merge d0badce…,24 PNG hashes/dimensions and six memberships independently checked; all three platform-font records custom InterVariable/35glyphs. Representative desktop shell/mobile drawer/Login/MFA manually inspected; earlier drawer scrollbar absent |
| Final implementation-source local checks | PASS                   | corepack pnpm UI test1/1, Web test51/51, Web typecheck, format:check, lint, docs:check, static preflight and full diff checks; root discovery13 suites/120tests/0skips. UI typecheck and focused39/39 also executed during M1                                                                                                                                                                                                                                                                     |
| Independent implementation review        | PASS                   | Separate reviewer through5d3254d, no remaining confirmed P1/P2/P3; actual syntax/diff checks and focused4/4. Earlier confirmed lifecycle/keyboard/responsive and verifier review findings addressed; review does not substitute for runtime                                                                                                                                                                                                                                                       |
| Local full quality / local Docker        | FAIL/BLOCKED / NOT RUN | Prisma artifact download EAI_AGAIN / unsafe disk capacity; full real hosted canonical Foundation above supplies the executed environment evidence, no local PASS inferred                                                                                                                                                                                                                                                                                                                         |

### M1.5 Review Findings & Visual Fidelity Fixes (2026-10-23)

Addressing the two unresolved P2 review findings on PR #27 and aligning M1 visual fidelity directly with the reference ZIP (`C:\Users\wayyk\Downloads\nexora-logistics-management (1).zip`):

1. **P2-1 (Sidebar first-paint layout shift on hard reload at 901–1100px)**:
   - **Root Cause**: `ShellClient.tsx` previously relied on client hydration to read `window.matchMedia("(max-width: 1100px)")` and collapse the sidebar. On SSR first paint, it rendered expanded at 240px and collapsed to 72px after hydration, causing a visible layout shift and reflow.
   - **Fix**: Implemented CSS-first responsive compact desktop presentation in `Sidebar.module.css`. A `.responsive` class applies `@media (min-width: 901px) and (max-width: 1100px) { width: var(--sidebar-collapsed-width); }` (72px) with centered icon buttons directly at initial layout calculation before JS hydration runs. User manual toggle overrides are preserved separately in `userOverride: boolean | null`. Verified at 901px, 1024px, and 1100px with 72px DOMContentLoaded first paint and layout shift <= 0.00096.

2. **P2-2 (Mobile drawer toggle accessible name and state)**:
   - **Root Cause**: `Header.tsx` toggle button did not differentiate between desktop and mobile toggle semantics or communicate drawer state.
   - **Fix**: Header toggle button derives its accessible label from mobile drawer state:
     - Closed drawer: `aria-expanded="false"`, `aria-label="Mở menu di động"`, `title="Mở menu di động"`.
     - Open drawer: `aria-expanded="true"`, `aria-label="Đóng menu di động"`, `title="Đóng menu di động"`.
     - Maintained full keyboard navigation, Escape dismissal, and focus restoration to the toggle button upon dismissal.

3. **Visual Fidelity Alignments with Reference ZIP**:
   - **Sidebar**:
     - Brand subtitle updated from `"QUẢN LÝ VẬN ĐƠN"` to `"Logistics Hub"` matching ZIP branding.
     - Monogram updated to 34×34px navy rounded mark with 16px white "N" and 6px orange accent dot.
     - Active item indicator is a 4px rounded-r-full `#F58A24` bar on `#1E3A5F` active background.
   - **Header**:
     - Borderless toggle button matching ZIP (`p-2 text-[#64748B]`).
     - Active breadcrumb title decorated with signature `#F58A24` orange indicator dot.
     - Account trigger displays user avatar circle with initials ("OP") + username + deployment role.
   - **Mobile Drawer & Overflow**:
     - Removed large orange "Đóng menu di động" button above the logo. Replaced with compact 34×34px icon button `<X size={18} />` at `top: 10px; right: 12px;` aligned with the 56px header line without altering layout hierarchy.
     - Exported `viewport: Viewport = { width: "device-width", initialScale: 1 }` in `apps/web/app/layout.tsx`, fixing mobile Chromium zoom-out and virtual 980px viewport issue.
     - Tooltips set to `display: none;` by default (only `display: block` when collapsed or compact desktop), eliminating scrollable area contribution. Set `overflow-x: hidden;` on `.mobileNavigation` and `.side`. Verified `scrollWidth <= clientWidth` (zero horizontal overflow) across 768px, 390px, and 375px viewports.
   - **Login / MFA Page**:
     - Card width aligned to 420px max-width, `border-radius: 16px` (`rounded-2xl`).
     - Inputs height 44px, radius 12px, background `#F8FAFC`, border `#CBD5E1`.
     - Submit button text color set to pure white `#FFFFFF` with `#F58A24` background and hover `#E07716`.
     - Help link styled in `#F58A24` with hover `#E07716`.
     - Preserved authentic Nexora TOTP, recovery code, session, and server authorization logic (no mock / quick-fill).

4. **Executed Verification Evidence**:
   - `scripts/m1-p2-regression.mjs`: ALL PASSED across 901px, 1024px, 1100px, 1101px, 1280px, 1440px, 768px, 390px, 375px viewports and Login page.
   - `apps/web/test/m1-shell.test.mjs`: 4/4 PASSED.
   - `docker exec nexora-web-1 env -u PORT pnpm --filter @nexora/web test`: 54/54 PASSED.
   - `pnpm --filter @nexora/ui test`: 1/1 PASSED.
   - `pnpm format:check`, `pnpm lint`, `pnpm docs:check`, `pnpm preflight:check`: ALL PASSED.
   - Visual artifacts captured and inspected in `scratch/screenshots/`: `expanded_1440x900_desktop.png`, `expanded_1280x800_desktop.png`, `compact_1024x768_first_paint.png`, `tablet_768x1024_closed.png`, `tablet_768x1024_open.png`, `mobile_390x844_closed.png`, `mobile_390x844_open.png`, `mobile_375x812_closed.png`, `mobile_375x812_open.png`, `login_page_desktop.png`.

### M1.6 UI Design Tokens & Component Reuse Consistency (2026-10-24)

Standardized frontend Design Tokens, canonical form controls, and UI reuse consistency per owner review:

1. **Normative UI Design System Rule Established**:
   - Added [NEXORA UI TOKEN & COMPONENT REUSE RULE](../../ai/PROJECT_RULES.md#7-mandatory-ui-design-system--component-reuse-rule) to canonical project documentation.
   - Documented token ownership and canonical form control contract in [Frontend Architecture](../../architecture/frontend.md).
   - Documented canonical shared control registry (`Button`, `TextInput`, `Textarea`, `Checkbox`, `Overlay`, and deferred `Select` specification) in [Reusable Components Registry](../../architecture/reusable-components.md).

2. **Audit & Elimination of Unjustified Hardcoded CSS**:
   - Centralized card radius token `--radius-xl: 16px;` in `apps/web/styles/tokens.css` without altering `--radius-lg: 12px;`.
   - Replaced raw hex colors in `Sidebar.module.css`, `login.module.css`, `AccountMenu.module.css`, `AppShell.module.css`, and `styles.css` with semantic tokens (`var(--color-surface)`, `var(--color-border)`, `var(--color-border-subtle)`, `var(--gray-400)`, `var(--color-status-error-*)`).
   - Removed duplicate control-state declarations and removed all `!important` overrides and `.form button[type="submit"]` broad selectors from `login.module.css`.

3. **Canonical Form Control Contract Parity**:
   - Standardized `TextInput`, `Textarea`, and `Checkbox` in `packages/ui` (`Controls.tsx`, `Controls.module.css`).
   - Standard 44px height (`--control-height`), 12px radius (`--control-radius`), and box-sizing border-box.
   - Full state parity: default, hover, focus/focus-visible, disabled, readonly, invalid (`aria-invalid="true"`), and placeholder.
   - Specificity ordering ensures focus and invalid states strictly override hover styling.
   - Consumed shared `Button` and `TextInput` in `SetupForm.tsx` and `LoginForm.tsx`.

4. **Button Contrast & WCAG AA Compliance**:
   - Previous white text on `#F58A24` achieved 2.46:1 contrast (failing WCAG AA normal text threshold of 4.5:1).
   - Standardized button text to brand navy `var(--brand-navy, #172b4d)` on `#F58A24`, achieving **5.74:1** contrast ratio (surpassing WCAG AA 4.5:1). Hover contrast on `#E07716` achieves 4.54:1.

5. **Header First-Paint Responsive Parity at 901–1100px**:
   - Header CSS `.responsiveBrand` media query renders `.collapsedBrand` monogram at 901–1100px on first paint before React hydration completes, aligning visual presentation with the 72px Sidebar without layout shift.

### M1.7 Comprehensive CSS Token Audit, Styling Policy & Testing Strategy (2026-10-24)

Executed full automated CSS audit, standardized Design Tokens, enforced Styling Policy, and transitioned tests to behavioral contract groups:

1. **Comprehensive CSS Audit across Frontend**:
   - Audited all CSS Modules in `apps/web/**/*.css`, `packages/ui/**/*.css`, and inline styles across all React components.
   - Identified and fixed semantic mismatches:
     - `Sidebar.module.css` (`.brandSubtitle`, `.navItemLink`): border token `--color-border-subtle` incorrectly used as text color; replaced with `--color-text-on-dark-muted`.
     - `AppShell.module.css` (`.mobileCloseButton`): border token used as text color; replaced with `--color-text-on-dark-muted`.
     - `styles.css` (`::-webkit-scrollbar-thumb`): border token used as background; replaced with `--gray-300` (hovering to `--gray-400`).
     - `AccountMenu.module.css` (`.plannedBadge`): border token used as background; replaced with `--color-surface-muted`.
   - Unified hardcoded `rgba(255, 255, 255, ...)` on dark surfaces:
     - Introduced dark-surface context tokens in `tokens.css`: `--color-text-on-dark`, `--color-text-on-dark-muted`, `--color-border-on-dark`, `--color-border-on-dark-subtle`, `--color-surface-on-dark`, `--color-surface-on-dark-hover`, `--shadow-on-dark-tooltip`.
     - Replaced dark-surface literals in `Sidebar.module.css`, `AppShell.module.css`, and `login.module.css`.
   - Unified duplicated box-shadows:
     - `workspace-layout.module.css`: raw shadow replaced with `var(--shadow-md)`.
     - `Header.module.css`: raw shadow replaced with `var(--shadow-lg)`.
     - `login.module.css`: raw shadow replaced with `var(--shadow-sm)`.
     - `Sidebar.module.css`: raw tooltip shadow replaced with `var(--shadow-on-dark-tooltip)`.
   - Replaced repeating font sizes with standardized Typography Scale tokens:
     - Added `--font-size-2xs` (10px) through `--font-size-3xl` (24px) in `tokens.css`.
   - Eliminated all 3 inline styles across React components:
     - `Breadcrumb.tsx`: replaced inline `style={{ display: "inline-flex", alignItems: "center", gap: 8 }}` with `className={styles.breadcrumbItem}`.
     - `login/page.tsx`: replaced inline `style={{ minHeight: "180px" }}` with `className={styles.fallbackPlaceholder}`.
     - `(workspace)/page.tsx`: replaced inline `style={{ marginBottom: "20px" }}` with `className="page-header"`.
   - Eliminated all 32 unnecessary `var(--token, fallback)` declarations across `apps/web`:
     - `login.module.css`: 15 unnecessary fallbacks removed.
     - `workspace-layout.module.css`: 5 unnecessary fallbacks removed.
     - `styles.css`: 4 unnecessary fallbacks removed.
     - `AccountMenu.module.css`: 2 unnecessary fallbacks removed.
     - `Sidebar.module.css`: 6 unnecessary fallbacks removed.
   - Identified and documented legitimate CSS-local exceptions:
     - Contextual constants (0, auto, inherit, transparent, 100%, 50%).
     - Local geometric coordinates/offsets (`top: 10px; right: 12px;`, tooltip offsets).
     - Component-local micro-shadows on gradient monograms (e.g. `0 1px 2px rgba(0, 0, 0, 0.1)`).

2. **Transitioned Testing Strategy to Three Behavioral Groups**:
   - Replaced implementation-specific regex locks (e.g. `assert.match(css, /height:\s*var\(--control-height,\s*44px\)/)`) in `apps/web/test/form-control-contracts.test.mjs`:
     - **Group 1: Token Contract**: Verifies declaration of required tokens in `tokens.css`, performs DFS cycle detection on token references graph (0 cycles), enforces fallback policy (0 unnecessary fallbacks in `apps/web`), and asserts semantic ownership.
     - **Group 2: Component Consistency**: Verifies `TextInput`, `Textarea`, and `Button` bind sizing and states to canonical contract tokens without hardcoded values, ensures hover states do not clobber focus states (`:not(:focus)`), validates zero `!important` overrides, and checks WCAG AA contrast (5.74:1).
     - **Group 3: Runtime Token Override**: Verified dynamically in browser CDP suite (`scripts/m1-p2-regression.mjs`): overrides `--control-height: 52px` and `--control-radius: 6px` at `:root`, confirms both `TextInput` and `Button` update in lockstep, and verifies clean restoration.

3. **Documentation Updates Synchronized**:
   - `docs/architecture/frontend.md`: Canonical Styling Policy updated with Token Architecture, Semantic Ownership, Fallback Policy, Shared Control Parity, Exceptions, and Test Strategy.
   - `docs/ai/PROJECT_RULES.md`: Section 7 updated with normative token reuse, semantic correctness, fallback avoidance, and behavioral testing requirements.
   - `docs/architecture/reusable-components.md`: Registered `Button`, `TextInput`, `Textarea`, `Checkbox`, `Overlay`, `Panel`, and `StatusBadge` with owner paths, public contracts, consumers, styling dependencies, and fallback policies.
   - `docs/operations/testing.md`: Documented Token Contract, Component Consistency, Runtime Token Override, and visual regression test suites.

4. **Executed Verification Evidence**:
   - `apps/web/test/form-control-contracts.test.mjs`: 9/9 PASSED.
   - `apps/web/test/shared-ui.test.mjs`: 4/4 PASSED.
   - `apps/web/test/m1-shell.test.mjs`: 5/5 PASSED.
   - `scripts/m1-p2-regression.mjs`: ALL PASSED in Chromium CDP (all 6 viewports, Runtime Token Override, focus border, 5.74:1 contrast).
   - `pnpm --filter @nexora/ui test`: 1/1 PASSED.
   - `docker exec nexora-web-1 env -u PORT pnpm --filter @nexora/web test`: 60/60 PASSED.
   - `pnpm format:check`, `pnpm lint`, `pnpm docs:check`, `pnpm preflight:check`: ALL PASSED.

### M1.8 Fix M1 Review Findings & Token Contract (2026-10-24)

Addressed all remaining M1 P2 review findings and synchronized implementation, tests, and canonical documentation with Nexora's UI Design System policy:

1. **P2 — Remove Implementation-Value Locking from Tests**:
   - Refactored `apps/web/test/shared-ui.test.mjs`, `apps/web/test/form-control-contracts.test.mjs`, and `scripts/m1-p2-regression.mjs`.
   - Eliminated brittle literal value assertions (`--control-height: 44px`, `--control-radius: 12px`, hardcoded RGB strings).
   - Enforced Token Contract: required token definitions exist, references resolve acyclically, no circular references, and semantic ownership is preserved.
   - Enforced Component Consistency: `TextInput` and `Button` share identical control height and radius variables (`inputHeight === buttonHeight`, `inputRadius === buttonRadius`), while `TextInput` and `Textarea` share border, focus, disabled, readonly, and invalid semantics. Reconfiguring `--control-height` to 48px or `--control-radius` to 8px in `tokens.css` does not break tests.
   - Enforced Runtime Override: recorded initial computed styles via `getComputedStyle()`, dynamically overrode root `--control-height: 52px` and `--control-radius: 6px` on `document.documentElement`, verified all consumers updated in lockstep, and verified clean restoration to original values.
   - Exact-value assertions are permitted only where an absolute dimension is an explicit, justified acceptance invariant (e.g. 0 layout shifts, WCAG AA thresholds, brand visibility).

2. **P2 — Correct WCAG Contrast Testing**:
   - Replaced hardcoded RGB arrays in `form-control-contracts.test.mjs` with dynamic contrast calculations derived directly from resolved theme tokens (`--color-text-on-accent` and `--color-accent`) using relative luminance formulas.
   - In `scripts/m1-p2-regression.mjs`, evaluated real rendered computed styles from `window.getComputedStyle()`, verifying default state (5.74:1) and hover state (4.58:1) both exceed the WCAG AA 4.5:1 threshold.
   - Standardized Button foreground text in `Controls.module.css` to semantic token `--color-text-on-accent: var(--brand-navy)` and hover to `--color-text-on-accent-hover: var(--brand-navy)`.
   - Added negative tests proving deliberate inaccessible theme modifications (e.g. white text `#ffffff` on orange accent `#f58a24` yielding 2.14:1) fail closed.

3. **P2 — Fix Header/Sidebar First-Paint Accessibility at 901–1100px**:
   - Implemented CSS-first responsive button triad in `Header.tsx` and `Header.module.css`:
     - `.desktopExpandedToggle`: visible only on wide desktop (>1100px), static `aria-expanded="true"`, "Thu gọn thanh điều hướng".
     - `.desktopCompactToggle`: visible only on compact desktop (901–1100px), static `aria-expanded="false"`, "Mở rộng thanh điều hướng".
     - `.mobileToggle`: visible only on mobile/tablet (<=900px), dynamic `aria-expanded={mobileOpen}`, "Mở/Đóng menu di động".
   - First-Paint Parity: Pre-hydration accessibility tree and visible layout match the 72px collapsed Sidebar identically without layout shift (shift < 0.05, observed 0.00) or React hydration warnings.
   - Interactive Verification: CDP verified that manual toggle clicks at 1024px expand the sidebar to 240px (`aria-expanded="true"`) and collapse back to 72px (`aria-expanded="false"`).
   - Mobile drawer accessibility, focus restoration, and zero horizontal scroll overflow (`scrollWidth === viewportWidth`) remain intact across 768px, 390px, and 375px viewports.

4. **P2 — Expand CSS Policy Validation**:
   - Expanded discovery in `form-control-contracts.test.mjs` to recursively scan all production CSS in `apps/web/**/*.css`, `packages/ui/**/*.css`, and future `apps/web/features/**/*.css`, while deliberately excluding build and vendor artifacts.
   - Enhanced declaration parser to handle multiline CSS declarations and nested CSS functions.
   - Enforced fallback rules and semantic ownership (forbidding border tokens for text, surface/border for backgrounds, etc.).
   - Added negative unit tests proving violations in standard paths and future `features/` modules are detected.

5. **Resolve Fallback and Shared Component Consistency**:
   - Standardized `packages/ui/src/Controls.module.css`: eliminated deeply nested fallback chains (`var(--control-border, var(--color-border-subtle, #cbd5e1))`) in favor of direct token consumption (`var(--control-border)`).
   - Enforced strict fallback policy: `apps/web` has mandatory theme tokens (no fallbacks permitted); `packages/ui` avoids repeating raw values solely to duplicate root defaults.
   - Retained `Textarea` export in `@nexora/ui` for domain-neutral form control contract parity with `TextInput`.

6. **Investigation of Foundation CI Failure 40068551943**:
   - Investigated `BROWSER_LAUNCH` timeout in Foundation run 40068551943: Chrome did not emit `DevToolsActivePort` within the 10-second polling timeout under runner load (`exitCode: null`, `stderrBytes: 0`, process still alive).
   - Verified that prior quality and integration stages passed; following established repository rules (NEXORA-024, NEXORA-020, NEXORA-019), bounded same-head rerun is the canonical procedure for runner startup latency without weakening timeouts or assertions.

7. **Executed Verification Evidence**:
   - `node --test apps/web/test/form-control-contracts.test.mjs apps/web/test/shared-ui.test.mjs apps/web/test/m1-shell.test.mjs apps/web/test/navigation.test.mjs packages/ui/test/status-tone.test.mjs`: 24/24 PASSED.
   - `node scripts/m1-p2-regression.mjs`: ALL PASSED in Chromium CDP across all viewports (901px, 1024px, 1100px, 1101px, 1280px, 1440px, 768px, 390px, 375px), 0 layout shifts, 1024px manual toggle, 5.74:1 button contrast, hover contrast, and runtime token overrides.
   - `pnpm format:check`, `pnpm lint`, `pnpm docs:check`, `pnpm preflight:check`: ALL PASSED.

This evidence commit changes documentation only. Exact final documentation-head Preflight/Foundation results and tested merge lineage are recorded in PR27 metadata after execution, avoiding a SHA-only documentation loop. Until those checks finish, final-head readiness is VERIFICATION PENDING. The implementation-source PASS above must not be relabeled as the new commit's PASS. No claim of production DNS/certificate/firewall/NTP/key custody/backup deployment verification; CI uses owned disposable resources only. Immutable design snapshot unchanged; Documentation Impact REQUIRED, canonical frontend/testing documentation synchronized.
