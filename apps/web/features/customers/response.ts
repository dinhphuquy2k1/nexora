import { CustomerStatus } from "@nexora/shared";
import type {
  Stats,
  Summary,
  Customer,
  Address,
  CustomerPage,
} from "./types.ts";
const record = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const integer = (x: unknown): x is number =>
  Number.isSafeInteger(x) && Number(x) >= 0;
export function customerStats(x: unknown): Stats | null {
  if (
    !record(x) ||
    !integer(x.total) ||
    !integer(x.active) ||
    !integer(x.inactive) ||
    x.total !== x.active + x.inactive
  )
    return null;
  return { total: x.total, active: x.active, inactive: x.inactive };
}
const strings = (x: Record<string, unknown>, keys: string[]) =>
  keys.every((k) => typeof x[k] === "string");
export function isSummary(x: unknown): x is Summary {
  return (
    record(x) &&
    strings(x, [
      "id",
      "code",
      "name",
      "phone",
      "statusLabel",
      "createdAt",
      "updatedAt",
    ]) &&
    (x.status === CustomerStatus.ACTIVE ||
      x.status === CustomerStatus.INACTIVE) &&
    ["email", "note"].every((k) => x[k] === null || typeof x[k] === "string")
  );
}
export function isAddress(x: unknown): x is Address {
  return (
    record(x) &&
    strings(x, [
      "id",
      "recipientName",
      "recipientPhone",
      "countryCode",
      "addressText",
      "createdAt",
      "updatedAt",
    ]) &&
    (x.label === null || typeof x.label === "string") &&
    typeof x.isDefault === "boolean"
  );
}
export function isCustomer(x: unknown): x is Customer {
  return (
    isSummary(x) &&
    record(x) &&
    Array.isArray((x as Record<string, unknown>).addresses) &&
    ((x as Record<string, unknown>).addresses as unknown[]).every(isAddress)
  );
}
export type ListResult = {
  customers: CustomerPage["customers"];
  pagination: CustomerPage["pagination"];
  stats: Stats | null;
};
export function readCustomerPage(x: unknown): ListResult {
  if (
    !record(x) ||
    !Array.isArray(x.customers) ||
    !x.customers.every(isSummary) ||
    !record(x.pagination)
  )
    throw Error("MALFORMED_RESPONSE");
  const p = x.pagination;
  if (
    !["page", "pageSize", "total", "totalPages"].every((k) => integer(p[k])) ||
    Number(p.page) < 1 ||
    Number(p.pageSize) < 1 ||
    Number(p.pageSize) > 100
  )
    throw Error("MALFORMED_RESPONSE");
  return {
    customers: x.customers,
    pagination: p as CustomerPage["pagination"],
    stats: customerStats(x.stats),
  };
}
export function readCustomer(x: unknown): Customer {
  if (!record(x) || !isCustomer(x.customer)) throw Error("MALFORMED_RESPONSE");
  return x.customer;
}
