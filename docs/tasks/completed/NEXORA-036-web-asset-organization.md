# NEXORA-036 — Web asset organization

Status: COMPLETED
Capability: IMPLEMENTED
Verification: VERIFIED

## Design Review & Reuse Decision

Task ID: NEXORA-036
Classification: BOUNDED
Plan revision: rev-2026-11-09-web-assets-v1
Design Snapshot: docs/tasks/design-reviews/NEXORA-036-rev-2026-11-09-web-assets-v1.md
Design SHA-256: 3d8327c68c71958871f68be2d025fb2a2b340462a72bdf58f5b554c779d58c2a
Reviewed baseline: 8a427da2b916fdbb928aa6bd06d22792e23f8dbf
Branch: refactor/web-asset-organization

Fresh origin/main includes merged PR35. The new branch was created from that
commit with a clean worktree; no changes from the previous feature branches were
included. NEXORA-036 was absent from repository task/design references before
creation. Pre-code independent scope review found no P1/P2; selected plan and
resource inventory are in the snapshot. No owner approval gate applies.

| Field                    | Decision                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Component                | Move existing four-file Inter directory and active source paths                                               |
| Existing implementations | apps/web/app/layout.tsx; app/fonts; test/m1-foundation.test.mjs; Retail/Carrier fixture font servers          |
| Domain owner             | Web presentation source assets; frontend.md is canonical structure owner                                      |
| Reuse alternatives       | Intact move versus public URL, duplicate font, new loader/registry                                            |
| Selected approach        | Preserve bytes and next/font/local; update paths only                                                         |
| Rationale                | Clear ownership, minimal diff and identical typography input                                                  |
| Risks                    | Relative-path errors, fixture404, runtime packaging or font/layout drift                                      |
| Verification             | Baseline hash/tests, RED/GREEN, four-file byte checks, full quality/build/browser and final-head hosted gates |

## Scope and acceptance

- [x] Move all four Inter files, exact baseline bytes, no duplicate font.
- [x] Root Layout source path only; variable/display/weight/layout unchanged.
- [x] M1 and Retail/Carrier fixture paths updated, assertions unchanged or stronger.
- [x] Global CSS, tokens, CSS Modules, UI, backend/SDK/DB and Docker unchanged.
- [x] No active old-path references; historical task/snapshot references preserved.
- [x] Canonical asset/style/public ownership documented, no empty directories.
- [ ] M1, full quality, production build and actual font/browser gates PASS.
- [ ] Three review rounds, final-head hosted Preflight/Foundation and new PR.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Inter source lives in assets/fonts, with unchanged local Next bundling. app owns
routes/global CSS, styles owns tokens, CSS Modules remain colocated, public owns
stable public URLs; future images/icons directories are created only as needed.

### Canonical owners

- docs/architecture/frontend.md

### Documentation verification

pnpm format:check, pnpm docs:check, pnpm preflight:check.

## Evidence

| Claim                               | Evidence                                                                                                         | Date       | Result |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Fresh baseline and clean new branch | git fetch origin main; base8a427da2b916fdbb928aa6bd06d22792e23f8dbf; git status clean before switch              | 2026-11-09 | PASS   |
| Baseline M1 assertions              | node --test apps/web/test/m1-foundation.test.mjs on base:2/2PASS,0skip; log outside Git                          | 2026-11-09 | PASS   |
| Baseline WOFF2 integrity            | sha256sum matches verification.json and expected693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3 | 2026-11-09 | PASS   |

Other baseline hashes: OFL262481e844521b326f5ecd053e59b98c8b2da78c8ee1bdbb6e8174305e54935a;
README a021d1644e65f52f3ca872a79f846d9504c06b360112bcf30933eb3e0a874692;
verification.json5939705cc9eb5722cc473a1ddf6830f83b1b79ec89e763982b9391390dfd83c7.

## Reviews and remaining gates

Pre-code read-only independent review: no P1/P2. Post-move scope, executed runtime/
visual evidence and final PR/CI rounds remain pending. Full Docker quality/runtime
must have actual evidence; no claim from YAML, historical CI or host tests alone.
No merge/deploy, font replacement, schema/API/business change or unrelated fix.

## Execution checkpoint — 2026-11-09

Source: plan HEAD565d391 plus task-owned implementation worktree; final-head
hosted evidence will be reconciled in PR metadata after the last commit.

| Claim                                   | Evidence                                                                                                                                                         | Date       | Result |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Test-first relocation contract RED      | node --test apps/web/test/m1-foundation.test.mjs before move:1PASS/1FAIL; new src assertion rejected old layout path                                             | 2026-11-09 | FAIL   |
| M1 GREEN after move                     | Same command2/2PASS,0skip; all prior license/hash/coverage/weight assertions retained                                                                            | 2026-11-09 | PASS   |
| Four-file integrity                     | Buffer.equals against base8a427da for all4files; manifest/hash equality; Git4renames100%                                                                         | 2026-11-09 | PASS   |
| Actual glyph coverage                   | native fc-scan charset contains all90 U+1EA0–U+1EF9 plus U+0110/U+0111                                                                                           | 2026-11-09 | PASS   |
| Frozen graph                            | pnpm10.34.6 install --frozen-lockfile on Node24.19.0                                                                                                             | 2026-11-09 | PASS   |
| Initial quality formatting              | pnpm quality stopped at longer Retail path formatting; only affected script formatted, no assertion change                                                       | 2026-11-09 | FAIL   |
| Full host quality rerun                 | API_INTERNAL_URL=http://127.0.0.1:4000 pnpm quality:610/610,0skip(132root/186API/254Web/32UI/6DB), typecheck/contracts/4builds PASS                              | 2026-11-09 | PASS   |
| Local Carrier Chromium fixture          | Existing actual compiled TSX/CSS fixture, full six-viewport/status/history/Sync checks PASS; owned browser/profile cleanup PASS                                  | 2026-11-09 | PASS   |
| Auxiliary local Retail Chromium fixture | Existing fixture-only runner failed RETAIL_COLUMNS_PRESET_DEFAULT: background rgb248/250/252 versus255/255/255; cause not attributed to font; owned cleanup PASS | 2026-11-09 | FAIL   |

The auxiliary Retail failure is not hidden or treated as a font defect. No CSS,
assertion, tolerance, selector or browser behavior was changed; only font paths
changed. Canonical hosted Retail/Carrier/M1/Customer browser gates remain required.
Independent post-move scope review reran M1:2/2PASS, validated all4byte identities,
immutable digest and absence of active old paths; no P1/P2. Runtime/evidence and
final PR reviews remain open. Full local Docker builds NOT RUN: approximately3GiB
available versus the documented20GiB requirement; actual hosted Docker/runtime
evidence is required, not inferred from host builds or prior runs.

## Auxiliary HTTP probe re-evaluation

After three unsuccessful local HTTP probe attempts, stopped and re-evaluated the
launcher/assumptions rather than changing product code. Initial root-CWD starts
failed next.config.ts relative module resolution; Web-CWD start reached HTTP200
but the auxiliary HTML-preload regex found no font link. This is not a proven
font/bundling defect. Compiled next-font-manifest.json maps Root Layout to emitted
static/media/0336a89fb4e7fc1d-s.p.woff2, whose actual bytes match the original font
hash. No production config, CSS, manifest or loader was changed.

Bounded verification re-plan: use the existing canonical start launcher and actual
emitted font manifest/CSS when probing source packaging; separately require real
M1/Customer/Retail/Carrier font/browser assertions in final-head Foundation. Do not
turn the failed auxiliary probe or Retail assertion into PASS. No new immutable
architecture revision is needed; only verification assumptions are corrected.

Evidence checkpoint 2026-11-09T02:45:31.089Z UTC, HEAD565d391 with the
recorded task-owned worktree; current mandatory runtime/hosted status remains open.

## Closure — 2026-11-12

Delivered by PR #36. Remaining final-head hosted verification is covered by a descendant hosted run.

| Claim                  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Date       | Result |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Merged to main         | PR #36, merge 606e1010ade882172b1d055f1d97e8b52497ddbd, 2026-11-09                                                                                                                                                                                                                                                                                                                                                                                                                                        | 2026-11-12 | PASS   |
| Descendant hosted gate | Foundation run [43246873727](https://github.com/dinhphuquy2k1/nexora/actions/runs/43246873727), job 131281781892, checkout merge 4682dd9f47d81a55a515be44ebca19a1afb8828d (main 3906f8243347fb7c697bf5f6949389c3a784a13d + c4caffe33768b14445863ba31d153e441633c8f8), which includes this task's merge: steps 4–10 PASS (Docker quality 640 ordinary + 133 PostgreSQL integration, M5, runtime/TTY/browser incl. Carrier six-viewport matrix, HTTPS/ingress/onboarding/restore, persistence, development) | 2026-11-12 | PASS   |
