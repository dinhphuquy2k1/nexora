import { CustomerStatusVO } from "./customer-status.vo";
import {
  customerRecord,
  CUSTOMER_PROFILE_FIELDS,
  CUSTOMER_PATCH_FIELDS,
  CUSTOMER_ADDRESS_FIELDS,
} from "./customer-command";
import { PhoneNumber as CommonPhoneNumber } from "../../common/value-objects/phone-number";
import { CountryCode as CommonCountryCode } from "../../common/value-objects/country-code";
import { z } from "zod";
import {
  invalid,
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
export class PhoneNumber {
  private constructor(readonly value: string) {
    Object.freeze(this);
  }
  static create(value: unknown): CommonPhoneNumber {
    const input = text(value, 64);
    try {
      return CommonPhoneNumber.parse(input, "VN");
    } catch {
      return invalid();
    }
  }
}
export class CountryCode {
  private constructor(readonly value: string) {
    Object.freeze(this);
  }
  static create(value: unknown): CommonCountryCode {
    const code = text(value, 2);
    try {
      return CommonCountryCode.parse(code);
    } catch {
      return invalid();
    }
  }
}
export function normalizeProfilePatch(input: CustomerPatch): CustomerPatch {
  customerRecord(input, CUSTOMER_PATCH_FIELDS);
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
  if (Object.hasOwn(input, "status"))
    out.status = CustomerStatusVO.from(input.status).value;
  if (!Object.keys(out).length) invalid();
  return out;
}
export function normalizeCustomerFields(input: CustomerFields): CustomerFields {
  customerRecord(input, CUSTOMER_PROFILE_FIELDS);
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
  customerRecord(input, CUSTOMER_ADDRESS_FIELDS);
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
  customerRecord(input, CUSTOMER_ADDRESS_FIELDS);
  if (!Object.hasOwn(input, "addressText")) invalid();
  const out: AddressCreate = {
    label: null,
    countryCode: "VN",
    addressText: input.addressText,
  };
  if (fallback) {
    out.recipientName = fallback.name;
    out.recipientPhone = fallback.phone;
  }
  return { ...out, ...normalizeAddressPatch(input) };
}
