import type {
  CarrierConnectionRow,
  CarrierQuery,
  ConnectionDraft,
  ConnectionStatus,
  SyncItem,
} from "./types.ts";
export const CONNECTION_STATES = {
  CONNECTED: { label: "Đang kết nối", ok: true },
  ERROR: { label: "Lỗi kết nối", ok: false },
  REAUTH_REQUIRED: { label: "Cần xác thực lại", ok: false },
} satisfies Record<ConnectionStatus, { label: string; ok: boolean }>;
export const SYNC_LABELS = {
  running: "Đang đồng bộ",
  completed: "Hoàn tất",
  failed: "Có lỗi",
  unavailable: "Chưa khả dụng",
} satisfies Record<SyncItem["state"], string>;
export const CARRIER_COLUMNS = [
  { label: "STT", width: 56 },
  { label: "HÃNG VẬN CHUYỂN", width: 190 },
  { label: "TÀI KHOẢN", width: 180 },
  { label: "TRẠNG THÁI KẾT NỐI", width: 144 },
  { label: "ĐỒNG BỘ DỮ LIỆU", width: 240 },
  { label: "LẦN ĐỒNG BỘ THÀNH CÔNG", width: 210 },
  { label: "HÀNH ĐỘNG", width: 176 },
] as const;
export const INITIAL_QUERY: CarrierQuery = {
  search: "",
  provider: "all",
  status: "all",
  page: 1,
  pageSize: 20,
};
export const UNAVAILABLE =
  "Chưa tích hợp dịch vụ kết nối và đồng bộ. Thao tác chưa khả dụng.";
export function selectConnections(
  rows: readonly CarrierConnectionRow[],
  query: CarrierQuery,
) {
  const text = query.search.trim().toLocaleLowerCase("vi");
  const filtered = rows.filter(
    (row) =>
      (query.provider === "all" || row.provider === query.provider) &&
      (query.status === "all" || row.status === query.status) &&
      [row.providerName, row.displayName, row.loginIdentifier ?? ""].some(
        (value) => value.toLocaleLowerCase("vi").includes(text),
      ),
  );
  const pageSize = [5, 10, 20, 50].includes(query.pageSize)
    ? query.pageSize
    : 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(
    totalPages,
    Math.max(1, Number.isFinite(query.page) ? Math.floor(query.page) : 1),
  );
  const offset = (page - 1) * pageSize;
  return {
    rows: filtered.slice(offset, offset + pageSize),
    total: filtered.length,
    page,
    pageSize,
    totalPages,
    start: filtered.length ? offset + 1 : 0,
    end: Math.min(offset + pageSize, filtered.length),
  };
}
export function validateConnectionDraft(
  draft: ConnectionDraft,
): Partial<Record<keyof ConnectionDraft, string>> {
  const errors: Partial<Record<keyof ConnectionDraft, string>> = {};
  if (!draft.displayName.trim() || draft.displayName.length > 100)
    errors.displayName = "Nhập tên gợi nhớ từ 1 đến 100 ký tự.";
  if (!draft.loginIdentifier.trim() || draft.loginIdentifier.length > 128)
    errors.loginIdentifier = "Nhập tên đăng nhập từ 1 đến 128 ký tự.";
  if (!draft.password.length || draft.password.length > 1024)
    errors.password = "Nhập mật khẩu từ 1 đến 1024 ký tự.";
  return errors;
}
export function displayTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(date);
}
