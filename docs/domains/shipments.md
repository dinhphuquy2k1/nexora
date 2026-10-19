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

## Retail presentation boundary — NEXORA-026

`/shipments/retail` and the Carrier metadata scope selector are IMPLEMENTED as UI presentation only. Shipment persistence, listing/search/filter/page/count endpoints, create, export and detail/history remain PLANNED. The route shows an explicit unsupported state and no fixture records. Unknown totals are not zero. Prototype status labels are disabled reference design, not canonical domain vocabulary; Kiện lẻ vs batch classification is not inferred from parcel count.

Next backend milestone must decide Shipment identity (not tracking number alone), explicit target connection for create, owner authorization and server scope/filter/pagination/count semantics; source versus normalized status, strict timestamp/date handling, decimal-string monetary fields with currency, detail/history and authorized export contracts. Then generate OpenAPI/SDK and replace unsupported presentation through reviewed server operations. No schema/API, fee formula, synchronization or live provider execution is introduced by this UI task.
