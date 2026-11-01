# NEXORA-033 immutable design — Carrier Connections UI migration

Task ID: NEXORA-033
Plan revision: rev-2026-11-01-carrier-ui-v1
Classification: SIGNIFICANT
Reviewed baseline: 1a4fe7bfcc3571219db28b833aba3a626f6e472f
Documentation Impact: REQUIRED

## 1. Outcome, authority and provenance

Use existing feat/carrier-connections-ui, new Draft PR into main. Task033 was
reserved by owner and absent from docs/roadmap/other task files at inspection.
ZIP remix-nexora-logistics-management (2).zip raw SHA256
6912f4917756a1c3393e48b34f63f350464cb068351a377c2efb9d5cde6d5a52 verified.
Read CarrierConnectionsView, CarrierDataSyncDrawer, carrierConnectionsData,
ShippingScopeContext/Selector, CustomSelect and App directly. Source is reference
layout only, not authority for provider authorization or system state. No ZIP
package scripts executed; source/render artifacts stay outside Git.

## 2. Scope and non-goals

Workspace route /settings/carrier-connections; list, line status tabs, search/
provider/status filters/chips/reset, local pagination; create/edit/detail/sync
side drawers, unavailable confirmation and fixture-only progress/error/history
inspection. Responsive six specified viewports, native controls/keyboard/Overlay,
Account link and nested Settings breadcrumb. Production uses no connection rows,
no sync history, requests, storage, fake success, automatic jobs or fake refresh.
No apps/api, packages/database, migrations, SDK operation, global ShippingScope
provider/selector, Sidebar item, dependencies, Python scripts, auth/session/MFA
change, live Carrier traffic, deployment, force-push or merge.

## 3. Existing ownership and source audit

Read AGENTS, AI ordered docs, frontend/design-system/reuse/API, ADR007/009,
M1–M5 task031, Retail/Customer presentation, Account032 and retention policy.
Read installed Next16 server/client and Link navigation guides per web AGENTS.
ZIP view is monolithic (list+form/detail/dialog), Sync drawer540px with three tabs;
reference list uses title icon36, line tabs, toolbar32, seven navy table columns,
attached footer; form drawer512, sync drawer540, fixed dark header/footer and
middle scroll. Raw table uses vertical dividers that Nexora intentionally omits.
ZIP sandbox/syncing/authGateApproved, fake api-key auth, addAccount/updateAccount/
syncAccount, INITIAL_SYNC_HISTORY and timeout-based success are excluded.
Backend only accepts provider uniship and statuses CONNECTED/ERROR/REAUTH_REQUIRED.
SDK already exports CarrierConnectionDto; use type-only status alias, not new
backend vocabulary or another status enum. Backend APIs exist but are not called.

## 4. Required reuse/impact audit

| Component          | Existing implementations                                           | Domain owner                        | Reuse alternatives                                      | Selected approach                                                                                                                         | Rationale                                            | Risks                                             | Verification                                                                                             |
| ------------------ | ------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Workspace route    | workspace/layout auth + cached session; Retail server page         | AppShell/Identity                   | New shell/guard or existing layout                      | Server page with empty model, existing guarded layout and wide frame                                                                      | No auth bypass/Carrier fetch                         | SSR/navigation/state leakage                      | Real authenticated direct route/reload/Account link, unauth redirect                                     |
| Navigation         | nav-config/resolve-active, AccountMenu, buttonClassName            | Web navigation/AppShell             | Sidebar item/new router or nested metadata              | Canonical child path/label; Settings ancestor active; wide override and three breadcrumbs; native Next Link in existing menu              | No fourth item or new shell composition              | Tab order/link styles                             | Native keyboard/link/dismiss/logout regressions and navigation tests                                     |
| Controls           | @nexora/ui Button/TextInput/Select/Checkbox/TabBar/TabCountBadge   | Shared UI                           | ZIP CustomSelect/local controls or reuse                | Default32 controls, line TabBar, semantic typography/color tokens                                                                         | Canonical32/40/48 and native focus/disabled behavior | ZIP size/palette differences                      | Component/control contracts + real computed browser states                                               |
| Overlays           | @nexora/ui Overlay + modal Toast viewport; Customer/Retail drawers | Shared Overlay/feature presentation | New trap/modal framework or reuse                       | Feature-local540/512 geometry; shared native dialog; fixed header/footer, scroll body, mobile full width                                  | Existing focus/body lock/Escape authority            | Nested top layer, return focus, secrets retention | Actual dialog tab/Escape/outside/return focus and close/reopen credential discard                        |
| Data and filtering | Retail DI fixture pattern, generated CarrierConnectionDto          | Carrier presentation only           | Global store/SDK client or local readonly model         | Readonly injected rows/sync presentation props; pure filter/page selector; production page passes none                                    | Test-rich UI without fake production state           | Fixture import/network leakage, stale pages       | Static import/network/storage/timer guards + production empty browser + fixture interactions             |
| Connection form    | Existing native shared fields/Overlay                              | Carrier presentation                | Fake API key/verification or ephemeral credential draft | Uniship only; displayName/login/password validation; local draft lost on close; explicit unavailable submit, no write/result success      | Owner excludes backend integration                   | Password URL/log/storage or stale state           | Blank/long inputs, valid submit no success/request; password blank on reopen; screenshots blank password |
| Sync surfaces      | ZIP Sync drawer three tabs; shared controls/Overlay                | Carrier presentation                | Simulated scheduler/job or readonly presentation        | Status/schedule/history; disabled backend actions, unsaved local schedule drafts; empty production data; provided fixture inspection only | No fake counts/timestamps/job dispatch               | Fake progress/saved schedule interpretation       | Empty/unavailable production; fixture progress/error/history and long scrolling, no requests/storage     |
| Evidence           | existing compiled TSX/CSS adapter, browser-login CDP and fixtures  | Test infrastructure                 | New framework/Python or extend helpers                  | Dedicated Carrier browser helper using existing session/compiler/owned teardown; CI14-day artifact                                        | Avoid duplicate launcher and authentication bypass   | Source SHA/secret capture, artifacts expire       | Targeted/full tests, hashes/dimensions/final-head workflow logs and three independent rounds             |

## 5. DDD and transport boundary assessment

No new business domain, Aggregate, entities, persistence, transactions or domain
policy: UI-only adaptation of trusted future data contracts. Backend Carrier owns
credentials/status/lifecycle; presentation cannot verify or mutate them. Model
connection status via existing SDK type; view labels exhaustively keyed. Sync
presentation state is a distinct UI type, not backend connection status. Fixture
provider labels do not register providers or promise authorization. No API client
abstraction or shared global store is justified.

## 6. Data/UX capability map

| Surface                            | Source                              | Capability gap                       | Scope decision                                                                          |
| ---------------------------------- | ----------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------- |
| Production connections/counts/time | No integration                      | Backend not connected in this PR     | Empty list, counts0, unavailable notice, timestamps dash                                |
| Fixture rows/status/long text      | Injected test source only           | Not production records               | Real local filters/tabs/pagination; label isolated fixture outside product              |
| Connection draft                   | Ephemeral form state                | No create/rename/reconnect operation | Uniship credential fields, inline validation, unavailable message; no persisted success |
| Sync status/progress/history       | Optional injected presentation data | No sync backend/metadata/worker      | Production empty/unavailable; immutable fixture inspection only                         |
| Schedule                           | Local draft                         | No save/scheduler                    | Local toggles/interval, next-run dash, disabled save; reset on drawer unmount           |
| Account route                      | Existing guarded workspace          | UI route absent at baseline          | Activate Carrier link; Profile remains planned; exact nested breadcrumbs                |

## 7. Screen/state hierarchy and component boundaries

CarrierConnectionsPage composes header/line tabs/toolbar/chips, seven-column table,
pagination and one active side drawer. Separate cohesive list controls/table,
connection form/detail, sync drawer and inspection/confirmation; avoid15 tiny
files when components share one responsibility. Pure presentation.ts owns labels,
filter/page derivation and form validation. types.ts owns readonly view models.
Table column widths56/190/180/144/240/210/176 centrally declared, native colgroup,
navy header and zero vertical row borders; scroll in its own wrapper.
Form drawer512; sync/detail drawer540; mobile<=640 full viewport, fixed dark
header and light footer, only central body scroll. Sync tabs retain drawer geometry.
Status rows/history use readable stacked layouts, not an oversized inner table.
List state local and intentionally transient in this UI-only phase; refresh resets
filters/drafts, Back/Forward retain genuine route navigation, no credentials in URL.
No new URL/global state framework. Direct unavailable/invalid route stays under
existing auth/404 policy; no route query switch enables fixtures.

## 8. Security, accessibility and truthfulness invariants

Production imports no fixture data and calls no Carrier API. Forms never log or
persist secrets; password stays in local memory only while mounted, clears on close,
is not shown by details or screenshot capture. No timeout simulation, success
callback, fake account insertion/deletion, mock refresh or automatic schedule.
Unsupported operation confirmation is explicit and disabled; valid local form
validation cannot be described as a verified/saved connection. Test-only fixture
inspection is read-only and never issues mutations.
Shared native Overlay owns modal/top layer/focus/body lock, Escape/outside dismiss
and restoration; no custom trap. Native labelled inputs/buttons, described unavailable
states, semantic tables/captions, keyboard TabBar, overflow/focus/200% zoom checks.
Preserve canonical palette policy (no forced contrast recoloring), non-color cues,
reduced motion, default32 controls and every original logout/MFA assertion.

## 9. Compatibility and visual differences

Native Select replaces ZIP CustomSelect; Nexora shell/gutters/Inter/shared sizing
replace App layout/Tailwind. Remove fake export, provider readiness, success badges,
API key auth, sandbox/syncing connection tabs, sync history and global ShippingScope.
Only Uniship appears as configured provider choice, without promising integration.
Fixture many-provider labels are layout tests only. No new shared component/API;
registry update only if that changes. Source ZIP/source file hashes and visual
measurements retained as text, images/logs/manifests only ignored output/CI14 days.

## 10. Test-first/verification-first plan

RED pure filtering/page boundaries/status-map/validation + rendered empty/truthful
form/sync states and navigation expectations before implementation. Browser uses
actual TSX/CSS through existing adapter: injected many-account fixtures for search,
chips/tab/page, detail/edit/create/unavailable actions, all three sync tabs, long
history, nested inspection, keyboard/focus/Escape/scroll/disabled, short/long values.
Real-session production route asserts no fixture records or Carrier network/storage
operations, Account/nativeLink route and Profile planned, session/Auth/MFA/logout
regressions preserved. No passwords in screenshots; normal credential field must
be cleared before capture. Source ZIP rendered outside product with inert handlers
for direct hierarchy/geometry comparison at1440x900,1280x800,1024x768,768x1024,
390x844,375x812. Explicit state/data exclusions, no pixel-equality claim.

## 11. Verification, documentation and delivery

Frozen install, native unit/component/UI/token tests, format/lint/boundaries/docs/
preflight/typecheck/build; full final-head hosted Preflight/Foundation and actual
browser CDP evidence. Reuse existing fixture compiler/browser login; no new package,
Python or browser launcher. Three independent rounds: architecture/scope;
UI/visual; final source/regression/log/artifact verification. Focused commits/push
same branch and new Draft PR; no merge/deploy or whole-M4 completion claim.
Update task033,031 milestone note, frontend navigation/presentation and testing
owners. Keep snapshots immutable; material conflict gets new recorded revision.

## 12. Risks and resolution

No unresolved PLAN ISSUE. UI-only production empty is deliberate, not a demo
success. Future SDK integration needs its own actor/security/request/state policy;
this design adds no operation stub pretending to succeed. Render references without
executing ZIP scripts/services/mutation handlers. CI ephemeral captures are not
production deployment or indefinite evidence; attachment digest is not source bytes.
