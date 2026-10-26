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

---

## 7. Canonical Form Control Primitives

- **Owner Path**:
  - Components: `packages/ui/src/Controls.tsx`
  - Styling: `packages/ui/src/Controls.module.css`
  - Barrel: `packages/ui/src/index.tsx`
- **Exported Contract**:
  - `export function Button(props: ButtonProps): JSX.Element`, extending native attributes with optional `variant: primary | secondary | ghost` and `icon: boolean`. Primary remains the default for Login/M1.
  - `export function TextInput(props: InputHTMLAttributes<HTMLInputElement>): JSX.Element`
  - `export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>): JSX.Element`
  - `export function Checkbox(props: CheckboxProps): JSX.Element`
  - `export function Select(props: SelectHTMLAttributes<HTMLSelectElement>): JSX.Element`
- **Intended & Active Consumers**:
  - Login (`LoginForm`), Setup (`SetupForm`), modal dialogs and Customer M2 forms/filters; future Settings forms.
- **Supported Behavior**:
  - **Canonical Sizing & Typography Contract**: `height: var(--control-height)` (default 32px), `border-radius: var(--control-radius)` (default 12px), `box-sizing: border-box`, and `font-size: var(--control-font-size)` (shared between `TextInput`, `Button`, and `Textarea` to ensure cohesive typography scaling).
  - **State Parity**: Complete contract covering default, hover, focus/focus-visible, disabled, readonly, invalid (`aria-invalid="true"`), and placeholder.
  - **State Precedence**: Focus and invalid states strictly override hover styling via `:not(:focus):not([aria-invalid="true"])`.
  - **Button Contrast (WCAG AA)**: Standardized to semantic foreground `--color-text-on-accent: var(--brand-navy, #172b4d)` text on orange `--color-accent: var(--brand-orange, #f58a24)` background (5.74:1 contrast ratio, exceeding WCAG AA 4.5:1 requirement). On hover (`--color-accent-hover`), enabled button transitions foreground to `--color-text-on-accent-hover` (4.58:1 contrast) with `color 0.15s ease`. Disabled button preserves `--control-disabled-text`. Verified on real rendered elements in genuine `:hover` state via CDP pointer dispatch, confirming `>= 4.5:1` ratio after transition completion (0.15s) and compositing. Negative accessibility regression tests prove that deliberate inaccessible contrast fails closed, and distinct foreground token overrides prove that hover resolves its dedicated foreground token rather than reusing default foreground.
  - **Textarea Parity**: Retained in `@nexora/ui` to guarantee domain-neutral form control contract parity with `TextInput`. Reuses identical colors, borders, radius, focus rings, disabled/readonly/invalid states, with default 88px min-height and vertical resize.
  - **Self-Contained Styling**: Owns all default control appearance in `Controls.module.css` through direct token consumption.
- **Styling / Token Dependencies**:
  - Sizing & Radius: `--control-size-default/medium/large`, `--control-radius`, `--control-padding-x`, `--control-padding-y`, `--control-font-size`.
  - Colors & States: `--control-bg`, `--control-bg-focus`, `--control-text`, `--control-placeholder`, `--control-border`, `--control-border-hover`, `--control-focus-border`, `--control-focus-ring`, `--control-disabled-bg`, `--control-disabled-text`, `--control-disabled-border`, `--control-readonly-bg`, `--control-invalid-border`, `--control-invalid-focus-ring`, `--color-accent`, `--color-accent-hover`, `--color-text-on-accent`, `--color-text-on-accent-hover`.
- **Fallback Policy**:
  - `apps/web`: Mandatory theme tokens guaranteed by root `tokens.css`; fallbacks in `apps/web` are prohibited.
  - `packages/ui`: Standardized on direct canonical token consumption (`var(--control-border)`). Standalone fallbacks are permitted only where an explicit standalone-consumer contract requires independent execution outside the Nexora theme.
  - Deeply nested fallback chains (e.g. `var(--a, var(--b, c))`) and repeating raw hex values solely to echo default theme tokens are forbidden.
- **Explicit Non-Goals**:
  - Does not manage form submission, data-binding, or validation logic. Consuming feature components handle validation.
  - Does not use `!important` or broad global selectors.
- **Native Select Contract (M2)**:
  - Standard established: `height: var(--control-height)`, identical borders, radius, background, and focus ring matching `TextInput`.
  - `Select` is exported from Controls.tsx and shares the input class/state tokens; actual consumers are Customer status/page-size/replacement filters. It is a native select, without a custom listbox or invented readonly state. Browser parity remains an executed acceptance gate.
- **When to Reuse**:
  - Whenever rendering standard text inputs, textareas, primary buttons, or checkboxes across web features.
- **When NOT to Reuse**:
  - Do not create duplicate local control styles or custom `<input>` styling in feature CSS Modules.
  - Do not render raw HTML `<button>` or `<input>` for primary form interactions.

---

## 8. Modal Dialog & Overlay Primitive

- **Owner Path**:
  - Component: `packages/ui/src/Overlay.tsx`
  - Styling: `packages/ui/src/Overlay.module.css`
  - Barrel: `packages/ui/src/index.tsx`
- **Exported Contract**:
  - `export function Overlay(props: OverlayProps): JSX.Element`
- **Intended Consumers**:
  - Mobile navigation drawer (`ShellClient`), Login help dialog (`LoginForm`), and future feature confirmation/modal dialogs.
- **Supported Behavior**:
  - Native HTML `<dialog>` with top-layer placement, background inerting, keyboard focus trapping, Escape key closing, backdrop click dismissal, and body overflow restoration on unmount. Optional `className` provides a neutral layout slot for Customer right-side form drawers; it does not replace native focus/close behavior.
- **Styling / Token Dependencies**:
  - Background & Elevation: `--color-surface`, `--color-border`, `--shadow-lg`, `--radius-lg`.
  - Backdrop: `rgb(15 23 42 / 55%)` (or `rgba(15, 23, 42, 0.55)`) applied strictly to `::backdrop` or `.overlay::backdrop`; compound selector lists containing non-backdrop elements are forbidden.
- **Fallback Policy**:
  - Standalone fallbacks are not permitted for Overlay; direct semantic token references are enforced.

- **Explicit Non-Goals**:
  - Does not replace lightweight popovers; popovers use `useDismissable` hook.
- **When to Reuse**:
  - Whenever modal dialogs, drawers, or alert overlays are required.
- **When NOT to Reuse**:
  - Do not use for lightweight dropdown menus or tooltips (use popover semantics via `useDismissable`).

---

## 9. Content Card Panel Primitive

- **Owner Path**:
  - Component: `packages/ui/src/Panel.tsx`
  - Styling: `packages/ui/src/Panel.module.css`
  - Barrel: `packages/ui/src/index.tsx`
- **Exported Contract**:
  - `export interface PanelProps { title: string; children: ReactNode; className?: string; }`
  - `export function Panel(props: PanelProps): JSX.Element`
- **Intended Consumers**:
  - Overview cards (`/`), System health status panels (`/system`), and Settings sections (`/settings`).
- **Supported Behavior**:
  - Semantic `<section>` container with consistent title typography (`<h2>`), internal padding, border, radius, and subtle elevation.
  - Scoped paragraph styling resets paragraph bottom margin on `:last-child`.
- **Styling / Token Dependencies**:
  - Background & Border: `--color-surface`, `--color-border`, `--color-primary`, `--radius-lg`, `--shadow-sm`.
- **Fallback Policy**:
  - Permitted standalone fallbacks matching root theme (`#ffffff`, `#e2e8f0`, `12px`).
- **When to Reuse**:
  - Whenever grouping related information or settings into a distinct content card across pages.
- **When NOT to Reuse**:
  - Do not use as a generic unstyled wrapper; use a layout `<div>` instead.

---

## 10. Status Indicator Badge Primitive

- **Owner Path**:
  - Component: `packages/ui/src/StatusBadge.tsx`
  - Resolver: `packages/ui/src/status-tone.ts`
  - Styling: `packages/ui/src/StatusBadge.module.css`
  - Barrel: `packages/ui/src/index.tsx`
- **Exported Contract**:
  - `export interface StatusBadgeProps { ok: boolean | null; children: ReactNode; className?: string; }`
  - `export function StatusBadge(props: StatusBadgeProps): JSX.Element`
  - `export function resolveStatusTone(ok: boolean | null): "good" | "bad" | "pending"`
- **Intended Consumers**:
  - System health indicators (`/system`), session connection badges, Customer M2 badges and future Shipment indicators.
- **Supported Behavior**:
  - Maps tri-state boolean (`true` -> `good`, `false` -> `bad`, `null` -> `pending`) to semantic status colors.
  - Renders inline-flex pill badge with uppercase styling, 12px font size, and full border radius.
- **Styling / Token Dependencies**:
  - Status tokens: `--color-status-success-*`, `--color-status-error-*`, `--color-status-pending-*`, `--radius-full`.
- **Fallback Policy**:
  - Permitted standalone fallbacks matching root semantic status colors.
- **When to Reuse**:
  - Whenever rendering tri-state health, connectivity, or operational readiness indicators.
- **When NOT to Reuse**:
  - Do not use for domain-specific multi-state business badges (e.g. Shipment tracking stages); use domain-specific tag components instead.

### Neutral action hierarchy (Customer M2 actual consumers)

Button primary(default)/secondary/ghost variants share control sizing/radius/font, focus ring and disabled behavior. Secondary uses surface/text/border semantic tokens; ghost uses transparent surface and semantic text; neither relies on feature CSS state overrides. `icon` makes width/min-width equal to control-height, retaining canonical hit target; consumers provide an accessible name. Actual consumers: Customer toolbar/reload/clear, segmented status, pagination, profile/address inline actions and drawer Cancel/Save. Input/Select/Textarea remain unchanged. New root semantic text-on-dark accent and accent-border tokens belong to dark brand icons/default-address emphasis, not interchangeable palette shortcuts. Genuine computed-style/contrast/token-override and M1/Login regression remain acceptance requirements.

### v3 shared control API migration

Controls export ControlSize(default|medium|large), typed native/ref props, ButtonVariant(primary|secondary|ghost|emphasis) and buttonClassName for real navigation presentation. Input/Select omit numeric native size; Textarea rows and native multiple Select retain multiline/auto-height. Private mappings belong only to Controls.module.css; feature sizing/state overrides are retired. [Design System](design-system.md) owns defaults/public runtime points and consumer migration. Existing Login/MFA/Setup, Header/account/notifications/mobile actions and Customer form/table/pagination consumers use default32. Historical44px/scoped compact guidance is superseded by approved v3; acceptance remains in task031.

## Shared Toast and modal viewport

Owner: packages/ui/src/Toast.tsx, toast-state.ts and Toast.module.css. Exports ToastProvider, useToast, ToastViewport, Toast and ToastMessage. Domain/transport-neutral bounded queue and live-region/dismissal/timeout behavior; actual consumers are Customer List/Detail read feedback and profile/address/default/delete/Power mutations. AppShell keys provider by verified user identity; native Overlay registers its optional active viewport. No API calls, Customer imports, raw HTML or browser persistence. See [Design System](design-system.md); static/SSR tests do not replace native dialog/focus/session/CDP acceptance.
