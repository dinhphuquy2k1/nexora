# Nexora Design System

This document owns shared frontend visual contracts. [Frontend architecture](frontend.md) owns routes/data/server boundaries, [Reusable Components](reusable-components.md) owns exported APIs and actual consumers, and [Project Rules](../ai/PROJECT_RULES.md) owns mandatory reuse. The approved [v3 design](../tasks/design-reviews/NEXORA-031-rev-2026-10-26-design-system-m2-v3.md) governs the migration; execution and remaining verification belong to [NEXORA-031](../tasks/active/NEXORA-031-full-frontend-migration.md).

## Ownership and token layers

Use existing Vanilla CSS Modules, local Inter and neutral @nexora/ui components. No duplicate UI library, feature-specific form defaults or unapproved dependencies. Theme source is apps/web/styles/tokens.css:

1. Foundation: existing palette, type10–24px, weights400–800, line heights1.2/1.35/1.5, spacing4/8/12/16/20/24/32, radii4/6/8/12/16/full and shadows.
2. Semantic: text/surface/border/focus/action/status roles, typography aliases and density/layout contracts. Equal current values do not make roles interchangeable.
3. Component: @nexora/ui maps public size tokens to private --\_control-\* values at the actual consumer. Private aliases are owned only by Controls.module.css, not root theme overrides or feature extension points.

## Controls and public APIs

| size                        | Height/min-height/interactive target | Inline padding | Icon | Checkbox indicator |
| --------------------------- | ------------------------------------ | -------------- | ---- | ------------------ |
| default, including omission | 32px                                 | 12px           | 14px | 16px               |
| medium                      | 40px                                 | 16px           | 16px | 18px               |
| large                       | 48px                                 | 20px           | 18px | 20px               |

Button, TextInput, Select, Textarea and Checkbox accept size="default"|"medium"|"large" and React19 native refs. Input/Select omit conflicting numeric native size; no current numeric-size consumer exists. All modules, including Login/MFA/Setup, use32px by default. No legacy44px fallback or Customer28px density. Decorative logos/avatars and container/navigation geometry have separate semantic roles.

```tsx
<Button>Thêm khách hàng</Button>
<TextInput size="medium" type="number" />
<Select size="large" aria-label="Lựa chọn" />
<Textarea rows={6} />
```

Button variants primary(default), secondary, ghost and emphasis share size/state/focus/disabled behavior. Labels stay single-line within the selected fixed height; consuming action/feedback groups wrap between controls rather than wrapping a label inside32px. icon gives a square target; consumers supply an accessible name. Real navigation stays a real Link; buttonClassName shares presentation with data-size without changing link semantics.

Textarea shares font, padding, radius and states, defaults rows3, honors explicit rows and vertical resize, and retains a multiline minimum; it is never forced to32px tall. Checkbox's label is the interactive target; indicator dimensions are separate. One-line native Input types reuse TextInput; no speculative DatePicker, Radio, Switch, Combobox or multi-select framework. Native multiple Select remains auto-height, not a32px listbox.

## Runtime override and migration

Authoritative public sizing points are --control-size-default/medium/large. --control-radius and --control-font-size remain public. State colors/focus tokens remain semantic public theme controls. Change a root size token to update that variant across actual compatible consumers; other variants retain their own size. Private mappings resolve at the control rather than inheriting a feature's shadowed defaults.

--control-height and old generic padding aliases are retired. Migrate theme overrides to the selected size token; remove feature-local control height/font/radius/padding declarations and direct button/input/select state overrides. Use explicit shared size/variant APIs. Feature CSS may own widths, positions and icon input padding, not shared height/min-height or hover/focus/disabled rules.

Tests assert32/40/48 as owner-defined acceptance values AND dynamically change public values to different measurements. Verify actual computed styles per consumer/variant, isolation, detached-consumer negatives and restoration of exact inline values/priorities plus computed baseline. Changing only test expectations cannot repair a hidden cascade defect.

## Typography, spacing and surfaces

| Role                             | Existing scale mapping               |
| -------------------------------- | ------------------------------------ |
| Page title                       | xl/bold/tight                        |
| Section heading                  | md/semibold/snug                     |
| Body / small body                | base/normal/normal; sm/normal/normal |
| Label / button label             | base/semibold/snug                   |
| Caption / table heading / status | sm with medium/semibold and snug     |

Semantic --type-\*-size aliases reference the existing scale, not a second font scale. Use canonical weight and line-height variables. Controls share --control-font-size; headings do not inherit control heights.

Use spacing2 for control gaps/field-label separation; spacing4 for form groups; toolbar padding3/gap2; surface standard padding6, compact4; table inline3/block2; dialog header/body/footer4; pagination3. Use root radius/shadow/border tokens; focus is a distinct role from border/error. Real local coordinates are allowed; arbitrary offsets that conceal a structural defect are not.

Panel/Card/Overlay/Drawer use semantic surface density, automatic content height and appropriate border/elevation. StatusBadge/Toast use semantic typography/padding and automatic height, not input-height constraints. Native Overlay remains the focus/top-layer/body-lock authority; no parallel trap.

## Colors and interaction

Text, surfaces, borders, focus and status tokens keep separate roles. Root palette is the only owner of raw colors; no app fallbacks. Documented standalone Panel/Badge fallbacks remain narrowly scoped. Existing primary keeps navy-on-bright-orange; emphasis selects white on accessible darker orange with a distinct hover surface, preserving Login/MFA color behavior. Customer visual migration and actual AA acceptance remain staged, not certified by these declarations.

Applicable states: default, genuine hover, focus-visible, pressed/selected, disabled, readonly, invalid and loading. Native Select has no invented readonly. Focus/invalid supersede hover. Disabled actions remain unavailable with truthful state; reduced-motion removes animation without removing readiness checks. Icons/text must meet relevant contrast on final composed backgrounds; inactive controls are identified as such rather than misreported as enabled contrast PASS.

All default targets are32px, above WCAG2.2 target24px; validate spacing and real hit testing, not only visual icon dimensions. Maintain labels, native keyboard behavior, modal containment/Escape/return focus, font glyphs and no page-level horizontal overflow. A focused scroll region retains a clear focus-visible outline; never remove keyboard access merely to improve a screenshot.

## Shared workspace and asynchronous feedback migration

Keyed read/statistics retention, nine-column colgroup/Skeleton and modal-aware Toast are implemented in v3 stages2–4; browser verification remains pending. Standard/wide frame migration is implemented in stage5; final browser geometry remains required. Source implementation is not runtime PASS. Do not create LayoutProvider/global state manager, Customer-only Toast or stats hook/request.

The frame contract uses the same Header/content inline gutters24 desktop/16≤900/12≤600, standard max-width1600 including gutters and wide unrestricted; preserve sidebar240/72, Header56 and SSR/mobile behavior. Customer owns column geometry and backend-field truth; shared UI owns generic interaction. Exact backend row/address/status/session rules remain outside this document.

## Reuse, policy and verification

Before any UI change inspect this document and the registry, search actual consumers and choose reuse. Changes to shared defaults require consumer impact and regression verification. Extend the existing CSS declaration/context parser rather than regex-only policy or blanket exceptions. Enforce token existence/cycles/semantic roles, legitimate component mappings and no feature-shadowed public sizes; include negative and valid-future-module tests. No new Python tooling.

Use native Node discovery and existing Chromium CDP session. Test three sizes/omission, type/ref compatibility, native fields, multiline/checkbox behavior, real pointer/keyboard states, public overrides and negative contrast/ownership cases. Full quality/contracts/build/genuine Docker/API/DB/MFA/runtime/HTTPS/data/dev and final-head hosted evidence remain mandatory. Visual acceptance requires opening actual images and DOM measurements at the ten approved viewports, with source/merge lineage and explicit reference differences. Unit or overflow PASS is insufficient.

Exceptions need a concrete consumer/rationale, owner/path, compatibility impact, tests and approved design delta where material. Do not edit approved snapshots. Rollback uses focused source/test/doc commits together, never security assertions, keys or data resets. Current stage outcomes and failures are recorded in task031 and PR28.

### Shared Toast and asynchronous outcomes

ToastProvider/useToast/Toast/ToastViewport are neutral UI exports. Workspace owner-keyed provider keeps one bounded/deduplicated queue (3 visible/6 queued), safe text, explicit dismissal, persistent errors and pausable success timers. An open native Overlay registers the sole active viewport so notifications remain inside its top-layer/inert boundary; no provider preserves existing Overlay behavior. Toast does not steal focus. Modal notification placement, pointer/keyboard dismissal, timers and session cleanup require actual browser acceptance.

Customer List/Detail/forms classify API errors with their existing safe mapper and preserve essential inline descriptions. Toast announces API errors once; inline Feedback uses a non-live data-customer-error marker when already announced. Browser gates still assert surface errors and, in API negative cases, an actual error Toast; persistent historical Toasts do not make an otherwise settled surface erroneous.401 clears retained rows/stats/dialogs/notifications before redirect; generic denial stays latched through failed refresh until accepted success. Power uses a synchronous table-wide gate, not React state as a lock; confirmed write and read reconciliation have separate outcomes and Retry.

### Workspace frame implementation (v3 stage 5)

Canonical navigation metadata supplies `contentVariant`: Customer list/detail use
`wide`; Overview/System/Settings use `standard`. Resolution uses the longest available
ancestor and rejects prefix near-matches. Unknown routes fall back to standard.
`WorkspaceFrame.module.css` owns both Header inner and main frames, centered at
1600px including gutters for standard, unlimited for wide. Root gutter tokens are
24px desktop, 16px at ≤900px and 12px at ≤600px. MainWrapper owns vertical scrolling,
so its scrollbar reduces both frames together; Header remains sticky at 56px.
Customer no longer selects padding through a pathname-specific CSS class. Sidebar
widths/breakpoints and mobile Overlay behavior remain the existing contract.
Browser geometry across variants and Sidebar states remains required evidence.

### Customer emphasis and Panel composition (v3 stage 6)

Customer Create, selected tabs, selected pagination and primary drawer/confirmation
controls use shared `emphasis` (dark orange/white); Login/MFA keep default primary.
Selected count/dot colors follow emphasis foreground rather than the legacy navy
accent foreground. Actual composed-color, hover and focus measurements are still
required; palette calculations alone are not browser evidence.

Panel accepts existing title/children/className plus optional `density` and `actions`.
`standard` remains the default; `compact` uses the shared compact surface spacing
and heading divider, without outer margin. Customer profile and address sections
consume this shared composition; their duplicate card/heading paint was removed.
The search field advertises only name/code/phone. Exact phone uses a secondary native
filter disclosure and the existing URL/query contract, without another API.

Disabled Input/Textarea presentation takes precedence when readonly and invalid are
also present; those enabled-state rules exclude :disabled. Genuine state probes
wait real CSS transitions, verify focus/invalid-focus distinction and compare the
combined disabled presentation, restoring native attributes/focus afterward.

Fixed-column Customer name/email text wraps within the column and retains complete
DOM text plus keyboard Detail links; it cannot paint over neighboring columns.
The same native colgroup owns row/Skeleton/header widths. Browser Range checks
validate both padded header text and actual data-cell content, including long fixtures.

Pending/inactive status text uses its semantic pending foreground mapped to gray700,
including the decorative dot. The previous muted gray500 against pending background
was4.14:1 and failed normal-text AA; root palette calculation and genuine status/count
composed-color probes enforce4.5. Active semantics remain unchanged.

Retained Customer statistics keep fresh/stale/unavailable metadata without adding
visible stale text to the tabbar. Tab contents remain geometrically identical on
same-scope refresh; sr-only status and existing table/Toast errors communicate
loading or failed reconciliation. Counts remain backend-authoritative and cannot
cross owner/search/phone scope. An ambiguous Power response does not establish
write failure: retain the table gate through authoritative GET settlement, block
on read failure and offer GET-only reconciliation rather than repeating PATCH.
