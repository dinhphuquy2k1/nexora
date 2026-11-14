import { STATUS_TABS } from "./columns.ts";
import type { FilterCondition } from "./types.ts";
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
