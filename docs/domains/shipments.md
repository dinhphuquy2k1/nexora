# Shipment domain notes

## Status

PLANNED: Not implemented in foundation v0.1.0. Foundation provides infrastructure, database catalog, local storage, API framework, and UI shell only.

## Planned capabilities

- **Customer management**: Basic customer profiles, sender/receiver contact information.
- **Shipment entity**: Tracking number, sender/recipient addresses, weights, parcel dimensions, declared value, estimated shipping fees, and lifecycle state (created, in transit, delivered, exception).
- **Tracking history**: Ordered timestamped events and carrier status updates.
- **Ingestion methods**: Manual operator entry via UI, authorized batch Excel (XLSX) imports via local file storage.
- **Provider synchronization**: Conditional adapter querying external carrier APIs only if official authorization and terms allow.
- **Analytics & search**: Full-text and identifier filtering, volume/fee summaries.

## Deferred decisions

- Shipment database table schema, indexes, and partition strategy (deferred to shipment domain milestone).
- Excel parser implementation and column mapping engine (deferred to ingestion milestone).
- Provider-specific adapter implementation (deferred pending provider API feasibility study).
- Multi-carrier connection management ([ADR-007](../decisions/multi-carrier-architecture.md)) provides on-demand carrier credentials and authentication without implementing shipment business tables, background workers, or automated synchronization loops.
