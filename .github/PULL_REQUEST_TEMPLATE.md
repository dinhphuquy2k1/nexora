## Pull Request Preflight

- **Task ID**: `<e.g. NEXORA-027>`
- **Task Reference**: `docs/tasks/active/<task-file>.md`
- **Task Classification**: `[ ] BOUNDED  [ ] SIGNIFICANT  [ ] SPIKE`
- **Plan revision**: `<e.g. rev-2026-10-21-reuse-v2>`
- **Design Review & Reuse Audit**: `<Path to task section or review artifact>`
- **Approval provenance**: `<Link to owner approval comment, review, or directive>`

---

## Changes Summary

- **Architecture & Domain Changes**:
  - `<Summary of domain/common architectural changes>`
- **Canonical Primitives Reused / Extracted**:
  - `<List of reusable components utilized or introduced>`
- **API & SDK Contract Impact**:
  - `<Zero drift or list of additive fields/endpoints>`

---

## Verification Evidence

| Claim         | Executed Command                                            | Result |
| :------------ | :---------------------------------------------------------- | :----- |
| `<Assertion>` | `<e.g. pnpm test, pnpm --filter @nexora/api test:customer>` | `PASS` |

---

## Documentation Impact

<!-- Select exactly one option matching the actual change scope: -->

- [ ] Documentation Impact: REQUIRED
- [ ] Documentation Impact: NONE

### Changed facts

- `<Summary of changed facts (if REQUIRED)>`

### Canonical owners updated

- `<Paths to updated canonical docs (if REQUIRED)>`

### Documentation verification

- `pnpm docs:check`
