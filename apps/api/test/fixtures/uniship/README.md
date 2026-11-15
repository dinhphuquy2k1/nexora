# Uniship customer-portal fixtures (owner-captured)

Captured by the owner from browser DevTools on kh.uniship.vn on 2026-11-15
(~03:49–04:07 UTC, ~10:49–11:07 Asia/Ho_Chi_Minh). Tokens, cookies and request
headers were never included.

## transition-page.json

Source: GET /client/api/transition/?ecommerce=true&filter=<base64 {"filter":[{"column":"IsEcommerce","value":1,"condition":"equal"}]}>&page=1&rowsPerPage=15&q=
Real response; all fields, order and JSON value types kept (numbers stay numbers, e.g. 0.0, 3980; nulls stay null).
Redactions only:

- UID (real account id) -> 1000
- Username (real username) -> "redacted-user"
- CreatedBy (real username) -> "redacted-user"
- TransactionCode (real code) -> "md00001"

## china-stores.json

Source: GET /client/api/chinaStores/
Real response reduced to ID, Name, StoreType, CountryCode, IsHidden (values and JSON types kept, including trailing space in one Name and IsHidden null for ID 27).
Removed fields: Receiver, Phone, Address, Description, SoundFile, OrderIndex, Country, PlayOnSrc, PlayOnDes, ProductType, IsOfficial.
Envelope (status, message, total 24, offset, rowsPerPage 10000000, summary null) kept as received.

## Not captured

- GET /client/api/customers/{id}: owner personal data; intentionally excluded and not used for Shipment.

## transition-statuses.json

Synthetic cases derived from the captured transition row, not additional real
responses. Cases cover Status1,2,3,4,5,13,0,99; the claim case has OldStatus4.
Only ID (synthetic100001..100008), TransactionCode (md-derived-1..8), Status and
OldStatus change within each row. Every other field/value/type is copied. The
combined envelope has8 rows and a derived summary; the unknown99 contributes to
the all-record count but has no invented status-specific summary key.
Raw numeric spelling such as0.0 is retained in the derived source as well.

## Source byte integrity and formatting

Captured JSON files are copied verbatim from the owner's supplied redacted files.
They are fixture evidence, not proof of an enabled adapter or permission to call
any endpoint during tests. A fixture-local formatter override uses4-space JSON
indentation for only the two captured files, preserving key order, numeric spelling,
null values and the warehouse-name trailing space.

- transition-page.json SHA-256:
  b328f42ea39a2870623a7a1c28bc29b98ca6ae90f4690d9f06ba1cd6f4473a2c
- china-stores.json SHA-256:
  8fd8c076a0598b8c195eefcea8747cc463b10ec5fce0731043b1350ee59cccdf

The captured page size15 differs from the owner-confirmed supported request sizes50
and100. Future Shipment FULL paging selects100; no capture is rewritten to pretend
it used that size. The warehouse envelope's large rowsPerPage and null summary are
observed metadata, not a Nexora request-size policy. No additional raw capture for
each filtered status tab is retained here; those mappings are owner-confirmed
observations documented in the integration contract, and derived cases are tests.
