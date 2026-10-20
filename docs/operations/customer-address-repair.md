# Customer address integrity audit and controlled repair

This is a procedure for an authorized operator, not a claim that a deployment has been inspected or repaired. Customer API V1 now creates at least one address and exactly one default. Physical PostgreSQL constraints enforce FKs and **at most one** default only; existing zero-address/no-default data may remain. The PR workspace has no selected operator database/host credentials. Never certify historical data from an empty disposable database or native SQL fixtures.

## Read-only preflight

On the authorized environment, use an existing operator-provisioned read-only libpq service/credential profile (example service name nexora_customer_audit). Do not paste credentials/PII into terminal history, screenshots, PRs or logs. The script is explicitly REPEATABLE READ READ ONLY, emits aggregate counts and index metadata, and never changes data:

```sh
PGSERVICE=nexora_customer_audit psql -X -v ON_ERROR_STOP=1 -f packages/database/scripts/audit-customer-addresses.sql
```

Capture environment identifier, source SHA, UTC timestamp, aggregate counts and the index definition/indisvalid/indisready. Check exactly one valid, ready unique partial index on customer_id WHERE is_default=true. Missing/invalid index or multiple defaults is a schema integrity incident; normal application writes must pause for reviewed maintenance. The scripted audit does not invent a repair or leak names, phones, email, notes or address text.

For identifying records, an authorized owner/DBA may use a separate read-only query scoped to the verified owner's UUID and return only customer/address UUIDs and counts. Do not expose a global invalid-record inventory through a new API, or grant ADMIN cross-owner access. Agree the real address/desired default with the actual owner before mutation. Keep a protected pre-repair snapshot/backup under the existing deployment process and record approvals/custody separately from shared evidence.

## Owner-led repair through existing APIs

- Zero addresses: the owner supplies a real address via POST /api/customers/:id/addresses. Existing recipient fallback and phone validation apply; with no current default this newly supplied address becomes default. Never synthesize address text or copy another customer's address.
- Existing addresses but no default: the owner explicitly chooses one of their own addresses via PUT /api/customers/:id/default-address. No oldest/newest/arbitrary selection. Read the owner-scoped detail before/after and verify addressCount>=1, exactly one default and parent binding.
- Disabled/unavailable owner: coordinate through existing approved account/operations procedures; do not bypass SessionGuard, reset MFA or impersonate ownership in this feature.
- Valid profiles: to delete default A, explicitly select B first, then delete A. Last address deletion returns409 LAST_CUSTOMER_ADDRESS; default deletion with alternatives returns409 DEFAULT_ADDRESS_REASSIGN_REQUIRED. Missing/foreign child always returns404 first. Secondary deletion is allowed.

These are real API operations with the existing session and exact Origin policy. No provider authorization, key change, live Carrier traffic or public deployment is needed.

## Multiple defaults or broken index

A valid current partial unique index prevents multiple committed defaults. If an external/old schema lacks that guarantee, do not pretend a routine API call repaired it: selecting an already-default address is normally idempotent and may not clear anomalous extra defaults. Stop writers; obtain a separate reviewed DBA maintenance plan with the owner-chosen address, an isolated restore rehearsal and protected backup.

That plan must lock the owner user then the owner-scoped Customer, verify the chosen address belongs to it **before** any update, clear/set defaults atomically, assert exactly one default before commit, and restore the original approved unique partial index if absent/invalid. Abort on any mismatch or unexpected affected-row count. Re-run the read-only audit and genuine migration/drift/security tests before resuming writers. This document does not execute or authorize arbitrary production SQL/DDL, change historical migrations, add a migration/trigger, grant runtime DDL, delete Customer data or reset volumes.

Record before/after counts, chosen identifiers and approvals in restricted operations evidence; publish only sanitized summaries. This addresses address consistency, not every possible externally corrupted Customer field. No operator dataset has been certified by PR23's disposable tests.
