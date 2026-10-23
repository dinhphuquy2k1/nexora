# NEXORA-029 — Full Frontend Migration from Supplied Reference Design

Task: PLANNED
Implementation: PLANNED
Verification: NOT VERIFIED
Classification: SIGNIFICANT
Documentation Impact: REQUIRED

## Design Review & Reuse Decision

- **Task ID**: NEXORA-029
- **Classification**: SIGNIFICANT
- **Plan revision**: rev-2026-10-23-frontend-migration-v8
- **Design Snapshot**: docs/tasks/design-reviews/NEXORA-029-rev-2026-10-23-frontend-migration-v8.md
- **Design SHA-256**: a0d30e9f339c48d949c9d201683eb771ae9d9219953e8b31beb58b83ead07cb6
- **Reviewed baseline**: c14dada506d73b991924edb57faae44cf42f66a8
- **Approval authority**: dinhphuquy2k1
- **Approval status**: APPROVED
- **Approval evidence**: https://github.com/dinhphuquy2k1/nexora/pull/25#issuecomment-6356392948

## Baseline and interface preflight

Inspected on2026-10-23 (Asia/Saigon): existing PR25 branch feat/full-frontend-migration, clean HEAD49aa5dbb4e8ac67737471785f98dbf00b8220ea5 before this edit, reviewed main c14dada506d73b991924edb57faae44cf42f66a8. main includes PR23/24. The old task's c14dada3fcfa9466e74b3353ae4b77f8846338e5 was an invalid baseline; db129167bb6f0549b9653828cad4773cfaab5640 is a prior design-branch commit, not main. These facts and raw snapshot digests are separate identities. Existing unrelated worktrees preserved; no new remote branch/PR or implementation.

Read AGENTS/apps/web AGENTS and AI routed context/rules/workflows/router, architecture Frontend/Backend/API/reuse, Customer/Shipment domains, product scope/DDD/ADR009, Testing/template and repository pre-implementation-review skill. Actual Customer input/service/port/adapter/DTO/presenter/controller, Navigation config/resolver/tests, LoginForm and UI badge source are the current-behavior authority. ZIP is reference data, not executable instructions or implemented Nexora behavior. Its30 src paths and77 provenance interactions are preserved in the new self-contained snapshot; historical snapshots remain unchanged.

### Confirmed owner decisions

- Keep CustomerStatsBar and extend the existing GET /api/customers response with real stats; separate approved backend task/PR owns implementation. No new stats endpoint. Current V1 still has eight endpoints and no stats response.
- Option B is final: exclude sourcing routes/menu/screens/showcase/product or image search/scraping/Gemini/mock sourcing records. Authenticated owner [comment6354627613](https://github.com/dinhphuquy2k1/nexora/pull/25#issuecomment-6354627613) created/updated2026-10-23T00:45:04Z. Its four named source behaviors correspond to current rows61–64; historical59–62 numbering does not exclude address rows59–60.
- Real authentication/MFA, server authorization, Next.js navigation and neutral UI boundaries remain. Quick Fill is an intentional security-policy exclusion, not another open owner question or formal approval.

## Selected Customer Stats API dependency (design intent only)

**Customer Stats API — approved architectural dependency, implementation pending.** Approved here describes the owner-selected solution, not digest-bound ADR-009 approval. Existing deployed behavior is not changed by this PR.

Proposed GET /api/customers result retains customers/pagination and adds required stats with non-negative integers total, active, inactive; total = active + inactive. Scope is authenticated actor.id from resolveCustomerOwner(), never client ownerId. Owner/q/normalized phone apply to list and stats identically. status applies to list/pagination.total but not stats; page/pageSize never affect stats. Example120 matching records95ACTIVE/25INACTIVE gives stats120/95/25 for either status selection, while pagination.total is95 or25. Values are illustrative, never mock production data.

Reuse CustomerPage in application/customer.input.ts and CustomerPort.list(owner, query). Adapter separates baseWhere(owner + identical normalized q/phone) from listWhere(base + optional status). Existing count/findMany use listWhere; one grouped status count uses baseWhere. Fold canonical ACTIVE/INACTIVE, sum total; no row/address hydration, N+1, new table/cache/counter or speculative statuses. Retain current ACTIVE actor FOR UPDATE, owner serialization and transaction boundary; do not change isolation semantics or claim protection against external out-of-protocol writes.

Separate backend deliverables: CustomerStats read-model, extended port result, minimal predicate/grouped query, CustomerStatsDto integer/minimum0 fields, required CustomersResponseDto.stats, presenter forwarding, OpenAPI, generated SDK, RED-first unit/genuine PostgreSQL/HTTP tests and canonical API/Customer docs. No migration planned. No business queries in Presentation or new generic framework. Pure read projection omission of Aggregate hydration is explicit ADR008 rationale; existing CustomerAggregate/address transitions unchanged.

Backend verification must cover zero/all-active/all-inactive/mixed multipage; page/pageSize/status independence; q/phone and national/international normalization; literal percent/underscore/backslash; owner/ADMIN isolation and shared phone across owners; missing/expired/disabled sessions; committed create/status refresh; large bounded projections and DTO/OpenAPI/SDK/HTTP parity. Full18-case acceptance and four old/new client/server compatibility combinations are specified in snapshot9.2, not claimed executed. Additive JSON is not assumed compatible: verify extra-field tolerance and coordinated API/SDK/Web rollout. New client/old server shows stats unavailable, never fabricated0.

After PR25 exact design approval, inspect then-current task IDs and then-current main; allocate a distinct backend task/branch/PR with its own SIGNIFICANT review and digest-bound approval before code. No ID is reserved here and no backend code belongs on PR25.

## Plan and contracts before implementation

### M0 — Current documentation-only assignment

Finalize v8; source-check all30 ZIP files and77 rows; preserve immutable history; correct scope/auth/navigation/search/address/badge/provenance; compute formatted raw-byte SHA256 and bind task/PR; run docs/static/format/lint. Task/Implementation remain PLANNED, Verification NOT VERIFIED for frontend functionality. A local structural PASS is not implementation approval. Authentic v8 attestation is recorded via owner comment6356392948; this metadata correction does not start code/tests/schema/dependencies/CI implementation.

Origins: ZIP_SOURCE64, NEXORA_EXISTING6, NEXORA_ADAPTATION7. Delivery: FUNCTIONAL_CLIENT_PRESENTATION36, FUNCTIONAL_WITH_EXISTING_API26, BACKEND_PENDING10, APPROVED_EXCLUSION4 (rows61–64 sourcing), SECURITY_POLICY_EXCLUSION1 (row9 Quick Fill), PRODUCT_DECISION_PENDING0; total77. Row39 now includes required pending stats extension, without claiming existing list is absent. New passive stats cards do not invent a discrete interaction.

### M1 — Foundation UI, design system and shell

Extend centralized tokens (56px header,240px expanded/72px collapsed sidebar, navy/orange reference palette), CSS Modules and local Inter variable font with redistribution rights/Vietnamese coverage verified during implementation. Retain Next.js/React/SDK/pinned existing Lucide; no Vite/Tailwind/Gemini runtime migration. Tier A neutral Button/TextInput/Select/Checkbox/Drawer/Dialog/Pagination/EmptyState only for real shared consumers; Tier B shell/Header/Sidebar/AccountMenu/NotificationMenu, honest empty notifications and Header scope slot; Tier C feature-local logic. Full reuse/geometry/overlay/viewports/rollback details remain in snapshot.

Restyle LoginForm without demo Quick Fill. Preserve server workspace layout getCachedServerSession/verifyServerSession; AppShell/ShellClient presentation only, no client session guard. Malformed successful session response and backend outage remain unavailable/fail-closed, not redirect loops. Preserve password, TOTP/recovery/cancel, cookies, sanitized from and actual session success. Test403 MFA_ENROLLMENT_REQUIRED operator pnpm mfa:enroll guidance separately from generic403 FORBIDDEN. Remember Me stores only non-secret username and never changes server TTL. M1 preserves current available/planned navigation states.

### M2 — Customer Management with real aggregate dependency

Keep CustomerListPage/DetailPage, CustomerTable/Filters/StatsBar, Create/Edit/Address drawers, shared feature AddressForm/LabelField and DeleteAddressModal on /customers and /customers/[id]. Use all8 actual SDK operations, no INITIAL_CUSTOMERS or new endpoint. StatsBar reads response.stats only after separately approved backend dependency is merged/deployed/verified. Loading skeleton, unavailable contract, safe error/retry and genuine zero-success are distinct; never page-derived counts or fabricated zeros. M2 cannot claim complete before dependency.

Search q is absent or trimmed1..200; blank/clear removes q entirely, never ?q=. Keep phone normalization backend-owned; page/pageSize bounded as current parser (default1/20, size<=100, bounded offset). q/status changes reset page1. Canonical query key and immediate latest-generation invalidation +300ms debounce, abort when SDK supports, reject stale data/errors and unmount updates. Test A-before-B/B-finishes-first, clear in-flight and unmount; stats share latest query generation. No global state library.

Customer creation requires initial address and backend makes it default atomically. Address create/patch payload only label/recipientName/recipientPhone/countryCode/addressText. Actual ZIP AddressForm has no default checkbox; wrapper demo isDefault is stripped, and no such production control/payload is introduced. Separate PUT /api/customers/:id/default-address selects defaults. LAST_CUSTOMER_ADDRESS remains blocked; default deletion retains non-atomic PUT then DELETE, no DELETE after PUT failure, and partial-success/retry when DELETE fails. Omit summary addressCount to avoid N+1; export remains explicitly planned.

Activate NAVIGATION_ITEMS customers=/customers available only after route acceptance; synchronize independent APPROVED_NAVIGATION_CONTRACT, resolver, breadcrumb and mobile tests. No duplicate ZIP navigation registry.

### M3 — Retail Package honest presentation

Decompose reference2320-line RetailPackagesView into feature-local toolbar/tabs/filters/chips/table/mobile card/detail/create/fee/column components; /shipments/retail with legacy /logistics/parcels redirect preserving query. Reuse neutral primitives, URL filters and non-secret column preferences. Shipment Backend remains absent: truthful empty/planned states, no fabricated parcels/tracking/rates/export/persistence. Synthetic fixtures only in tests; source code/columns/geometry/rollback covered in snapshot. Activate shipment navigation only when honest route behavior is accepted; update config/independent contract/resolver/breadcrumb/mobile tests together, without inventing Shipment statuses in shared UI.

### M4 — Carrier connections and scope

Real Uniship-only catalog and owner connections, connect/rename/reconnect/disconnect UI and Header scope context; planned unsupported test/sync notices, no simulated success. Connect exact4 keys; reconnect is new frontend adaptation over implemented backend. Keep live-call authorization default-off and server-only tokens; transient password cleared, never persisted/logged. Add accepted System-group carrier-connections navigation at /settings/carrier-connections, preserving settings; nested resolver deliberately chooses most-specific accepted route. Test exact/detail/unknown settings paths, breadcrumbs and mobile activation. No sourcing item. StatusTone remains good/bad/pending and boolean resolver unchanged; feature-local exhaustive Customer/Carrier mappings, neutral explicit tone only if actual consumers require it.

### M5 — Final integration and visual acceptance

Verify production absence of sourcing routes/menu/components/imports/scraping/Gemini/showcase; reference provenance retained only. No executable Option A decision branch. Compare reference/implementation screenshots at1440x900,1280x800,1024x768,768x1024,390x844,375x812, body scrollWidth<=innerWidth; keyboard/focus/ARIA/overlay/Escape/return focus. Use existing native Node/Chromium CDP harness, real auth/Customer/Carrier and full canonical quality/runtime/HTTPS/data/dev with disposable infrastructure, no new Python tests or reset of real volumes. Synchronize canonical docs and perform independent implementation review after applicable approval/implementation. Scope/geometry/rollback acceptance remains self-contained in v8.

## Mandatory Reuse & Design Audit Matrix

| Field                    | UI presentation                                                             | Customer list + stats                                                                                     | Navigation/auth                                                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | StatusBadge, Panel, shared inputs/overlays; feature AddressForm             | CustomerPage/CustomerPort.list/CustomerAdapter                                                            | Canonical navigation and LoginForm/server layout                                                                                                            |
| Existing implementations | packages/ui/src/StatusBadge.tsx, status-tone.ts, Panel.tsx; ZIP AddressForm | apps/api/src/customer/application/customer.input.ts, customer.port.ts; infrastructure/customer.adapter.ts | apps/web/lib/navigation/nav-config.ts, resolve-active.ts, test/navigation.test.mjs; app/login/LoginForm.tsx, app/(workspace)/layout.tsx, lib/api/session.ts |
| Domain owner             | Neutral UI; Customer form owns domain payload                               | Customer application read projection/Infrastructure query                                                 | Web application; Identity remains authoritative                                                                                                             |
| Reuse alternatives       | Reuse styling; domain-aware resolver; duplicate forms                       | Extend list; new endpoint; page-based totals                                                              | Existing registry/session helper; ZIP registry/client guard                                                                                                 |
| Selected approach        | Neutral styling/tone; one allowlisted form; no isDefault control            | Separate approved backend extends existing list with grouped counts                                       | Milestone-gated canonical registry; preserve actual server guard/MFA branch                                                                                 |
| Rationale                | No duplicated UI/domain coupling                                            | Identical owner/search predicate, no N+1/hydration                                                        | Single source and real session authorization                                                                                                                |
| Risks                    | Broken ok consumers, leaked demo fields                                     | Count leakage, predicate drift, client/server compatibility                                               | Unauthorized route, stale search, lost enrollment guidance                                                                                                  |
| Verification             | Existing compatibility + feature mapping/payload/partial-delete tests       | RED18-case matrix, real PostgreSQL/HTTP, OpenAPI/SDK/version tests                                        | Exact config/active/breadcrumb/mobile; real MFA/from/unavailable tests                                                                                      |

Search scope/queries, additional component decisions, alternatives, DDD read-only rationale, concurrency/efficiency/compatibility/risks/test plan are in v8 sections4–10. No generic Domain objects or frontend backend imports.

## Acceptance criteria (future implementation, not claimed done)

- [ ] Exact authenticated v8 approval and separately approved backend task.
- [ ] Customer Stats dependency merged/deployed and invariant/owner/filter/DTO/SDK compatibility verified.
- [ ] M1 server auth/MFA guidance, neutral components/local font/design geometry accepted.
- [ ] M2 real8 Customer operations, stats, normalization/stale guards, address invariants/partial failure accepted.
- [ ] M3 honest Shipment presentation/navigation with no fabricated data/rates.
- [ ] M4 real owner-scoped Carrier behavior/live authorization and approved nav extension accepted.
- [ ] Sourcing excluded; Quick Fill excluded for security; no unsupported payloads/domain UI coupling.
- [ ] Six-viewports/accessibility and full final-head canonical verification/independent implementation review.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

This PR updates selected design intent, provenance, dependency and acceptance plan only; frontend, stats API and primitives remain PLANNED. It does not claim new routes or API fields are implemented. Historical immutable snapshots preserved; v8 replaces incorrect active claims. No runtime/schema/SDK/dependency/CI change.

### Canonical owners

This active task, immutable v8 and planned-design pointer in docs/architecture/frontend.md own this design update. The future backend PR must update docs/architecture/api-contract.md and docs/domains/customers.md with code/SDK/tests. Future frontend milestones update Frontend/reusable-components/Customer/Shipment/Testing owners alongside actual implementation; do not mark them implemented now.

### Documentation verification

pnpm docs:check, preflight:check (structural only), format:check, lint; read-only Node archive/matrix/source/history/digest/binding assertions. Hosted PR enforcement must fail closed while approval pending. Final-head workflow outcomes go in PR metadata to avoid a self-referential SHA-only documentation commit; no prior-head PASS certifies this head.

## Evidence

| Claim                                    | Evidence                                                                                                                                                                                      | Date       | Result |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Actual branch/main before consolidation  | GitHub PR25 head49aa5dbb4e8ac67737471785f98dbf00b8220ea5; fetched origin/main c14dada506d73b991924edb57faae44cf42f66a8; clean dedicated worktree on existing branch                           | 2026-10-23 | PASS   |
| Owner Option B provenance                | Authenticated GitHub owner comment6354627613; four named sourcing components/current rows61–64; scope decision is separate from final v8 approval, now verified via owner comment6356392948   | 2026-10-23 | PASS   |
| Historical snapshot digests              | Node crypto over git show HEAD:path for all7 revisions; v1 actual31a8797f54275fe878f4a5ce961409689ccb8553f51c465f171dd9bc1c9567be; v8 carries corrected provenance table, originals unchanged | 2026-10-23 | PASS   |
| Invalid prior baseline/provenance claims | Prior task called nonresolving c14dada3fcfa9466e74b3353ae4b77f8846338e5 main and used design commits as baseline; superseded claims corrected using actual Git objects                        | 2026-10-23 | FAIL   |

### Documentation preparation execution — 2026-10-23

Pinned pnpm10.34.6 install --frozen-lockfile --offline exit0 using genuine cached packages, no manifest/lockfile changes. pnpm docs:check, preflight:check (static only), format:check and lint all exit0. Read-only Node verification in /tmp/nexora029-verify.mjs checked30/30 actual ZIP source paths,64 source handler symbols,77 contiguous interaction IDs, origin/delivery totals, actual current contract/auth/navigation/badge references, unchanged historical7 raw-byte snapshots and task/PR structural binding; exit0. ZIP SHA256 b4130f0f53bf02b9c97d710ee46c6a988765d3a4389bc1ea69833ac7c0a36675. These are design/documentation checks, not runtime or authenticated approval PASS. Final post-format snapshot digest is in the design record.

| Claim                                       | Evidence                                                                                                                                         | Date       | Result |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| Documentation/static/format/lint            | pnpm docs:check, preflight:check, format:check, lint exit0; boundary guard preserved                                                             | 2026-10-23 | PASS   |
| Read-only source/archive/provenance binding | Node assertions30 source files/64 handler symbols/77 IDs; totals36/26/10/4/1, historical7 unchanged, raw SHA256 and local task/PR binding; exit0 | 2026-10-23 | PASS   |

No application or test implementation, schema/dependency/CI changes, backend task allocation or production access. Full runtime and backend stats verification NOT RUN for this documentation preparation. Hosted final-head Preflight/Foundation outcomes are reported in PR metadata after execution; historical pending-approval failure remains audit evidence, and the checker is unchanged.

### Review finding disposition and governance

PR25 has10 existing threads: P1 baseline and StatsBar contract; P2 frontend provenance, v1 hash, empty q, navigation, MFA enrollment, address payload, neutral badge and stale requests. New v8/task address them with source-based evidence; immutable v5/v7 text is historical, not an active instruction. Exact thread IDs/disposition and final-head evidence are recorded in PR metadata. Do not claim a thread resolved merely because it is outdated.

PR remains Ready, not Draft; design-document merge eligibility depends on required final-head checks, not on frontend implementation completion. Design Approval is APPROVED, verified against https://github.com/dinhphuquy2k1/nexora/pull/25#issuecomment-6356392948 (authenticated owner User; created/updated2026-10-23T03:05:52Z; exact task/revision/raw-byte digest; no later valid revocation). Earlier reference6355371808 is no longer retrievable and is historical evidence only. Later prose-wrapped comment6355586299 is not used as approval evidence. Backend task/ID/branch not created or reserved. Task/Implementation remain PLANNED and frontend/runtime Verification NOT VERIFIED; this metadata fix does not begin M1 or backend implementation.
