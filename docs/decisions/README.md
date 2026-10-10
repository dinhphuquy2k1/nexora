# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for Nexora. Durable architectural decisions are documented here; task records and PR descriptions reference these decisions rather than restating them.

## Accepted decisions

| Decision                                    | Title                                                                       | Date       | Status   |
| :------------------------------------------ | :-------------------------------------------------------------------------- | :--------- | :------- |
| [ADR-001](technology-baseline.md)           | Technology baseline & provenance                                            | 2026-10-09 | Accepted |
| [ADR-002](product-scope.md)                 | Product scope & domain boundaries                                           | 2026-10-09 | Accepted |
| [ADR-003](reference-architecture-policy.md) | Reference architecture & engineering governance policy                      | 2026-10-10 | Accepted |
| [ADR-004](per-app-docker-architecture.md)   | Per-application Docker architecture & shared BuildKit dependency foundation | 2026-10-10 | Accepted |

## Foundational architectural topics

- [Authentication & session boundaries](authentication.md)
- [API contract ownership & OpenAPI generation](contract-ownership.md)
- [Docker runtime modes & execution topology](docker-modes.md)
- [Local file storage & catalog persistence](storage.md)
