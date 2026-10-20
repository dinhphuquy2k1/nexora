import type { ParsedScope } from "../../shipping-scope/model.ts";

// Presentation inventory from the reference, not a persisted Shipment DTO or status vocabulary.
export const COLUMNS = [
  { id: "index", label: "#", width: 48 },
  { id: "tracking", label: "Mã vận đơn", width: 190, required: true },
  { id: "carrier", label: "Hãng giao hàng", width: 160 },
  { id: "product", label: "Tên sản phẩm", width: 210 },
  { id: "originIn", label: "Nhập kho gửi", width: 130 },
  { id: "originOut", label: "Xuất kho gửi", width: 130 },
  { id: "destIn", label: "Nhập kho nhận", width: 130 },
  { id: "destOut", label: "Xuất kho nhận", width: 130 },
  { id: "weight", label: "Cân nặng (kg)", width: 120 },
  { id: "unitPrice", label: "Đơn giá", width: 110 },
  { id: "domesticFee", label: "Ship nội địa", width: 120 },
  { id: "value", label: "Giá trị", width: 110 },
  { id: "packages", label: "Số kiện", width: 85 },
  { id: "items", label: "Số SP", width: 80 },
  { id: "insurance", label: "Bảo hiểm", width: 100 },
  { id: "inspection", label: "Kiểm đếm", width: 100 },
  { id: "wood", label: "Đóng gỗ", width: 100 },
  { id: "bubble", label: "Bọt khí", width: 100 },
  { id: "status", label: "Trạng thái", width: 170 },
  { id: "total", label: "Tổng tiền", width: 130 },
] satisfies { id: string; label: string; width: number; required?: boolean }[];
export const DEFAULT_COLUMNS = COLUMNS.filter((c) => c.id !== "carrier").map(
  (c) => c.id,
);
export const BASIC_COLUMNS = [
  "index",
  "tracking",
  "carrier",
  "product",
  "weight",
  "status",
  "total",
];
export function visibleColumns(ids: readonly string[]) {
  return COLUMNS.filter((c) => c.id === "tracking" || ids.includes(c.id));
}
export const STATUS_REFERENCE = [
  "Tất cả",
  "Đang đến kho gửi",
  "Đã về kho gửi",
  "Đang về kho nhận",
  "Đã về kho nhận",
  "Đã giao hàng",
  "Khiếu nại",
];
export const FILTER_FIELDS = [
  { id: "tracking", label: "Mã vận đơn", type: "text" },
  { id: "product", label: "Tên sản phẩm", type: "text" },
  { id: "originIn", label: "Ngày nhập kho gửi", type: "date" },
  { id: "destIn", label: "Ngày nhập kho nhận", type: "date" },
] as const;
export type DraftFilter = {
  field: (typeof FILTER_FIELDS)[number]["id"];
  value: string;
};
export function readQuery(params: URLSearchParams) {
  const page = Number(params.get("page") ?? 1);
  const size = Number(params.get("size") ?? 10);
  return {
    q: params.get("q") ?? "",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    size: [5, 10, 20, 50, 100].includes(size) ? size : 10,
  };
}
export function updateQuery(
  params: URLSearchParams,
  updates: Record<string, string>,
): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete("page");
  for (const [key, value] of Object.entries(updates)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  return next;
}
export function formatDate(value?: string | null): string {
  if (
    !value ||
    !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(
      value,
    )
  )
    return "—";
  const date = value.slice(0, 10);
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(`${date}T00:00:00Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day ||
    (value.length > 10 && !Number.isFinite(Date.parse(value)))
  )
    return "—";
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}
export function formatDecimal(value?: string | null): string {
  if (value == null || !/^-?\d+(?:\.\d+)?$/.test(value)) return "—";
  const [integer, fraction] = value.split(".");
  return `${integer!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}${fraction === undefined ? "" : `,${fraction}`}`;
}
export type RetailState =
  | "unsupported"
  | "loading"
  | "error"
  | "empty"
  | "invalid";
export function stateMessage(state: RetailState) {
  const messages = {
    unsupported: {
      title: "Dữ liệu kiện lẻ chưa được triển khai",
      description:
        "Chức năng quản lý kiện lẻ chưa được triển khai. Tải dữ liệu, tạo mới, xuất file và lịch sử hiện chưa khả dụng.",
    },
    loading: {
      title: "Đang tải phạm vi vận chuyển…",
      description: "Đang đọc metadata hãng và tài khoản của bạn.",
    },
    error: {
      title: "Không tải được phạm vi vận chuyển",
      description:
        "Không thể xác định metadata kết nối. Vui lòng thử lại; đây không phải danh sách rỗng.",
    },
    empty: {
      title: "Chưa có kiện hàng",
      description: "Phạm vi và bộ lọc hiện tại không có kết quả.",
    },
    invalid: {
      title: "Phạm vi không khả dụng",
      description:
        "Tài khoản hoặc hãng không hợp lệ, đã bị xóa hoặc mất quyền. Hãy chọn lại trên header; hệ thống không mở rộng phạm vi.",
    },
  };
  return messages[state];
}
export function sourceLabel(
  scope: ParsedScope,
  providerName: string,
  connectionName: string,
): string {
  return scope.type === "all"
    ? `${providerName} · ${connectionName}`
    : scope.type === "provider"
      ? connectionName
      : "";
}
