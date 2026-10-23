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
- [ ] Targeted native/auth + genuine CDP keyboard/six-viewports; sync canonical frontend/Testing and milestone evidence, review diff, commit/push/report.

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
| Root discovered Node tests                                 | PASS119/119,0 skipped                | 12 discovered suites; includes discovery, docs, governance and M1 privacy guards                                                                            |
| Focused helper/docs/governance                             | PASS38/38                            | Actual execution, controlled helper checks separated from real CDP                                                                                          |
| format:check, lint/boundaries, docs:check, local preflight | PASS exit0                           | Pinned Node24.19.0 and corepack pnpm10.34.6; static preflight does not authenticate approval                                                                |
| Local production quality                                   | FAIL / BLOCKED at Prisma download    | binaries.prisma.sh EAI_AGAIN; earlier format/lint/preflight/docs stages passed. No synthetic engine or weakened check                                       |
| Local quality-docker/runtime                               | NOT RUN                              | Existing Docker VFS layers and ~132MiB free make a genuine disposable build unsafe; unrelated volumes/caches preserved. Hosted canonical execution required |
| Independent implementation re-review421d011                | PASS, no remaining P1/P2/P3 findings | Prior P2 lifecycle coverage fixed; focused8/8 and complete diff check PASS; source review is not runtime PASS                                               |

Implementation commits: ea7f8d6 authorization, e8458d9 M1.1, c31b85d M1.2,7d84b6d M1.3, bd69661 M1.4 harness,421d011 lifecycle/font-proof correction. Selected reuse remains the PR22 unmodified licensed font and PR21 pure deployment text helper, existing server authorization/SDK/navigation/notification/account modules and neutral UI package; no whole PR import. Actual font source bytes and immutable design digest remain unchanged.

No new unresolved architecture issue or production auth finding. Stop at M1; Draft retained while final runtime/visual verification is pending and later milestones await owner continuation. No merge, live Carrier calls, public deployment, key/MFA reset or user-volume deletion.

### M1 real lifecycle regression found during verification

Foundation39929948220/421d011: six-viewport Login and MFA font/geometry proof PASS; later ADMIN_MFA_SUCCESS FAIL (no HTTP status observed). The newly exercised help-open→MFA→cancel sequence exposed retained helpOpen state: unmount restored scroll correctly, but returning to the password branch rendered the old help modal open again, intercepting subsequent browser input. Reset help presentation state when the real login outcome enters MFA, with an explicit real CDP regression assertion after cancellation. This changes only presentation lifecycle, not MFA outcome/cookie/challenge/auth behavior. Both historical failures remain FAIL; new hosted results required.
