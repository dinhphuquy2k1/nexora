# ADR-008 · Tactical DDD for Nexora Business Domains

Status: Accepted. Date: 2026-10-21. Authority: explicit owner instruction in the Customer PR23 DDD scope amendment. This records the approved direction, not a claim that implementation/runtime verification passed. Historical accepted ADRs are unchanged.

## Context

Nexora is a modular monolith. Customer V1 previously combined request parsing, scalar validation and deletion policy in one domain file, while its adapter decided creation/default/fallback transitions. Database transactions were sound in design, but an anemic model made policy ownership hard to extend and test independently. New Shipment/Tracking/Freight Fee work needs a consistent domain design without microservices or speculative infrastructure.

## Decision and responsibilities

Adopt **Modular Monolith + Clean Architecture + Tactical DDD + Ports & Adapters**. Each new business-domain plan must identify ownership/ubiquitous language, module/context, aggregate consistency boundary, meaningful entity identity/lifecycle, value invariants, commands/use cases, ports/adapters, cross-domain dependencies and concurrency/testing strategy before implementation. Unresolved ownership/aggregate boundaries are PLAN ISSUES, resolved before writes.

- Domain owns business state, transitions, errors, invariants and policies. It imports no NestJS/Prisma/HTTP, application, infrastructure or presentation. Encapsulate entity collections and metadata; expose copies/read-only snapshots that cannot mutate internal state, including dates.
- Application resolves trusted actors, prepares strict commands and orchestrates use cases through ports; error mapping stays feature-local and exhaustive. No Prisma. Unknown faults retain the global ErrorFilter path.
- Infrastructure implements application ports, transactions/locks, hydration, scoped persistence, DB-generated UUID/code/timestamps, physical constraints and narrow persistence error classification. It supplies consistent locked facts to domain decisions; a transaction-dependent invariant still belongs to domain policy.
- Presentation owns routes/DTOs/guards/transport and delegates to application; no direct database/adapter access. Aggregates are neither API DTOs nor Prisma models.

Dependency direction: Presentation → Application → Domain; Infrastructure → Application port + Domain, with Prisma confined to Infrastructure. Composition root wires adapters. Existing pure cross-feature leaf vocabulary imports remain permitted when acyclic and ownership is explicit; no cross-domain repository writes or implicit shared kernel.

## Aggregate, repositories and concurrency

An aggregate is a business consistency boundary, not a substitute for PostgreSQL transactions. Keep actor/authorization recheck, owner-scoped parent lock, locked hydration, domain transition, minimal scoped persistence and commit in one transaction. Preserve database uniqueness/FKs and authoritative sequence semantics. Never hydrate for a write outside its transaction, use in-memory mutexes instead of row locks, perform external I/O under locks, or delete/reinsert an entire child collection to save state.

Prefer a small use-case port when it makes transaction ownership explicit. Generic save(aggregate), Unit of Work, BaseEntity/BaseAggregate, event bus, CQRS/Event Sourcing, shared-domain package or microservices are not required and need an evidenced separate decision. Value Objects are selected for real invariants (Customer PhoneNumber/CountryCode), not every primitive. One canonical implementation supplies value validation wherever invoked; request-shape/query parsing stays outside domain. Defensive domain validation must not become a divergent second algorithm.

Read-only list/search/pagination projections need not hydrate aggregates or child collections; retain ownership, filtering/order/count semantics. This is a read-model exception, not a CQRS framework.

## Customer reference and lifecycle-specific invariants

CustomerAggregate owns CustomerAddressEntity children, profile updates, add/update/remove/default decisions. Domain factory creates a valid draft with mandatory first/default address and recipient fallback; the DB supplies identities and timestamps. Draft/pending address identity is null, never a fabricated UUID/code. CustomerPort retains its use-case contract; the Prisma adapter hydrates after ACTIVE actor→Customer locks and applies only the approved operation's changed fields. Default flag writes clear then set within one transaction to preserve the partial unique index. GETs retain projections.

Rehydrate copies persisted scalars/cardinality without silently normalizing, repairing or rejecting all legacy zero/no-default records. New creation is strict. Explicit owner Add Address/Set Default performs the existing repair; ordinary edits do not fabricate addresses/defaults. Missing/foreign address precedes LAST then DEFAULT deletion errors. Multiple-default/broken-index incidents remain governed by the existing repair runbook. Snapshot copies preserve ownership/code and Date isolation. Domain timestamps do not pretend to replace DB-generated persisted timestamps.

## Applicability and exceptions

Mandatory for this Customer migration and business domains introduced afterward, including Shipment, Tracking and Freight Fee; their implementation is not authorized by this ADR. Pure query modules, stateless policies, infrastructure-only components or simple supporting capabilities may omit an aggregate when a rationale is explicit in the plan and reviewed; never silently omit modeling or create meaningless classes to satisfy a count.

Identity, Carrier, Health and Storage are grandfathered: no blanket refactor. Substantial new features in existing modules require Modeling Preflight and a scoped adoption/transition decision. This ADR does not change authentication, provider authorization, data ownership or security policy.

## Alternatives, trade-offs and rollout

Rejected: leave all decisions in services/adapters (weak domain ownership); framework-first DDD or microservices (unproven operational cost); generic full-aggregate persistence (stale/bulk-write risk); reject all imperfect historical records during hydration (prevents approved repair).

Costs: more explicit domain/application mapping and copies, full address hydration for mutations, and defensive validation calls through the same canonical functions. Benefits: isolated invariant tests, encapsulation and a reference boundary for future work. Read projections avoid list N+1/full hydration. Measure actual contention before changing GET locks or adding aggregate-count APIs.

Rollout in PR23 under NEXORA-027: domain tests first, model/input split, transactional adapter mapping, governance adoption, independent contract checks and genuine runtime verification. Existing infrastructure fixes/evidence remain separate. Architecture is accepted by owner; implementation/verification follow task lifecycle. Require aggregate/application tests, boundary/vocabulary checks, unchanged8 API/OpenAPI/SDK/schema/grants, real migrated Nest/PostgreSQL ownership/concurrency/rollback, canonical quality and mandatory runtime/hosted CI before readiness. Unit/native SQL/historical PASS cannot replace current genuine integration evidence.
