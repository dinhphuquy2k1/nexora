import { parsePagination } from "@nexora/shared/validation";
import { PAGE_SIZE, PAGE_SIZE_OPTIONS, STATUS_TABS } from "./columns.ts";
import { makeFilter, addFilter } from "./filters.ts";
import type { RetailQuery, StatusTabKey, FilterCondition } from "./types.ts";
export const DEFAULT_RETAIL_QUERY: RetailQuery = {
  status: "all",
  search: "",
  page: 1,
  pageSize: PAGE_SIZE,
  filters: [],
};
const keys = ["status", "search", "page", "pageSize", "filters"];
export function parseRetailQuery(params: URLSearchParams): RetailQuery {
  if (params.toString().length > 4096) throw Error("INVALID_RETAIL_QUERY");
  for (const key of params.keys())
    if (!keys.includes(key) || params.getAll(key).length !== 1)
      throw Error("INVALID_RETAIL_QUERY");
  const pagination = parsePagination(
    params.get("page") ?? undefined,
    params.get("pageSize") ?? String(PAGE_SIZE),
  );
  const status = params.get("status") ?? "all",
    search = params.get("search") ?? "";
  if (
    !pagination ||
    !PAGE_SIZE_OPTIONS.some((n) => n === pagination.pageSize) ||
    !STATUS_TABS.some((t) => t.key === status) ||
    search.length > 200
  )
    throw Error("INVALID_RETAIL_QUERY");
  let filters: readonly FilterCondition[] = [];
  if (params.has("filters")) {
    let raw: unknown;
    try {
      raw = JSON.parse(params.get("filters")!);
    } catch {
      throw Error("INVALID_RETAIL_QUERY");
    }
    if (!Array.isArray(raw) || raw.length > 12)
      throw Error("INVALID_RETAIL_QUERY");
    for (const item of raw) {
      if (
        !item ||
        typeof item !== "object" ||
        Array.isArray(item) ||
        Object.keys(item).some(
          (k) => !["field", "operator", "value"].includes(k),
        )
      )
        throw Error("INVALID_RETAIL_QUERY");
      const f = makeFilter(item.field, item.operator, item.value);
      if (!f) throw Error("INVALID_RETAIL_QUERY");
      filters = addFilter(filters, f);
    }
  }
  return {
    status: status as StatusTabKey,
    search,
    ...pagination,
    filters,
  };
}
export function retailQueryString(query: RetailQuery): string {
  const p = new URLSearchParams({
    status: query.status,
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  if (query.search) p.set("search", query.search);
  if (query.filters.length)
    p.set(
      "filters",
      JSON.stringify(
        query.filters.map(({ field, operator, value }) => ({
          field,
          operator,
          value,
        })),
      ),
    );
  parseRetailQuery(p);
  return p.toString();
}
/** UI boundary: reject a composite URL budget violation without throwing from an event. */
export function tryRetailQueryString(query: RetailQuery): string | null {
  try {
    return retailQueryString(query);
  } catch {
    return null;
  }
}
