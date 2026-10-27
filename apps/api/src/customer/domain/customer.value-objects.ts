import { CustomerInputLimits, normalizeBoundedText } from "@nexora/shared";
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
  const normalized = normalizeBoundedText(value, max);
  if (normalized === null) invalid();
  return normalized;
}
function nullable(value: unknown, max: number): string | null {
  return value === null ? null : text(value, max);
}
export function parseCustomerPhone(value: unknown): CommonPhoneNumber {
  const input = text(value, CustomerInputLimits.PHONE_RAW);
  try {
    return CommonPhoneNumber.parse(input, "VN");
  } catch {
    return invalid();
  }
}

export function parseCustomerCountryCode(value: unknown): CommonCountryCode {
  const code = text(value, CustomerInputLimits.COUNTRY_CODE);
  try {
    return CommonCountryCode.parse(code);
  } catch {
    return invalid();
  }
}

/** Backward compatibility alias */
export const PhoneNumber = { create: parseCustomerPhone };
/** Backward compatibility alias */
export const CountryCode = { create: parseCustomerCountryCode };

export function normalizeProfilePatch(input: CustomerPatch): CustomerPatch {
  customerRecord(input, CUSTOMER_PATCH_FIELDS);
  const out: CustomerPatch = {};
  if (Object.hasOwn(input, "name"))
    out.name = text(input.name, CustomerInputLimits.NAME);
  if (Object.hasOwn(input, "phone"))
    out.phone = parseCustomerPhone(input.phone).value;
  if (Object.hasOwn(input, "email")) {
    out.email = nullable(input.email, CustomerInputLimits.EMAIL);
    if (out.email !== null && !z.email().safeParse(out.email).success)
      invalid();
  }
  if (Object.hasOwn(input, "note"))
    out.note = nullable(input.note, CustomerInputLimits.NOTE);
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
  if (Object.hasOwn(input, "label"))
    out.label = nullable(input.label, CustomerInputLimits.ADDRESS_LABEL);
  if (Object.hasOwn(input, "recipientName"))
    out.recipientName = text(
      input.recipientName,
      CustomerInputLimits.RECIPIENT_NAME,
    );
  if (Object.hasOwn(input, "recipientPhone"))
    out.recipientPhone = parseCustomerPhone(input.recipientPhone).value;
  if (Object.hasOwn(input, "countryCode"))
    out.countryCode = parseCustomerCountryCode(input.countryCode).value;
  if (Object.hasOwn(input, "addressText"))
    out.addressText = text(input.addressText, CustomerInputLimits.ADDRESS_TEXT);
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
