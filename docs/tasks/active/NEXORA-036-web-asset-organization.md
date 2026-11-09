# NEXORA-036 — Web asset organization

Status: PLANNED
Capability: PLANNED
Verification: NOT VERIFIED

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

- [ ] Move all four Inter files, exact baseline bytes, no duplicate font.
- [ ] Root Layout source path only; variable/display/weight/layout unchanged.
- [ ] M1 and Retail/Carrier fixture paths updated, assertions unchanged or stronger.
- [ ] Global CSS, tokens, CSS Modules, UI, backend/SDK/DB and Docker unchanged.
- [ ] No active old-path references; historical task/snapshot references preserved.
- [ ] Canonical asset/style/public ownership documented, no empty directories.
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
