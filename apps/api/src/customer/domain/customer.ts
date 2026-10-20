import { parsePhoneNumberWithError } from "libphonenumber-js/max";
import { isValid as isCountry } from "i18n-iso-countries";
import { z } from "zod";

export const CustomerStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type CustomerStatus =
  (typeof CustomerStatus)[keyof typeof CustomerStatus];
export class CustomerError extends Error {
  constructor(
    readonly code:
      | "VALIDATION_ERROR"
      | "UNAUTHORIZED"
      | "NOT_FOUND"
      | "CUSTOMER_PHONE_EXISTS"
      | "LAST_CUSTOMER_ADDRESS"
      | "DEFAULT_ADDRESS_REASSIGN_REQUIRED",
  ) {
    super(code);
  }
}
export function invalid(): never {
  throw new CustomerError("VALIDATION_ERROR");
}
export function record(
  input: unknown,
  allowed: readonly string[],
): Record<string, unknown> {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((k) => !allowed.includes(k))
  )
    invalid();
  return input as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string") invalid();
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) invalid();
  return trimmed;
}
function nullable(value: unknown, max: number): string | null {
  return value === null ? null : text(value, max);
}
export function normalizePhone(value: unknown): string {
  const input = text(value, 64);
  try {
    const phone = parsePhoneNumberWithError(input, {
      defaultCountry: "VN",
      extract: false,
    });
    if (!phone.isValid() || phone.ext) invalid();
    return phone.number;
  } catch {
    return invalid();
  }
}
export function uuid(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      value,
    )
  )
    invalid();
  return value.toLowerCase();
}
export interface CustomerFields {
  name: string;
  phone: string;
  email?: string | null;
  note?: string | null;
}
export type CustomerPatch = Partial<CustomerFields> & {
  status?: CustomerStatus;
};
export type CustomerCreate = CustomerFields & { address: AddressCreate };
function customerStatus(value: unknown): CustomerStatus {
  if (!Object.values(CustomerStatus).includes(value as CustomerStatus))
    invalid();
  return value as CustomerStatus;
}
export function customerInput(input: unknown, patch?: false): CustomerCreate;
export function customerInput(input: unknown, patch: true): CustomerPatch;
export function customerInput(
  input: unknown,
  patch = false,
): CustomerCreate | CustomerPatch {
  const body = record(
    input,
    patch
      ? ["name", "phone", "email", "note", "status"]
      : ["name", "phone", "email", "note", "address"],
  );
  if (
    !Object.keys(body).length ||
    (!patch &&
      (!Object.hasOwn(body, "name") ||
        !Object.hasOwn(body, "phone") ||
        !Object.hasOwn(body, "address")))
  )
    invalid();
  const out: CustomerPatch = {};
  if (Object.hasOwn(body, "name")) out.name = text(body.name, 200);
  if (Object.hasOwn(body, "phone")) out.phone = normalizePhone(body.phone);
  if (Object.hasOwn(body, "email")) {
    out.email = nullable(body.email, 254);
    if (out.email !== null && !z.email().safeParse(out.email).success)
      invalid();
  }
  if (Object.hasOwn(body, "note")) out.note = nullable(body.note, 5000);
  if (Object.hasOwn(body, "status")) out.status = customerStatus(body.status);
  if (patch) return out;
  const fields = out as CustomerFields;
  return { ...fields, address: addressInput(body.address, fields) };
}
export function assertAddressDeletion(count: number, isDefault: boolean): void {
  if (count <= 1) throw new CustomerError("LAST_CUSTOMER_ADDRESS");
  if (isDefault) throw new CustomerError("DEFAULT_ADDRESS_REASSIGN_REQUIRED");
}
export interface AddressFields {
  label: string | null;
  recipientName: string;
  recipientPhone: string;
  countryCode: string;
  addressText: string;
}
export type AddressCreate = Pick<
  AddressFields,
  "label" | "countryCode" | "addressText"
> &
  Partial<Pick<AddressFields, "recipientName" | "recipientPhone">>;
export function addressInput(
  input: unknown,
  fallback?: Pick<CustomerFields, "name" | "phone">,
  patch?: false,
): AddressCreate;
export function addressInput(
  input: unknown,
  fallback: undefined,
  patch: true,
): Partial<AddressFields>;
export function addressInput(
  input: unknown,
  fallback?: Pick<CustomerFields, "name" | "phone">,
  patch = false,
): Partial<AddressFields> {
  const body = record(input, [
    "label",
    "recipientName",
    "recipientPhone",
    "countryCode",
    "addressText",
  ]);
  if (
    !Object.keys(body).length ||
    (!patch && !Object.hasOwn(body, "addressText"))
  )
    invalid();
  const out: Partial<AddressFields> = {};
  if (!patch) {
    out.label = null;
    out.countryCode = "VN";
    if (fallback) {
      out.recipientName = fallback.name;
      out.recipientPhone = fallback.phone;
    }
  }
  if (Object.hasOwn(body, "label")) out.label = nullable(body.label, 100);
  if (Object.hasOwn(body, "recipientName"))
    out.recipientName = text(body.recipientName, 200);
  if (Object.hasOwn(body, "recipientPhone"))
    out.recipientPhone = normalizePhone(body.recipientPhone);
  if (Object.hasOwn(body, "countryCode")) {
    const code = text(body.countryCode, 2).toUpperCase();
    if (!/^[A-Z]{2}$/.test(code) || !isCountry(code) || code === "XK")
      invalid();
    out.countryCode = code;
  }
  if (Object.hasOwn(body, "addressText"))
    out.addressText = text(body.addressText, 2000);
  return out;
}
export interface CustomerQuery {
  page: number;
  pageSize: number;
  q?: string;
  searchPhone?: string;
  status?: CustomerStatus;
  phone?: string;
}
export function listQuery(input: unknown): CustomerQuery {
  const query = record(input, ["page", "pageSize", "q", "status", "phone"]);
  function integer(value: unknown, fallback: number, max: number) {
    if (value === undefined) return fallback;
    if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) invalid();
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n > max) invalid();
    return n;
  }
  const page = integer(query.page, 1, 2147483647),
    pageSize = integer(query.pageSize, 20, 100);
  if ((page - 1) * pageSize > 2147483647) invalid();
  const out: CustomerQuery = { page, pageSize };
  if (Object.hasOwn(query, "q")) {
    out.q = text(query.q, 200);
    try {
      out.searchPhone = normalizePhone(out.q);
    } catch {
      /* Name/code substring remains valid when not a phone. */
    }
  }
  if (Object.hasOwn(query, "phone")) out.phone = normalizePhone(query.phone);
  if (Object.hasOwn(query, "status")) out.status = customerStatus(query.status);
  return out;
}
export interface CustomerSummary extends CustomerFields {
  id: string;
  code: string;
  status: CustomerStatus;
  createdAt: Date;
  updatedAt: Date;
  email: string | null;
  note: string | null;
}
export interface CustomerAddress extends AddressFields {
  id: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export interface CustomerDetail extends CustomerSummary {
  addresses: CustomerAddress[];
}
export interface CustomerPage {
  customers: CustomerSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
