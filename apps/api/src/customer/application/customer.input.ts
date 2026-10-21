import {
  invalid,
  type CustomerCreate,
  type CustomerFields,
  type CustomerPatch,
  type AddressCreate,
  type AddressFields,
  type CustomerStatus,
  type CustomerSummary,
} from "../domain/customer";
import {
  PhoneNumber,
  text,
  customerStatus,
  normalizeCustomerFields,
  normalizeProfilePatch,
  normalizeAddressCreate,
  normalizeAddressPatch,
} from "../domain/customer.value-objects";
export interface CustomerQuery {
  page: number;
  pageSize: number;
  q?: string;
  searchPhone?: string;
  status?: CustomerStatus;
  phone?: string;
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
export const normalizePhone = (value: unknown): string =>
  PhoneNumber.create(value).value;
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
  if (!Object.keys(body).length) invalid();
  if (patch) return normalizeProfilePatch(body as CustomerPatch);
  if (!Object.hasOwn(body, "address")) invalid();
  const { address, ...raw } = body;
  const fields = normalizeCustomerFields(raw as unknown as CustomerFields);
  return { ...fields, address: addressInput(address, fields) };
}
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
  if (!Object.keys(body).length) invalid();
  if (patch) return normalizeAddressPatch(body as Partial<AddressFields>);
  return normalizeAddressCreate(body as unknown as AddressCreate, fallback);
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
      /* Non-phone name/code search remains valid. */
    }
  }
  if (Object.hasOwn(query, "phone")) out.phone = normalizePhone(query.phone);
  if (Object.hasOwn(query, "status")) out.status = customerStatus(query.status);
  return out;
}
