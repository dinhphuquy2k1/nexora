# NEXORA-032 — Account Menu ZIP parity

Status: COMPLETED
Implementation: IMPLEMENTED
Verification: VERIFIED

Prior visual verification checkpoints remain historical below. Current evidence-
retention correction is NOT VERIFIED until its new head passes required checks;
task stays active and is not marked COMPLETED.

## Scope

New branch feat/account-menu-zip-parity from origin/main845c7e68cd9de6e2e90651267a0778e8afebb117 (PR29 already merged). Exactly3 Account entries, true session username/initials and neutral subtitle; no environment notice, fake identity/wallet/VIP, Profile/Carrier placeholder UI, auth/backend/SDK/schema changes, new dependencies, deployment or merge. Do not mutate tasks007/031/history or any PR29-only work.

## Design Review & Reuse Decision

Task ID: NEXORA-032
Classification: SIGNIFICANT
Plan revision: rev-2026-10-31-account-menu-v1
Reviewed baseline: 845c7e68cd9de6e2e90651267a0778e8afebb117
Design Snapshot: docs/tasks/design-reviews/NEXORA-032-rev-2026-10-31-account-menu-v1.md
Design SHA-256: 3b0313bea5971181f468a41b99cfd9a9bd8ae8659bb009d396d675df15b0eac2

Read-only audit/8-field reuse matrix, scoped control appearance assessment, route/API inventory, security boundaries, alternatives and verification are in the immutable snapshot. Both Profile and Carrier Connections UI absent; native disabled planned items, no fake href. SessionUser has only id/username; no role inference. Keep Header compatibility, AccountMenu ownership, useDismissable and real logout POST/status-before-redirect, add single-flight guard.

## Delivery milestones

- [x] Read-only source/ZIP/routes/security audit; new task ID/branch availability checked.
- [x] Record scoped plan, reuse matrix, snapshot/digest before implementation.
- [x] Test-first identity/entries/disabled routes; implement trigger/summary/three entries and preserve logout.
- [x] Actual browser/ZIP six-viewport comparison, keyboard/loading/error/retry and real ADMIN/OPERATOR revocation.
- [x] Independent rounds1–3 and targeted/full quality/regressions.
- [x] Focused commits/push, new PR, source-head Preflight/Foundation/log/artifact reconciliation.
- [ ] Final documentation-head CI pending at this checkpoint; reconcile final outcome in PR30 metadata without a self-referential commit loop.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

AccountMenu presentation uses true session username, neutral subtitle and exactly3 entries; Profile/Carrier items planned; red logout retains actual server revocation. Shared default controls/security unchanged; explicit Account appearance follows owner ZIP request.

### Canonical owners

- docs/architecture/frontend.md
- docs/architecture/design-system.md (scoped Account visual roles)
- docs/operations/testing.md (browser evidence procedure/retention)
- docs/ai/PROJECT_RULES.md and docs/ai/TASK_WORKFLOW.md (storage/provenance policy)
- docs/tasks/evidence/NEXORA-032/README.md and reference.json (text source provenance)
- This task and new PR metadata; shared registry only if an exported shared API changes (none planned).

### Documentation verification

Run docs:check, preflight:check and format:check; preserve immutable bytes after pinning.

## Evidence

| Claim                                      | Evidence                                                                                                                                                                                                             | Date       | Result |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Main/branch isolated and unused task032    | git fetch origin main, worktree new branch at845c7e6; rg NEXORA-032 found no previous task                                                                                                                           | 2026-10-31 | PASS   |
| Exact uploaded ZIP provenance              | sha256sum a10065b309004c8771ad937d2f622a7f93e44ef9a496599e7cfc637e198151aa; Header and mockData read directly                                                                                                        | 2026-10-31 | PASS   |
| Initial Carrier unit failure               | Foundation41207628316 attempt1 at2845e22; API171/172, first loopback verification503; runtime skipped                                                                                                                | 2026-10-31 | FAIL   |
| Initial Account route harness precondition | Foundation41207628316 attempt2;18 Account images, hidden Sidebar navigation timeout; corrected in8b2160b                                                                                                             | 2026-10-31 | FAIL   |
| Retail gate before Account                 | Foundation41208246908 at1dcf44d; RETAIL_COLUMNS_PRESET_ALL failure; subsequent gates skipped, restored original browser launch                                                                                       | 2026-10-31 | FAIL   |
| Full source-head governance                | [Preflight41209017667](https://github.com/dinhphuquy2k1/nexora/actions/runs/41209017667), head8b2160baf718d49e1385a88b86c8c8a6d0a6d509                                                                               | 2026-10-31 | PASS   |
| Full source-head Docker quality and smoke  | [Foundation41209017608](https://github.com/dinhphuquy2k1/nexora/actions/runs/41209017608), job124559895977; quality/integration, LOCAL/TTY/MFA/browser, HTTPS, data, dev all executed successfully                   | 2026-10-31 | PASS   |
| Actual browser visual and failure states   | [Account artifact13046121263](https://github.com/dinhphuquy2k1/nexora/actions/runs/41209017608/artifacts/13046121263);72PNG hashes +2 manifests checked, six viewports ×six phases ×two actors; ZIP18 hashes checked | 2026-10-31 | PASS   |
| Independent implementation review          | Three rounds, actual source/tests/images/logs; final8b2160b review no confirmed P1/P2; advisory same-tick test coverage retained below                                                                               | 2026-10-31 | PASS   |

## Execution journal

Plan recorded before code/tests. This initial planning checkpoint preceded all implementation/testing. Subsequent execution evidence follows; hosted CI remains pending until the new PR exists. No owner approval gate per current ADR009. ZIP has full demo menu; visual reference will isolate actual account subtree and explicitly document removed mock fields/rows. No ZIP package scripts or live provider services run.

## Reuse audit and domain invariants

| Component       | Existing implementations                   | Domain owner                              | Reuse alternatives                                 | Selected approach                                                       | Rationale                                        | Risks                           | Verification                                                   |
| --------------- | ------------------------------------------ | ----------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------- | -------------------------------------------------------------- |
| Disclosure      | AccountMenu/Header, useDismissable         | AppShell                                  | Replace Header / reuse disclosure                  | Existing component, medium40 trigger, native region, pathname dismissal | Preserve shell and focus policy                  | Mobile bounds/hydration         | SSR and actual keyboard/pointer CDP                            |
| Identity/logout | SessionUser, GET session, POST logout      | Identity contract / AppShell presentation | Mock ZIP callback / real endpoint                  | Existing session fields and res.ok gate; ref single-flight, safe retry  | No role inference or premature redirect          | Failure/double-submit/security  | Actual ADMIN/OPERATOR revocation plus isolated failure/loading |
| Appearance      | shared Button, semantic tokens, ZIP Header | Shared control / Account presentation     | New framework/global defaults / scoped composition | Shared size/focus/disabled; scoped content/icon/gray/rose roles         | Exact requested layout without global regression | CSS load order/disabled entries | Computed tokens/sizing/state and direct ZIP screenshots        |
| Routes          | workspace app tree, navigation metadata    | Feature route owners                      | Fake href/page / planned buttons                   | Profile and Carrier absent: disabled native entries with description    | No404 or premature M4                            | Future route activation         | Exactly3 entries, no invalid links/new APIs                    |

Tactical DDD Boundaries: no new business domain, aggregate, entities, persistence,
commands or schema. Identity owns session revocation and trusted user facts; UI
only presents id/username and calls the existing logout HTTP port. Domain
invariants: no inferred role/profile data, no fake destination or Carrier state;
server success before redirect, no repeated in-flight logout, unchanged Origin,
HttpOnly and MFA behavior. Full eight-field inventory and alternatives remain in
the pinned snapshot. No aggregate/VO adoption is required for this presentation task.

Reference comparison clarification (within pinned scope): actual Tailwind4.3.3
render of exact Account subtree confirms row32px, icon16px, padding8px/12px,
gap10px, panel256px/radius12px and a two-layer shadow distinct from existing
--shadow-lg. Use a new account-only shadow role instead of changing shared
shadows; preserve actual rose600/rose50 OKLCH values from reference and md text
visibility at768px. Trigger uses approved canonical40 instead of ZIP42. Profile/
Carrier disabled opacity and reduced panel height (no VIP/wallet/4 extra entries)
are owner-required differences, not parity failures. At that historical implementation checkpoint, reference images/manifest were
committed under docs/tasks/evidence/NEXORA-032. The retention correction below
removes those PNGs from the final tree and compacts metadata; ZIP mock data never
entered product source. No ZIP package scripts/App/provider components executed.

### Implementation checkpoint — 2026-10-31 (Asia/Saigon)

Implemented trigger/summary and exactly three entries with canonical shared controls,
scoped gray/rose appearance, native disabled planned destinations and unchanged
POST/status-before-redirect logout plus ref single-flight. Header/AppShell, backend,
SDK/schema and package contracts are unchanged. Reference ChevronDown stays static;
aria-expanded reports disclosure state. Account-only tokens preserve all existing
global defaults. Added actual Account JSX/CSS CDP checks to ADMIN/OPERATOR smoke;
original genuine logout/session401 assertions remain.

Executed local evidence (working tree before first implementation commit):

- Frozen pnpm10.34.6 install PASS (RAM store; unchanged lockfile).
- Test-first Account SSR initially RED on old subtitle/missing content seam, then3/3 PASS.
- Shared build prerequisite PASS; complete Web tests186/186 and UI tests32/32 PASS.
- Web type generation/typecheck PASS; format/lint/boundaries/docs/static preflight PASS.
- Browser expression syntax inventory3/3 PASS.
- Actual TSX/CSS isolated browser, six viewports, keyboard/focus/outside/Notification,
  disabled routes, loading/503/retry, normal and50-character usernames PASS.
  This fixture uses synthetic sessions and does not prove server revocation.
- Exact ZIP subtree18 captures with real fine-pointer hover PASS; source hashes,
  per-image hashes and geometry committed under evidence/NEXORA-032.
  Product comparison intentionally omits mock fields/four rows, disables absent
  routes, and uses canonical40px trigger rather than reference42px.

Preserved diagnostic history: first Web test run lacked built shared dist (fixed by
building dependency); initial preflight required inline reuse/DDD assessment (added
without changing snapshot); isolated Next hook bundle lacked compiler defines
(fixed with pinned Next getDefineEnv, no fake hook/browser process); initial
headless reference reported hover:none (not accepted as hover proof; rerun with
source-verified fine-pointer Blink device settings and real mouse). None of these
failures was reclassified as PASS without rerun.

Independent Round1 architecture/security: no P1/P2. Advisory P3: repeated pointer
click after loading verifies disabled behavior, not adversarial same-tick reentry;
production handler also checks a ref before awaiting. Round2 independent visual/interaction review opened desktop/mobile reference and
product screenshots, checked focus clipping/source hashes, reran6/6 tests and
diff-check: no P1/P2. Fixed confirmed source-comparison differences (row gap10,
account-only shadow, rose OKLCH, static ChevronDown); browser rerun PASS.
Round3 final-head regression remains pending. Full canonical Docker/hosted checks
and genuine ADMIN/MFA/OPERATOR revocation are NOT YET VERIFIED for this task.

Implementation checkpoint is now VERIFICATION PENDING / Verification NOT VERIFIED until mandatory hosted runtime evidence is available. No merge/deploy performed.

### Hosted and transport-failure checkpoint — 2026-10-31 (Asia/Saigon)

New Draft PR30: https://github.com/dinhphuquy2k1/nexora/pull/30.
Initial implementation head2845e220d870a05a5adae3ec0b794e23690864e9.
Hosted Preflight41207628272 PASS (24/24 governance tests); checkout log shows
PR merge commit7d4805349176be9fd3d6ab88ba8fce05d46bc071, not direct head checkout.
Foundation41207628316 attempt1 FAIL: existing API uniship-verify.test.cjs:82 first
successful loopback request hit the test's100ms timeout and returned503.
API171/172; Web186/186, UI32/32, database6/6 and scripts124/124 passed. Format,
lint, preflight/docs and full typecheck passed; runtime/HTTPS/data/dev were SKIPPED
and must not be inferred PASS. Missing Account/Retail artifacts are secondary to
the early failure. Exact job rerun requested without weakening tests or touching
Carrier/backend code; outcome pending.

Additional host root test attempts: first FAIL missing required API_INTERNAL_URL;
configured rerun FAIL while fetching Prisma schema engine (EAI_AGAIN binaries.prisma.sh).
Turbo cancelled dependent jobs. These are not full-quality PASS; canonical Docker
CI remains authoritative. Only task-owned generated build storage moved to RAM;
no user volumes or shared/production databases touched.

Transport regression extended with actual CDP Fetch.failRequest(ConnectionFailed):
no redirect, session200 and retry-enabled state PASS in local actual component
browser. Focused SSR/expression6/6 PASS. Chevron now references an account semantic
role instead of a foundation palette token, with unchanged computed appearance.
Round3 independent source review of2845e22 found no P1/P2; final runtime/artifact
review remains open. Local36 normal and36 long-name PNG hashes matched manifests
at2845e22; new transport/token follow-up requires its own final-head checks.

### Runtime discovery and scoped harness correction — 2026-10-31 (Asia/Saigon)

Foundation41207628316 attempt2: quality/integration PASS; runtime FAIL at
ACCOUNT_REAL_SESSION_AND_DISCLOSURE; later HTTPS/data/dev SKIPPED. Account artifact
13045716290 has18 closed/open/focus PNGs plus admin.json (merge SHA7d480534...),
not a complete browser run. Direct inspection shows the route test focuses desktop
Sidebar after screenshot metrics return to Chrome's narrow default; canonical
AppShell hides desktop Sidebar at<=900px. The isolated fixture has no Sidebar and
could not expose this test precondition. Fix: set1440 desktop viewport for actual
Next Link navigation, assert visible native Link and actual keyboard focus; retain
route-change/disclosure-close assertions. Add safe named interaction steps so a
failure identifies the precise check without dumping session/request data.

Head1dcf44dd07c641f8d280c17cb200ac8075791236 Preflight41208246843 PASS;
Foundation41208246908 quality/integration PASS, runtime FAIL at pre-existing
RETAIL_COLUMNS_PRESET_ALL before reaching Account. No Account artifact; later
HTTPS/data/dev SKIPPED. Remove the newly introduced global Chromium pointer
capability override to preserve existing Retail/auth smoke launch semantics.
ZIP reference rendering alone retains its explicit fine-pointer profile; Account
CSS hover uses real mouse events and no media-based forced state. No Retail tests,
production behavior or assertions changed/weakened. Both FAIL records remain.

Corrected harness targeted/local actual component browser and final-head Docker
checks must rerun; no old or partial artifact establishes final PASS.

### Verified implementation checkpoint — 2026-10-31 (Asia/Saigon)

Implementation8b2160baf718d49e1385a88b86c8c8a6d0a6d509 passed Preflight41209017667
and full Foundation41209017608. Actual Foundation checkout was PR merge
20b8f24fefb2ef4590195ede5ad9105967a75a89, whose GitHub-verified parents are main
845c7e68cd9de6e2e90651267a0778e8afebb117 and the implementation head; not a direct
head checkout. Logs read, not merely YAML or aggregate status. Every required
quality/integration, LOCAL runtime, provisioning/TTY/MFA/browser, disposable HTTPS,
persistence and development step ran PASS; only failure-only Diagnostics skipped.

Executed canonical frozen install, format/lint/boundaries/preflight/docs/typecheck/
contracts/test/build in Docker. Script124, API172, Web186, UI32, database6 and
integration81 tests all passed with zero failures. Real disposable cluster,
migrations/provisioning/cleanup, two retained Python PTY harnesses, cookie/Origin/
MFA/revocation, Customer API/UI CRUD and Retail regressions ran successfully.
No new Python test or orchestration added. Host root failures above remain FAIL;
these Docker results do not retroactively make them PASS.

Account artifact13046121263 ZIP SHA256
136ffce0fef09a483097e7e7e4b57f7c021bce38c5ed652479a4744115afe4df;
admin.json/operator.json each contain36 PNG records and the exact merge SHA.
All72 image hashes checked; desktop/mobile open/hover/focus/loading/error images
opened against the18 direct ZIP reference images. Normal panel196px,256px width,
12px radius,32/40px avatars, Header56, trigger40, rows32/icons16/padding12/gap10;
long usernames wrap summary without overflow. Error feedback increases panel
height intentionally. No claim of whole-demo pixel equality: real identity/neutral
subtitle, two disabled planned entries, excluded mock fields/four actions and
canonical40 versus42 trigger are deliberate differences.

Synthetic503 and actual CDP ConnectionFailed cases verified no redirect, session200
and retry. The caller then executed original actual ADMIN-after-MFA and OPERATOR
logout, Login redirect and session401 assertions; no intercepted success or fake
revocation. Route dismissal now passed using a visible real Next Link. Browser,
security, Customer/Retail, TTY/MFA, HTTPS/data/dev results verified from actual logs.
This is disposable CI evidence, not a public deployment or production readiness.

Independent rounds: R1 architecture/security no P1/P2; R2 direct visual review,
confirmed gap/shadow/rose/static-chevron corrections and local rerun; R3 final
source,72 hosted PNGs/manifests and full actual logs no P1/P2. Follow-up route-test
precondition reviewed independently with assertions preserved. P3 advisory: repeated
pointer test proves disabled-state protection; it does not separately isolate a
same-tick ref reentry attack. Production ref guard precedes await; no blocker found.

This evidence-only update must receive its own final-head Preflight/Foundation;
keep PR Draft until both pass and logs/artifacts are reconciled there. The PR holds
final documentation-head SHA/run URLs so recording evidence does not recursively
require another commit solely to name itself. No approval/merge/deployment is
performed. The task remains active pending final-head handoff and owner acceptance.

## Corrective plan — Evidence retention (recorded before code)

Corrective revision: corrective-2026-11-01-evidence-retention-v1.
Classification: BOUNDED corrective governance/storage change on existing PR30,
reviewed head cf369336015662636a4255754a0b8a43ae5a0a42. The primary SIGNIFICANT
visual design/revision/snapshot/digest above remain unchanged: no visual, business,
security or runtime contract changes. This is execution-evidence storage policy,
not a material revision of the selected Account design. Documentation Impact:
REQUIRED; canonical owners Project Rules, Task Workflow, Testing and this task's
provenance README/JSON. No new framework, service, dependencies or ADR required.

### Read-only audit and impact/reuse matrix

| Component         | Existing implementations                                                       | Domain owner                   | Reuse alternatives                                 | Selected approach                                                                                                                  | Rationale                                                                                    | Risks                                                              | Verification                                                                                              |
| ----------------- | ------------------------------------------------------------------------------ | ------------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Storage policy    | PROJECT_RULES section5, TASK_WORKFLOW Evidence schema, testing.md              | Contributor governance/testing | New service/ADR or extend canonical owners         | Text summaries/provenance in Git; generated captures/logs/manifests in ignored local output or14-day CI                            | Preserve auditability without accumulated binary                                             | Expired artifacts/source attachments mistaken for accessible proof | Explicit historical/current/reproducibility wording and docs checks                                       |
| Binary prevention | .gitignore /artifacts, scripts/docs-check.mjs +docs-check-lib.mjs/test.mjs     | Repository tooling             | Git hooks/framework or existing docs checker       | Narrow task-media ignore rules; existing docs CLI checks tracked/staged paths via git ls-files -z and a small exported path policy | Force-added files must fail even if ignored; allow Markdown/source JSON/production assets    | Overbroad suffix blocks legitimate design assets                   | Real disposable Git fixture: ignore, force-add rejection, staged deletion, allowed production/design docs |
| PR cleanup        | evidence/NEXORA-032 README/reference.json +18PNG                               | Task provenance                | Keep captures in Git or remove final-tree binaries | Remove18 PNG; retain compact hashes/geometry/tooling, no dead image paths                                                          | No production/runtime/test import depends on these PNGs                                      | Hash alone cannot reconstruct ZIP; old Git blobs remain            | Tracked-tree inventory, reference search, raw snapshot digest, source hashes                              |
| CI evidence       | foundation.yml, m1-visual-checks/customer-/retail-/account-menu-browser-checks | Test infrastructure            | Refactor all capture contracts or preserve them    | Keep every assertion/capture/manifest/upload and14-day retention unchanged; optimize future task capture plans separately          | Capture functions also execute assertions; output reduction now risks weakening verification | Artifact size/expiry remains                                       | Exact-final-head full Foundation logs/manifests/images and three review rounds                            |

Tactical DDD/domain invariants: no domain model, Aggregate, persistence, schema,
API/SDK, Auth/Carrier/Customer/Shipment changes. Existing browser collectors are
independent test owners, not a new evidence abstraction. Long-term source-design
images belong outside generated task evidence paths and require documented need,
size/privacy/alternative-source assessment; no exception is selected for these18PNG.

### Repository/history findings and selected delivery

- Clean existing branch/head matches authenticated GitHub PR30; main845c7e6;
  PR open/unmerged.18 PNG total444406bytes introduced2845e22 and present in
  2845e22/1dcf44d/8b2160b/cf36933 trees. No other tracked media or artifact outputs.
- API reports squash/merge/rebase all enabled, rulesets empty. Branch protection
  read returned403 (integration lacks access); no claim that no protection exists.
- Existing exact-head CI/snapshot/task references bind these historical commits.
  Remove files from final tree only; no reset/filter-repo/rebase/force-push/history
  rewrite. Recommend owner squash merge so intermediate PNG trees do not become
  main ancestry. Other merge methods may preserve those blobs. This is not remote
  object purging, garbage collection or a guaranteed clone-size reduction.
- ZIP is a user attachment, not a durable source URL. Preserve archive/Header/
  mockData hashes and necessary geometry/tooling; explicitly document that future
  reconstruction needs the exact original bytes. Historical reference captures
  remain in old branch Git objects while reachable, not in current tree or a
  dedicated reference CI archive; no retention guarantee.

### Verification-first sequence

1. Round1 independent audit of inventory/history/policy and recorded plan.
2. RED tests for existing docs checker: tracked/staged forbidden evidence and real
   Git ignore cases; preserve legitimate source JSON/Markdown/design/production assets.
3. Minimal guard/ignore implementation; remove18PNG, compact provenance JSON and
   update canonical policies/references, preserving all historical results/snapshot.
4. Targeted tests/format/lint/boundaries/docs/preflight and final diff/tree checks;
   Round2 independent implementation/docs review. No screenshot-count reduction.
5. Commit/push existing branch; exact-new-head Preflight +full Docker Foundation,
   actual browser/logout/Customer/Retail and artifact manifest/hash verification;
   Round3 independent final-head review. Final run metadata in PR avoids self-SHA
   documentation loops. Keep Draft while mandatory verification pending; no merge.

Correction implementation/verification: NOT YET RUN at this planning checkpoint.
Prior visual implementation PASS remains historical evidence, not proof of this
new correction. Current correction must pass its own exact-head checks.

### Corrective execution checkpoint — 2026-11-01 (Asia/Saigon)

Round1 independent inventory/history/policy review found no P1/P2; emphasized
index truth, expired-source availability and no history-purge claim. RED: existing
docs-check tests lacked the new path guard and task-media ignore behavior. GREEN:
9/9 docs tests, including real disposable Git index and actual CLI nonzero rejection
of force-added captures, staged removal acceptance, all8 case-aware media/log
ignore patterns, source Markdown/JSON/snapshot and legitimate production/design
asset preservation. No hook framework, new dependency or domain changes.

Removed18 PNG (444406bytes) from tracked final tree only. README now describes
historical captures and source-attachment limitations; reference.json keeps raw
archive/Header/mockData hashes, historical measurements/tooling/reproduction needs,
not deleted image filenames/hashes or a current browser manifest. No binary
exception retained. Immutable v1 snapshot bytes/digest unchanged.

All four existing collectors, assertions, screenshot/manifest generation and four
Foundation uploads/14-day retention remain unchanged. Screenshot optimization is
a separate future follow-up because current capture functions contain assertions.
Prior headcf369336015662636a4255754a0b8a43ae5a0a42 was genuinely verified by
Preflight41210458138 and Foundation41210458113, with merge476be97be1169339085a60c26f1091aeeeaee295;
this is historical, not a PASS for the correction. Final corrective head/run/
timestamp/artifact metadata will be reconciled in PR30 after new CI completes.

History still contains the18 blobs through earlier branch commits; bytes removed
from final tree are not Git-history bytes reclaimed. Squash is enabled but owner-
controlled; merge/rebase can import intermediate binary trees. Branch protection
remains unknown after403; rulesets read returned empty. No history rewrite,
force-push, merge or remote-object purge performed.

Implementation clarification before Docker edit: docker/Dockerfile.tools tools/deps
use Node slim and do not install Git. The new real-index guard/tests require the
already selected Git CLI in canonical quality too; silently skipping them in Docker
would weaken verification. Add Git only to the existing dev target used by quality,
with the existing apt/no-recommends/cleanup pattern. No npm dependency, new image/
service/framework, release API/Web/migrate package or business behavior changes.
Testing/runtime docs record this dev/test prerequisite. Genuine Docker quality
must prove Git/index/CLI tests execute there, not rely on host-only PASS.

Round2 compatibility finding before follow-up edit: linked worktree .git may point
outside the Compose source bind. Git CLI installation alone does not make that
metadata reachable. Keep the guard fail-closed; document ordinary checkout as the
default Docker prerequisite and use existing NEXORA_COMPOSE_OVERRIDE for a quality-
only read-only bind of the common Git directory to the same absolute target path.
No automatic host mount or custom Git/index snapshot/parser/bypass introduced.
Add an actionable safe error and a genuine disposable linked-worktree regression
for accessible versus missing metadata. Hosted Foundation uses ordinary checkout;
this test does not claim a local linked-worktree Docker run was performed.

### Corrective local verification and Round2 checkpoint

Executed after the linked-worktree clarification: docs-check10/10 and complete
native root tooling128/128 PASS (zero failures/skips); format:check, lint/boundaries,
docs:check, local/static preflight and diff-check PASS. Raw snapshot digest remains
3b0313bea5971181f468a41b99cfd9a9bd8ae8659bb009d396d675df15b0eac2.
Archive/Header/mockData hashes equal the historical JSON; compact metadata has no
removed image paths. Git index has zero task PNGs and no root artifacts tracked.
Compared withcf36933, application/packages/workflows/browser collectors are unchanged.

Round2 independently reproduced10/10 PASS and closed the linked-worktree finding
for source/documented support: ordinary checkout or explicit existing read-only
metadata override, never a silent bypass. No confirmed P1/P2 remains at this
checkpoint. Local Docker with an override is NOT RUN; hosted ordinary-checkout
Docker quality, runtime and artifact checks still require the corrective head.
All existing visual/security FAIL/PASS checkpoints remain historical, unchanged.

Implementation is ready for new-head CI; current corrective verification remains
NOT VERIFIED until Preflight/Foundation and actual artifacts are checked. Final
results/timestamps/HEAD/merge/run URLs are recorded in PR30 without another commit
solely to name itself. Owner controls squash/merge; no merge performed.

## Closure — 2026-11-12

Delivered by PR #30. The only open item was final documentation-head CI, now covered by a descendant hosted run.

| Claim                  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Date       | Result |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Merged to main         | PR #30, merge 1a4fe7bfcc3571219db28b833aba3a626f6e472f, 2026-11-01                                                                                                                                                                                                                                                                                                                                                                                                                                        | 2026-11-12 | PASS   |
| Descendant hosted gate | Foundation run [43246873727](https://github.com/dinhphuquy2k1/nexora/actions/runs/43246873727), job 131281781892, checkout merge 4682dd9f47d81a55a515be44ebca19a1afb8828d (main 3906f8243347fb7c697bf5f6949389c3a784a13d + c4caffe33768b14445863ba31d153e441633c8f8), which includes this task's merge: steps 4–10 PASS (Docker quality 640 ordinary + 133 PostgreSQL integration, M5, runtime/TTY/browser incl. Carrier six-viewport matrix, HTTPS/ingress/onboarding/restore, persistence, development) | 2026-11-12 | PASS   |
