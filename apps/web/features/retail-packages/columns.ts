/**
 * Retail Packages — column configuration and status tab definitions.
 *
 * These are presentation-layer constants. They define what columns exist and
 * which status tabs are available in the retail packages list view.
 * No persisted domain vocabulary is defined here.
 */

import type { ColumnConfig, StatusTabKey } from "./types.ts";

/** All available columns in the retail packages table. */
export const RETAIL_PACKAGE_COLUMNS: readonly ColumnConfig[] = [
  {
    id: "index",
    width: 40,
    basic: true,
    label: "#",
    defaultVisible: true,
    align: "center",
  },
  {
    id: "trackingCode",
    width: 150,
    basic: true,
    label: "MÃ VẬN ĐƠN",
    defaultVisible: true,
    required: true,
    align: "left",
  },
  {
    id: "carrier",
    width: 170,
    basic: true,
    label: "HÃNG VẬN CHUYỂN",
    defaultVisible: false,
    align: "left",
  },
  {
    id: "productName",
    width: 180,
    basic: true,
    label: "TÊN SẢN PHẨM",
    defaultVisible: true,
    align: "left",
  },
  {
    id: "originWarehouseDate",
    width: 110,
    basic: false,
    label: "NHẬP KHO GỬI",
    defaultVisible: true,
    align: "center",
  },
  {
    id: "originWarehouseExportDate",
    width: 110,
    basic: false,
    label: "XUẤT KHO GỬI",
    defaultVisible: true,
    align: "center",
  },
  {
    id: "destWarehouseDate",
    width: 110,
    basic: false,
    label: "NHẬP KHO NHẬN",
    defaultVisible: true,
    align: "center",
  },
  {
    id: "destWarehouseExportDate",
    width: 110,
    basic: false,
    label: "XUẤT KHO NHẬN",
    defaultVisible: true,
    align: "center",
  },
  {
    id: "weightKg",
    width: 105,
    basic: true,
    label: "CÂN NẶNG (KG)",
    defaultVisible: true,
    align: "right",
  },
  {
    id: "unitPriceCNY",
    width: 95,
    basic: false,
    label: "ĐƠN GIÁ (¥)",
    defaultVisible: true,
    align: "right",
  },
  {
    id: "domesticShipCNY",
    width: 100,
    basic: false,
    label: "SHIP NỘI ĐỊA",
    defaultVisible: true,
    align: "right",
  },
  {
    id: "valueCNY",
    width: 95,
    basic: false,
    label: "GIÁ TRỊ (¥)",
    defaultVisible: true,
    align: "right",
  },
  {
    id: "packageCount",
    width: 75,
    basic: false,
    label: "SỐ KIỆN",
    defaultVisible: true,
    align: "center",
  },
  {
    id: "itemCount",
    width: 70,
    basic: false,
    label: "SỐ SP",
    defaultVisible: true,
    align: "center",
  },
  {
    id: "hasInsurance",
    width: 80,
    basic: false,
    label: "BẢO HIỂM",
    defaultVisible: true,
    align: "center",
  },
  {
    id: "hasInspection",
    width: 80,
    basic: false,
    label: "KIỂM ĐẾM",
    defaultVisible: true,
    align: "center",
  },
  {
    id: "hasWoodenCrate",
    width: 80,
    basic: false,
    label: "ĐÓNG GỖ",
    defaultVisible: true,
    align: "center",
  },
  {
    id: "hasBubbleWrap",
    width: 80,
    basic: false,
    label: "BỌT KHÍ",
    defaultVisible: true,
    align: "center",
  },
  {
    id: "status",
    width: 150,
    basic: true,
    label: "TRẠNG THÁI",
    defaultVisible: true,
    align: "center",
  },
  {
    id: "totalAmountVND",
    width: 120,
    basic: true,
    label: "TỔNG TIỀN",
    defaultVisible: true,
    align: "right",
  },
] as const;

/** Default column visibility derived from column definitions. */
export const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> =
  Object.fromEntries(
    RETAIL_PACKAGE_COLUMNS.map((col) => [col.id, col.defaultVisible]),
  );

/** Status tab definitions shown above the table. */
export interface StatusTab {
  readonly key: StatusTabKey;
  readonly label: string;
}

export const STATUS_TABS: readonly StatusTab[] = [
  { key: "all", label: "Tất cả kiện hàng" },
  { key: "to_origin", label: "Đang đến kho gửi" },
  { key: "at_origin", label: "Đã về kho gửi" },
  { key: "in_transit", label: "Đang về kho nhận" },
  { key: "at_dest", label: "Đã về kho nhận" },
  { key: "delivered", label: "Đã giao hàng" },
  { key: "disputed", label: "Khiếu nại / Xử lý" },
] as const;

/** Human-readable label for each package status. */
export const STATUS_LABELS: Record<string, string> = {
  to_origin: "Đang đến kho gửi",
  at_origin: "Đã về kho gửi",
  in_transit: "Đang về kho nhận",
  at_dest: "Đã về kho nhận",
  delivered: "Đã giao hàng",
  disputed: "Khiếu nại",
};

/** Default page size for the retail packages list (10). */
export const PAGE_SIZE = 10;

/** Page size choices supported by the pagination selector. */
export const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;

export function columnPreset(
  preset: "all" | "basic" | "default",
): Record<string, boolean> {
  return Object.fromEntries(
    RETAIL_PACKAGE_COLUMNS.map((c) => [
      c.id,
      !!c.required ||
        preset === "all" ||
        (preset === "basic" ? !!c.basic : c.defaultVisible),
    ]),
  );
}
export function visibleColumns(visibility: Record<string, boolean>) {
  return RETAIL_PACKAGE_COLUMNS.filter(
    (c) => c.required || (visibility[c.id] ?? c.defaultVisible),
  );
}
export function searchColumns(search: string) {
  const q = search.trim().toLocaleLowerCase("vi");
  return RETAIL_PACKAGE_COLUMNS.filter((c) =>
    c.label.toLocaleLowerCase("vi").includes(q),
  );
}
