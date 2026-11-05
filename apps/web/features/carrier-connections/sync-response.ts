import {
  SyncJobStatus as J,
  SyncType as T,
  SyncTrigger as Trigger,
} from "@nexora/shared";
import type { components } from "@nexora/sdk";
import type { SyncConfigResponse } from "./sync-api.ts";
import type { SyncPresentation, SyncState } from "./types.ts";
export type SyncJobPage = components["schemas"]["SyncJobsResponseDto"];
const state = (status: string): SyncState => {
  const states: Record<string, SyncState> = {
    [J.QUEUED]: "queued",
    [J.RUNNING]: "running",
    [J.WAITING]: "waiting",
    [J.SUCCEEDED]: "completed",
    [J.FAILED]: "failed",
    [J.CANCELLED]: "failed",
  };
  return states[status] ?? "unavailable";
};
export function syncPresentation(
  configs: SyncConfigResponse[],
  page: SyncJobPage,
): SyncPresentation {
  return {
    serverHistory: {
      total: page.total,
      types: page.types,
      summary: page.summary,
    },
    items: configs.map((c) => {
      const j = c.latestJob;
      let streamState: SyncState = "unavailable";
      if (j) streamState = state(j.status);
      else if (c.available) streamState = "idle";
      return {
        id: c.syncType,
        label: c.syncType === T.SHIPMENT ? "Kiện hàng" : "Khách hàng",
        icon: c.syncType === T.SHIPMENT ? "package" : "user",
        state: streamState,
        code: c.syncType,
        lastSuccess: c.lastSuccessAt ?? undefined,
        autoEnabled: c.enabled,
        autoInterval: String(c.intervalMinutes),
        nextRun: c.nextRunAt ?? undefined,
        jobId: j?.id,
        processed: j?.appliedCount,
        total: j?.fetchedCount,
        checkpoint: j?.phase,
        detail: j
          ? `${j.phase} · Mới ${j.newCount} · Đổi ${j.changedCount} · Không đổi ${j.unchangedCount} · Áp dụng ${j.appliedCount} · Từ chối ${j.rejectedCount} · Cần xem ${j.needsReviewCount}`
          : undefined,
        errorCode: j?.errorCode ?? undefined,
        available: c.available,
        warning:
          !!j &&
          j.status === J.SUCCEEDED &&
          j.rejectedCount + j.needsReviewCount > 0,
      };
    }),
    history: page.jobs.map((j) => ({
      id: j.id,
      startedAt: j.startedAt,
      createdAt: j.createdAt,
      time: j.startedAt
        ? new Date(j.startedAt).toLocaleString("vi-VN", {
            timeZone: "Asia/Ho_Chi_Minh",
          })
        : "Chưa bắt đầu",
      dataType: j.syncType,
      source: j.triggerSource === Trigger.MANUAL ? "Thủ công" : "Tự động",
      state: state(j.status),
      records: j.fetchedCount,
      warning:
        j.status === J.SUCCEEDED && j.rejectedCount + j.needsReviewCount > 0,
      detail: `${j.phase} · Kết thúc ${j.finishedAt ?? "—"} · Thời lượng ${j.finishedAt && j.startedAt ? Math.max(0, Date.parse(j.finishedAt) - Date.parse(j.startedAt)) + " ms" : "—"} · Áp dụng ${j.appliedCount} · Từ chối ${j.rejectedCount} · Cần xem ${j.needsReviewCount}${j.errorCode ? " · " + j.errorCode : ""}`,
    })),
  };
}
