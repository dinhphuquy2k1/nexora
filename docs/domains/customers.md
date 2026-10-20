# Customer Management Backend V1

Backend: IMPLEMENTED. Frontend: PLANNED. Verification and remaining gates are tracked in [NEXORA-027](../tasks/active/NEXORA-027-customer-management-backend.md); implementation is not a claim that mandatory runtime checks passed. Shipment management remains PLANNED. No shipment snapshots, portal, export, employee, Workspace, Shop, membership or synchronization is added.

## Ownership and identity

A Customer belongs directly to one existing Nexora user. `resolveCustomerOwner(actor)` currently returns only the authenticated actor.id. Creation sets owner and creator to that actor in the infrastructure transaction. Neither field nor customer code/status is accepted at creation. ADMIN has no cross-owner Customer access; both roles manage their own records. Customer identity is not an application login, user account or Carrier connection. Carrier ownership/authorization is unchanged.

Two independent owners may store the same phone. Within one owner, the E.164-normalized phone is unique even when one input is0912345678 and another is+84912345678. Name/email are not unique. Code is globally unique, sequence-generated KH000001 with minimum-six digits, grows beyond KH999999 and permits rollback gaps; it is never a per-owner counter or client input. No Customer DELETE API exists; INACTIVE preserves the record/addresses and remains readable/editable. Future Shipment rules for INACTIVE customers are undecided.

## Validation

Phone parsing uses pinned libphonenumber-js1.13.15/max, VN for national inputs, explicit international numbers supported; invalid numbers/extensions rejected and recipients normalized independently. Postal country is independent of the phone's national default. ISO3166-1 alpha-2 is validated with pinned i18n-iso-countries7.14.0, excluding its non-ISO XK extension; trim/uppercase, default VN. No geopolitical/province/ward model is introduced.

Trimmed lengths: name/recipientName1..200, label1..100, addressText1..2000, email1..254, note1..5000; raw phone input1..64 before parsing, persisted E.164 at most16. Email uses the existing Zod email validator. Nullable email/note and address label accept null (including PATCH clearing); null/blank required fields, extensions, invalid status/UUID and unknown/mass-assignment fields reject400. Empty PATCH rejects400. CustomerStatus is the domain-owned ACTIVE/INACTIVE as-const vocabulary with database CHECK; no enums.

## Recipient addresses

A customer has zero or more addresses, independent recipient name/phone and free-form full addressText. Omitted recipient values on create use the current customer values; later customer edits do not rewrite independent address snapshots. A first address is default. When adding after a default has been deleted and none exists, the newly added address becomes default; existing addresses are never silently promoted by deletion. No address-count limit is imposed.

Address PATCH cannot reassign customer or change isDefault. Dedicated default selection verifies the parent and address under one parent-row lock, clears/sets atomically and is idempotent if already selected. Every mutation first locks/rechecks ACTIVE actor, then owner-scoped customer, then addresses. Concurrent additions/default/deletion serialize on that parent; a partial unique index also enforces at most one default. Initial customer/address creation is one transaction. Owner/creator FKs RESTRICT user deletion; address FK cascades only if a Customer is deleted by authorized database maintenance in a future policy. No maintenance/delete API is introduced here.

For endpoint/pagination/error details see [API contract](../architecture/api-contract.md); physical sequence/grants/constraints belong to [Database](../architecture/database.md). No Customer PII is added to logs.
