import type {
  CarrierConnectionRow,
  SyncPresentation,
} from "../../features/carrier-connections/types.ts";
// Synthetic stress data only. Never imported by production page/features.
export const CARRIER_FIXTURES: readonly CarrierConnectionRow[] = Array.from(
  { length: 27 },
  (_, i) => ({
    id: `fixture-carrier-${i}`,
    provider: i % 2 ? "fixture-b" : "uniship",
    providerName: i % 2 ? "Hãng B (kiểm thử)" : "Uniship",
    displayName:
      i === 0
        ? "Tài khoản kiểm thử tên dài ".repeat(5)
        : `Chi nhánh kiểm thử ${i}`,
    loginIdentifier: `fixture-user-${i}`,
    status: (["CONNECTED", "ERROR", "REAUTH_REQUIRED"] as const)[i % 3],
    lastVerifiedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
  }),
);
export const SYNC_FIXTURE: SyncPresentation = {
  items: Array.from({ length: 8 }, (_, i) => ({
    id: `type-${i}`,
    label: i === 0 ? "Kiện hàng" : `Loại dữ liệu kiểm thử ${i}`,
    state: (["running", "failed", "completed"] as const)[i % 3],
    lastSuccess: "2026-01-01T00:00:00Z",
    progress: i === 0 ? 43 : undefined,
    processed: i === 0 ? 43 : undefined,
    total: i === 0 ? 100 : undefined,
    detail:
      i % 3 === 1
        ? "Lỗi kiểm thử tổng hợp: không có yêu cầu thật tới hãng."
        : "Tiến độ kiểm thử tổng hợp. Không có job thực thi.",
  })),
  history: Array.from({ length: 40 }, (_, i) => ({
    id: `history-${i}`,
    time: `01/01/2026 10:${String(i).padStart(2, "0")}`,
    dataType: i % 2 ? "Khách hàng" : "Kiện hàng",
    source: "Kiểm thử tổng hợp",
    state: (["completed", "failed", "running"] as const)[i % 3],
    records: i,
    detail: `Chi tiết lịch sử kiểm thử ${i}. Không phải dữ liệu vận hành.`,
  })),
};
