# NEXORA-032 immutable design — Account Menu ZIP parity

Task ID: NEXORA-032
Plan revision: rev-2026-10-31-account-menu-v1
Reviewed baseline: 845c7e68cd9de6e2e90651267a0778e8afebb117
Classification: SIGNIFICANT
Documentation Impact: REQUIRED

## 1. Task and provenance

New branch feat/account-menu-zip-parity from origin/main, new PR targeting main.
Main already includes merged PR29; do not merge/cherry-pick any other branch.
Reference remix-nexora-logistics-management (1).zip raw SHA-256:
a10065b309004c8771ad937d2f622a7f93e44ef9a496599e7cfc637e198151aa.
Reference source src/components/Header.tsx:246–381 and src/data/mockData.ts.
Owner request fixes AccountMenu only; supplied screenshots show the old runtime
notice. Do not change immutable007/031 records or their existing snapshots.

## 2. Scope and explicit exclusions

Replace trigger/summary with username/initials and neutral Tài khoản Nexora.
Exactly3 dropdown entries: Thông tin cá nhân, Kết nối hãng vận chuyển, Đăng xuất.
Both destination UIs are absent at baseline; use native disabled planned buttons
with accessible Chưa triển khai description. Do not invent hrefs, routes, profile
editors, Carrier modals/selectors or API calls. No wallet/VIP/mock name/account
code, extra history/security/login-test entries, environment badge or runtime box.
Keep AppShell/Header/Sidebar/Breadcrumb layout and composition. No Identity/API/
SDK/schema/cookie/MFA changes, no deployment, new dependencies or Python tests.

## 3. Documentation and ownership

ADR009 plan-first; existing authentication contract remains authoritative.
AccountMenu is AppShell-specific, not a shared UI primitive. Canonical owners:
frontend.md for menu/navigation/data; design-system.md for scoped appearance;
testing.md for browser/evidence; new active task for execution. Shared registry
changes only if a shared public API changes (none selected).007/031 are provenance,
not new task identifiers or records to rewrite.

## 4. Read-only inventory

Inspected AccountMenu.tsx/CSS, Header.tsx/CSS, Controls.tsx/CSS, SessionUser and
verifyServerSession, useDismissable, workspace routes, browser-login-smoke, M1
visual and Customer/Retail browser helpers, neutral TSX SSR loader, fixture build
adapter, authentication/API docs, task007 and current031. Searches: AccountMenu,
SessionUser, logout, account-profile, carrier-connections, deployment, avatar,
Button ghost/pressEffect, CSS tokens, task032 allocation. No task032 or proposed
branch exists at baseline. Only workspace home/customers/system/settings/retail
routes exist; neither Profile nor settings/carrier-connections UI is implemented.
The backend Carrier API does not establish Carrier UI readiness.

## 5. Mandatory reuse audit

| Component                 | Existing implementations                                                            | Domain owner                               | Reuse alternatives                                                          | Selected approach                                                                                                                                                                           | Rationale                                                                            | Risks                                                       | Verification                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Account disclosure        | components/app-shell/AccountMenu.tsx/CSS, Header composition                        | AppShell                                   | NewAccountMenu/shared menu framework / edit existing                        | Keep existing component and Header API; deployment prop accepted for composition compatibility but not rendered                                                                             | Localized scope, no shell redesign                                                   | Header height/mobile overflow                               | Real header and six viewport captures                                                                   |
| Identity display          | lib/api/session.ts SessionUser id/username, existing same-origin session refresh    | Identity transport/AppShell                | New role/profile API / reuse exact session fields                           | Type-only SessionUser; retain refresh and real SSR initialUser; username-derived initials, neutral subtitle                                                                                 | No role/fullname/code inference                                                      | Unavailable initial data, long usernames                    | Real/long/escaped user tests, SSR hydration/browser                                                     |
| Entries                   | @nexora/ui Button, Link for implemented routes, nav metadata                        | AppShell                                   | Fake links/placeholders / native planned buttons                            | Two-item private declarative config of labels/icons; native disabled shared Buttons and accessible explanation; no hrefs until real routes exist                                            | Current route audit permits no navigation                                            | Accidental404/activation                                    | Exactly3 entries, real keyboard/pointer, no extra routes                                                |
| Logout                    | existing AccountMenu handler POST/api/auth/logout, browser-login-smoke              | Identity owns revocation; UI owns feedback | ZIP callback / preserve real POST                                           | Keep endpoint/status/redirect/error semantics; ref-backed single-flight, loading/error/retry; redirect only on res.ok                                                                       | Prevent repeated requests without changing auth                                      | Failed revocation redirect, double click                    | Real ADMIN/OPERATOR logout; synthetic failure/loading interception isolated in CDP then real revocation |
| Dismissal                 | lib/hooks/use-dismissable.ts                                                        | Web common                                 | Parallel listeners/modal trap / reuse                                       | Reuse outside/Escape policy, close on pathname changes; native Tab flow, no menu role/trap                                                                                                  | Preserve outside target focus, restore Escape trigger                                | Notification interference/route persistence                 | Pointer outside, Enter/Space/Escape/Tab/ShiftTab/navigation                                             |
| Controls and visual roles | Controls size32/40/48, pressEffect none, semantic palette/type/space/radius         | Shared UI controls; Account appearance     | Custom buttons/new danger variant/global token changes / scoped composition | Shared Button medium40 trigger fits32 avatar; default32 rows; pressEffect none. Account-only content typography/icon16 and semantic gray/rose states; preserve shared sizing/focus/disabled | User explicitly requires ZIP appearance and red logout; no shared red variant exists | CSS load order / control overrides                          | Computed sizes/tokens/hover/focus/disabled, shared/customer regression                                  |
| Evidence                  | existing CDP session, owned teardown, TSX/CSS fixture compiler, CI artifact uploads | Test infrastructure                        | New browser framework / extend existing                                     | Account-specific helper/isolated actual component fixture when needed; real session route verified separately; reuse compiler via minimal optional entry/output if required                 | No production bypass or mock backend                                                 | Fixture import leakage, cleanup/secrets                     | Auth smoke + real UI states, manifests/digests, Foundation                                              |
| ZIP comparison            | exact Header account subtree/Tailwind CSS and mockData                              | External reference only                    | Execute ZIP App/services / isolate subtree                                  | Render hash-verified account JSX subsection outside product in RAM, Tailwind tooling outside repo, no ZIP scripts/services; compare role/layout/geometry with authorized exclusions         | Direct source visual evidence without live integrations                              | Mock data entering production / incorrect source comparison | Raw archive/source hashes, reference and product same-state six viewport screenshots                    |

## 6. Alternatives and trade-offs

Reject copying whole Header (imports sourcing/notifications/shipping scope and
fake logout); shared generic menu framework or new Button variant for a single
consumer; fake navigation. Retain compatibility deployment prop to avoid changing
Header composition while removing environment presentation from AccountMenu.
Two identical planned row structures justify only a small private array/map.

## 7. Selected design and DDD assessment

No new business domain, aggregate, Value Object, persistence port or transactions:
this is presentation over the existing Identity session and logout application
contract. Keep SessionUser browser-safe via type-only import. Username comes from
verified session, no inferred role. Initials use the existing first2-character
uppercase policy; no hardcoded account identity. Unknown user stays neutral.

Account summary: panel256px/max viewport-32px, radius12, header16px, light slate,
40px avatar,14px semibold username,12px muted subtitle. Trigger:32px avatar,12px
semibold username,11px subtitle,16px chevron, medium40 shared target inside56px
Header. Mobile hides text/chevron as needed, retains avatar/accessible username.
Menu rows: default32 shared targets,12px content labels,16px decorative icons,
12px inline padding,8px radius. Dedicated muted footer, rose logout and light rose
hover. Exactly3 entries; disabled route states intentionally differ from enabled
ZIP demo links. Account header excludes wallet/VIP/code sections, reducing height.

## 8. Security, concurrency and accessibility

Retain POST same-origin logout and res.ok success gate before /login hard redirect;
server still owns revocation/Origin/cookies. Ref-backed in-flight guard closes the
same-tick repeated-click window; failure releases it and shows safe retry text.
No Carrier logout effect. No response/payload/token logging. Native button trigger
with expanded/controls and existing accessible label; labelled nonmodal region,
no role=menu or trap. useDismissable outside policy does not steal outside focus;
Escape restores trigger. Pathname change closes disclosure. Header layout is not
changed. Visible focus, non-color accessibility and reduced motion preserved.

## 9. Compatibility and scoped styling decision

No backend/OpenAPI/SDK/schema/migration/dependency changes. Existing logout smoke
selectors retained. Shared control default sizes and styles unchanged.

User's Account-specific gray/rose menu appearance requires scoped semantic color
states because existing Button variants contain no red logout appearance. This
is an explicit local appearance contract, not a global form-control override:
retain shared size/focus/disabled/transition, use pressEffect none, scoped item
colors/background/radius, content font12 and decorative icon16. Add only actual
missing rose600/rose50 foundation plus account semantic logout/hover/avatar/icon
roles; do not redefine global avatar24, text-muted, status-error or other consumers.
Local panel width256 is geometry, not a new single-use global layout token.

## 10. Verification-first and test-first plan

1. RED actual rendered account identity/subtitle/three-entry/no fake data tests;
   use existing SSR loader and a narrow presentation composition seam if needed,
   not test-only production flags. Route absence/correct disabled semantics checked.
2. Actual compiled TSX/CSS browser tests for disclosure and geometry at1440x900,
   1280x800,1024x768,768x1024,390x844,375x812, long username, keyboard/focus/outside,
   real hover, neutral subtitle, row count, disabled entries/no404/no extra APIs.
3. CDP interception only for explicit synthetic delayed/failed logout fixture:
   real handler/loading/single-flight/error/retry, no redirect on failure; restore
   interception and execute actual ADMIN/OPERATOR logout and verify session401.
4. Capture closed/open/focused/loading/error/narrow; direct ZIP source rendering
   and same-state comparisons of intended subset, document mock-data/excluded-row
   differences; never infer visual PASS from SSR classes alone.
5. Frozen install, format/lint/docs/preflight/typecheck/test/build; genuine Docker
   quality/runtime/Customer/Retail/Auth/MFA, final-head hosted Preflight/Foundation,
   artifacts/source SHA/steps/logs reviewed. No user volume reset.
6. Three independent review rounds: architecture/security; visual/interaction;
   final exact-head regression/evidence. Preserve failures and scope-bound fixes.

## 11. Governance and delivery

Record task032 before code, raw snapshot digest in task/PR, no owner attestation
needed. New Draft PR into latest main; focused commits, no PR29 mutation, no merge.
Task stays active until mandatory evidence is satisfied. Final SHA/CI metadata may
be reconciled in PR to avoid self-referential documentation commits.

## 12. Plan issues and resolved implementation clarifications

NONE unresolved. Shared40 trigger/default32 rows deliberately reconcile avatar32
with canonical controls instead of ZIP's arbitrary42px trigger. Icon16/content12
and scoped gray/rose states are explicitly requested Account appearance; shared
control sizing/security preserved and canonical design-system updated. Both route
entries intentionally planned because no implemented UI exists at reviewed main.
