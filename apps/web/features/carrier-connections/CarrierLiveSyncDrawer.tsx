"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createSyncApi,
  SyncApiError,
  type SyncJobResponse,
  type SyncConfigResponse,
  type SyncType,
} from "./sync-api.ts";
import { CarrierDataSyncDrawer } from "./CarrierDataSyncDrawer.tsx";
import type {
  CarrierConnectionRow,
  SyncPresentation,
  SyncState,
} from "./types.ts";
import type { ScheduleDraft } from "./sync-presentation.ts";
const api = createSyncApi();
const state = (status: string): SyncState => {
  const states: Record<string, SyncState> = {
    QUEUED: "queued",
    RUNNING: "running",
    WAITING: "waiting",
    SUCCEEDED: "completed",
    FAILED: "failed",
    CANCELLED: "failed",
  };
  return states[status] ?? "unavailable";
};
function presentation(
  configs: SyncConfigResponse[],
  jobs: SyncJobResponse[],
): SyncPresentation {
  return {
    items: configs.map((c) => {
      const job = jobs.find((j) => j.syncType === c.syncType);
      return {
        id: c.syncType,
        label: c.syncType === "SHIPMENT" ? "Kiện hàng" : "Khách hàng",
        icon: c.syncType === "SHIPMENT" ? "package" : "user",
        state: job ? state(job.status) : c.available ? "idle" : "unavailable",
        code: c.syncType,
        lastSuccess: c.lastSuccessAt ?? undefined,
        autoEnabled: c.enabled,
        autoInterval: String(c.intervalMinutes),
        nextRun: c.nextRunAt ?? undefined,
        jobId: job?.id,
        processed: job?.appliedCount,
        total: job?.fetchedCount,
        checkpoint: job?.phase,
        detail: job
          ? `${job.phase} · Mới ${job.newCount} · Đổi ${job.changedCount} · Không đổi ${job.unchangedCount} · Áp dụng ${job.appliedCount} · Từ chối ${job.rejectedCount} · Cần xem ${job.needsReviewCount}`
          : undefined,
        errorCode: job?.errorCode ?? undefined,
        available: c.available,
      };
    }),
    history: jobs.map((j) => ({
      id: j.id,
      startedAt: j.startedAt ?? j.createdAt,
      time: new Date(j.startedAt ?? j.createdAt).toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
      }),
      dataType: j.syncType,
      source: j.triggerSource === "MANUAL" ? "Thủ công" : "Tự động",
      state: state(j.status),
      records: j.fetchedCount,
      detail:
        j.status === "SUCCEEDED" && j.rejectedCount + j.needsReviewCount > 0
          ? "Hoàn tất có cảnh báo"
          : `${j.phase} · Áp dụng ${j.appliedCount} · Từ chối ${j.rejectedCount} · Cần xem ${j.needsReviewCount}`,
    })),
  };
}
export function CarrierLiveSyncDrawer({
  row,
  onClose,
}: {
  row: CarrierConnectionRow;
  onClose: () => void;
}) {
  const router = useRouter(),
    generation = useRef(0),
    flight = useRef(false),
    [data, setData] = useState<SyncPresentation>(),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState("");
  useEffect(() => {
    const v = ++generation.current,
      abort = new AbortController();
    setData(undefined);
    Promise.all([
      api.configs(row.id, abort.signal),
      api.jobs(row.id, 1, abort.signal),
    ])
      .then(([c, j]) => {
        if (v === generation.current && !abort.signal.aborted)
          setData(presentation(c, j.jobs));
      })
      .catch((e) => {
        if (v !== generation.current || abort.signal.aborted) return;
        if (e instanceof SyncApiError && e.status === 401) {
          setData(undefined);
          router.replace("/login");
        } else setFeedback("Không thể tải dữ liệu đồng bộ. Hãy thử lại.");
      });
    return () => {
      abort.abort();
      generation.current++;
    };
  }, [row.id, revision, router]);
  const mutate = async (operation: () => Promise<unknown>) => {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    const v = generation.current;
    try {
      await operation();
      if (v === generation.current) {
        setFeedback("Đã lưu yêu cầu. Đang tải lại trạng thái.");
        setRevision((n) => n + 1);
      }
    } catch (e) {
      if (v === generation.current) {
        if (e instanceof SyncApiError && e.status === 401) {
          setData(undefined);
          router.replace("/login");
        } else
          setFeedback(
            "Không xác nhận được kết quả. Tải lại trạng thái trước khi thử lại.",
          );
      }
    } finally {
      flight.current = false;
      if (v === generation.current) setBusy(false);
    }
  };
  const save = (draft: ScheduleDraft) =>
    mutate(async () => {
      for (const [type, value] of Object.entries(draft)) {
        const item = data?.items.find((i) => i.id === type);
        if (item?.available)
          await api.configure(
            row.id,
            type as SyncType,
            value.enabled,
            Number(value.interval) as SyncConfigResponse["intervalMinutes"],
          );
      }
    });
  return (
    <CarrierDataSyncDrawer
      key={row.id + ":" + revision + ":" + Boolean(data)}
      row={row}
      data={data}
      onClose={onClose}
      onSync={(type) => void mutate(() => api.admit(row.id, type as SyncType))}
      onSaveSchedule={save}
      busy={busy}
      feedback={feedback}
      onReload={() => setRevision((v) => v + 1)}
    />
  );
}
