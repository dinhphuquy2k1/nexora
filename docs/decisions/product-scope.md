# ADR-002 · Product scope & domain boundaries

Accepted 2026-10-09.

## 1. Domain ownership

Nexora is an independent shipment management application. Nexora owns the **Shipment** domain.
Planned domain capabilities include:

- Customer management
- Shipment management
- Tracking numbers and status history
- Weights and estimated fees
- Shipment search, filtering, and pagination
- Manual data entry
- Authorized Excel/file imports
- Operational analytics and metrics
- Conditional external logistics provider integration and synchronization

No shipment business tables or CRUD endpoints are implemented in foundation v0.1.0 (infrastructure only). Nexora must remain fully operable without an external logistics provider.

## 2. Provider integration feasibility requirements

Before building any external logistics provider adapter, an authorized review must investigate:

1. **Provider identity & legality**: Official corporate identity and provider terms of service.
2. **Authorized API availability**: Availability of official, published, and contractually authorized developer APIs.
3. **Integration permissions**: Explicit contractual permissions for programmatic data retrieval and storage.
4. **Authentication lifecycle**: Token lifetimes, refresh flows, and credential rotation mechanisms.
5. **Token handling & storage**: Secure, server-side encrypted credential storage. Never commit or log credentials.
6. **Rate limits & quotas**: Enforced query rates, burst tolerances, and backoff expectations.
7. **Available schema**: Available fields, data types, and status mapping compatibility.
8. **Pagination & retrieval constraints**: Bulk vs single-item queries, date range limits.
9. **Permitted data storage & retention**: Terms governing long-term persistence and caching of provider tracking events.

**Non-negotiable rule**: Never bypass MFA, CAPTCHA, web anti-scraping protections, or reverse-engineer unauthorized private mobile/web APIs. If official authorized APIs do not exist or are denied, provider integration will not be built; Nexora will operate exclusively via manual entry and authorized file imports.

## 3. Identity boundaries

1. **Nexora local authentication session**: Governs user access to the local Nexora application, UI, and internal APIs.
2. **External provider session / integration**: Governs programmatic machine-to-machine integration with external logistics providers.
   These two identity concepts are logically and architecturally distinct. External provider tokens must never serve as application session tokens, and provider authentication must pass through the trusted server-side adapter before Nexora issues a session. Local ADMIN authentication is implemented under [ADR-005](authentication.md); preregistered OPERATOR authentication is implemented and mock-tested under NEXORA-012. Live-provider verification and shipment integration remain deferred.

## 4. Synchronization architecture

Future data synchronization must follow a one-way pipeline:
`Provider → Infrastructure Adapter → Normalize → Validate → Synchronize Service → Nexora Database`

1. External provider data structures must never dictate Nexora's internal domain entity definitions.
2. The infrastructure adapter normalizes external payloads into internal domain commands.
3. The synchronization service validates domain invariants before persisting to PostgreSQL.
4. Manual entry and Excel import share the same validation pipeline.

## 5. Nexora–Lyra project separation

- **Nexora**: Authoritative owner of shipment records, tracking events, parcel metadata, and client shipments.
- **Lyra**: Authoritative owner of carrier invoice freight statement reconciliation and dispute auditing.
- **Independence**: Nexora and Lyra have completely isolated source trees, Docker projects, database clusters, volumes, and ports. Neither project imports or executes the other at runtime.
- **Future interoperability**: If Nexora and Lyra exchange data in the future, integration will occur via versioned, immutable Shipment snapshot exports over an explicit external contract (e.g. signed JSON/XLSX export/import), never via shared databases, shared network namespaces, or direct internal API coupling.

## Unified identity amendment

[Unified identity](unified-identity.md) defines implemented local ADMIN and preregistered OPERATOR access through independent Nexora sessions. The provider authentication port/adapter and local mock-tested Login are implemented; provider tokens remain separate from application sessions and are not persisted. On 2026-10-13 the owner confirmed Uniship API integration permission and approved `userid` identity mapping. Missing permission and userid semantics are not unresolved blockers for this scope. Real Uniship authentication remains technically unverified; `UNISHIP_LIVE_AUTHORIZED` is an explicit deployment switch, default `false`. Broader rights to retain provider tokens, customer profiles or shipment data are not established by that confirmation and remain outside this milestone. General feasibility requirements still apply to future shipment synchronization and other providers.
