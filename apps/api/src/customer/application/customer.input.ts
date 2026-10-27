import { parsePagination, CustomerInputLimits } from "@nexora/shared";
import { isUuid } from "../../common/validation/uuid";
import { CustomerStatusVO } from "../domain/customer-status.vo";
import {
  customerRecord,
  CUSTOMER_PROFILE_FIELDS,
  CUSTOMER_PATCH_FIELDS,
  CUSTOMER_ADDRESS_FIELDS,
} from "../domain/customer-command";
import {
  invalid,
  type CustomerCreate,
  type CustomerFields,
  type CustomerPatch,
  type AddressCreate,
  type AddressFields,
  type CustomerStatusCode,
  type CustomerSummary,
} from "../domain/customer";
import {
  PhoneNumber,
  text,
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
  status?: CustomerStatusCode;
  phone?: string;
}
export interface CustomerStats {
  total: number;
  active: number;
  inactive: number;
}
export interface CustomerPage {
  stats: CustomerStats;
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
export const record = customerRecord;
export function uuid(value: unknown): string {
  if (!isUuid(value)) invalid();
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
    patch ? CUSTOMER_PATCH_FIELDS : [...CUSTOMER_PROFILE_FIELDS, "address"],
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
  const body = record(input, CUSTOMER_ADDRESS_FIELDS);
  if (!Object.keys(body).length) invalid();
  if (patch) return normalizeAddressPatch(body as Partial<AddressFields>);
  return normalizeAddressCreate(body as unknown as AddressCreate, fallback);
}
export function listQuery(input: unknown): CustomerQuery {
  const query = record(input, ["page", "pageSize", "q", "status", "phone"]);
  const pagination = parsePagination(query.page, query.pageSize);
  if (!pagination) invalid();
  const { page, pageSize } = pagination;
  const out: CustomerQuery = { page, pageSize };
  if (Object.hasOwn(query, "q")) {
    out.q = text(query.q, CustomerInputLimits.QUERY_TEXT);
    try {
      out.searchPhone = normalizePhone(out.q);
    } catch {
      /* Non-phone name/code search remains valid. */
    }
  }
  if (Object.hasOwn(query, "phone")) out.phone = normalizePhone(query.phone);
  if (Object.hasOwn(query, "status"))
    out.status = CustomerStatusVO.from(query.status).value;
  return out;
}
