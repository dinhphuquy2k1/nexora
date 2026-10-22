# NEXORA-027 immutable design snapshot — reuse-v2

Task ID: NEXORA-027
Plan revision: rev-2026-10-21-reuse-v2
Reviewed baseline: 4f93a74cfadbb89f71fa0b0feca8f83994f5bd86

## Provenance and objectives

Captured on 2026-10-22 from the owner's existing PR23 implementation specifications, NEXORA-027 Design Review & Reuse Decision, ADR-008 and ADR-009. This snapshot did not exist before the earlier implementation. The selected architecture was already directed by the owner; this newly pinned artifact requires a new real digest-bound GitHub attestation. It does not retroactively attest pre-code timing.

Complete Customer Backend V1 as the reference for Modular Monolith, Clean Architecture, Tactical DDD and Ports & Adapters, eliminate unnecessary repeated validation, and enforce truthful reusable-component/design governance. Implement directly on feat/customer-management-backend-v1 / PR23 under the existing task. Design approval, task lifecycle, code review, test success and merge approval remain distinct.

## Scope and existing components

Retain Customer Aggregate/Address entities, strict commands, owner-scoped transaction ports, status VO/shared status/label contracts and current eight APIs. Reuse existing preflight parser, task binding, independent GitHub review/comment retrieval, duplicate-validation guards, Agent Skills and CI modes rather than replacing them with a framework.

Canonical reusable components: common/validation/uuid.ts (8-4-4-4-12 case-insensitive groups, no trimming/version restriction); common/validation/hex.ts (lowercase hex64 format only); common/value-objects/phone-number.ts (immutable E.164 through pinned libphonenumber-js, explicit country context and neutral failure); common/value-objects/country-code.ts (ISO alpha-2, uppercase/trim, XK excluded, neutral failure); common/http/error-messages.ts (exact generic safe text). Shared owns CustomerStatus codes/derived type/exhaustive Vietnamese presentation labels; owning Domain retains CustomerStatusVO and business behavior.

## Ownership and reuse decisions

Neutral technical predicates/VO algorithms live in API common with no Nest/Prisma/domain-specific error dependency. Customer supplies raw phone limit64, national context VN, address country/default/fallback, strict field allowlists, owner-phone uniqueness and CustomerError translation. Identity retains entropy/hash/expiry/replay policies; Carrier retains epoch/lifecycle/secret handling. Similar locking/text syntax is not a shared business policy.

Use common primitives instead of duplicate regexes/third-party parsers; use pure Customer policy functions around neutral VOs instead of redundant wrapper classes. Keep feature-local exhaustive HTTP error maps and global ErrorFilter. Do not merge authorization or transaction semantics across modules. Shared is browser-safe; generated SDK owns HTTP types, not Backend Domain imports.

## Governance design and selected hardening

Keep one versioned Markdown snapshot per plan revision, with SHA-256 over raw UTF-8 bytes via Node crypto. Task/PR metadata binds exact Task ID, task filename, plan revision, snapshot reference and lowercase64 digest to recomputed bytes. Only authenticated authorized GitHub decisions matching task/revision/digest can verify approval. Mutable execution evidence belongs in task/PR and does not change this digest. Material design changes require a new revision/snapshot and renewed attestation; no silently rewritten approved artifact.

Use a standalone five-line NEXORA DESIGN APPROVAL block, ordered Task / Plan revision / Design SHA-256 / Decision. Permit LF/CRLF and outer whitespace only. Reject examples, quotes, fences, intervening prose, duplicate fields/blocks and malformed values. Preserve APPROVED, REVISION_REQUIRED, REVOKED. Authorized real login policy remains dinhphuquy2k1, never role labels/bots. Positive review requires actual APPROVED state; owner issue comments independently qualify. Only relevant formal decisions supersede; use reliable creation/submission and edit timestamps, fail closed on invalid/ambiguous ordering, and preserve later revocation/reapproval.

Task and snapshot references are repository-relative regular Markdown files under their governed active/design-reviews directories. Reject URL/absolute/traversal paths and symlinks at every component; verify physical containment with realpath/path.relative and read through checked canonical paths. Pure parsing/file validation stays separate from authenticated network access. No fabricated approval or transition bypass.

## Constraints, alternatives and non-goals

Selected: extend small existing checker using Node standard crypto/fs/path. Rejected: hash mutable task/PR text (invalidates evidence updates), trust matching agent-written hashes without GitHub (no independent authority), loose prose scanning (stitches unrelated text), string-prefix-only path checks (symlink escape), generic document/approval framework (unnecessary complexity).

No new dependency/service/ADR/task/PR; no Customer frontend, Shipment domain, metadata endpoint, dynamic statuses/i18n framework, generic DDD/UoW/events/CQRS framework, blanket Identity/Carrier DDD migration or Python launcher rewrite. No database/schema/migration/grant changes for this hardening. Do not weaken approval/runtime checks to produce green CI.

## Security, compatibility and risks

Keep actor ACTIVE recheck then owner-scoped Customer locks, minimal writes and DB-generated code/IDs/timestamps; no external I/O under locks. Keep session/Origin/MFA/no-store/error envelope and statuses, no ADMIN cross-owner access, initial/default/minimum address rules, recipient independence, legacy explicit Add/SetDefault repair and phone uniqueness. Shared status remains primitive ACTIVE/INACTIVE VARCHAR; required statusLabel is presentation-only on Customer Summary/Detail, never input/storage/Address field. Same-revision monorepo API/Web deployment is assumed. Preserve generated contracts and all current business assertions.

Risk mitigations: exact behavior regression for extracted validators; strict runtime mixed-field tests; label/SDK exhaustiveness; physical file-provenance and digest mutation tests; authenticated source/state/revocation/edit chronology negatives; local static mode never claims verified approval. Fail closed on missing credentials/API/event evidence. No arbitrary historical active-task exemption; completed historical records remain grandfathered. Pending tasks remain structurally representable.

## Acceptance and verification strategy

Test first: snapshot alteration invalidates old approval even at unchanged revision; task evidence-only edits do not; missing/malformed/conflicting digest/path/task/revision fails; strict formal grammar and edited revocation ordering; owned temporary symlink/file fixtures; authorized review/comment and CI fail-closed regressions; existing Skills/duplication guards retained. Static checks and PR implementation approval are distinct.

Run preflight tests/check, docs/tests, format/lint/lint tests/boundaries, typecheck, Customer/API tests, contracts and build/quality. Original genuine migrated PostgreSQL ownership/concurrency/rollback, provisioning/migration/drift, Docker quality, LOCAL/HTTPS/persistence/development smoke and both final-head hosted workflows remain mandatory. No historical/unit/native-SQL success substitutes for current runtime acceptance; report prerequisite failures honestly. Operator Data Audit decision remains a separate gate and no deployment dataset is certified. No public deployment/live Carrier, production DB fixtures, key/MFA reset or user-volume reset. Do not self-approve or merge.
