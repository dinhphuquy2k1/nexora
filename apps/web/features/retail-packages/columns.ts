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
    label: "#",
    defaultVisible: true,
    align: "center",
  },
  {
    id: "trackingCode",
    label: "MÃ VẬN ĐƠN",
    defaultVisible: true,
    required: true,
    align: "left",
  },
  {
    id: "carrier",
    label: "HÃNG VẬN CHUYỂN",
    defaultVisible: false,
    align: "left",
  },
  {
    id: "productName",
    label: "TÊN SẢN PHẨM",
    defaultVisible: true,
    align: "left",
  },
  {
    id: "originWarehouseDate",
    label: "NHẬP KHO GỬI",
    defaultVisible: true,
    align: "center",
  },
  {
    id: "originWarehouseExportDate",
    label: "XUẤT KHO GỬI",
    defaultVisible: true,
    align: "center",
  },
  {
    id: "destWarehouseDate",
    label: "NHẬP KHO NHẬN",
    defaultVisible: true,
    align: "center",
  },
  {
    id: "destWarehouseExportDate",
    label: "XUẤT KHO NHẬN",
    defaultVisible: true,
    align: "center",
  },
  {
    id: "weightKg",
    label: "CÂN NẶNG (KG)",
    defaultVisible: true,
    align: "right",
  },
  {
    id: "unitPriceCNY",
    label: "ĐƠN GIÁ (¥)",
    defaultVisible: true,
    align: "right",
  },
  {
    id: "domesticShipCNY",
    label: "SHIP NỘI ĐỊA",
    defaultVisible: true,
    align: "right",
  },
  {
    id: "valueCNY",
    label: "GIÁ TRỊ (¥)",
    defaultVisible: true,
    align: "right",
  },
  {
    id: "packageCount",
    label: "SỐ KIỆN",
    defaultVisible: true,
    align: "center",
  },
  {
    id: "itemCount",
    label: "SỐ SP",
    defaultVisible: true,
    align: "center",
  },
  {
    id: "hasInsurance",
    label: "BẢO HIỂM",
    defaultVisible: true,
    align: "center",
  },
  {
    id: "hasInspection",
    label: "KIỂM ĐẾM",
    defaultVisible: true,
    align: "center",
  },
  {
    id: "hasWoodenCrate",
    label: "ĐÓNG GỖ",
    defaultVisible: true,
    align: "center",
  },
  {
    id: "hasBubbleWrap",
    label: "BỌT KHÍ",
    defaultVisible: true,
    align: "center",
  },
  {
    id: "status",
    label: "TRẠNG THÁI",
    defaultVisible: true,
    align: "center",
  },
  {
    id: "totalAmountVND",
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
  { key: "all", label: "Tất cả" },
  { key: "to_origin", label: "Đang đến kho gửi" },
  { key: "at_origin", label: "Đã về kho gửi" },
  { key: "in_transit", label: "Đang về kho nhận" },
  { key: "at_dest", label: "Đã về kho nhận" },
  { key: "delivered", label: "Đã giao hàng" },
  { key: "disputed", label: "Khiếu nại" },
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

/** Page size options for the retail packages list. */
export const PAGE_SIZE = 20;
