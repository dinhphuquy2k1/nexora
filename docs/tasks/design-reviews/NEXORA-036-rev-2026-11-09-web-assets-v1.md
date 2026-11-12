# NEXORA-036 — Web asset organization

Task ID: NEXORA-036
Classification: BOUNDED
Plan revision: rev-2026-11-09-web-assets-v1
Reviewed baseline: 8a427da2b916fdbb928aa6bd06d22792e23f8dbf
Branch: refactor/web-asset-organization

## Scope and selected design

Move the four existing Inter files from apps/web/app/fonts to
apps/web/assets/fonts using git mv. Preserve every byte of the WOFF2, OFL,
verification manifest and README. Change only the Root Layout localFont src,
three M1 test paths, two browser fixture source paths and canonical frontend
asset ownership documentation. No other assets move and no empty directories.

Next.js 16.3.8's installed app font guide and font API specify src relative to
the calling file and permit source fonts outside app. Keep next/font/local,
--font-inter, swap and weight100–900; leave HTML, metadata and all CSS unchanged.

## Read-only inventory

| Resource                                    | Current path                                                 | Consumers                                               | Target path            | Required change                                |
| ------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------- | ---------------------- | ---------------------------------------------- |
| Inter binary, license, README, verification | apps/web/app/fonts/                                          | Root Layout; M1; Retail/Carrier browser fixture servers | apps/web/assets/fonts/ | Byte-identical directory move and active paths |
| Global CSS                                  | apps/web/app/styles.css                                      | Root Layout                                             | Same                   | None                                           |
| Tokens                                      | apps/web/styles/tokens.css                                   | Web and shared UI                                       | Same                   | None                                           |
| CSS Modules                                 | apps/web/components, features and packages/ui                | Respective owner                                        | Same                   | None                                           |
| Icons                                       | lucide-react imports                                         | Existing shell/features                                 | Same                   | No copied SVG or new registry                  |
| Other image/public assets                   | No additional tracked image/SVG assets found in Web/UI audit | Existing presentation                                   | Same                   | No speculative images/icons directories        |
| Docker artifacts                            | apps/web/Dockerfile; scripts/runtime-artifacts.mjs           | Next build, .next runtime output                        | Same                   | No hardcoded font-source path; do not change   |

Search scope: tracked apps/web, packages, scripts, docs and .github for app/fonts,
InterVariable.woff2, OFL.txt, verification.json, next/font/local, --font-inter,
relative fonts paths and asset extensions. Historical NEXORA-029/NEXORA-031
records establish Inter4.1/OFL/Vietnamese provenance and stay unchanged.

## Reuse and design audit

| Field                    | Font relocation                                                                                                               | Styling and runtime                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Component                | Existing local Inter asset and paths                                                                                          | Existing CSS ownership and Next bundling                                                        |
| Existing implementations | app/layout.tsx; app/fonts; test/m1-foundation.test.mjs; scripts/retail-browser-checks.mjs; scripts/carrier-browser-checks.mjs | app/styles.css; styles/tokens.css; colocated CSS Modules; Web Dockerfile; runtime-artifacts.mjs |
| Domain owner             | Web presentation source assets                                                                                                | Web/shared UI owner and Next build                                                              |
| Reuse alternatives       | Move intact; public URL; download/subset another copy                                                                         | Preserve bundling; add manual font COPY/asset registry                                          |
| Selected approach        | Move all four unchanged, update active references only                                                                        | Preserve existing CSS and artifact pipeline                                                     |
| Rationale                | Clear source ownership with identical visual input                                                                            | Smallest change, no parallel mechanism                                                          |
| Risks                    | Broken relative path, fixture404, altered bytes/provenance                                                                    | Missing runtime media, typography/geometry drift                                                |
| Verification             | Hash/byte comparison, M1 RED/GREEN, active-path audit                                                                         | Next production build, actual Chromium and final-head Foundation                                |

## Boundaries, alternatives and invariants

This is presentation resource organization, not a business Domain change; no new
Aggregate, VO, command, persistence or API is appropriate. No SDK/backend/DB/auth,
Carrier/Sync business logic, dependency, CSS/token, layout or deployment changes.
Reject public font URLs, duplicated fonts, new loaders/manifests/barrels and
empty images/icons directories. Public remains for stable public URL resources;
assets is source/bundled content. Future images/icons directories need real files.

Preserve source font SHA256
693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3
and compare all four files to baseline, not just mutable metadata. Preserve
Vietnamese coverage, variable weights, fixture /inter.woff2 route/MIME and all
existing browser assertions, geometry expectations and deadlines.

## Implementation and verification

1. Record task/reuse/snapshot and raw digest; verify structural governance.
2. Update M1 paths and assert new Root Layout src first; execute RED before move.
3. git mv directory; update only layout src and two fixture source paths; GREEN.
4. Update frontend.md's authoritative location and asset/style/public ownership.
   Design-system/testing ownership facts are otherwise unchanged; do not duplicate.
5. Verify all four byte identities, no old active references, unchanged CSS/UI/
   Docker/backend/SDK and preserved historical snapshots.
6. Run targeted M1, frozen install, host quality/build/contracts, actual browser
   checks and final-head hosted Preflight/Foundation. Local full Docker builds may
   be resource constrained; never replace their evidence with host-only results.
7. Three independent review rounds: scope/structure, runtime/visual evidence,
   final PR/CI. Fix only confirmed in-scope findings. Preserve FAIL history.
8. Commit/push focused changes, new PR base main; no merge/deploy. Draft if gates
   remain open. Reconcile final-head CI in PR metadata without SHA-only commits.

## Documentation Impact

Documentation Impact: REQUIRED

Canonical changed facts belong to docs/architecture/frontend.md. Task records
execution evidence; this versioned snapshot remains immutable. Owner approval
is not required by ADR-009. PLAN ISSUES: NONE.
