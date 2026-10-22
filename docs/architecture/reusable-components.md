# Reusable Components Registry

This registry catalogues canonical, reusable technical components and shared vocabularies in Nexora, established per [ADR-009](../decisions/mandatory-pre-code-design-review.md). Before proposing or implementing new primitives, contributors must consult this inventory to avoid redundant implementations.

---

## 1. UUID Validator

- **Owner Path**: `apps/api/src/common/validation/uuid.ts`
- **Exported Contract**: `export function isUuid(value: unknown): value is string;`
- **Intended Consumers**: All API domain modules, application input validation boundaries, controller parameters, and service layers (e.g. Customer, Carrier, Identity, future Shipments).
- **Supported Behavior**:
  - Validates 8-4-4-4-12 hexadecimal groups.
  - Case-insensitive acceptance (matches both lowercase and uppercase hex characters).
  - Validates all standard UUID versions and variants without restriction.
  - Zero implicit trimming (leading or trailing whitespace returns `false`).
  - Pure type predicate (`value is string`).
- **Explicit Non-Goals**:
  - Does not generate UUIDs (UUID generation remains owned by PostgreSQL `gen_random_uuid()` or `node:crypto`).
  - Does not enforce domain-specific error mapping or lowercase normalization (callers perform their own domain error handling and `.toLowerCase()` where required).
- **Dependency Restrictions**: Strictly zero external dependencies. Pure TypeScript.
- **When to Reuse**: Whenever an API module needs to validate whether an unknown value or string conforms to the standard 8-4-4-4-12 UUID format.
- **When NOT to Reuse**: Do not use for non-standard IDs (e.g. ULID, NanoID, sequential integers).

---

## 2. Lowercase Hex64 Validator

- **Owner Path**: `apps/api/src/common/validation/hex.ts`
- **Exported Contract**: `export function isLowercaseHex64(value: unknown): value is string;`
- **Intended Consumers**: Identity token validation, setup links, MFA challenges, session tokens, and recovery code hashes.
- **Supported Behavior**:
  - Validates exactly 64 lowercase hexadecimal characters (`[0-9a-f]{64}`).
  - Case-sensitive (uppercase or mixed case returns `false`).
  - Zero implicit trimming.
  - Pure format validation.
- **Explicit Non-Goals**:
  - Does not perform cryptographic hashing (SHA-256 remains owned by `node:crypto`).
  - Does not enforce token expiration, replay protection, or authorization.
  - Does not conflate different business token lifecycles into a single type.
- **Dependency Restrictions**: Zero dependencies. Pure TypeScript.
- **When to Reuse**: Whenever validating strings that must be exactly 64-character lowercase hex digests (e.g. SHA-256 output).
- **When NOT to Reuse**: Do not use for generic hex strings of arbitrary length, case-insensitive hex, or token authorization logic.

---

## 3. PhoneNumber Value Object

- **Owner Path**: `apps/api/src/common/value-objects/phone-number.ts`
- **Exported Contract**:
  - `export class PhoneNumber`
  - `PhoneNumber.parse(value: unknown, defaultCountry?: CountryCode): PhoneNumber`
  - `phone.value: string` (immutable E.164 representation, e.g. `+84912345678`)
  - `phone.equals(other: unknown): boolean`
  - `export class InvalidPhoneNumberError extends Error`
- **Intended Consumers**: Customer domain, recipient address records, future Identity user contact, and future Shipment dispatch/recipient contacts.
- **Supported Behavior**:
  - E.164 normalization using pinned `libphonenumber-js/max`.
  - Telephone validity checks per country numbering plans.
  - Rejection of extensions (`phone.ext`).
  - Value-based equality (`.equals()`).
  - Immutable instance (`Object.freeze`).
  - Explicit default country context parameter for national number parsing (e.g. `"VN"`).
- **Explicit Non-Goals**:
  - Does not assume phone belongs to a Customer or enforce uniqueness.
  - Does not send SMS or OTP codes.
  - Does not throw domain-specific errors (throws `InvalidPhoneNumberError`).
  - Does not enforce raw input length limits (domain policy boundary handles raw length, e.g. Customer max 64).
- **Dependency Restrictions**: Limited to pinned `libphonenumber-js/max`. No NestJS, Prisma, or business domain imports.
- **When to Reuse**: Whenever parsing, validating, and normalizing telephone numbers to E.164 format across backend domains.
- **When NOT to Reuse**: Do not use in `@nexora/shared` (heavy phone metadata library is not browser-safe for frontend bundles).

---

## 4. CountryCode Value Object

- **Owner Path**: `apps/api/src/common/value-objects/country-code.ts`
- **Exported Contract**:
  - `export class CountryCode`
  - `CountryCode.parse(value: unknown): CountryCode`
  - `code.value: string` (immutable ISO 3166-1 alpha-2, e.g. `"VN"`, `"US"`)
  - `code.equals(other: unknown): boolean`
  - `export class InvalidCountryCodeError extends Error`
- **Intended Consumers**: Customer Address, Carrier routing, and future Shipment destination/origin countries.
- **Supported Behavior**:
  - ISO 3166-1 alpha-2 validation using pinned `i18n-iso-countries`.
  - Trimming and uppercase normalization (e.g. `" vn "` → `"VN"`).
  - Explicit exclusion of unrecognized code `"XK"`.
  - Immutable instance (`Object.freeze`).
  - Value-based equality (`.equals()`).
- **Explicit Non-Goals**:
  - Does not own address hierarchy, provinces, or postal codes.
  - Does not dictate default country policy (e.g. Customer address default `"VN"` remains Customer domain policy).
  - Does not couple postal country to telephone parsing country.
- **Dependency Restrictions**: Limited to pinned `i18n-iso-countries`. No NestJS, Prisma, or business domain imports.
- **When to Reuse**: Whenever validating ISO 3166-1 alpha-2 country codes across backend domains.
- **When NOT to Reuse**: Do not use for province, district, or ward level administrative boundaries.

---

## 5. Generic Safe HTTP Error Message

- **Owner Path**: `apps/api/src/common/http/error-messages.ts`
- **Exported Contract**: `export const GENERIC_ERROR_MESSAGE = "Không thể thực hiện yêu cầu";`
- **Intended Consumers**: All API domain error mappers (Customer, Identity, Carrier).
- **Supported Behavior**: Centralized Vietnamese safe generic error message string for public error envelopes.
- **Explicit Non-Goals**:
  - Does not define HTTP status codes (domains keep their own status code mapping).
  - Does not replace feature-local specific messages for domain conflicts (e.g. "Tên đăng nhập đã tồn tại", "Cần chuyển địa chỉ mặc định trước khi xóa").
- **Dependency Restrictions**: Zero dependencies. Pure string constant.
- **When to Reuse**: Whenever an API error mapper needs a safe generic message without exposing internal system details.
- **When NOT to Reuse**: Do not use when a specific, actionable business validation error message is required.

---

## 6. Shared CustomerStatus & Presentation Labels

- **Owner Path**:
  - Codes: `packages/shared/src/customer-status.ts`
  - Labels: `packages/shared/src/customer-status-labels.ts`
  - Barrel: `packages/shared/src/index.ts`
- **Exported Contract**:
  - `CustomerStatus = { ACTIVE: "ACTIVE", INACTIVE: "INACTIVE" } as const`
  - `type CustomerStatusCode = "ACTIVE" | "INACTIVE"`
  - `CustomerStatusLabelsVi: Record<CustomerStatusCode, string>`
- **Intended Consumers**:
  - `CustomerStatus` / `CustomerStatusCode`: API Domain `CustomerStatusVO`, API Presentation DTOs, Web frontend pages/components.
  - `CustomerStatusLabelsVi`: API Presentation presenter (`statusLabel` response property) and Web UI components.
- **Supported Behavior**:
  - Browser-safe, framework-independent, single source of truth for customer status codes and Vietnamese presentation labels.
  - Pure code leaf subpath allows backend Domain to import codes without loading presentation labels.
- **Explicit Non-Goals**:
  - Does not replace Domain `CustomerStatusVO` validation or Aggregate transition rules.
  - Does not permit Domain to import presentation labels.
- **Dependency Restrictions**: Zero dependencies. Browser-safe ESM and CommonJS exports.
- **When to Reuse**: Whenever API Presentation or Web frontend needs customer status codes or their display labels.
- **When NOT to Reuse**: Do not use in Domain business logic for display strings; Domain only uses codes.
