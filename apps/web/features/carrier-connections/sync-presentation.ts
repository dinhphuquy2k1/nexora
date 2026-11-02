import type { SyncHistoryEntry, SyncItem, SyncPresentation } from "./types.ts";
export const UNAVAILABLE_SYNC_ITEMS: readonly SyncItem[] = [
  {
    id: "shipment",
    label: "Shipment (Đơn vận chuyển, kiện hàng)",
    code: "SHP",
    icon: "package",
    state: "unavailable",
  },
  {
    id: "customer",
    label: "Customer (Khách hàng từ hãng)",
    code: "CUST",
    icon: "user",
    state: "unavailable",
  },
];
export const SYNC_INTERVALS = ["15", "30", "60", "120", "240"] as const;
export type ScheduleDraft = Readonly<
  Record<string, { enabled: boolean; interval: string }>
>;
export function initialSchedule(items: readonly SyncItem[]): ScheduleDraft {
  return Object.fromEntries(
    items.map((i) => [
      i.id,
      { enabled: i.autoEnabled ?? false, interval: i.autoInterval ?? "60" },
    ]),
  );
}
export function scheduleDirty(base: ScheduleDraft, draft: ScheduleDraft) {
  return Object.keys(base).some(
    (id) =>
      base[id].enabled !== draft[id]?.enabled ||
      base[id].interval !== draft[id]?.interval,
  );
}
function calendarDay(year: number, month: number, day: number): number | null {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return date.getTime();
}
export function historyDataTypes(
  entries: readonly SyncHistoryEntry[],
): string[] {
  return [...new Set(entries.map((entry) => entry.dataType))];
}
export function parseSyncStartedAt(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (
    !match ||
    calendarDay(+match[1], +match[2], +match[3]) === null ||
    +match[4] > 23 ||
    +match[5] > 59 ||
    +match[6] > 59
  )
    return null;
  if (
    match[7] !== "Z" &&
    (+match[7].slice(1, 3) > 23 || +match[7].slice(4, 6) > 59)
  )
    return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}
export function filterSyncHistory(
  entries: readonly SyncHistoryEntry[],
  type: string,
  state: string,
  range: string,
) {
  const timestamps = entries.map((entry) =>
    parseSyncStartedAt(entry.startedAt),
  );
  if (timestamps.some((value) => value === null))
    return {
      entries: [],
      error: "Dữ liệu lịch sử có thời điểm bắt đầu không hợp lệ.",
    };
  let min = -Infinity,
    max = Infinity;
  if (range.trim()) {
    const match =
      /^(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(\d{2})\/(\d{2})\/(\d{4})$/.exec(
        range.trim(),
      );
    if (!match)
      return {
        entries: [],
        error: "Khoảng ngày phải có dạng dd/mm/yyyy - dd/mm/yyyy.",
      };
    const start = calendarDay(+match[3], +match[2], +match[1]);
    const end = calendarDay(+match[6], +match[5], +match[4]);
    if (start === null || end === null || start > end)
      return { entries: [], error: "Khoảng ngày không hợp lệ." };
    // Vietnam's established UTC+07 presentation day, inclusive through 23:59:59.999.
    min = start - 7 * 3600000;
    max = end + 86400000 - 1 - 7 * 3600000;
  }
  return {
    entries: entries.filter(
      (entry, index) =>
        (type === "all" || entry.dataType === type) &&
        (state === "all" || entry.state === state) &&
        timestamps[index]! >= min &&
        timestamps[index]! <= max,
    ),
    error: "",
  };
}
export function historySummary(data: SyncPresentation | undefined) {
  if (!data) return null;
  return {
    total: data.history.length,
    completed: data.history.filter((e) => e.state === "completed").length,
    running: data.history.filter((e) => e.state === "running").length,
    failed: data.history.filter((e) => e.state === "failed").length,
  };
}
