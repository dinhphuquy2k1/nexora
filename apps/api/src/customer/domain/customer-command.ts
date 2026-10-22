import { invalid } from "./customer";

/** Runtime command allowlist shared by domain operations and application parsing. */
export function customerRecord(
  input: unknown,
  allowed: readonly string[],
): Record<string, unknown> {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
    Reflect.ownKeys(input).some(
      (key) => typeof key !== "string" || !allowed.includes(key),
    )
  )
    invalid();
  return input as Record<string, unknown>;
}
export const CUSTOMER_PROFILE_FIELDS = [
  "name",
  "phone",
  "email",
  "note",
] as const;
export const CUSTOMER_PATCH_FIELDS = [
  ...CUSTOMER_PROFILE_FIELDS,
  "status",
] as const;
export const CUSTOMER_ADDRESS_FIELDS = [
  "label",
  "recipientName",
  "recipientPhone",
  "countryCode",
  "addressText",
] as const;
