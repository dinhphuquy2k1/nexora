import type {
  CarrierConnectionRow,
  CarrierQuery,
  ConnectionDraft,
  ConnectionStatus,
  SyncItem,
  SyncPresentation,
  CarrierFilterCondition,
  CarrierTab,
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
  waiting: "Chờ lượt tiếp theo",
  queued: "Đang chờ xử lý",
  idle: "Chưa đồng bộ",
} satisfies Record<SyncItem["state"], string>;
export const CARRIER_COLUMNS = [
  { label: "STT", width: 56, sizing: "width" },
  { label: "HÃNG VẬN CHUYỂN", width: 190, sizing: "min" },
  { label: "TÀI KHOẢN", width: 180, sizing: "min" },
  { label: "TRẠNG THÁI KẾT NỐI", width: 144, sizing: "width" },
  { label: "ĐỒNG BỘ DỮ LIỆU", width: 240, sizing: "min" },
  { label: "LẦN ĐỒNG BỘ THÀNH CÔNG GẦN NHẤT", width: 210, sizing: "min" },
  { label: "HÀNH ĐỘNG", width: 176, sizing: "width" },
] as const;
export const INITIAL_QUERY: CarrierQuery = {
  search: "",
  tab: "all",
  conditions: [],
  page: 1,
  pageSize: 10,
};
export const UNAVAILABLE =
  "Chưa tích hợp dịch vụ kết nối và đồng bộ. Thao tác chưa khả dụng.";
export const FILTER_STATUS_OPTIONS = [
  { value: "connected", label: "Đang kết nối" },
  { value: "sandbox", label: "Sandbox" },
  { value: "error", label: "Lỗi kết nối" },
  { value: "syncing", label: "Đang đồng bộ" },
] as const;
export const FILTER_FIELDS = [
  {
    id: "carrier",
    label: "Hãng vận chuyển",
    operators: ["equals", "not_equals"],
  },
  {
    id: "status",
    label: "Trạng thái kết nối",
    operators: ["equals", "not_equals"],
  },
  {
    id: "environment",
    label: "Môi trường",
    operators: ["equals", "not_equals"],
  },
  {
    id: "accountName",
    label: "Tên / ID tài khoản",
    operators: ["contains", "not_contains", "equals"],
  },
] as const;
export const FILTER_OPERATORS = {
  equals: "Là",
  not_equals: "Không phải là",
  contains: "Chứa",
  not_contains: "Không chứa",
};
export function makeCarrierFilter(
  field: string,
  operator: string,
  value: string,
): CarrierFilterCondition | null {
  const config = FILTER_FIELDS.find((f) => f.id === field);
  const clean = value.trim();
  if (
    !config ||
    !(config.operators as readonly string[]).includes(operator) ||
    !clean ||
    clean.length > 200
  )
    return null;
  if (
    field === "status" &&
    !FILTER_STATUS_OPTIONS.some((s) => s.value === clean)
  )
    return null;
  if (field === "environment" && !["production", "sandbox"].includes(clean))
    return null;
  return {
    id: JSON.stringify([field, operator, clean.toLocaleLowerCase("vi")]),
    field: field as CarrierFilterCondition["field"],
    operator: operator as CarrierFilterCondition["operator"],
    value: clean,
  };
}
export function addCarrierFilter(
  filters: readonly CarrierFilterCondition[],
  next: CarrierFilterCondition,
): readonly CarrierFilterCondition[] | null {
  if (filters.length >= 12 || filters.some((f) => f.id === next.id))
    return null;
  return [...filters, next];
}
function matchesCondition(
  row: CarrierConnectionRow,
  condition: CarrierFilterCondition,
) {
  let value: string | null = null;
  switch (condition.field) {
    case "carrier":
      value = row.provider;
      break;
    case "status": {
      const matches = {
        connected: row.status === "CONNECTED",
        error: row.status === "ERROR" || row.status === "REAUTH_REQUIRED",
        sandbox: row.preview?.environment === "sandbox",
        syncing: row.preview?.syncing === true,
      }[condition.value];
      return condition.operator === "not_equals" ? !matches : !!matches;
    }
    case "environment":
      value = row.preview?.environment ?? null;
      break;
    case "accountName":
      value = [row.displayName, row.loginIdentifier, row.id]
        .filter(Boolean)
        .join(" ");
      break;
  }
  if (value === null) return false;
  const left = value.toLocaleLowerCase("vi"),
    right = condition.value.toLocaleLowerCase("vi");
  const equal =
    condition.field === "accountName"
      ? [row.displayName, row.loginIdentifier, row.id].some(
          (v) => v?.toLocaleLowerCase("vi") === right,
        )
      : left === right;
  switch (condition.operator) {
    case "equals":
      return equal;
    case "not_equals":
      return !equal;
    case "contains":
      return left.includes(right);
    case "not_contains":
      return !left.includes(right);
  }
}
export function tabMatches(row: CarrierConnectionRow, tab: CarrierTab) {
  switch (tab) {
    case "all":
      return true;
    case "connected":
      return (
        row.status === "CONNECTED" && row.preview?.environment !== "sandbox"
      );
    case "needs_check":
      return row.status === "ERROR" || row.status === "REAUTH_REQUIRED";
    case "sandbox":
      return row.preview?.environment === "sandbox";
  }
}
export function selectConnections(
  rows: readonly CarrierConnectionRow[],
  query: CarrierQuery,
) {
  const text = query.search.trim().toLocaleLowerCase("vi");
  const filtered = rows.filter(
    (row) =>
      tabMatches(row, query.tab) &&
      query.conditions.every((c) => matchesCondition(row, c)) &&
      [row.providerName, row.displayName, row.loginIdentifier ?? ""].some(
        (value) => value.toLocaleLowerCase("vi").includes(text),
      ),
  );
  const pageSize = [5, 10, 20, 50].includes(query.pageSize)
    ? query.pageSize
    : 10;
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
export function latestSyncSuccess(
  data: SyncPresentation | undefined,
): string | null {
  let latest: string | null = null;
  let timestamp = -Infinity;
  for (const item of data?.items ?? []) {
    const candidate = Date.parse(item.lastSuccess ?? "");
    if (Number.isFinite(candidate) && candidate > timestamp) {
      latest = item.lastSuccess!;
      timestamp = candidate;
    }
  }
  return latest;
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
