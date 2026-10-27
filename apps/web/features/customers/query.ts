import { CustomerStatus, parsePagination, CustomerInputLimits } from "@nexora/shared";
import type { Query } from "./types.ts";
const keys = ["page", "pageSize", "q", "status", "phone"] as const;
export function parseCustomerQuery(params: URLSearchParams): Query {
  for (const key of keys)
    if (params.getAll(key).length > 1) throw Error("INVALID_FILTER");
  const pagination = parsePagination(
    params.get("page") ?? undefined,
    params.get("pageSize") ?? undefined,
  );
  if (!pagination) throw Error("INVALID_FILTER");
  const { page, pageSize } = pagination;
  const out: Query = { page, pageSize };
  const q = params.get("q")?.trim();
  if (q) {
    if (q.length > CustomerInputLimits.QUERY_TEXT) throw Error("INVALID_FILTER");
    out.q = q;
  }
  const status = params.get("status");
  if (status !== null) {
    if (status !== CustomerStatus.ACTIVE && status !== CustomerStatus.INACTIVE)
      throw Error("INVALID_FILTER");
    out.status = status;
  }
  const phone = params.get("phone");
  if (phone !== null) {
    if (!phone.trim() || phone.length > CustomerInputLimits.PHONE_RAW) throw Error("INVALID_FILTER");
    out.phone = phone;
  }
  return out;
}
export function customerQueryString(query: Query): string {
  const p = new URLSearchParams();
  p.set("page", String(query.page));
  p.set("pageSize", String(query.pageSize));
  if (query.q?.trim()) p.set("q", query.q.trim());
  if (query.status) p.set("status", query.status);
  if (query.phone) p.set("phone", query.phone);
  return p.toString();
}
