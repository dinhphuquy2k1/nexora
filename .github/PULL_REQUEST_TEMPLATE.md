## Pull Request Preflight

- **Task Reference**: `<e.g. docs/tasks/active/NEXORA-027-customer-management-backend.md>`
- **Design Review & Reuse Audit**: `<Path to review artifact or task section>`
- **Approval Evidence**: `<Decision reference, owner comment/PR review, or directive>`
- **Task Classification**: `[ ] BOUNDED  [ ] SIGNIFICANT  [ ] SPIKE`

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

<!-- Declare exactly one of REQUIRED or NONE -->

Documentation Impact: REQUIRED

### Changed facts

- `<Summary of changed facts>`

### Canonical owners updated

- `<Paths to updated canonical docs>`

### Documentation verification

- `pnpm docs:check`
