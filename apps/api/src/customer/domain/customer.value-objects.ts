import { parsePhoneNumberWithError } from "libphonenumber-js/max";
import { isValid as isCountry } from "i18n-iso-countries";
import { z } from "zod";
import {
  invalid,
  CustomerStatus,
  type CustomerFields,
  type CustomerPatch,
  type AddressFields,
  type AddressCreate,
} from "./customer";

export function text(value: unknown, max: number): string {
  if (typeof value !== "string") invalid();
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) invalid();
  return trimmed;
}
function nullable(value: unknown, max: number): string | null {
  return value === null ? null : text(value, max);
}
function object(value: unknown): asserts value is object {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
}
export class PhoneNumber {
  private constructor(readonly value: string) {
    Object.freeze(this);
  }
  static create(value: unknown): PhoneNumber {
    const input = text(value, 64);
    try {
      const phone = parsePhoneNumberWithError(input, {
        defaultCountry: "VN",
        extract: false,
      });
      if (!phone.isValid() || phone.ext) invalid();
      return new PhoneNumber(phone.number);
    } catch {
      return invalid();
    }
  }
  equals(other: PhoneNumber): boolean {
    return this.value === other.value;
  }
}
export class CountryCode {
  private constructor(readonly value: string) {
    Object.freeze(this);
  }
  static create(value: unknown): CountryCode {
    const code = text(value, 2).toUpperCase();
    if (!/^[A-Z]{2}$/.test(code) || !isCountry(code) || code === "XK")
      invalid();
    return new CountryCode(code);
  }
  equals(other: CountryCode): boolean {
    return this.value === other.value;
  }
}
export function customerStatus(value: unknown): CustomerStatus {
  if (!Object.values(CustomerStatus).includes(value as CustomerStatus))
    invalid();
  return value as CustomerStatus;
}
export function normalizeProfilePatch(input: CustomerPatch): CustomerPatch {
  object(input);
  const out: CustomerPatch = {};
  if (Object.hasOwn(input, "name")) out.name = text(input.name, 200);
  if (Object.hasOwn(input, "phone"))
    out.phone = PhoneNumber.create(input.phone).value;
  if (Object.hasOwn(input, "email")) {
    out.email = nullable(input.email, 254);
    if (out.email !== null && !z.email().safeParse(out.email).success)
      invalid();
  }
  if (Object.hasOwn(input, "note")) out.note = nullable(input.note, 5000);
  if (Object.hasOwn(input, "status")) out.status = customerStatus(input.status);
  if (!Object.keys(out).length) invalid();
  return out;
}
export function normalizeCustomerFields(input: CustomerFields): CustomerFields {
  object(input);
  if (
    !Object.hasOwn(input, "name") ||
    !Object.hasOwn(input, "phone") ||
    Object.hasOwn(input, "status")
  )
    invalid();
  return normalizeProfilePatch(input) as CustomerFields;
}
export function normalizeAddressPatch(
  input: Partial<AddressFields>,
): Partial<AddressFields> {
  object(input);
  const out: Partial<AddressFields> = {};
  if (Object.hasOwn(input, "label")) out.label = nullable(input.label, 100);
  if (Object.hasOwn(input, "recipientName"))
    out.recipientName = text(input.recipientName, 200);
  if (Object.hasOwn(input, "recipientPhone"))
    out.recipientPhone = PhoneNumber.create(input.recipientPhone).value;
  if (Object.hasOwn(input, "countryCode"))
    out.countryCode = CountryCode.create(input.countryCode).value;
  if (Object.hasOwn(input, "addressText"))
    out.addressText = text(input.addressText, 2000);
  if (!Object.keys(out).length) invalid();
  return out;
}
export function normalizeAddressCreate(
  input: AddressCreate,
  fallback: Pick<CustomerFields, "name" | "phone">,
): AddressFields;
export function normalizeAddressCreate(
  input: AddressCreate,
  fallback?: Pick<CustomerFields, "name" | "phone">,
): AddressCreate;
export function normalizeAddressCreate(
  input: AddressCreate,
  fallback?: Pick<CustomerFields, "name" | "phone">,
): AddressCreate {
  object(input);
  if (!Object.hasOwn(input, "addressText")) invalid();
  const out: AddressCreate = {
    label: null,
    countryCode: "VN",
    addressText: text(input.addressText, 2000),
  };
  if (fallback) {
    out.recipientName = fallback.name;
    out.recipientPhone = fallback.phone;
  }
  return { ...out, ...normalizeAddressPatch(input) };
}
