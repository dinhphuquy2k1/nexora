import { STATUS_TABS } from "./columns.ts";
import type { FilterCondition, RetailPackage, RetailQuery } from "./types.ts";
const option = (value: string, label: string) => ({ value, label });
const equality = [
  option("equals", "Là"),
  option("not_equals", "Không phải là"),
];
const text = [
  option("contains", "Chứa"),
  option("not_contains", "Không chứa"),
  ...equality,
];
const date = [
  option("equals", "Là"),
  option("before", "Trước ngày"),
  option("after", "Sau ngày"),
];
const number = [
  option("equals", "Bằng"),
  option("greater_than", "Lớn hơn"),
  option("less_than", "Nhỏ hơn"),
];
export const ORIGIN_WAREHOUSES = [
  "Quảng Châu",
  "Bằng Tường",
  "Đông Hưng",
] as const;
export function normalizeWarehouse(name: string): string {
  const lower = name.toLowerCase().trim();
  if (lower.includes("quảng châu")) return "Quảng Châu";
  if (lower.includes("bằng tường")) return "Bằng Tường";
  if (lower.includes("đông hưng")) return "Đông Hưng";
  return lower;
}
export interface FilterField {
  id: string;
  label: string;
  type: "select" | "text" | "date" | "number";
  operators: readonly { value: string; label: string }[];
  defaultValue: string;
  options?: readonly { value: string; label: string }[];
}
export const FILTER_FIELDS: readonly FilterField[] = [
  {
    id: "status",
    label: "Trạng thái kiện hàng",
    type: "select",
    operators: equality,
    defaultValue: "to_origin",
    options: STATUS_TABS.filter((t) => t.key !== "all").map((t) =>
      option(t.key, t.label),
    ),
  },
  {
    id: "originWarehouse",
    label: "Kho gửi Trung Quốc",
    type: "select",
    operators: equality,
    defaultValue: "Quảng Châu",
    options: ORIGIN_WAREHOUSES.map((v) =>
      option(v, v === "Quảng Châu" ? "Kho TMĐT Quảng Châu" : `Kho ${v}`),
    ),
  },
  {
    id: "trackingCode",
    label: "Mã vận đơn",
    type: "text",
    operators: text,
    defaultValue: "",
  },
  {
    id: "productName",
    label: "Tên sản phẩm",
    type: "text",
    operators: text,
    defaultValue: "",
  },
  {
    id: "originWarehouseDate",
    label: "Ngày nhập kho gửi",
    type: "date",
    operators: date,
    defaultValue: "",
  },
  {
    id: "originWarehouseExportDate",
    label: "Ngày xuất kho gửi",
    type: "date",
    operators: date,
    defaultValue: "",
  },
  {
    id: "destWarehouseDate",
    label: "Ngày nhập kho nhận",
    type: "date",
    operators: date,
    defaultValue: "",
  },
  {
    id: "weightKg",
    label: "Cân nặng",
    type: "number",
    operators: number,
    defaultValue: "",
  },
  {
    id: "unitPriceCNY",
    label: "Đơn giá",
    type: "number",
    operators: number,
    defaultValue: "",
  },
];
/** Calendar scalar, independent of local timezone or permissive Date rollover. */
export function calendarDay(value: unknown): number | null {
  if (typeof value !== "string") return null;
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    [, y, m, d] = match.map(Number);
  } else {
    match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
    if (!match) return null;
    [, d, m, y] = match.map(Number);
  }
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (y < 1 || y > 9999 || m < 1 || m > 12 || d < 1 || d > days[m - 1])
    return null;
  return y * 10000 + m * 100 + d;
}
function decimal(value: string): number | null {
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) && n <= 1e12 ? n : null;
}
export function makeFilter(
  field: unknown,
  operator: unknown,
  value: unknown,
): FilterCondition | null {
  const cfg = FILTER_FIELDS.find((f) => f.id === field);
  if (
    !cfg ||
    typeof operator !== "string" ||
    !cfg.operators.some((o) => o.value === operator) ||
    typeof value !== "string"
  )
    return null;
  const clean = value.trim();
  if (!clean || clean.length > 200) return null;
  if (cfg.type === "select" && !cfg.options?.some((o) => o.value === clean))
    return null;
  if (cfg.type === "number" && decimal(clean) === null) return null;
  if (
    cfg.type === "date" &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(clean) || calendarDay(clean) === null)
  )
    return null;
  const normalized = cfg.type === "number" ? String(Number(clean)) : clean;
  const identity = JSON.stringify([
    cfg.id,
    operator,
    normalized.toLocaleLowerCase("vi"),
  ]);
  const shown =
    cfg.options?.find((o) => o.value === clean)?.label ?? normalized;
  let prefix = cfg.label;
  if (cfg.id === "status") prefix = "Trạng thái";
  if (cfg.id === "originWarehouse") prefix = "Kho gửi TQ";
  if (cfg.id === "productName") prefix = "Sản phẩm";
  let label = `${prefix}: ${shown}`;
  if (operator === "not_equals") label = `${prefix} ≠ ${shown}`;
  if (operator === "contains") label = `${prefix} chứa "${shown}"`;
  if (operator === "not_contains") label = `${prefix} không chứa "${shown}"`;
  if (cfg.type === "number") {
    const symbol = (
      { greater_than: ">", less_than: "<", equals: "=" } as Record<
        string,
        string
      >
    )[operator];
    label = `${prefix} ${symbol} ${normalized} ${cfg.id === "weightKg" ? "kg" : "¥"}`;
  }
  if (cfg.type === "date") {
    const parts = normalized.split("-");
    const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
    label = `${prefix}: ${formatted}`;
    if (operator === "before") label = `${prefix} trước ${formatted}`;
    if (operator === "after") label = `${prefix} sau ${formatted}`;
  }

  return {
    id: identity,
    field: cfg.id,
    operator,
    value: normalized,
    displayLabel: label,
  };
}
export function addFilter(
  filters: readonly FilterCondition[],
  next: FilterCondition | null,
): readonly FilterCondition[] {
  if (!next || filters.some((f) => f.id === next.id) || filters.length >= 12)
    return filters;
  return [...filters, next];
}
export function matchesFilter(pkg: RetailPackage, input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  const raw = input as Record<string, unknown>;
  const cond = makeFilter(raw.field, raw.operator, raw.value);
  if (!cond) return false;
  const cfg = FILTER_FIELDS.find((f) => f.id === cond.field)!;
  const actual =
    cond.field === "originWarehouse"
      ? pkg.originWarehouseName
      : (pkg as unknown as Record<string, unknown>)[cond.field];
  if (cfg.type === "date") {
    const a = calendarDay(actual),
      b = calendarDay(cond.value);
    if (a === null || b === null) return false;
    if (cond.operator === "before") return a < b;
    if (cond.operator === "after") return a > b;
    return a === b;
  }
  if (cfg.type === "number") {
    if (typeof actual !== "number" || !Number.isFinite(actual)) return false;
    const b = Number(cond.value);
    if (cond.operator === "greater_than") return actual > b;
    if (cond.operator === "less_than") return actual < b;
    return actual === b;
  }
  if (typeof actual !== "string") return false;
  let equal: boolean;
  if (cond.field === "originWarehouse") {
    equal = normalizeWarehouse(actual) === normalizeWarehouse(cond.value);
  } else {
    const a = actual.toLocaleLowerCase("vi"),
      b = cond.value.toLocaleLowerCase("vi");
    equal = a === b;
  }
  if (cond.operator === "equals") return equal;
  if (cond.operator === "not_equals") return !equal;
  const a = actual.toLocaleLowerCase("vi"),
    b = cond.value.toLocaleLowerCase("vi");
  if (cond.operator === "contains") return a.includes(b);
  if (cond.operator === "not_contains") return !a.includes(b);
  return false;
}
export function filterPackages(
  packages: readonly RetailPackage[],
  query: Pick<RetailQuery, "status" | "search" | "filters">,
): RetailPackage[] {
  const search = query.search.trim().toLocaleLowerCase("vi");
  return packages.filter(
    (p) =>
      (query.status === "all" || p.status === query.status) &&
      (!search ||
        [p.trackingCode, p.productName, p.carrierName].some((v) =>
          v.toLocaleLowerCase("vi").includes(search),
        )) &&
      query.filters.every((c) => matchesFilter(p, c)),
  );
}
