# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for Nexora. Durable architectural decisions are documented here; task records and PR descriptions reference these decisions rather than restating them.

## Accepted decisions

| Decision                                     | Title                                                                       | Date       | Status   |
| :------------------------------------------- | :-------------------------------------------------------------------------- | :--------- | :------- |
| [ADR-001](technology-baseline.md)            | Technology baseline & provenance                                            | 2026-10-09 | Accepted |
| [ADR-002](product-scope.md)                  | Product scope & domain boundaries                                           | 2026-10-09 | Accepted |
| [ADR-003](reference-architecture-policy.md)  | Reference architecture & engineering governance policy                      | 2026-10-10 | Accepted |
| [ADR-004](per-app-docker-architecture.md)    | Per-application Docker architecture & shared BuildKit dependency foundation | 2026-10-10 | Accepted |
| [ADR-006](scope-reduction-backup-restore.md) | Removal of custom Backup/Restore subsystem & test simplification            | 2026-10-13 | Accepted |
| [ADR-007](multi-carrier-architecture.md)     | Multi-Carrier Management, Security Architecture & Independent Identity      | 2026-10-14 | Accepted |

## Foundational architectural topics

- [Authentication & session boundaries](authentication.md)
- [API contract ownership & OpenAPI generation](contract-ownership.md)
- [Docker runtime modes & execution topology](docker-modes.md)
- [Local file storage & catalog persistence](storage.md)

## Accepted future direction

- [Multi-carrier management](multi-carrier-architecture.md) — accepted 2026-10-14; supersedes experimental provider login from [unified identity](unified-identity.md). Implementation follows the 6-PR plan (PR 1–4, 6, 7).
- [Unified identity foundation](unified-identity.md) — accepted 2026-10-12; Phase 1 users/credentials merged. Phase 2 provider login is superseded by ADR-007 and scheduled for complete elimination in PR 2.
