# NEXORA-037 — Global stylesheet organization

Task ID: NEXORA-037
Classification: BOUNDED
Plan revision: rev-2026-11-09-global-styles-v1
Reviewed baseline: 606e1010ade882172b1d055f1d97e8b52497ddbd
Branch: refactor/web-global-styles-organization

## Scope and selected design

Move apps/web/app/styles.css to apps/web/styles/globals.css with git mv. The
only CSS content change is first-line @import "../styles/tokens.css" becoming
@import "./tokens.css". Every subsequent byte, selector, declaration, specificity,
rule order, reset, typography, scrollbar and media query remains unchanged.

Change Root Layout's first import to ../styles/globals.css at the same position;
leave the rest of that file, including local Inter, unchanged. Update the Retail,
Carrier and Account fixture imports in place and the shared-ui test's read path.
Update only frontend.md's canonical Global CSS heading and ownership paragraph.
No other CSS, styling, component, data, event, screenshot or timeout changes.

## Read-only inventory and reuse audit

Search tracked apps/web, scripts, packages, .github and canonical docs for
app/styles.css, ./styles.css, ../../app/styles.css, ../styles/tokens.css and dynamic
CSS readers/scanners. Existing active consumers match Root Layout, three fixture
entries and shared-ui.test.mjs. Global CSS has exactly one relative reference,
the tokens import, and no url() paths. Existing policy scans all Web/UI CSS and
does not require an exclusion change. Docker/runtime artifacts have no hardcoded
source stylesheet path. Historical NEXORA-029/031/036 records stay unchanged.

| Field                    | Global stylesheet                                                     | Verification and ownership                                                                       |
| ------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Component                | Existing global stylesheet and imports                                | Existing shared-ui tests, CSS policy and browser gates                                           |
| Existing implementations | app/styles.css; app/layout.tsx; retail/carrier/account-entry.tsx      | test/shared-ui.test.mjs; form-control-contracts.test.mjs; existing fixture compiler; frontend.md |
| Domain owner             | Web global reset/typography/layout rules; styles owns source location | Web tests and frontend architecture                                                              |
| Reuse alternatives       | Move with one adjusted import; duplicate or split stylesheet          | Extend existing tests; new parser/hash-pinned CSS fixture                                        |
| Selected approach        | Single moved file, same import positions                              | Extend existing tests, one-off baseline byte/build equivalence and canonical browser tests       |
| Rationale                | Minimal diff, no cascade or semantic redesign                         | Real regression coverage without duplicate stylesheet/parser                                     |
| Risks                    | Broken token resolution or changed emitted CSS order                  | False PASS from stale build/browser evidence                                                     |
| Verification             | Compare all bytes except first import; check untouched files          | RED/GREEN, production CSS content/order, full quality and final-head hosted Foundation           |

## Boundaries and invariants

This is source organization, not a business Domain feature; no new Aggregate,
VO, application service or persistence is appropriate. No API/SDK/DB/auth,
Carrier/Sync, dependency, Docker, packages/ui, font, tokens or CSS Module changes.
Retain all current global classes, colors, dimensions, focus/hover states and
breakpoints; do not refactor their ownership. Keep tokens separate and loaded
once before reset/base/global/responsive rules. No provider or asset framework.

The original stylesheet SHA256 is
210da631277aff07d25525eeeb625d4a554188ed80dc5ca3563feabbc0c52732.
Source equivalence is verified against the Git baseline rather than a permanent
hash assertion that would obstruct future intentional stylesheet edits.

## Implementation and verification sequence

1. Record task, scope/reuse and this snapshot's raw SHA256; structural preflight.
2. Capture existing shared-ui/M1 results and a fresh baseline Next production
   build. Retain compiled CSS hashes and route entry CSS order outside Git.
3. Extend existing shared-ui assertions first: new file exists, old file absent,
   Root Layout has one Global CSS import, one leading local tokens import and
   unchanged negative internal-component checks. Execute RED before moving.
4. git mv and change only the authorized token/Root/fixture paths. GREEN targeted
   shared-ui/M1 and existing CSS policy/component tests; no new CSS parser.
5. Compare source bytes against baseline with exactly one first-line substitution;
   verify tokens/fonts/Modules/UI and remaining Root/fixture bytes unchanged.
6. Build production and compare emitted CSS content and ordered route CSS entries
   to the fresh baseline (source path descriptors may reflect the relocation).
   Investigate a difference before changing anything; never alter tokens to hide it.
7. Update frontend.md only. Frozen install; format/lint/typecheck/docs/preflight/
   contracts/quality, fixture compilation and genuine canonical browser gates.
   Local Docker builds may be resource constrained; hosted evidence is mandatory.
8. Three independent reviews: structure/scope, cascade/browser, final PR/CI.
   Focused commits, normal push and new PR base main. No merge/deployment.
   Preserve failures and reconcile final-head CI in PR metadata without SHA-only
   documentation commit loops. Keep Draft while mandatory gates remain open.

## Documentation Impact and governance

Documentation Impact: REQUIRED

Canonical changed facts belong to docs/architecture/frontend.md. Do not duplicate
policy across design-system/testing docs or rewrite historical snapshots. ADR-009
requires the recorded plan, not owner approval. PLAN ISSUES: NONE.
