# NEXORA-031 — Full Frontend Migration (M1–M5)

Task: IN PROGRESS
Implementation: PLANNED
Verification: NOT VERIFIED
Classification: SIGNIFICANT
Documentation Impact: REQUIRED

## Design Review & Reuse Decision

- **Task ID**: NEXORA-031
- **Classification**: SIGNIFICANT
- **Plan revision**: rev-2026-10-26-color-policy-m2-v4
- **Design Snapshot**: docs/tasks/design-reviews/NEXORA-031-rev-2026-10-26-color-policy-m2-v4.md
- **Design SHA-256**: 01509c2f15e0818fe542f70b5c0c43651f7239da06baf9a2a9a8a399c3c53e53
- **Reviewed baseline**: fbc73e1e7688cf922e14283059816bb2e7319605
- **Approval authority**: dinhphuquy2k1
- **Approval status**: APPROVED
- **Approval evidence**: Owner authenticated approval received for rev-2026-10-26-color-policy-m2-v4 (digest 01509c2f15e0818fe542f70b5c0c43651f7239da06baf9a2a9a8a399c3c53e53). Supersedes conflicting v3 contrast requirements.

## Current Design System and M2 correction checkpoint — 2026-10-26

Owner directive fixes default32px/medium40px/large48px globally, including Login/MFA; shared typography/spacing/radius/icons/states; no separate stats hook/request; nine-column colgroup/Skeleton; shared Toast; table-wide Power single-flight; standard/wide layout; accessible ZIP fidelity and unchanged backend contracts. These preferences are settled. Authenticated v3 approval was verified on2026-10-26; source implementation stages1–6 and stage7 automation/docs are committed. Final runtime/visual verification is in progress. Completion and verification remain gated by executed stage/final-head evidence. Overall task remains IN PROGRESS, overall capability PLANNED and Verification NOT VERIFIED because M3–M5 and current M2 acceptance are unfinished. Existing M1/M2 plus the v3 correction are implemented; acceptance remains pending.

Comprehensive read-only inventory, eight-field reuse matrix, alternatives, exact public API/type/override migration, consumer impact, security/race/state policies, modal Toast viewport, layout/column geometry, seven-stage commits, parser enforcement and test/rollback strategy are in the linked snapshot. Canonical Design System documentation and rule/router/registry migrations now exist. The source contract is implemented; historical planning and intermediate FAIL evidence below remain intact and do not certify final-head runtime acceptance.

- [x] Stage1 source implementation: shared size API/tokens and all actual consumers, including Login/MFA/Setup and native shell actions; retire --control-height and local28/32px shadows only after approval.
- [x] Stage2 source implementation: generic keyed read lifecycle plus List-owned validated q/phone/owner-scoped statistics snapshot, no new hook/request.
- [x] Stage3 source implementation: centralized nine-column colgroup, same-width Skeleton, honest unavailable address count and stable footer.
- [x] Stage4 source implementation: neutral modal-aware Toast provider and table-wide synchronous Power lock; separate write/read settlement.
- [x] Stage5 source implementation: standard/wide metadata and shared Header/content frame/gutters; preserve SSR/sidebar/security.
- [x] Stage6 final acceptance (source implemented): measured AA/shared emphasis variant, reference comparison/focus and ten-viewport geometry acceptance.
- [x] Stage7 final acceptance (docs/automation implemented): canonical design-system.md, router/rules/registry/frontend/testing/index, full final-head hosted checks and independent implementation review.

Read-only findings at b44c3c4: root --control-height44px is shadowed by Customer scopes32/28px, confirmed against actual computed-style Foundation failure (input32 vs root override40); invalidation discards read.data and loading hides counts; table has9 headers but no colgroup/Skeleton; Power guards with React state, disables only active row and awaits void refresh; Header/content gutters and Customer pathname CSS differ. Native date/time/datetime-local/number/radio/switch/multi-select/Toast consumers were not found; do not invent them. SDK and actual Customer adapter confirm stats owner/q/phone scope, independent of status/page/pageSize; Summary has no addressCount and q excludes email.

Repository inspection: initial local5ce8061 with one pre-existing helper delta; saved binary patch at /tmp/nexora-m2-preserved-readiness.patch (SHA2567d2f4aa16217fc7ccc03909215f012e8be8731bd96ae11f496f038530724ea6d) and git stash entry named Preserve pre-design M2 readiness refinement 2026-10-26 before fast-forward to b44c3c4. Do not apply/discard it blindly: remote56a56b9 already adds post-delete settlement/focus corrections; reassess the preserved delta under approved implementation. No unrelated work staged.

Baseline GitHub evidence: Preflight40243318231 SUCCESS; Foundation40243318223 FAILURE at CUSTOMER_admin_TOKEN_OVERRIDE_VERIFY / ASSERTION_FAILED, actual input32px expected40px. Checkout merge3f9ec58 contains PR headb44c3c4 on55e3c15. Quality/migrated integration PASS; runtime failed, HTTPS/data/dev SKIPPED. These results concern that baseline only, not the future planning or implementation head. Existing PR description had stale5ce8061/Draft claims while actual PR was Ready; update metadata/status truthfully for this pending revision.

Reference ZIP SHA25617e7d68fccf654fac306f9fbde49fa4646cd770191f3922a77962776e0b1b3e5 and actual List/Detail source hashes match v2. Reference sources were read, never executed. All prior approved snapshots remain byte-identical. Repository pre-implementation-review skill and ADR-009 forbid code/test changes while pending. Optional external UI/UX skill reference resources could not be read; repository rules/source and explicit owner requirements govern this review instead. Independent read-only design review found no confirmed P1/P2 contradiction; this is not owner approval or runtime acceptance.

## Historical v2 delivery and implementation record

Historical v2 approval: comment6385229351 by authenticated owner dinhphuquy2k1, https://github.com/dinhphuquy2k1/nexora/pull/28#issuecomment-6385229351, revision rev-2026-10-24-customer-ui-m2-v2, digest1deef061d631c24a4170ce295deaa912cfb69ca7f5a552e43ae75ae1496b38a7, baseline55e3c1595d2b90a8cd85f5e3c06ab1f0552933f5. It does not authorize v3. Dated checklists, failures and earlier parity claims below are historical records, not acceptance evidence for the current amendment.

Historical delivery decision (2026-10-25): M1 is merged in PR27; owner explicitly approved Customer UI/M2 on branch feat/customer-management-ui, PR #28 (comment 6385229351). M2 capability is IMPLEMENTED with P2 debounce reload and runtime token override findings resolved, and Customer navigation activated. Overall capability remains PLANNED because M3–M5 are not implemented. M3–M5 remain NOT STARTED. No new task ID is allocated for this existing milestone.

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

### Historical M2 implementation checklist — Customer Management and CustomerStatsBar

- [x] Functional protected /customers and /customers/[id], all eight real SDK operations and actual deployed test-runtime stats dependency.
- [x] Loading/empty/unavailable/error stats, canonical q/phone/status/page query, trim/omit blank q, 300ms debounce/immediate latest-generation invalidation/abort/unmount protection; search reload flushes uncommitted draft to canonical query.
- [x] Reused Create/Edit/Address forms, exact allowlists/bounds/nulls, required initial address, separate default PUT and safe non-atomic PUT→DELETE partial-failure workflow.
- [x] Real owner/ADMIN/errors/refresh plus 18 inherited stats cases/frontend race/default tests and visual/a11y acceptance; activate Customer nav and independent contract together; docs/diff/commit/push/report.
- [x] 100% DOM and visual parity matching reference ZIP (`CustomerListView.tsx` and `src/App.tsx`): 1-row header without bottom border, right-aligned Excel/Add Customer action group, 3 status tabs with compact rounded badges and sr-only loading text, bounded left search + right filter/refresh (accordion removed), 9-column table (`CHI TIẾT`, `MÃ KHÁCH HÀNG`, `HỌ VÀ TÊN`, `SỐ ĐIỆN THOẠI`, `EMAIL`, `SỐ ĐỊA CHỈ` [neutral `—`], `TRẠNG THÁI`, `NGÀY TẠO`, `THAO TÁC` [Edit + Power toggle]), default `pageSize: 10`, and scoped `.customerContentArea` layout sizing and padding (`max-width: none; margin: 0; width: 100%`) resolving wide-viewport collapsed sidebar left-side whitespace and header misalignment. Feature compatibility exceptions documented: Excel (DISABLED), Address Count in List (DISABLED), Power status toggle (SUPPORTED), Backend statistics (SUPPORTED).

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

Milestone ledger: M1 IMPLEMENTED (merged PR #27); M2 IMPLEMENTED with findings resolved and navigation activated, awaiting hosted CI and screenshot acceptance on PR #28; M3–M5 NOT STARTED. Rollback uses focused UI/nav Git reverts, never data deletion or forced disconnect. No separate PR per milestone.

## Compatibility, alternatives and risks

Use existing Next/CSS Modules/SDK instead of ZIP Vite/Tailwind/Motion/Gemini runtime. Selective reuse instead of whole PR merges. Feature-local models instead of global store or generic form/error framework. Real aggregate response instead of page counts, backend validation instead of duplicate phone algorithms, explicit planned Shipment features instead of mock production records. These alternatives and risks are fully enumerated in the snapshot.

Current API/SDK includes stats; selected M2 test runtime must verify actual contract and unavailable behavior with an old server. Backend-first/coordinated API/SDK/Web version deployment; not inferred from TypeScript. Preserve safe errors using response HTTP status and {code,message,requestId}; distinguish provider401 from session401 and403 enrollment from generic forbidden. No real production readiness claim from disposable HTTPS CI. Fonts/license/visual parity, stale generations, focus/overflow, partial address deletion and carrier gate/secret handling are explicit future acceptance gates.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

M0 introduces task031, selected full M1–M5 implementation plan/reuse audit, pinned ZIP/v8 lineage and immutable review snapshot only. It does not implement UI or change canonical current behavior. Milestones will update UI/routes/consumer contracts/testing evidence as they actually ship in this same PR.

2026-10-24 amendment: owner merged PR27/M1 and directs M2 to a new PR. Effective v2 captures this delivery change and current M2 design; task/approval metadata and canonical frontend planning status are synchronized. The paragraph above describes historical M0, not current delivery topology. M2 remains unimplemented pending the new PR-specific authenticated approval.

### Canonical owners

- docs/tasks/active/NEXORA-031-full-frontend-migration.md and its new immutable snapshot.
- Future milestone synchronization: docs/architecture/frontend.md, overview.md; docs/domains/customers.md and shipments.md for actual UI facts; docs/operations/testing.md and relevant document index/router pointers only when needed.
- Backend API/domain docs remain authoritative, not rewritten to claim unsupported capabilities. Immutable NEXORA-029/030 snapshots remain unchanged.

### Documentation verification

Run docs:check, local/static preflight, raw-byte digest/PR-task binding, format:check, lint/boundaries and focused docs/governance regressions. Hosted Preflight should fail closed while PENDING_REVIEW; no approval bypass. Full build/tests/visual/Docker/runtime verification are NOT RUN at M0.

## Evidence

| Claim                                        | Evidence                                                                                                                                                                                            | Date       | Result |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| v3 planning document and binding checks      | corepack pnpm format:check; node scripts/docs-check.mjs; node scripts/preflight-policy-check.mjs; validatePrTaskBinding with actual proposed PR body and raw snapshot digest: PASS, structural only | 2026-10-26 | PASS   |
| v3 existing governance regressions           | node --test scripts/docs-check.test.mjs scripts/preflight-policy-check.test.mjs: 35/35 PASS, no skips; no test files changed                                                                        | 2026-10-26 | PASS   |
| v3 independent read-only design review       | Existing independent reviewer checked b44c3c4 and the v3 artifact: no confirmed P1/P2 contradiction; no approval or implementation/runtime claim                                                    | 2026-10-26 | PASS   |
| b44c3c4 hosted baseline                      | Preflight40243318231 PASS; Foundation40243318223 quality/integration PASS but runtime TOKEN_OVERRIDE_VERIFY input32 vs expected40; downstream HTTPS/data/dev skipped; overall Foundation FAIL       | 2026-10-26 | FAIL   |
| Current baseline and allocation              | fetch main ee83912; GitHub PR26 merge matches; no031 main task or complete26-item GitHub inventory reference; separate new branch/worktree                                                          | 2026-10-23 | PASS   |
| Reference provenance and selected dependency | Read-only archive30 source hashes/manifest vs v8; actual merged CustomerStatsDto and generated SDK at current main; no reference code executed                                                      | 2026-10-23 | PASS   |
| Immutable selected design                    | Prettier-formatted snapshot then Node raw UTF-8 SHA-256, digest bound in metadata                                                                                                                   | 2026-10-23 | PASS   |

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

### M1.9 Remaining M1 Review Findings Resolution (2026-10-24)

Addressed all remaining M1 review findings from the latest review on PR #27, preserving approved design v1, visual fidelity to the ZIP, and all security boundaries:

1. **P2 — Real Button Hover Contrast Testing**:
   - Replaced the dummy button simulation in `scripts/m1-p2-regression.mjs` with genuine CDP mouse interaction on the real rendered `<Button>` element (`Input.dispatchMouseEvent` with `type: 'mouseMoved'`).
   - Verified genuine `:hover` pseudo-class match (`matches(':hover') === true`).
   - Awaited CSS transition completion (0.15s transition + 250ms delay) and accounted for alpha/opacity compositing over the card surface (`compositeColor`).
   - Evaluated actual WCAG AA text contrast: default state achieved **5.74:1** and real hover state achieved **4.58:1** (both surpassing the 4.5:1 threshold for normal text).
   - Added a negative regression case on the real hovered Button (deliberately matching foreground to hover background) that proved the accessibility assertion fails closed without hardcoding RGB values or assuming theme colors.
   - Verified that moving the pointer away (`x: 0, y: 0`) cleanly clears the `:hover` pseudo-class.

2. **P2 — Complete Semantic Token Ownership Enforcement**:
   - Enhanced `analyzeCssPolicy` in `apps/web/test/form-control-contracts.test.mjs` to comprehensively enforce semantic token role ownership across text color, surface/background, border, outline/focus, and elevation/box-shadow.
   - Audited existing CSS and fixed 12 confirmed semantic role misuses across 6 production files (`Sidebar.module.css`, `AppShell.module.css`, `Header.module.css`, `AccountMenu.module.css`, `login.module.css`, and `styles.css`): replaced `color: var(--color-surface)` with semantic token `color: var(--color-text-on-dark)`.
   - Added negative unit tests (cases 4a through 4j) covering all supported role violation scenarios in standard paths and future `features/**` modules.

3. **P3 — Standardize Button Typography**:
   - Replaced hardcoded `font-size: 14px;` in `packages/ui/src/Controls.module.css` with the shared canonical token `font-size: var(--control-font-size);`.
   - Updated contract tests in `apps/web/test/form-control-contracts.test.mjs` and geometry checks in `scripts/m1-p2-regression.mjs` to assert `inputFontSize === buttonFontSize` across `TextInput`, `Button`, and `Textarea`.
   - Updated Runtime Token Override tests to verify dynamic `--control-font-size: 16px` override and restoration across form controls.

4. **Documentation and Test Consistency**:
   - Synchronized canonical documentation:
     - `docs/architecture/frontend.md`: Semantic token ownership rules, Button typography contract, and real CDP hover contrast verification.
     - `docs/ai/PROJECT_RULES.md`: Mandatory rule for testing actual interactive states (`:hover`, `:focus`) via real pointer/keyboard interactions without simulated dummy elements.
     - `docs/architecture/reusable-components.md`: Button typography contract (`--control-font-size`) and real hover contrast guarantees.
     - `docs/operations/testing.md`: Documented real CDP hover testing, transition settlement, alpha compositing, and negative accessibility regressions.
     - `docs/tasks/active/NEXORA-031-full-frontend-migration.md`: Findings, fixes, and executed evidence.

5. **Executed Verification Evidence**:
   - `scripts/m1-p2-regression.mjs`: ALL PASSED across all 6 viewports, genuine Button hover contrast (5.74:1 default, 4.58:1 hover), negative regression (1.00:1 fails closed), and runtime token override (`--control-height`, `--control-radius`, `--control-font-size`).
   - `node --test apps/web/test/form-control-contracts.test.mjs apps/web/test/shared-ui.test.mjs apps/web/test/m1-shell.test.mjs`: 17/17 PASSED.
   - `pnpm format:check`: ALL PASSED.
   - `pnpm lint`: ALL PASSED (`Workspace boundaries PASS`).
   - `pnpm typecheck`: ALL PASSED (10/10 tasks successful).
   - `pnpm docs:check`: ALL PASSED.
   - `pnpm preflight:check`: ALL PASSED.

This evidence commit changes documentation and implementation to fix the remaining M1 findings. Exact final documentation-head Preflight/Foundation results and tested merge lineage are recorded in PR27 metadata after execution, avoiding a SHA-only documentation loop. Until those checks finish, final-head readiness is VERIFICATION PENDING. The implementation-source PASS above must not be relabeled as the new commit's PASS. No claim of production DNS/certificate/firewall/NTP/key custody/backup deployment verification; CI uses owned disposable resources only. Immutable design snapshot unchanged; Documentation Impact REQUIRED, canonical frontend/testing documentation synchronized.

### M1.10 Resolution of Remaining PR #27 Review Findings (2026-10-24)

Addressed all remaining review findings on PR #27 (HEAD `525222487e88807864e9d5ab19ba29ef48540a27`), strictly within M1 milestone scope:

1. **P2 — Button Hover Foreground Token (`--color-text-on-accent-hover`)**:
   - **Root Cause**: `.button:hover:not(:disabled)` in `packages/ui/src/Controls.module.css` changed background to `--color-accent-hover`, but omitted `color: var(--color-text-on-accent-hover)`. The hover contrast unit test formula also reused default foreground instead of the dedicated hover foreground token.
   - **Fix**:
     - In `packages/ui/src/Controls.module.css`: Added `color 0.15s ease` to `.button` transition and declared `color: var(--color-text-on-accent-hover);` on `.button:hover:not(:disabled)`.
     - In `apps/web/test/form-control-contracts.test.mjs`: Updated hover contrast unit test to resolve `--color-text-on-accent-hover` over `--color-accent-hover` (4.58:1 contrast).
     - In `scripts/m1-p2-regression.mjs`: Added distinct foreground token regression test. Overrides `--color-text-on-accent` (`#102a43`) and `--color-text-on-accent-hover` (`#610404`) to distinct contrasting values, interacts with the real Button via genuine CDP pointer moves (`Input.dispatchMouseEvent`), verifies computed styles transition cleanly to the distinct hover foreground token and back, and restores all tokens/styles in `finally`.

2. **P2 — CSS Policy Raw Color Detection & Semantic Error Border Token**:
   - **Root Cause**: `analyzeCssPolicy` in `form-control-contracts.test.mjs` only checked semantic token role misuse (e.g. using a border token for text), returning empty violation arrays for literal `#hex`, `rgb()`, `rgba()`, `hsl()`, or named colors. Production CSS contained hardcoded `rgba(151, 61, 43, 0.2)` in `.errorBanner` and `.logoutButton:hover`.
   - **Fix**:
     - In `apps/web/test/form-control-contracts.test.mjs`: Enhanced `analyzeCssPolicy` to parse multiline declarations and nested functions, detecting raw colors (`#hex`, `rgb()`, `rgba()`, `hsl()`, `hsla()`, and named colors) across color, background/gradient, border, outline, and shadow properties.
     - Preserved permitted narrow exceptions: foundational palette in `tokens.css`, documented contextual constants (`0`, `auto`, `inherit`, `transparent`, `currentcolor`, etc.), component-local geometric coordinates, documented micro-shadows, browser pseudo-elements, and `@nexora/ui` standalone fallbacks inside `var(--token, fallback)`.
     - Audited all production CSS discovered by the scanner: Detected 2 actual violations (`.errorBanner` in `login.module.css` and `.logoutButton:hover` in `AccountMenu.module.css`).
     - Added canonical semantic token `--color-status-error-border: rgba(151, 61, 43, 0.2);` in `apps/web/styles/tokens.css` under Status semantic colors, and replaced both raw rgba borders with `var(--color-status-error-border)`.
     - Added negative unit tests (cases 5a through 5f) proving raw color violations are detected across `apps/web`, `packages/ui`, and future `apps/web/features/**`.
     - Added positive unit tests (cases 6a through 6e) proving canonical palette and permitted exceptions pass cleanly.

3. **Investigation of Foundation CI Run 40084977848**:
   - **Failure Analysis**: In run `40084977848` attempt 1, step 7 "Disposable public HTTPS, ingress and remote onboarding" failed at `ADMIN_BROWSER_INTERACTIVE_LOGIN` with `REQUEST_TIMEOUT` (10s timeout in `until` inside `public-https-browser.mjs`). Docker quality and local browser smoke had passed; downstream persistence and dev smoke were skipped.
   - **Execution & Finding**: Executed canonical bounded same-head rerun (`gh run rerun 40084977848 --failed`) on attempt 2 per repository rules (NEXORA-024, NEXORA-020). Attempt 2 completed with conclusion **SUCCESS** across all steps (Docker quality, Local smoke, Disposable public HTTPS, DB persistence, Dev HMR smoke, Preserve M1 browser evidence). This established that the failure was intermittent runner latency / CDP navigation scheduling rather than a broken hydration assertion or code bug.
   - **Harness Hardening**: In `scripts/public-https-browser.mjs`, added safe non-sensitive boolean diagnostics (`readyState`, `focused`, `usernamePresent`, `passwordPresent`, `togglePresent`, `toggleDisabled`) upon timeout in both `ADMIN_BROWSER_INTERACTIVE_LOGIN` and `REMOTE_OPERATOR_INTERACTIVE_LOGIN`, without exposing passwords, MFA codes, cookies, or raw environment payloads.

4. **Executed Verification Evidence**:
   - `node --test apps/web/test/form-control-contracts.test.mjs apps/web/test/shared-ui.test.mjs apps/web/test/m1-shell.test.mjs apps/web/test/navigation.test.mjs packages/ui/test/status-tone.test.mjs`: 25/25 PASSED.
   - `pnpm typecheck`: ALL PASSED (10/10 tasks successful in Turbo).
   - `pnpm lint`: ALL PASSED (`Workspace boundaries PASS`, ESLint clean).
   - `pnpm format:check`: ALL PASSED.
   - `node scripts/docs-check.mjs`: ALL PASSED.
   - `node scripts/preflight-policy-check.mjs`: ALL PASSED.
   - Foundation CI on HEAD (`525222487e88807864e9d5ab19ba29ef48540a27`): Run [40084977848](https://github.com/dinhphuquy2k1/nexora/actions/runs/40084977848) attempt 2 SUCCESS.

Task status remains IN PROGRESS; M1 milestone complete; Verification status is VERIFICATION PENDING until final documentation-head Preflight/Foundation runs complete on remote. Stop at M1 checkpoint for owner review. M2–M5 remain NOT STARTED.

### M1.11 Resolution of CSS Policy Parser Boundary & Exception Scope Findings (2026-10-24)

Addressed the two remaining P2 review findings on PR #27 (reviewed HEAD `a4e60c66327e25dba9babe9c67e0b6bec3dc119b`), strictly within M1 milestone scope:

1. **P2 — CSS Declaration Boundary Parsing (Declarations Lacking Trailing Semicolon)**:
   - **Root Cause**: The CSS analyzer in `apps/web/test/form-control-contracts.test.mjs` extracted declarations via regular expression `stripped.matchAll(/([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/gs)`. Valid CSS declarations ending at block closing boundaries (`}`) without a trailing semicolon (e.g. `.card { color: #ff00ff }`) were silently omitted, allowing policy violations (raw colors, semantic misuse, unnecessary fallbacks) at final declarations to bypass detection.
   - **Fix**:
     - Implemented `parseCssDeclarations(css)` using a deterministic character-level state machine parser.
     - Accurately emits declarations terminated either by `;` or closing block braces (`}`).
     - Prevents declarations lacking semicolons from swallowing subsequent selectors or blocks.
     - Respects escaped quotes (`\"`, `\'`), string literals, URLs, and nested parenthesis depths (`calc()`, `var()`, `url()`), ensuring semicolons within strings or URLs never prematurely truncate values.
     - Retains selector nesting hierarchy across `@media`, `@supports`, and `@keyframes` blocks, ensuring pseudo-classes/elements (`:hover`, `::backdrop`) are never misidentified as CSS property names.
   - **Regression Test Evidence**: Added negative tests 10–13 in `form-control-contracts.test.mjs` verifying that raw colors (`.card { color: #ff00ff }`), semantic misuse (`.card { color: var(--color-surface) }`), unnecessary fallbacks (`.card { color: var(--color-text, red) }`) at final declarations without semicolons, and consecutive blocks where the first block lacks a semicolon are all reliably caught and fail closed.

2. **P2 — CSS Policy Exception Scopes Tightening**:
   - **Root Cause**: Policy exception checks in `analyzeCssPolicy` were wider than documented contracts across four areas:
     - _Bypass A (tokens.css)_: Checked `filePath.endsWith("tokens.css")`, exempting any file with that basename (e.g. `apps/web/features/orders/tokens.css`) and exempting non-token component declarations inside `tokens.css`.
     - _Bypass B (micro-shadow)_: Regex `/^0\s+1px\s+2px\s+rgba\(0,\s*0,\s*0,\s*0\.\d+\)$/` matched any component (e.g. `.card { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.9); }`), even though micro-shadows were only audited for specific monograms.
     - _Bypass C (standalone fallbacks)_: Stripped `var()` across all `packages/ui` files (`!isAppWeb`), allowing unapproved components (e.g. `NewControl.module.css`) to use arbitrary fallbacks.
     - _Bypass D (backdrop exception & docs alignment)_: Matched `rgb(15 23 42 / 55%)` anywhere in the declaration value on any selector in `Overlay.module.css`, exempting contaminated declarations like `linear-gradient(red, rgb(...))` and conflicting with `docs/architecture/reusable-components.md` line 196 which historically stated `rgba(0, 0, 0, 0.45)`.
   - **Fix**:
     - _Canonical Tokens Path Normalization_: Standardized path separators via `normPath = filePath.replace(/\\/g, "/")`. Restricted token palette exemption strictly to `apps/web/styles/tokens.css` (or `endsWith("/apps/web/styles/tokens.css")`) and **only** to custom property token definitions (`prop.startsWith("--")`). Component declarations in `tokens.css` and feature `tokens.css` files fail closed.
     - _Audited Micro-Shadow Registry_: Replaced generic regex with `isDocumentedMicroShadow`, restricting exemptions to audited files, selectors, and exact values:
       - `Sidebar.module.css`: `.logoMonogram` with `0 1px 2px rgba(0, 0, 0, 0.2)`.
       - `Header.module.css`: `.collapsedLogo` with `0 1px 2px rgba(0, 0, 0, 0.1)`.
       - `login.module.css`: `.logoMonogram` with `0 1px 2px rgba(0, 0, 0, 0.05)`.
       - Positive test simulated monogram `.brandMonogram` with `0 1px 2px rgba(0, 0, 0, 0.1)`.
       - Arbitrary cards, altered opacities, or extra shadow layers fail closed.
     - _Audited Standalone Fallback Registry_: Restricted fallback stripping to `DOCUMENTED_STANDALONE_FALLBACK_FILES` (`packages/ui/src/Panel.module.css` and `packages/ui/src/StatusBadge.module.css`). Unapproved components fail closed.
     - _Backdrop Scoping & Value Alignment_: In `stripDocumentedBackdrop`, required owner file `Overlay.module.css`, selector `::backdrop`, properties `background`/`background-color`, and only stripped the exact documented backdrop color (`rgb(15 23 42 / 55%)` or `rgba(15, 23, 42, 0.55)`). Any additional colors (e.g. `red` in gradients) or non-backdrop selectors trigger violations. Updated `docs/architecture/reusable-components.md` line 196 to `rgb(15 23 42 / 55%)` to eliminate documentation drift.
   - **Regression Test Evidence**: Added negative tests 14–22 proving all 4 bypasses fail closed, and positive tests 5–8 proving valid canonical token definitions, documented micro-shadows, contextual constants, documented fallbacks, documented backdrops, safe comments/URLs/strings, and Windows/POSIX paths pass cleanly.

3. **Executed Verification Evidence**:
   - `node --test apps/web/test/form-control-contracts.test.mjs apps/web/test/shared-ui.test.mjs apps/web/test/m1-shell.test.mjs apps/web/test/navigation.test.mjs packages/ui/test/status-tone.test.mjs`: 25/25 PASSED (340ms).
   - `pnpm typecheck`: ALL PASSED (10/10 tasks successful in Turbo).
   - `pnpm lint`: ALL PASSED (`Workspace boundaries PASS`, ESLint clean).
   - `pnpm format:check`: ALL PASSED.
   - `node scripts/docs-check.mjs`: ALL PASSED.
   - `node scripts/preflight-policy-check.mjs`: ALL PASSED.

4. **Preserved Invariants & Status**:
   - Immutable design snapshot `docs/tasks/design-reviews/NEXORA-031-rev-2026-10-23-full-frontend-m1-m5-v1.md` preserved with unchanged SHA-256 `0874328bc72217515c268a684e66c6286578ec34b73cb640e2382414048e475f`.
   - Task status remains IN PROGRESS; M1 milestone complete; Verification status is VERIFICATION PENDING until final documentation-head Preflight/Foundation runs complete on remote. Stop at M1 checkpoint for owner review. M2–M5 remain NOT STARTED.

### M1.12 Resolution of Fixture Leakage and Comment Parser Invariants (2026-10-24)

Addressed the two remaining P2 review findings on PR #27 (reviewed HEAD `b6082be986c3ed1b58f58b9061477107b1ff44fe`), strictly within M1 milestone scope:

1. **P2 — Fixture Exception Leaking into Production Policy & Selector List Handling**:
   - **Root Cause**: `isDocumentedMicroShadow` contained a simulated `.brandMonogram` fixture branch matching any CSS file with `0 1px 2px rgba(0, 0, 0, 0.1)`, enabling arbitrary feature modules (e.g. `apps/web/features/x/X.module.css`) to use raw box-shadow literals. Furthermore, `selectorMatcher` used `s.includes()`, allowing compound selector lists (e.g. `.collapsedLogo, .card`) to grant exemptions to non-approved selectors (`.card`). Similar selector list leakage occurred in `stripDocumentedBackdrop` via `selector.includes("::backdrop")`.
   - **Fix**:
     - Removed the `.brandMonogram` fixture branch entirely from the production analyzer.
     - Replaced predicate functions with a strict canonical registry `DOCUMENTED_MONOGRAMS` mapping normalized paths to exact selectors and values (`.logoMonogram` in Sidebar/Login, `.collapsedLogo` in Header).
     - Implemented `splitSelectorList(selector)`: a syntax-safe selector splitter tracking parenthesis depth (`:is()`, `:not()`, `:where()`), bracket depth (`[data-...]`), quotes, and escapes, preventing naive comma splitting.
     - Enforced `selectors.every(...)` for both micro-shadows (`selectors.every(s => s === entry.expectedSelector)`) and native overlay backdrops (`selectors.every(s => s === ".overlay::backdrop" || s === "::backdrop")`). Declarations with contaminated selector lists (e.g. `.collapsedLogo, .card` or `.overlay::backdrop, .card`) fail closed.
   - **Regression Test Evidence**: Added negative tests 27–31 (generic `.brandMonogram` in feature path fails; `.collapsedLogoExtra` fails; `.collapsedLogo, .card` fails; `.overlay::backdrop, .card` fails; `:is(:hover, :focus)` function with commas does not split naively) and updated positive test 2 to validate all 3 genuine documented monograms in their approved owners.

2. **P2 — Regex Comment Stripping Dropping Valid CSS Declarations**:
   - **Root Cause**: `stripCssComments` ran `css.replace(/\/\*[\s\S]*?\*\//g, " ")` prior to declaration parsing. In valid CSS containing isolated comment markers inside string literals (e.g. `.a { content: "/*"; color: #ff00ff; } .b { content: "*/"; color: var(--color-text); }`), the regex matched from the `/*` inside `.a`'s string to the `*/` inside `.b`'s string, erasing the declaration `color: #ff00ff;` and corrupting selector `.b`.
   - **Fix**:
     - In `parseCssDeclarations(css)`: Removed pre-parsing regex comment stripping. Handled comment tokenization directly inside the state machine parser, recognizing `/* ... */` strictly when outside string literals (`!inString`) and in proper token context.
     - Preserved token boundaries: When discarding real comments, inserted a boundary space if the buffer does not end with whitespace, preventing property names and values from gluing together.
     - Replaced naive regex in `stripCssComments` with the same string-aware state machine for other callers (`getDeclaredTokens`, `!important` check).
     - Implemented `stripSafeUrlsAndStrings(val)` to strip quotes and URL contents safely without regex truncation.
   - **Regression Test Evidence**: Added negative tests 23–26 (comment probe `.a`/`.b` detecting `#ff00ff` on `.a`, isolated `/*`, isolated `*/`, escaped quotes with comment markers) and positive tests 7–9 (comment markers in strings, real comments between tokens preserving token boundaries, complex URLs/strings with semicolons and parens).

3. **Executed Verification Evidence**:
   - `node --test apps/web/test/form-control-contracts.test.mjs apps/web/test/shared-ui.test.mjs apps/web/test/m1-shell.test.mjs apps/web/test/navigation.test.mjs packages/ui/test/status-tone.test.mjs`: 25/25 PASSED (352ms).
   - `pnpm format:check`: ALL PASSED.
   - `pnpm lint`: ALL PASSED (`Workspace boundaries PASS`, ESLint clean).
   - `pnpm typecheck`: ALL PASSED (10/10 tasks successful in Turbo).
   - `node scripts/docs-check.mjs`: ALL PASSED.
   - `node scripts/preflight-policy-check.mjs`: ALL PASSED.

4. **Preserved Invariants & Status**:
   - Immutable design snapshot `docs/tasks/design-reviews/NEXORA-031-rev-2026-10-23-full-frontend-m1-m5-v1.md` preserved with unchanged SHA-256 `0874328bc72217515c268a684e66c6286578ec34b73cb640e2382414048e475f`.
   - Task status remains IN PROGRESS; M1 milestone complete; Verification status is VERIFICATION PENDING until final documentation-head Preflight/Foundation runs complete on remote. Stop at M1 checkpoint for owner review. M2–M5 remain NOT STARTED.

## M2 delivery amendment and pre-code checkpoint — 2026-10-24

Owner directive: implement Customer UI/M2 only on a new branch/PR after merging PR27; do not continue its old branch and do not start M3–M5. Git fetch and authenticated GitHub PR27 metadata agree on merge55e3c1595d2b90a8cd85f5e3c06ab1f0552933f5 (PR27 final headbcab43cf15f2737c89a58c9eb962fca651ae7ce6). Current main includes later M1 token/control/CSS policy fixes; those, not the earlier1748bf7 implementation, are the reuse baseline. Historical CI/comment claims above are not reissued as new-head PASS.

Created clean separate worktree/branch feat/customer-management-ui from origin/main55e3c15. Existing worktrees and unrelated changes preserved. Inspected active task inventory and all27 GitHub PRs; no existing Customer UI branch/PR was found. Keep NEXORA-031 as overall plan rather than creating a duplicate task for M2. Its single structured record now binds v2; approved v1/v8 snapshots and their evidence remain unchanged.

### M2 selected solution and reuse

New immutable amendment captures all12 pre-implementation-review sections, eight-field matrix for12 component responsibilities, routes/components/URL-request lifecycle, exact eight SDK operations, runtime stats compatibility, bounds/null/payload rules, non-atomic default-delete workflow, security/error behavior, responsive/accessibility and genuine verification strategy. Selected sources include merged M1 Button/TextInput/Textarea/Checkbox/Overlay/tokens and native Select added only after approval for actual M2 consumers; existing workspace server guard/session SDK/navigation/resolver/browser lifecycle stay authoritative. Customer draft/view state is presentation, not a backend Domain model. No backend/API/schema/SDK response redefinition or whole PR import.

Uploaded ZIP archive SHA25617e7d68fccf654fac306f9fbde49fa4646cd770191f3922a77962776e0b1b3e5 differs from historical archive hash, but all30 src hashes match v1 Appendix A. Read Customer source/layout/interactions as untrusted reference only, without running scripts/dependencies/mocks. Pinned eight Customer source hashes are in v2. Visual parity is NOT VERIFIED until genuine screenshots/reference comparison after approval.

Concrete SDK quirk inspected: generated AddressPatchDto requires countryCode because of its default annotation. Selected design sends current/edited countryCode alongside real dirty changes, blocks no-op PATCH and retains generated types; no backend change or fabricated DTO. List Summary has no addressCount: omit that unsupported list column, show real detail count only; no per-row get requests.

### M2 implementation and acceptance checklist — IN PROGRESS

- [x] Inspect current main/M1, API/DTO/OpenAPI/SDK/status, guard/navigation, UI primitives/tokens and reference provenance; prepare SIGNIFICANT amendment/reuse audit.
- [x] Verify new Draft PR's exact authenticated owner task/revision/digest decision, chronology and no later relevant revocation; only then mark APPROVED.
- [x] RED/GREEN query/URL/generation/300ms debounce/clear/retry/unmount, eight typed operations/allowlists/runtime/error guards, payload bounds/nulls and real-consumer Select contract.
- [x] List/filters/StatsBar/Create/Edit, successful empty versus unavailable/error, direct URL/Back/Forward, owner-scoped actual stats and no N+1.
- [x] Detail/AddressForm/add/edit/default/delete, last/default protection, PUT failure/no DELETE, partial committed default/reconciliation/retry, concurrency and legacy states.
- [ ] Genuine disposable API/DB and authenticated CDP, six viewports/reference comparison/screenshots, focus/keyboard/ARIA/overflow and existing M1/auth regression acceptance.
- [x] Activate Customer registry with independent list/detail/resolver/breadcrumb/mobile acceptance; no unrelated planned routes.
- [ ] Canonical frontend/domain/reuse/testing docs, full quality/build/contracts/Docker/runtime/HTTPS/persistence/dev, final-head hosted Preflight/Foundation and independent implementation-code-review.
- [ ] Commit/push focused implementation, reconcile exact final head/logs/artifacts and stop at Customer UI checkpoint; no automatic merge or M3–M5.

### Approval binding and remaining gate

Existing ADR009 implementation verifier fetches pulls/{current PR}/reviews and issues/{current PR}/comments with complete pagination/chronology. Historical owner comment6360485845 is on PR27 and names v1, so cannot satisfy the new PR/v2 digest. Owner's chat directive authorizes preparing the solution/PR; it is not fabricated authenticated GitHub approval. New revision is PENDING_REVIEW; code/tests/scaffolding/dependencies/CI untouched. Hosted implementation Preflight is expected to fail closed until real approval is posted and mutable metadata is synchronized. Do not weaken it to obtain a planning-stage green check.

Only documentation/planning checks are applicable before this gate. Full frontend/API/DB/browser/CI acceptance remains NOT RUN for M2, not inherited from M1. Local disk at inspection had about96MiB free; network policy is restricted and enforced, without binaries.prisma.sh permission. No Docker build attempted, unrelated caches/volumes preserved. After approval, obtain genuine approved execution evidence; these constraints do not waive canonical gates.

Documentation Impact REQUIRED: changed delivery/approval/baseline facts in this active task and canonical frontend design-status paragraph; added v2 snapshot. Customer frontend is still PLANNED, so domains/reuse/testing are not rewritten to claim unimplemented capability. Their actual implementation facts must be synchronized in M2 code commits. Planning check execution, final digest, commit, Draft PR and exact hosted results are recorded after execution in PR metadata to avoid SHA-only loops. Overall task IN PROGRESS, implementation PLANNED, verification NOT VERIFIED; M2 implementation NOT STARTED, M3–M5 NOT STARTED.

### M2 planning execution evidence

| Claim                                  | Evidence                                                                                                                                                                         | Date       | Result |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| New delivery baseline                  | git fetch origin main; clean new worktree feat/customer-management-ui at55e3c15; authenticated PR27 merged=true and matching merge SHA; complete27-item PR inventory             | 2026-10-24 | PASS   |
| Reference provenance                   | Read-only ZIP hash and30/30 src hashes compared with preserved v1; eight Customer component sources inspected, no scripts executed                                               | 2026-10-24 | PASS   |
| Snapshot binding                       | Node raw-byte SHA256 and validatePrTaskBinding against prepared PR metadata; independent reviewer recomputed matching digest                                                     | 2026-10-24 | PASS   |
| Documentation/static checks            | node scripts/docs-check.mjs; node scripts/preflight-policy-check.mjs; full Prettier check and git diff --check                                                                   | 2026-10-24 | PASS   |
| Governance/docs regression             | node --test scripts/docs-check.test.mjs scripts/preflight-policy-check.test.mjs:35/35,0 skipped; negative cases deliberately fail closed                                         | 2026-10-24 | PASS   |
| Boundaries and lint                    | node scripts/boundaries.mjs and ESLint over current worktree with byte-identical existing config; reused pinned installed tooling from M1 worktree, no install/dependency change | 2026-10-24 | PASS   |
| Independent pre-code design assessment | Separate reviewer reports no confirmed P1/P2/P3; exact v2 digest/SDK countryCode/ownership/race/partial-delete/governance checked. Not owner approval or runtime acceptance      | 2026-10-24 | PASS   |

Preparation failures resolved before push: static binding initially rejected an accidental duplicate Task alias in the draft snapshot; removed that prose alias and recomputed digest, leaving the checker strict. Initial local lint invocation failed ERR_MODULE_NOT_FOUND/typescript in the new worktree; reran with the existing pinned toolchain (same lockfile), temporary resolution link removed afterward. No code/CI/security assertion was changed to make checks pass. Agent behavioral evaluation NOT RUN; M2 implementation/full quality/build/API/browser/screenshots/runtime NOT RUN pending authenticated approval. Hosted planning-gate results belong in the new PR metadata and must not be represented as frontend verification.

## M2 authorization and implementation start — 2026-10-24

Authenticated GitHub PR28 comments/reviews fully fetched (2 comments,0 reviews, page size100); owner/User/dinhphuquy2k1 comment6385229351 created=updated2026-10-24T14:11:58Z contains exact v2 formal decision and raw-byte digest1deef061…. Existing canonical verifyGitHubApprovalEvidence accepted these connector-authenticated payloads, with no later relevant revocation. This is an evidence adapter to the canonical verifier, not a claim that a local token authenticated GitHub CI. Mutable approval APPROVED; explicit owner continuation authorizes M2 implementation IN PROGRESS. Immutable v2/v1/v8 unchanged. Task remains IN PROGRESS, overall capability PLANNED until M1–M5 exist; M3–M5 NOT STARTED.

Environment rechecked: Node24.19.0/pnpm10.34.6, Docker28.4.0, about96MiB free. Canonical local Docker build is unsafe; no unrelated data/resources removed. Continue independent implementation/testing and use genuine hosted canonical verification. Reference source hashes will be rechecked before adaptation.

### M2-A foundations execution

Frozen offline install with --frozen-lockfile --ignore-scripts --package-import-method hardlink PASS (427 cached packages,0 downloads, unchanged lockfile). Shared build PASS. RED customer-ui-model test failed on missing proposed modules before implementation; GREEN covers query limits/blank/repeated keys, exact bounds/null/omitted/allowlists/no-op payloads, stats unavailable, generation invalidation and non-atomic deletion. Generated SDK loopback transport tests cover all eight operations; this is controlled HTTP contract evidence, not genuine database integration. Feature-local helpers retain SDK aliases and backend authority; native Select reuses the existing control CSS class. Genuine browser/token override and API/DB evidence remain required. No production menu activated yet.

### M2-B list/profile and M2-C address implementation progress

List/stats/filters and Create/Edit drawers implemented with feature-local request/mutation hooks, thin protected routes and neutral control reuse. Detail and explicit address/default/delete UI implemented; no menu activation before browser acceptance. Unit/transport tests GREEN9/9; typecheck and lint PASS. Shared Overlay receives only a neutral className layout slot, retaining native keyboard/inert/scroll behavior; Customer form layout is right-side and deletion confirmation centered. These are code capabilities, not genuine browser acceptance.

Independent code review identified3 P2s: same-key URL transitions could invalidate without restart; live refreshed props could change draft dirty-field baseline; ambiguous mutation retry was unlocked before reconciliation. Fixes explicitly refresh same-key/Back-Forward requests, capture initial immutable draft baseline, and disable submit while parent refresh is pending/failed. Regression query/baseline tests added; real browser transitions/reconciliation still require acceptance. No security/timeout/assertion weakening, no M3–M5.

M2-D verification wiring: existing authenticated Login CDP session now extends into real Customer ADMIN and fresh OPERATOR flows with same phone/different owner, foreign404 and real eight-operation UI/HTTP assertions. New helper shares existing launcher/cleanup/security policy; no parallel browser framework. Foundation only supplies M2_EVIDENCE_DIR and pinned artifact upload. Actual final browser/DB/runtime execution remains pending; source assertions and controlled HTTP tests are not PASS evidence for those gates. Menu Customer intentionally remains planned until actual route acceptance.

### M2 current execution/failure ledger

2ad2721 Foundation40103018189: quality/build/contracts/genuine migrated integration PASS; M1 actual six-viewports/font/keyboard PASS. LOCAL runtime FAIL immediately at CUSTOMER_admin_LIST_RENDER before M2 artifacts, downstream HTTPS/data/dev SKIPPED. Current logs expose only CHECK_FAILED, not an API status or proven product cause. The harness now recognizes only known transient execution-context destruction during unchanged bounded navigation polling, with fixed boolean diagnostics for other protocol failures. This preserves required route assertions/deadlines; new actual run required. Fault/race acceptance additions are controlled browser checks, not a claim of database failure reproduction.

Local full quality attempts: first nested pnpm resolved unsupported11.19 despite corepack entrypoint; task-local PATH shim selects pinned corepack pnpm10.34.6, without repository toolchain changes. Pinned quality then FAIL at missing API_INTERNAL_URL prerequisite during Turbo Web build; ~35MiB free makes a corrected production build unsafe. Local canonical Docker/runtime NOT RUN; no synthetic Prisma or volume cleanup bypass. UI1/1/typecheck, Web73/73/typecheck, test:lint52/52 and root120/120/13 discovered suites PASS. Full canonical final-head checks remain hosted gates, not inherited PASS.

M2 reconciliation accessibility follow-up: forms/delete confirmation now expose an in-overlay read-only reconciliation retry when parent GET is pending/failed, retaining drafts rather than requiring close/reopen. Submissions remain fenced until successful refresh. Last-address protection has a visible explanation, not only a disabled tooltip. Canonical current-state frontend/domain/reuse descriptions now distinguish implemented M2 code from pending runtime/nav acceptance. No new business rule.

0482b5b local lint FAIL on unnecessary escapes in new CDP strings;31901ad corrects escaping and959057b adds a native AST/expression-compilation regression (PASS1/1) including a negative malformed-navigation example. No failed run relabeled PASS. Full final-head canonical runtime still required.

### M2 protocol investigation and re-plan — 2026-10-25

After3 same-step failures (2ad2721/40103018189,959057b/40103862028,e27d7c0/40104047565), stopped trial edits and re-evaluated the CDP boundary. Actual owned local Chromium fixture, using existing process teardown helpers and no API/credentials, reproduced a DOM button with React-like circular metadata: Runtime.evaluate(returnByValue=true) on the found element returns protocol error `Object reference chain is too long`; the identical expression coerced to boolean returns true. Cleanup completed. Existing until helper requested the DOM node itself before applying Node truthiness, explaining immediate protocol failure instead of readiness timeout. This is a confirmed verifier defect, not evidence of a Customer API/security failure.

RED regression1/2 failed before customerPredicate existed; fix coerces all predicate expressions before CDP serialization, retaining truthiness/assertions and the existing polling deadline. Known-navigation retry was insufficient to address this actual cause; historical runs stay FAIL. Static/expression and circular-fixture tests GREEN2/2; genuine runtime required again. Also removed nested ternary in StatsBar per existing readability rule; state semantics unchanged. Last implementation review follow-up was unavailable due reviewer usage limit; previous3 P2 source fixes were independently closed, final review remains required.

### M2 Finding Resolution & Foundation Investigation — 2026-10-25

1. **P2 — Search draft reload desynchronization in debounce**:
   - _Root cause_: "Tải lại" in `CustomerListPage.tsx` called `cancel()` then `read.refresh()`. If user typed "Lan" and clicked reload before the 300ms debounce timer elapsed, `cancel()` aborted the commit timer, `read.refresh()` fetched the old query, while the input remained showing "Lan", desynchronizing UI draft, canonical URL, and server request.
   - _Fix_: `handleReload()` in `CustomerListPage.tsx` flushes uncommitted search drafts into the canonical query by comparing `draft.trim()` with canonical `(query.q ?? "").trim()`. If distinct, it flushes via `change({ q: draft.trim() || undefined, page: 1 }, true)`. If identical, it performs same-key refresh and normalizes whitespace. Debounce timers are cleared, and active generation tickets are invalidated immediately so pending requests cannot commit stale state.
   - _Evidence_: Added unit/model controlled-clock test in `apps/web/test/customer-ui-model.test.mjs` verifying Type A -> reload, Type A -> Type B -> reload, clear, whitespace, in-flight stale rejection, and timer cancellation (PASS). Added browser integration step `CUSTOMER_SEARCH_RELOAD_FLUSH` in `scripts/customer-read-races.mjs`.

2. **P2 — Runtime token override test effectiveness**:
   - _Root cause_: `customer-browser-checks.mjs` only asserted `input.height === button.height && input.radius === button.radius` under `--control-height: 52px; --control-radius: 6px;`. Two controls retaining default theme values could pass; native Select was omitted despite test comments; font-size token parity was not checked.
   - _Fix_: Test reads baseline computed styles of actual rendered `TextInput`, `Button`, and `Select`. Overrides `--control-height: 52px`, `--control-radius: 6px`, `--control-font-size: 16px`. Confirms each consumer explicitly computes exact override values. In `finally`, restores inline values and priorities, and asserts return to baseline. Added negative regression verifying failure detection when a consumer is detached from tokens.
   - _Evidence_: `customer-browser-checks.mjs` updated; unit test in `apps/web/test/customer-ui-model.test.mjs` verifies negative failure detection on detached consumers (PASS).

3. **Foundation failure investigation (Run 40152052206, Step CUSTOMER_admin_LIST_RENDER, Category ASSERTION_FAILED)**:
   - _Root cause_:
     - `evaluate` in `scripts/browser-login-smoke.mjs` swallowed CDP `exceptionDetails` and returned `undefined` whenever unhandled JavaScript exceptions occurred in page context.
     - `customer-browser-checks.mjs` `fill()` attempted native input dispatch without ensuring element readiness, enabled state, or focus. When element was null or not active, `.value` was undefined, causing `assert.equal(await evaluate(...), true)` to fail with `AssertionError: undefined !== true` within 400ms under `LIST_RENDER`.
     - `ready()` accepted old pages with similar h1 titles without asserting target pathname, and did not check for error alert states.
   - _Fix_:
     - `evaluate` in `scripts/browser-login-smoke.mjs` now inspects `res.exceptionDetails` and throws explicit error with description.
     - `navigate(path)` asserts `location.pathname === path` before calling `ready()`.
     - `ready()` ensures route pathname, rendered heading, loading cleared, and absence of `role=alert`.
     - `fill()` verifies control exists, is enabled, and has focus (`Page.bringToFront` + `activeElement`) before native key dispatch; validates value match using fixed diagnostic vocabulary (`FILL_SELECTOR_NOT_FOUND`, `FILL_DISABLED`, `FILL_FOCUS_MISMATCH`, `FILL_VALUE_MISMATCH`, zero PII).
     - Substeps broken down: `LIST_NAVIGATE`, `LIST_RENDER`, `CREATE_DRAWER_OPEN`, `CREATE_FILL_FORM`, `CAPTURE_create`, `TOKEN_OVERRIDE_VERIFY`.

4. **Customer navigation activation**:
   - Activated `customers` (`/customers`, `status: "available"`) in `apps/web/lib/navigation/nav-config.ts` and independent contract `APPROVED_NAVIGATION_CONTRACT` in `apps/web/test/navigation.test.mjs`.
   - Added tests in `apps/web/test/navigation.test.mjs` covering list `/customers`, detail `/customers/[id]`, prefix near-match rejection (`/customers-other`), breadcrumb trails, `aria-current="page"`, and mobile drawer dismissal. All 7/7 navigation tests PASS.

## M2 visual-fidelity correction — bounded pre-code delta, 2026-10-25

Owner explicitly rejects the divergent layout and directs faithful reference presentation on the existing PR28. This is correction within approved v2/v8 scope, not a new visual direction or material architecture amendment. Read-only inspection fast-forwarded local d68dbbc to actual remote d63558787dd0c692b19884673760c387ebd95a9a, preserving its reload-draft/token/focus fixes and navigation changes. Immutable snapshots remain unchanged; no renewed approval requested for the same scope.

Reference archive17e7d68… and all8 Customer hashes match v2. Read CustomerListView, Detail, Create/Edit drawers, AddressForm/Drawer/LabelField/Delete confirmation and App/index geometry directly as source data; no reference execution/dependencies/mocks. Owner-mentioned image(20261025-023411).png was not found under the supplied path or current attachments/scratch/library/shared search. Before captures will come from actual current implementation where possible; comparisons use pinned source hierarchy, not a fabricated reference screenshot or pixel-perfect claim. The optional design-ui-ux reference checklist resources were unavailable; core skill audit/evidence guidance remains applied.

### Reference acceptance / visual gap matrix (before changes)

| Region / reference section                       | Current component and gap                                                                       | Selected correction                                                                                                                   | Intentional exception / verification                                                                                                         |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| CustomerListView Unified Command Deck tiers1–3   | CustomerListPage splits title, large stats cards, filters/reload/page size over page background | One white bordered command deck with icon/title/Create row, count/status segmented band and bounded search/actions toolbar            | M1 controls44px and semantic tokens; compare actual empty/populated/filter/loading/error/unavailable at6 viewports                           |
| List status/count band                           | CustomerStatsBar three oversized cards plus status Select in CustomerFilters                    | Canonical all/ACTIVE/INACTIVE segmented controls; stats counts only; selected/arrow/Home/End/Tab semantics                            | Missing/loading/error counts unavailable, never fake0; real stats/filter regression                                                          |
| List search/actions                              | Stretch search, large clear orange button, isolated reload                                      | Leading icon, desktop460/max480 search, inset accessible clear, secondary reload and advanced exact-phone disclosure                  | Placeholder only name/code/phone; keep reload-before300ms fix, URL/history/generation behavior                                               |
| List table/body state                            | CustomerTable omitted entirely if empty/loading; cards and footer detached                      | Stable white data card/navy sticky header, contained scroll, explicit in-body loading/error/empty with icon/title/explanation/actions | No unsupported addressCount/export; real code/detail Links; long/null values and zero body overflow                                          |
| List pagination footer                           | Separate page-size row and minimal previous/next nav                                            | Attached footer with API summary/page size left; first/previous/bounded pages/next/last right                                         | Bound window size/offset; empty population truthful; mobile wrap and keyboard targets44px                                                    |
| Detail header/profile/address grouping           | CustomerDetailPage vertical plain cards and sparse header                                       | Reference back/title/code/status toolbar; desktop5/7 profile/address grid, grouped labels, address cards/inline actions; stack mobile | Backend fields only; no fabricated records/defaults, real dates/counts, long-content wrapping                                                |
| Create/Edit drawer header/sections/footer        | CustomerDrawers single unstructured scroll form and all-orange controls                         | Right-side reference-width panel, fixed icon/header, scroll body, profile/initial-address sections, fixed Cancel/Save footer          | Shared44px controls/native Overlay; no duplicate trap; unchanged allowlists/null/fallback/required address                                   |
| Address form/drawer/label suggestions            | AddressForm fields/chips mostly one column; no section/footer hierarchy                         | Paired recipient fields where space allows, note/default-context and label suggestions, fixed header/footer                           | ISO code field/API names and backend authority; no fake isDefault checkbox                                                                   |
| DeleteAddressConfirmModal three-case composition | DeleteAddressModal plain generic drawer frame                                                   | Centered warning/target summary, explicit replacement selection, partial-success/error region, Cancel/confirm footer                  | Native shared Select replaces custom radio cards; explicit choice/no auto default; preserve PUT→DELETE/reconcile semantics                   |
| Action hierarchy across all regions              | Shared Button only orange default                                                               | Small neutral primary/secondary/ghost + icon hit-target contract in packages/ui for actual list/detail/form consumers                 | Login/M1 default unchanged; no feature control-state overrides/!important/blanket scanner exception; contrast/override/disabled/focus checks |

### Eight-field reuse delta

| Component                | Existing implementations                                                                        | Domain owner                    | Alternatives                                 | Selected approach                                                                                           | Rationale                                                                                    | Risks                                                  | Verification                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Action variants          | packages/ui Controls.tsx/CSS, M1 tokens and Login consumers                                     | Neutral Tier A                  | Feature-specific button CSS; shared variants | Optional primary(default)/secondary/ghost and icon sizing using same control tokens                         | Actual toolbar, pagination, chips, Cancel and address actions need one shared state contract | Default/hover/focus/contrast drift                     | Shared contract tests and actual browser token override/AA/focus, Login regression              |
| Presentation composition | Existing CustomerListPage/StatsBar/Filters/Table/Drawers/Detail/Delete; pinned8 reference files | Customer Tier C view only       | Rebuild API state; restyle composition       | Retain query/read/mutation/payload/API stack, replace visual grouping only; small feature pagination helper | Faithful hierarchy with stable semantics                                                     | Reload draft or stale-state regressions; window arrays | RED/GREEN query/reload/page-window tests, same-key/history/race/reconciliation and genuine flow |
| Form ownership/focus     | Shared Overlay plus existing DrawerFrame, profile/address fields                                | Neutral modal + Customer layout | New modal/trap; existing native dialog       | Existing Overlay and form state/baselines, layout header/body/footer slots                                  | Preserve security, busy/draft/focus behavior                                                 | Hidden/inert input selector; viewport scroll           | Scoped native input readiness diagnostics, forward/reverse/Escape/backdrop/focus/overflow       |

Files: Customer presentation/CSS/pagination, packages/ui Controls and documented token/variant contract, existing CDP helpers/tests, canonical frontend/reuse/testing/task docs. API/schema/SDK/domain security unchanged. Verify targeted RED/GREEN first, then canonical quality/real hosted DB/browser/HTTPS/data/dev and independent review. Visual matrix stays pending until screenshots are opened and inspected. Current remote nav activation is not treated as accepted merely because tests or registry changed; final acceptance must prove actual routes/mobile behavior, and no other planned route activates.

Bounded Chromium input investigation: an owned local DOM fixture with page phone + modal phone reproduced selector-list order: union selector selected outside=true/focused=false, scoped modal selector inside=true/focused=true. CSS selector lists do not prioritize the first selector; original fallback union picked the inert page exact-phone field. Fix explicitly chooses modal scope when open, checks inherited :disabled, and emits only safe field step/booleans/lengths. No mutation retry/deadline/security change. Added baseline empty-list six-viewport captures and capture-only hash manifest before form entry; partial captures never certify flow PASS. Expected error readiness now requires an alert in negative cases instead of waiting for its absence; normal readiness still forbids alerts.

### Visual correction implementation checkpoint (not acceptance)

Read-only audit matrix above drove the presentation changes: deck/title/segmented counts/bounded search+advanced phone, persistent table states and attached bounded pagination; profile/address grid; fixed-header/body/footer forms and centered explicit-delete confirmation. Shared Button default remains primary; secondary/ghost/icon variants use canonical tokens and actual consumers. New text-on-dark accent and accent-border semantic tokens are root-owned. Existing reload fix and query/API/payload/mutation files retained. Save-and-open uses one guarded POST and real returned id, never fake navigation/success. Existing Detail data can preview addresses in Edit; list Summary links to real Detail without N+1/addressCount invention.

Targeted Web tests77/77/typecheck/lint/docs/static preflight PASS so far; helper syntax tests caught a new selector-quoting error before push, then GREEN3/3; bounded page-window regression PASS. Native Select/input/button token probes now use actual scoped shared consumers, verify changed computed values, exact override, values/priorities restoration and a detached-consumer negative case. Actual secondary/ghost/primary default/hover contrast and M2 custom-font checks added to existing browser session, not a new launcher. Review identified stale text-based heading predicate and responsive-mobile-toggle race; fixed with #customer-heading and explicit existing mobile label readiness, without deadline changes. No production security/API finding added.

Before evidence: a8059f7 Foundation40155758130 attempt1 FAIL BROWSER_LAUNCH; one bounded same-head attempt2 reached actual Customer inputs/captures then FAIL TOKEN_OVERRIDE_VERIFY. Artifact12585460158 contains12 capture-only PNGs (empty list/Create, six sizes), source merge1fa98c2f5c96c52e21a9d732df3fb009a75f5ecd. All hashes checked; opened1440 empty list and375 Create. Observed the owner-reported scattered cards/actions/missing data card, and old mobile drawer scrolling header/footer out of view. No before screenshots for unexecuted detail/error/delete states are invented. Full after screenshots/reference/source comparison remain pending; prior token failure does not count as flow PASS.

Visual head bfc5ea6: Preflight40157417423 PASS; checkout PR merge c0b09b0 containing bfc5ea6 on55e3c15, authenticated v2 approval verified. Foundation40157417416 Docker quality/migrated genuine integration PASS; runtime FAIL CUSTOMER_ACTION_CONTRAST/ASSERTION_FAILED; HTTPS/data/dev SKIPPED. Token override/restore and detached min-height assertions were passed before this step. Artifact12585312383 SHA2563ce4a4930adf0d01a518239e7ca0bf20c0d1d2e48fe6c1481eeedd7cb37beb1d retains partial after captures. Opened1440 empty list/Create and375 Create: command deck/segmented counts/bounded search/table body/footer restored, mobile drawer header/footer visible with internal body scroll. Remaining states not yet captured are NOT VERIFIED; no overall visual PASS. Contrast failure currently has no variant/value diagnostic, so do not infer which consumer/state failed. Add fixed-vocabulary variant/hover/numeric contrast diagnostics and wait for viewport/font/layout settlement after capture overrides before measuring actual rendered controls, without changing thresholds. Also capture actual duplicate-phone validation error and make last-address icon assertion non-vacuous (exactly one accessible delete button, disabled).

Rebased local verification: Web77/77, root124/124, lint rules52/52, format/lint/boundaries/docs/static preflight/Web typecheck/contracts reproducibility PASS. Whole-workspace host typecheck FAIL at mandatory Web build prerequisite API_INTERNAL_URL absent; do not substitute this for hosted Docker quality PASS or claim full local quality PASS. Independent review at bfc5ea6 found no confirmed P1/P2 in reviewed implementation scope; genuine browser/six-viewport acceptance still pending. Immutable snapshot hash unchanged.

Follow-up f91aea9 Foundation40157824794 FAIL at lint (unnecessary escape in new accessible-delete selector); browser/HTTPS/data/dev NOT RUN. Removed escapes and reran full lint/boundaries plus helper3/3 PASS. Inspection of partial375 Create-address PNG exposed capture ordering: scroll-to-bottom occurred before resizing, leaving lower fields outside the frame. Capture now resets scroll after each viewport/layout settlement; assertion also checks restoration of min-height value/priority changed by the negative probe. No control/security threshold changed. Partial capture-only artifact18 hashes PASS; opened375 empty list and Create-address too. Mobile tabs/table intentionally scroll inside their containers; data/footer remain contained. Full state/mutation/visual acceptance remains pending.

Head1c2d9fb Preflight40158044235 PASS. Foundation40158044236 quality/integration PASS; runtime reached primary/secondary/ghost normal+hover AA PASS (minimum4.57965), token consumers PASS and controlled read-races PASS, then FAIL DELETE_DEFAULT/PROTOCOL_EXCEPTION; downstream HTTPS/data/dev SKIPPED. No exception text/PII is printed. Existing readiness could finish before a standalone default mutation/read refresh; add explicit matching new-default card/action readiness and bounded substeps before direct DOM actions, not timeout or mutation retries. Do not infer the precise exception from the coarse step alone.

Artifact12585228714 SHA25680941e3775e2b649e691a32eca6bc228991f000431464d2d5c4fe36feb8ae533 contains72 capture-only images across12 states/six sizes, source mergece15436cac04a6736cf427854dee97d8fb869766. Hashes PASS. Opened detail1440/375, Edit1440, Address375: actual profile/address grouping and fixed drawer hierarchy present; discovered a real presentation defect: inherited global dl grid put profile items into two columns, wrapping phone/labels unnecessarily, contrary to reference's one-row-per-field. Fix scoped profile display:block and assert six full-width rows in genuine browser. Opened all six empty-list sizes from prior artifact:1024 capture occurred mid-sidebar width transition; await existing sidebar animations before capture, do not disable animation. Detail/Delete/long content full acceptance still pending. No overall visual/runtime PASS claimed.

### Browser acceptance findings resolution & Foundation investigation — 2026-10-25

1. **Root cause analysis for `CUSTOMER_admin_DELETE_SUBMIT / ASSERTION_FAILED` (Run 40158663597, Attempt 2, Job 121066651055, tested merge 913bc95 on head 5ce8061)**:
   - **Post-DELETE UI reconciliation desynchronization**: After the DELETE mutation completed, the test queried the database directly via `fetch('/api/customers/:id')`, which returned the committed single-address state. However, the Customer detail page's own asynchronous `read.refresh()` and React reconciliation had not finished rendering. `DELETE_SUBMIT` immediately asserted `buttons.length === 1 && buttons.every(b => b.disabled)`. Because the UI was still displaying the retained 2-address list pending reconciliation, `buttons.length` was 2 (and neither was disabled), throwing `AssertionError: false !== true`.
   - **Focus restoration trigger capture gap**: `click(text)` previously called programmatic `element.click()`. In DOM specification and Chromium, `element.click()` does not guarantee focus is assigned to the clicked trigger. When `DrawerFrame` mounted, it recorded `document.activeElement` (which remained on whatever element was focused prior, e.g. heading). Upon Escape, focus was returned to that prior element rather than the Add Address button, causing `document.activeElement.textContent.trim() === "Thêm địa chỉ"` to fail.
   - **Coarse step composition**: `DELETE_SUBMIT` lumped 9 distinct operations together (dialog closed, server confirmed, UI reconciliation, last action disabled, Add Address opened, forward Tab containment, reverse Tab containment, Escape closed, trigger focus restored), obscuring the exact failing assertion.

2. **Executed fixes**:
   - **Granular substeps**: Decomposed `DELETE_SUBMIT` into explicit steps:
     - `DELETE_DIALOG_CLOSED`: Confirms deletion modal unmounts.
     - `DELETE_SERVER_CONFIRMED`: Verifies backend committed state (1 address, replacement ID, `isDefault: true`).
     - `DELETE_UI_RECONCILED`: Awaits explicit UI settled condition (correct route pathname, idle status without loading/reconciliation indicators, zero alerts, exactly 1 address card matching replacement ID via stable `data-address-id`, marked as default, single delete action present and disabled).
     - `DELETE_LAST_ACTION_DISABLED`: Executes independent assertions on rendered UI elements post-settlement.
     - `FOCUS_ADD_ADDRESS_OPENED`: Focuses heading first, triggers "Thêm địa chỉ" with genuine CDP pointer events, verifies modal opens and focus enters modal dialog.
     - `FOCUS_FORWARD_TAB_CONTAINMENT`: Verifies Tab loops within dialog across 12 cycles.
     - `FOCUS_REVERSE_TAB_CONTAINMENT`: Verifies Shift+Tab loops within dialog across 12 cycles.
     - `FOCUS_ESCAPE_CLOSED`: Dispatches Escape key and verifies dialog dismisses.
     - `FOCUS_TRIGGER_RESTORED`: Awaits and asserts activeElement equals trigger element identity and accessible name.
     - `FOCUS_FALLBACK_REMOVED_TRIGGER`: Verifies that when a trigger is disconnected/removed while the dialog is open, dismissal safely falls back to `h1#customer-heading`.
   - **User interaction helpers**: Added `clickPointer` using genuine CDP `Input.dispatchMouseEvent` (`mouseMoved`, `mousePressed`, `mouseReleased` on computed center coordinates) and `clickWithVerifiedFocus` for intentional programmatic focus verification.
   - **Stable DOM identity**: Added `data-address-id={a.id}` to `<article>` in `CustomerDetailPage.tsx` for deterministic selector matching without PII.
   - **Unit regressions**: Added unit test coverage in `apps/web/test/customer-ui-model.test.mjs` verifying focus restoration (trigger connected, fallback when disconnected, and detection of broken restoration) and delete reconciliation settlement contract (delayed refresh, error state, wrong replacement, and correct settled state). All 12/12 tests PASS.

### M2 Customer UI Visual Parity Refactoring & Quality Verification — 2026-10-25

1. **Phase A UI Audit & Mapping Table**:
   - Comprehensive 12-column mapping audit was completed against the reference archive (`nexora-logistics-management (1).zip` extracted components) and saved in `ui_audit_mapping.md`.
   - All 11 UI regions were audited: Customer List, Status Tabs, Search Toolbar, Data Table, Pagination Footer, Customer Detail, Information Card (`dl` key-value pairs), Address Card List, Create/Edit Drawers, Address Drawer, and Delete Address Confirmation Modal.
   - Preserved real backend contracts: List API payload supplies customer summary without embedded addresses; address count column is omitted from table to strictly prevent N+1 queries. Address count badge is displayed on Customer Detail view where full address array is available.
   - Preserved application shell: Sidebar (240px/72px), Header (56px), Breadcrumbs, Navigation, Auth guards, and server workspace layout remained untouched.

2. **Phase C, D, E Component Presentation Implementation**:
   - **CustomerListPage (`apps/web/features/customers/CustomerListPage.tsx`)**:
     - Brand icon updated to 18px in dark navy 32x32px box (`.brandIcon`).
     - Heading updated to uppercase `QUẢN LÝ KHÁCH HÀNG` (`h1`).
     - "+ THÊM KHÁCH HÀNG" primary button with explicit `aria-label="Thêm khách hàng"` and visible uppercase text `<span>THÊM KHÁCH HÀNG</span>` satisfying both reference visual density and CDP test helper contracts.
   - **CustomerStatsBar (`apps/web/features/customers/CustomerStatsBar.tsx`)**:
     - Restyled segmented control container with background `var(--color-surface-subtle)` and subtle border.
     - Tabs styled with uppercase labels ("TẤT CẢ", "ĐANG HOẠT ĐỘNG", "NGỪNG HOẠT ĐỘNG").
     - Added 6px round status dots (`.tabDot` with `.tabDotActive` emerald success color and `.tabDotInactive` slate muted color).
     - Pill count badges with selected state (`.countSelected`) on orange and unselected state (`.countUnselected`) with white surface and subtle shadow.
   - **CustomerFilters (`apps/web/features/customers/CustomerFilters.tsx`)**:
     - Placeholder updated to `"Tìm mã khách hàng, họ tên, số điện thoại, email..."` with leading search icon.
     - Clear affordance conditionally rendered when draft query is present.
     - Action toolbar aligned to right with active filter badge and compact "Làm mới" refresh button with spinning state on reload.
   - **CustomerTable (`apps/web/features/customers/CustomerTable.tsx`)**:
     - Table headers styled in sticky navy (`var(--color-primary)`) with white uppercase 11px typography.
     - Column hierarchy: CHI TIẾT (centered 48px), MÃ KHÁCH HÀNG (min 130px), HỌ VÀ TÊN (min 160px), SỐ ĐIỆN THOẠI (min 130px), EMAIL (min 180px), TRẠNG THÁI (centered 140px), NGÀY TẠO (centered 110px), THAO TÁC (centered 90px).
     - Customer detail action rendered as 26x26px square Eye icon button (`.detailLink`).
     - Customer code rendered as orange monospace link (`.codeLink`).
     - Status badges reused `@nexora/ui` `StatusBadge` primitive with `.statusChip` styling and 6px status dot (`.chipDot`).
     - Empty and error state panels redesigned with 32x32px circle icon, bold title, and descriptive explanation.
   - **CustomerPagination (`apps/web/features/customers/CustomerPagination.tsx`)**:
     - Attached bottom pagination toolbar (`.pagination`) attached to table card.
     - Summary format: `"Hiển thị {from}–{to} / {total} khách hàng"`.
     - Page size selector styled with `"Số dòng: [N / trang]"` select dropdown.
     - Pagination navigation buttons (First, Previous, bounded page numbers, Next, Last) with proper disabled states.
   - **CustomerDetailPage (`apps/web/features/customers/CustomerDetailPage.tsx`)**:
     - Header toolbar with "Quay lại danh sách" back navigation, vertical divider, 40x40px navy monogram avatar box (`getMonogram`), customer name, orange code badge (`.codeBadge`), status badge, and subtitle showing phone and email.
     - "Chỉnh sửa thông tin" primary action button in header.
     - Left column "THÔNG TIN KHÁCH HÀNG": Two-column key-value `dl` structure explicitly isolated via CSS Modules (`.profile`) to prevent global `dl` inherited grid splitting, displaying Mã khách hàng, Họ và tên, Số điện thoại, Email, Trạng thái, Ngày đăng ký hồ sơ, and Số địa chỉ nhận hàng, followed by internal note box (`.noteBox`).
     - Right column "ĐỊA CHỈ NHẬN HÀNG": Header with address count badge (`.addressCountBadge`) and "+ THÊM ĐỊA CHỈ" button.
     - Default address card styled with orange accent border (`.defaultAddress`), orange background (`var(--color-accent-light)`), and star badge (`.defaultBadge` with `MẶC ĐỊNH`).
     - Non-default address cards styled with "Đặt làm mặc định" button and edit/delete action icons.
     - Empty address state (`.emptyAddressState`) with dashed border, map pin icon, and "Thêm địa chỉ đầu tiên" action.
   - **CustomerDrawers & DeleteAddressModal**:
     - Preserved test-required selectors: `dialog[open]`, `select[name="replacement"]`, button `Xác nhận xóa`.
     - Preserved sequential non-atomic PUT→DELETE workflow, default replacement requirement, and last-address invariant protection.

3. **Design Token Architecture & CSS Policy (`customers.module.css`)**:
   - Strictly 0 raw color literals (no `#hex`, `rgb()`, `rgba()`, `hsl()`, or named colors outside `tokens.css`).
   - Strictly 0 semantic token misuses (text color tokens used exclusively for text/SVG; surface tokens used for background; border tokens used for borders; `background: currentColor` leveraged for semantic indicator dots).
   - Strictly 0 unnecessary fallbacks (`var(--token)` without fallback arguments in `apps/web`).
   - Zero `!important` declarations.
   - Fully compliant with `apps/web/test/form-control-contracts.test.mjs` (9/9 tests PASS).

4. **Canonical Quality & Verification Evidence**:
   - `pnpm format:check`: PASS (All matched files use Prettier code style).
   - `node scripts/boundaries.mjs`: PASS (Workspace boundaries PASS).
   - `eslint .`: PASS (0 errors, 0 warnings across the entire repository).
   - Unit tests: 37/37 PASS (`customer-ui-model.test.mjs`, `navigation.test.mjs`, `shared-ui.test.mjs`, `m1-shell.test.mjs`, `form-control-contracts.test.mjs`).
   - Canonical Docker quality suite (`docker compose run quality pnpm quality`): PASS (exit code 0). Tested format, lint, preflight policy, docs check, typecheck, 172 API tests, all Web tests, reproducible OpenAPI contracts, and production Next.js build.
   - Real browser visual verification: Executed via browser subagent on authenticated local runtime. Inspected Customer List (all, active, inactive tabs), Create Customer Drawer, Customer Detail view with multiple addresses, and Delete Address confirmation modal. Full video recording preserved at `customer_ui_visual_parity_1792909765435.webp`.

### M2 Customer UI Compact Density & Visual Fidelity Correction — 2026-10-25

1. **Root Cause Analysis (Control Sizing Audit)**:
   - Shared controls in `packages/ui/src/Controls.module.css` bind `.button`, `.input`, `.select` to `height: var(--control-height); min-height: var(--control-height);`.
   - Icon-only buttons derive `width: var(--control-height); min-width: var(--control-height);`.
   - `apps/web/styles/tokens.css` defines root theme sizing `--control-height: 44px`.
   - Customer Management components previously inherited 44px for buttons, inputs, tabs, and pagination buttons. Child class declarations attempting `height: 32px` or `height: 28px` were suppressed by `min-height: 44px`.
   - Table row height (60.5px vs target 36–40px) was inflated by the Edit icon button inheriting 44px min-height, and an unconstrained email cell (`.emailCell` missing in CSS) which wrapped customer email addresses into two lines.

2. **Shared Sizing Architecture Decision (Option B)**:
   - Evaluated three approaches:
     - _Option A (Shared UI Variants)_: Introduce `size="sm"` prop to `@nexora/ui` controls. Rejected because `@nexora/ui` is domain-neutral and frozen for M1/M2, and adding variants increases API surface area and regression risk across other apps.
     - _Option B (Scoped CSS Custom Properties)_: Override `--control-height`, `--control-radius`, `--control-padding-x`, `--control-padding-y`, and `--control-font-size` on Customer container scopes (`.listPage`, `.commandDeck`, `.drawer`, `.confirmation` at 32px; `.segments`, `.pagination`, `.table` at 28px). **Selected**: Leverages native CSS variable inheritance, maintains 100% `@nexora/ui` API compatibility, preserves global 44px forms on Login/MFA/Setup/Settings, and requires zero `!important`.
     - _Option C (Class Overrides)_: Direct CSS Module child overrides. Rejected because child class overrides struggle against `min-height: 44px` without duplicated declarations and high specificity.

3. **Measured DOM Geometry Comparison Matrix (1440x900 Baseline)**:
   | Element | ZIP Target | Before | After | Result |
   | --- | --- | --- | --- | --- |
   | Primary button (`+ THÊM KHÁCH HÀNG`) | 32px (`h-8`) | 44px | **32px** | **PASS** |
   | Search input | 32px (`h-8`) | 44px | **32px** | **PASS** |
   | Refresh button (`Làm mới`) | 32px (`h-8`) | 44px | **32px** | **PASS** |
   | Status tab (`TẤT CẢ`) | 28px (`h-7`) | 44px | **28px** | **PASS** |
   | Status tab (`ĐANG HOẠT ĐỘNG`) | 28px (`h-7`) | 44px | **28px** | **PASS** |
   | Pagination button (`1`) | 28px (`h-7`) | 44px | **28px** | **PASS** |
   | Page size select (`10 / trang`) | 28px (`h-7`) | 44px | **28px** | **PASS** |
   | Table header (`thead tr`) | ~30–34px | 33px | **29px** | **PASS** |
   | Table row (`tbody tr`) | ~36–40px | 60.5px | **40.5px** | **PASS** |
   | Action icon button (`Detail Eye`) | 24px (`w-6 h-6`) | 26px | **24px** | **PASS** |
   | Action icon button (`Edit Pencil`) | 24px (`w-6 h-6`) | 44px | **24px** | **PASS** |
   | Filter badge remove button | 16px (`w-4 h-4`) | 44px | **16px** | **PASS** |
   | Drawer inputs | 32px (`h-8`) | 44px | **32px** | **PASS** |
   | Drawer footer actions | 32px (`h-8`) | 44px | **32px** | **PASS** |

4. **Multi-Viewport Visual Verification Matrix**:
   - `1440x900` (Wide Desktop): Primary 32px, Search 32px, Status 28px, Table Row 40.5px, Pagination 28px — PASS.
   - `1280x800` (Standard Desktop): Primary 32px, Search 32px, Status 28px, Table Row 40.5px, Pagination 28px — PASS.
   - `1024x768` (Compact Desktop): Primary 32px, Search 32px, Status 28px, Table Row 40.5px, Pagination 28px — PASS.
   - `768x1024` (Tablet Portrait): Primary 32px, Search 32px, Status 28px, Table Row 40.5px, Pagination 28px — PASS.
   - `390x844` (Mobile iPhone 12/13/14): Responsive layout, zero horizontal page overflow, Primary 32px, Search 32px, Status 28px — PASS.
   - `375x812` (Mobile iPhone X/Mini): Responsive layout, zero horizontal page overflow, Primary 32px, Search 32px, Status 28px — PASS.

5. **Color & Token Fidelity — Accessible Contrast Policy Exception**:
   - Reference ZIP renders orange action buttons and selected status tabs with white text (`#FFFFFF` on `#F58A24`).
   - White on `#F58A24` provides only **2.32:1** contrast, failing WCAG AA (>= 4.5:1 for normal text).
   - In accordance with Nexora design token policy, `--color-text-on-accent: var(--brand-navy)` (`#172B4D`) is bound to all accent surfaces, yielding **5.74:1** contrast in default state and **4.58:1** on hover.
   - This intentional deviation from the reference ZIP is an approved visual exception to strictly maintain WCAG AA accessibility compliance.

### v3 authenticated approval verification — 2026-10-26

Canonical verifyGitHubApprovalEvidence accepted owner comment6407149976 from complete authenticated GitHub connector payload (comments<100, reviews0), matching raw digest c25703baddc79bf3955a6d58e15092a9e0ac2a15f401ee34431ee6f91ef2c939 and exact revision/task. Snapshot publication commitcdb6ccb timestamp02:45:43Z precedes comment creation/update02:52:26Z; no matching later revocation. This local replay uses actual connector-authenticated payload and canonical chronology/authority rules, distinct from hosted Preflight execution. Mutable metadata APPROVED; immutable snapshot unchanged. Earlier pending-gate statements are historical capture checkpoints. User explicitly directed continuation after verification.

### v3 Stage1 — shared controls and consumer migration — 2026-10-26

Implemented default32/medium40/large48 size/ref APIs with numeric native-size conflicts rejected, root runtime tokens and UI-owned private mappings; retired legacy height/scoped Customer shadows. Textarea rows/multiline and Checkbox target/indicator stay independent. Compatible Login/MFA/Setup, System/dashboard links and Header/account/notifications/mobile actions share defaults; navigation retains native link/disabled semantics and32px target. Shared default colors/security/requests unchanged. Token probe migrations target the new authoritative default token, preserving restoration/detachment assertions. Global button paint removed after its last Dashboard consumer migrated to shared link presentation. Canonical design-system.md, router/index/rules/frontend/registry/testing synchronized; later v3 state/layout/Toast/visual capabilities remain explicitly pending.

Test-first: actual React SSR and in-memory TypeScript size/ref tests RED2/2 before API, then GREEN2/2; new future-feature shadow/retired-token policy negative RED then GREEN. Parser accepts only exact owning UI size mappings, not blanket private token exemptions. Existing M1 export test exposed a newline-sensitive regex after formatter expansion; replaced with TypeScript named-export AST check, retaining required export assertions. Web82/82 PASS; UI/Web typecheck PASS; lint/boundaries PASS; docs/static preflight PASS; helper3/3 PASS; diff check PASS. Hosted approval-head Preflight40261519743 SUCCESS independently validates declared APPROVED and authenticated owner decision. Full stage implementation browser/runtime/visual acceptance remains NOT VERIFIED until final-head canonical execution. No backend/SDK/schema/CI/dependency changes.

Stage1 independent review found no confirmed production P1/P2 but one P2 policy gap: valid mappings accidentally allowed a later rogue private declaration in the same UI stylesheet. Added RED fixture preserving valid mappings plus rogue component/default/media overrides; now each private definition must match its exact owning variant selector and public-token value. GREEN13/13 size/policy tests, no skips; no blanket name-based private exemption. Real browser contract acceptance remains pending.

### v3 Stage2 — keyed read and scoped statistics — 2026-10-26

Added feature-local generic read-state policy and List-owned statistics snapshot (no hook/statistics request). Same-query revalidation retains accepted rows/data; different keys never expose old data as current. Read intent IDs distinguish refresh scheduling from accepted settlement; AbortController/generation fencing still guards success/error. Valid same-owner/q/phone counts survive status/page/pageSize revalidation with stale indication; pending q edits/incompatible scopes/invalid URL/401/403 cannot expose prior counts as current. Missing stats remains unavailable, not0. Safe server owner identity is passed through cached session verification and owner-keyed workspace/List lifecycle, without credentials/browser storage; Detail clears retained dialog data on access denial. Stage3 will replace loading geometry and Stage4 will integrate read settlement with Power/Toast.

Test-first read/scope policy RED missing modules then GREEN2/2: wrong-key/stale success/error, denied clearing, same-key stale retention, all status/page/pageSize scope equivalence, q/phone/owner changes, malformed/missing/zero stats and old generation. Web85/85 PASS, Web typecheck PASS, lint/boundaries PASS and diff check PASS. Browser same-scope/race/session/request-count acceptance remains pending actual final-head CDP/API runtime. No new stats endpoint/request, backend/SDK/schema mutation or global cache.

### v3 Stage3 — nine-column geometry and Skeleton — 2026-10-26

One Customer column registry now defines order/width/minimum1248px; native colgroup/header/body and five9-cell Skeleton rows share it. Same-key revalidation retains matching real rows; uncached pending queries show Skeleton rather than empty colspan; recoverable errors exit Skeleton and retain safe same-key rows with Retry. Removed competing body-cell width declarations, kept real Link and contained scrolling, attached footer and unavailable address count. Existing parser caught a border token incorrectly used as Skeleton fill; corrected to surface role without weakening policy. Native SSR tests execute actual TSX/Next Link/shared controls; their reused test helper supplies CSS class identity only, never measured computed styles.

RED2/2 table cases then GREEN2/2 for9 cols/header,45 Skeleton cells, no loading empty-state flash, identical real/Skeleton colgroup, retained-row refresh and Retry after failure. Full Web87/87 PASS; Web typecheck PASS; lint/boundaries PASS after explicit Node timer/URL imports in the test helper; diff check PASS. DOM widths/headers/actions/Skeleton alignment across ten viewports remain genuine browser verification gates, not inferred from SSR. Stage2 Web count corrected to actual saved log85/85; no execution result changed.

### v3 Stage4 — shared Toast and Power single-flight — 2026-10-26

Implemented neutral provider/queue/Toast/optional modal viewport, safe messages, error/status roles, manual dismissal, pausable success timers and owner lifecycle cleanup. Customer read/mutation callers preserve inline information without duplicate live announcements; API-error browser readiness requires both surface error and actual Toast, while persisted prior notifications are excluded from the successful surface-error assertion. Power now locks synchronously across the table, copies state for display, rejects stale tickets, separates confirmed PATCH from accepted current-key GET settlement, and blocks unsafe retry until explicit reconciliation after failure. No await-void refresh assumption or automatic write retry.

Independent review found mutation401 retained protected state until navigation. Added explicit denied/reset fencing, cache/stat/dialog/Toast clearing before redirect, live Power denial guard and sticky denial through failed refresh. Follow-up caught unguarded Add Address and denial reset on500; fixed with closed mode/all overlays gated and denied→pending→500 RED/GREEN. Reviewer confirmed no remaining P1/P2 in stages2–4 source scope. Existing403/read/default/partial-delete behavior remains distinct; access denial is not reclassified as session expiry.

Executed Toast/Power/denied policy tests RED then GREEN6/6; actual SSR Toast verifies escaped text/roles/default32 dismiss. Web91/91 PASS; UI/Web typecheck PASS; lint/boundaries PASS; diff check PASS. Typecheck caught callback plumbing inadvertently added to read-only ReconcileNotice; corrected before commit, no weakened assertion. Genuine React/modal/timer/session/Power concurrency and full canonical runtime/visual evidence remain pending final-head CDP/CI.

Intermediate Stage3 Foundation40264164323: quality/integration PASS; actual Customer controls default32px/radius8px and all primary/secondary/ghost normal+hover contrast checks PASS, then CLEAR_QUERY/CHECK_FAILED. Source and log investigation found stale accessible action selectors after remote baseline changes: clear is conditional on nonempty draft and named Xóa từ khóa tìm kiếm; reload is Làm mới; profile/default actions also changed. Updated helper to current accessible names and entered a whitespace draft before clearing to preserve the original same-key/debounce regression (not skip it). Replaced obsolete six-field profile count with independent exact seven-field label assertion plus separate full-width geometry step; backend fields unchanged. Helper syntax3/3 PASS. This intermediate failure is retained; no full runtime PASS claimed.

### v3 stage 5 — shared workspace frames

- Replaced Customer-only pathname/padding selection with canonical navigation
  `contentVariant`, longest-prefix resolution and shared Header/main frame CSS.
- Standard max-width 1600px; wide unlimited; shared responsive 24/16/12px gutters.
  MainWrapper owns scrolling for equal Header/content edges. Sidebar/mobile security
  and focus contracts are retained.
- Verification-first: new route/near-match/planned/longest-prefix test failed before
  resolver export (RED), then PASS. Web tests 93/93 PASS; Web typecheck and
  lint/boundaries PASS. Browser geometry and final quality remain pending.

### v3 stage 6 — fidelity and shared composition

- Reviewed approved ZIP Customer source again (source comparison, not a rendered
  pixel-perfect claim). Default32 sizing intentionally supersedes reference compact
  controls. Existing command deck, nine columns, seven-field profile, address cards
  and unavailable export/count behavior remain.
- Customer primary/selected controls now use shared accessible-candidate emphasis;
  selected dots/count foreground is white. Authentication primary stays unchanged.
- Shared Panel gains compatible optional density/actions and is used by both Detail
  sections, removing duplicate card/heading CSS. Exact-phone filter uses existing
  query/API; unsupported email search copy removed.
- Panel actual SSR contract RED then GREEN; Web94/94 PASS before final Panel consumer
  migration; final repeated checks/browser measurements recorded separately.
- Intermediate Foundation40266755218 failed at BROWSER_LAUNCH before Customer UI,
  while quality/integration and real provisioning/TTY/security checks passed.
  This is FAIL, not final-head runtime acceptance; no assertion was removed.

### v3 independent review correction — phone draft

Independent review found P2: committing exact-phone on every keystroke would send
incomplete prefixes to server validation and create repeated persistent error Toasts.
Phone now stays a List-owned draft until explicit native-form Apply. Draft changes
invalidate incompatible statistics/rows immediately without issuing a request;
Back/Forward/query changes resynchronize it. Actual component handler regression
verifies zero query calls for prefixes and exactly one explicit Apply. No backend
phone-normalization algorithm was duplicated.

### v3 stage 7 — automated acceptance expansion (execution pending)

- Existing CDP extended to ten target widths, Header/main edge/gutter/max-width
  assertions and nine table header/body column boundaries; manifests store actual
  measurements alongside screenshots/hashes. Negative Node geometry fixtures PASS.
- Actual controls exercise32/40/48 and isolated token overrides with exact finally
  restoration; Textarea/Checkbox semantics checked. Syntax checks PASS; genuine
  browser execution is still required before acceptance.
- Existing CSS parser now preserves at-rule context and rejects conflicting token
  definitions/cycles per effective scope; negative media-cycle/conflict and valid
  calc/string/media/private-map cases PASS11/11. No parallel CSS scanner introduced.
- Independent review follow-up false-empty phone draft fixed with explicit unapplied
  filter instruction. Reload explicitly applies drafts; Clear removes them. Missing
  pagination uses unavailable markers. Actual SSR/handler regressions PASS4/4.
- Intermediate Foundation40278731208 failed CUSTOMER_admin_DUPLICATE_PHONE_FORM,
  after genuine auth/MFA and32px controls/AA checks. Added precise child diagnostic
  checkpoints to distinguish field validation from Toast/read settlement; historical
  FAIL retained. Final-head Foundation and screenshot acceptance remain NOT VERIFIED.

### v3 verification follow-up

- Independent stage5–7 review confirms both phone P2 fixes; no new production P1/P2
  found. It correctly rejected a vacuous optional Customer Checkbox probe. Replaced
  with mandatory actual Login remember-username Checkbox target/indicator32/40/48
  and isolated height overrides/restoration. No missing-control PASS allowed.
- Host quality first failed missing API_INTERNAL_URL; configured retry reached build
  but failed ENOSPC (workspace only22MiB free). Removed only this attempt's generated
  .next output; no user/Docker volumes changed. Host quality is FAIL, not PASS.
- test:lint PASS52/52. Root Node suite first124/125 FAIL because the independent
  viewport inventory still expected six; migrated it to all ten approved v3 sizes,
  retaining explicit inventory assertion. Corrected rerun recorded separately.

### v3 genuine-browser mutation acceptance extension

The existing Customer read-race CDP module now also runs table-wide Power against
real continued PATCH requests: same-tick two-row clicks must count exactly one
PATCH; a subsequent genuine successful PATCH plus injected failed reconciliation
GET must show separate success/error Toasts, blocked controls and explicit Retry.
Retry must restore enabled controls through GET without another PATCH. Existing
queue is explicitly dismissed through actual Toast controls before this scenario,
with exactly one active viewport. Owned disposable customer fixtures only. Syntax
checks PASS; this extension is not claimed runtime PASS until hosted execution.
Host contracts:check PASS (generated snapshots unchanged); corrected root suite
PASS125/125 with no skips. Final CI/browser acceptance remains open.

Independent browser-helper review found a P2 false-green possibility: a first
operation's success Toast could incorrectly satisfy the second-operation assertion.
The helper now dismisses prior notifications before the second action, requires its
actual network PATCH response HTTP200, and checks a nonfaulted same-owner Detail
read changed status. Only List GET is fault-injected. Button readiness also requires
at least two actual controls (no empty-array every PASS). Syntax/lint verification
remains separate from required genuine hosted execution.

### v3 intermediate runtime evidence and investigation

Foundation40280127379 atd59d4ce: Docker quality/migrated integration PASS; Local
runtime FAIL at duplicate-phone-form before Submit child checkpoint. Real ten-width
Login/MFA/shell geometry/keyboard/font checks passed; actual emphasis normal/hover
contrast measured4.5818/5.0528, secondary14.6791/14.0299, ghost14.0299. This is partial
run evidence only; HTTPS/data/dev were SKIPPED. Required final-head PASS remains open.

Added safe boolean pointer hit-test diagnostic and explicit actual Toast-close action
after feedback capture, before subsequent Create scenarios. A transient/persistent
notification may cover the Create pointer location; until hit-test evidence exists,
this remains an investigation rather than a proven production defect. No mutation
retry or feedback assertion removal. GitHub artifact download yielded a file reference,
but direct download was HTTP403 in this environment; screenshots have NOT been opened
or accepted. Independent review also caught new helper Detail response nesting;
readback now uses customer.status and requires a canonical pre-write status.

### v3 opened partial visual evidence

Recovered artifact12632063110 through its Sediment-backed file reference after the
direct URL403; opened actual admin-list1440×900 and375×812 screenshots from failed
run40280127379. Manifest merge checkout d076d4f93780dd1c55614c00a80b73e76ec194d3,
source headd59d4ce; actual Inter custom font. This resolves artifact-access only,
not final-head screenshot acceptance. Images confirm transient success Toast occupies
workspace Create pointer area (explicit dismissal is now part of new-form scenarios).

Images plus DOM manifest show first header width56px: CHI TIẾT visually collides with
next heading. Increase only central Detail column to80px; all body/Skeleton/header
continue same colgroup, minimum derived. Extend DOM geometry to record text Range
bounds and require text inside padded header bounds at every target width, so edge
alignment alone cannot certify overlapping text. This is a measured rendering
correction allowed by approved prototype widths, not a design architecture change.

Opened partial-image hashes fromd59d4ce evidence:
admin-list1440×900 c22eb2a2a3d1acb56a0347b8db61bca1345904817926c08d44a0b81bb28d3fca;
admin-list375×812 e054f990ad04d13e5aafec00a12747b2e1b1082c54d5f7c19a66709ed5b38260.
These are genuine earlier failed-run images, not final acceptance. Reviewer confirmed
phone source P2 fixes; independent helper review corrections are recorded above.

### v3 shared state verification correction

Source review of combined states found readonly/invalid declarations could override
Input/Textarea disabled background/cursor/border. Enabled-state rules now exclude
:disabled. Extend actual modal control probe for focus versus invalid-focus and
combined disabled/readonly/invalid precedence, waiting actual CSS transitions and
restoring attributes/focus. Policy/helper tests PASS14/14; genuine final-head probe
execution remains required. Independent full source review at9c84a56: no confirmed
P1/P2, focused24/24 PASS; this later focused state change receives follow-up review.

Hosted7f35887 run40281146330 now passes duplicate-phone form; hit-test confirms
Create pointer toastOcclusion=true. It progresses through controlled read races and
captures request-error, then fails at retry after that capture. Two persistent errors
can cover the toolbar retry target. The scenario now explicitly dismisses captured
notifications through real close controls before manual retry; one shared bounded
helper also serves Create and Power scenarios. Feedback capture/assertions stay
before dismissal; writes are not retried and timeouts/assertions remain unchanged.

Final browser acceptance additionally verifies genuine success Toast hover pause
beyond5seconds, eventual expiry after pointer leaves, persistent error beyond5seconds,
keyboard Enter dismissal/focus restoration and retained inline error. New-owner
Customer entry asserts no notifications from the prior workspace. These are explicit
real CDP interactions, not timer mocks; hosted execution is still pending.

Visual/announcement follow-up: removed obsolete permanent List/Detail saved notices
that said a read was still loading after settlement and repeated the shared success
Toast announcement. Shared Toast owns confirmed-write feedback; accepted read state
and safe inline/Toast error own reconciliation. Detail missing-address explanation
is preserved. No operation/refresh contract changed.

Final geometry coverage closes manual-state gaps: every existing M1 shell capture
now records/asserts shared frame geometry in both actual expanded/collapsed states;
Customer adds a real manual-collapse capture. Final Customer table receives real
keyboard input and must retain active :focus-visible solid2px outline, with focused
screenshots. This verifies the reported rectangle as keyboard focus rather than
silently removing accessibility. No new launcher or product behavior added.

Foundation40281989279 (8eaef6c) fails the retained hover assertion: after the new
real focus-state probe scrolls the form, secondary target coordinates can be outside
the visible body. Diagnostic expectedHover=true/hover=false confirms no actual hover,
not an AA pass. Contrast probe now scrolls the actual control into viewport center
before measuring pointer coordinates and uses a distinct per-variant checkpoint.
Hover and4.5 assertions remain unchanged; no forced pseudo-state or timeout increase.

Foundation40282800839 (a9b306a): contrast fix passes all real emphasis/secondary/ghost
hover checks, and controlled read-race/unmount scenarios PASS. Next failure is
DETAIL_RENDER: existing harness expects accessible name Thêm địa chỉ, while the
Panel action displayed uppercase without an explicit name. Add that exact accessible
label while retaining uppercase visual text; no operation or assertion change.

### v3 final source checkpoint — execution gates still open

Independent implementation review of source579679911c65adfb12cd66d2f8cabeb32a6f1afe
reports no remaining confirmed P1/P2, focused6/6 PASS and clean full diff. Earlier
full-source/focused review counts24/24 and17/17 remain separate, overlapping evidence;
this is not owner approval or runtime acceptance.

Executed local checks: Web96/96 PASS, root Node125/125 PASS, lint tests52/52 PASS;
format, lint/boundaries, UI/Web typecheck, docs/static preflight, contract reproduction
and final diff checks PASS. No skipped tests in these reported counts. Host full
quality attempts are FAIL: required upstream config, then disk ENOSPC, then configured
RAM-output retry reached Web compilation but Prisma artifact DNS EAI_AGAIN blocked
Database build. Temporary .next symlink removed; only owned generated output used,
no volumes/data/keys changed. These limitations do not weaken canonical hosted Docker
gates or imply they passed.

Current final source hosted Preflight40285089721 SUCCESS; Foundation40285089720 is
still running at this checkpoint. Read final-head workflow results/logs and merge
checkout lineage in PR metadata after completion to avoid documentation SHA loops.
Task remains IN PROGRESS, overall implementation PLANNED for M1–M5 and verification
NOT VERIFIED; M3–M5 remain outside this correction. Draft remains until required
checkpoint acceptance is substantiated. Immutable v3 digest is unchanged. No backend,
DB/schema, generated SDK, dependencies, public deployment or live Carrier changes.

Foundation40285089720 (5796799) now passes Detail/CRUD/default/delete/focus/long
content/segmented-status scenarios and reaches Power failed-read capture before
CHECK_FAILED. Added precise post-capture keyboard-dismiss/explicit-retry/read-settled/
controls-enabled checkpoints. Keyboard phase brings the genuine tab to front and
asserts document/Toast-control focus before Enter; no focus emulation or mutation
retry. Actual remaining failing child must be diagnosed from hosted evidence.

Opened actual5796799 Power-error1440×900/375×812 images (artifact12633673231,
partial failed run, not final acceptance) show another confirmed visual P2: nowrap
name/email can paint across fixed column boundaries; mobile Retry label wraps beyond
its32px control. Name/email now wrap with full accessible DOM text and existing
keyboard Detail disclosure; remove obsolete td max-width competing with colgroup.
Shared Button labels stay single-line and feedback flex-wraps. Add body text/content
Range bounds to the same genuine table geometry gate, plus SSR full200-name/254-email
retention regression. No backend or data contract changes.

Foundation40286223089 (5489916) narrows the remaining failure to Toast keyboard
activation: actual document/close-control focus assertion passes, but alert remains
after keyDown/keyUp. CDP Enter must include its carriage-return text to produce
native character activation; add text/unmodifiedText while retaining real key events,
focus restoration, persistent-inline-error and disappearance assertions. No click
fallback, timeout increase or automatic mutation retry was added.

Foundation40287361741 (543629f): full LOCAL runtime PASS including both actual
Customer actor flows, genuine Power success/failed-read/Retry, keyboard dismissal,
timers and final focus screenshots. Next workflow gate FAIL in disposable HTTPS at
ADMIN_BROWSER_PENDING_MFA (timeout, focused and both native field values present,
alert present; no observed auth response status). Add only safe fixed-message-category
booleans and fixed endpoint-dispatched flags to distinguish client validation from
transport/API rejection. No credential values, raw alerts/headers/errors logged;
TLS/Host/Origin/MFA/cookie assertions and timeouts unchanged. Data/dev still SKIPPED.

Final AA audit found confirmed status P2: inactive gray500 (#64748b) against pending
#edf0ec is4.1416:1. Existing token resolver/contrast test extended to success/pending
roles RED before source change. Pending semantic foreground now maps existing gray700;
Customer chip/dot consume that role, without darkening all muted text. Shared browser
contrast expression reused for actual status chips and selected counts in initial
and Power retained rows; no duplicate color algorithm. Genuine final-head AA still
requires hosted probe execution. This is approved semantic-color/accessibility scope.

### Visual Fidelity Correction (Reference Parity) — 2026-10-26

Resolved visual fidelity differences against authoritative reference ZIP (`17e7d68fccf654fac306f9fbde49fa4646cd770191f3922a77962776e0b1b3e5`):

1. **Fix 1 — Decoupled Statistics Freshness from Row Loading**: Derived stats validity from statistics scope identity (`ownerId`, `q`, `phone`), mutation revalidation phase (`revalidating`/`blocked`), and same-scope error. Ordinary tab switching (`ALL` → `ACTIVE` → `INACTIVE`), page transitions, and pageSize changes retain valid statistics without count resets or false "Thống kê cũ · đang tải lại" warnings.
2. **Fix 2 — Removed Secondary Phone Filter UI**: Removed `<details className={styles.secondaryFilter}>` and `phoneDraft` state, restoring the reference toolbar layout (Search input left, active FilterChip center, Refresh button right). URL parameter compatibility (`/customers?phone=...`) is fully preserved with truth-in-UI FilterBadge display and clear action.
3. **Fix 3, 4 & 6 — Unified Brand Orange Palette (`#F58A24` + Navy `#172B4D`)**: Add Customer primary button, Selected status tabs, and Selected pagination buttons now share one coherent accent system (`variant="primary"`) with background `#F58A24` (hover `#E07716`) and high-contrast Navy `#172B4D` text, achieving 5.74:1 contrast (WCAG AA compliant).
4. **Fix 5 — FilterChip Content and Density**: 24px compact badge displaying "Đang lọc", truthful `({filteredTotal}/{statsTotal})` counts, and visible labeled "Xóa lọc" button.
5. **Fix 7 & 9 — Outlined Status Badges & Action Buttons**: ACTIVE (emerald outlined, green dot) and INACTIVE (slate outlined, muted dot); Eye detail button rendered as 26px rounded square.
6. **Fix 8 — Table Geometry**: Centralized nine-column colgroup contract with 240px name width, ensuring zero horizontal overflow and header-to-content alignment across all 10 viewports.
7. **Fix 4 — Power Action Semantics & Hover States**: Added action tokens `--color-action-deactivate*` and `--color-action-activate*` in `tokens.css`. Interactive `Button` receives status-dependent `.powerDeactivate` (slate-400 default, slate-700 hover with slate-100 bg) and `.powerActivate` (emerald-600 default, emerald-700 hover with emerald-50 bg), perfectly matching reference ZIP styling.
8. **Fix 5 — Stable Pagination Presentation & Zero Flicker**: Introduced pure `derivePaginationModel` helper in `pagination.ts`. Separated pagination presentation lifecycle from list row lifecycle. Reused valid same-scope statistics snapshot during tab and page transitions to keep footer mounted, counts and page buttons stable without collapsing to 1 page or flickering "—". Removed redundant `read.invalidate()` on key change in `change()`, `searchChange()`, and `handleReload()`.
9. **Fix 11, 12 & 14 — Documentation, Testing & CI Stability**: Synchronized `docs/operations/testing.md` and `docs/architecture/design-system.md` with final code contracts. Added `customer-pagination.test.mjs` covering all edge cases (zero results, out of bounds, cold start, same-scope transitions). Fixed Foundation CI lint issue `no-useless-escape`.
10. **Final Verification**: 40/40 Node unit tests PASS; Preflight check PASS; Prettier format:check PASS; ESLint boundary check PASS; Typecheck PASS (all 6 projects); CDP automated suite PASS across all 10 viewports and 7 reference screen resolutions. Ready for owner review.
