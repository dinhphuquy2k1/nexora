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
export function filterSyncHistory(
  entries: readonly SyncHistoryEntry[],
  type: string,
  state: string,
  range: string,
) {
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
    const date = (d: string, m: string, y: string) => {
      const value = Date.UTC(+y, +m - 1, +d),
        v = new Date(value);
      return v.getUTCFullYear() === +y &&
        v.getUTCMonth() === +m - 1 &&
        v.getUTCDate() === +d
        ? value
        : NaN;
    };
    min = date(match[1], match[2], match[3]);
    max = date(match[4], match[5], match[6]);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max)
      return { entries: [], error: "Khoảng ngày không hợp lệ." };
    // Calendar ranges follow the Vietnamese display day, including midnight boundaries.
    min -= 7 * 3600000;
    max += 86400000 - 1 - 7 * 3600000;
  }
  return {
    entries: entries.filter(
      (e) =>
        (type === "all" || e.dataType === type) &&
        (state === "all" || e.state === state) &&
        (!range.trim() ||
          (!!e.startedAt &&
            Date.parse(e.startedAt) >= min &&
            Date.parse(e.startedAt) <= max)),
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
