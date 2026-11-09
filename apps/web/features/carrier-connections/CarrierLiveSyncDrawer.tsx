"use client";
import { SyncJobStatus as J } from "@nexora/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createSyncApi,
  SyncApiError,
  type SyncConfigResponse,
  type SyncType,
} from "./sync-api.ts";
import { syncPresentation } from "./sync-response.ts";
import { CarrierDataSyncDrawer } from "./CarrierDataSyncDrawer.tsx";
import type { CarrierConnectionRow, SyncPresentation } from "./types.ts";
import { syncHistoryRange, type ScheduleDraft } from "./sync-presentation.ts";
import type { HistoryQuery } from "./CarrierSyncPanels.tsx";
const api = createSyncApi();
export function CarrierLiveSyncDrawer({
  row,
  onClose,
}: {
  row: CarrierConnectionRow;
  onClose: () => void;
}) {
  const generation = useRef(0),
    flight = useRef(false),
    denied = useRef(false),
    detailScope = useRef(new AbortController()),
    mounted = useRef(true),
    request = useRef<AbortController | null>(null),
    [data, setData] = useState<SyncPresentation>(),
    [busy, setBusy] = useState(false),
    [blocked, setBlocked] = useState(false),
    [feedback, setFeedback] = useState(""),
    [scheduleRevision, setScheduleRevision] = useState(0),
    [history, setHistory] = useState<HistoryQuery>({
      type: "all",
      state: "all",
      range: "",
      appliedRange: "",
      page: 1,
    });
  const deny = useCallback(() => {
    denied.current = true;
    detailScope.current.abort();
    request.current?.abort();
    generation.current++;
    flight.current = true;
    setData(undefined);
    setBusy(false);
    setBlocked(true);
    setFeedback("Phiên đăng nhập đã kết thúc.");
  }, []);
  const load = useCallback(async () => {
    if (denied.current) return false;
    request.current?.abort();
    const abort = new AbortController();
    request.current = abort;
    const v = ++generation.current;
    const bounds = syncHistoryRange(history.appliedRange);
    if (bounds.error) return false;
    const filters = {
      syncType: history.type === "all" ? undefined : (history.type as SyncType),
      status: (
        {
          completed: J.SUCCEEDED,
          failed: `${J.FAILED},${J.CANCELLED}`,
          running: `${J.QUEUED},${J.RUNNING},${J.WAITING}`,
        } as Record<string, string>
      )[history.state],
      from: Number.isFinite(bounds.min)
        ? new Date(bounds.min).toISOString()
        : undefined,
      until: Number.isFinite(bounds.max)
        ? new Date(bounds.max).toISOString()
        : undefined,
    };
    try {
      const [c, j] = await Promise.all([
        api.configs(row.id, abort.signal),
        api.jobs(row.id, history.page, abort.signal, filters),
      ]);
      if (
        denied.current ||
        v !== generation.current ||
        abort.signal.aborted ||
        !mounted.current
      )
        return false;
      if (history.page > 1 && j.total <= (history.page - 1) * 4) {
        setHistory((h) => ({
          ...h,
          page: Math.max(1, Math.ceil(j.total / 4)),
        }));
        return false;
      }
      setData(syncPresentation(c, j));
      return true;
    } catch (e) {
      if (
        denied.current ||
        v !== generation.current ||
        abort.signal.aborted ||
        !mounted.current
      )
        return false;
      setData(undefined);
      if (e instanceof SyncApiError && e.status === 401) deny();
      else setFeedback("Không thể tải dữ liệu đồng bộ. Hãy thử lại.");
      return false;
    }
  }, [
    row.id,
    history.page,
    history.type,
    history.state,
    history.appliedRange,
    deny,
  ]);
  useEffect(() => {
    mounted.current = true;
    setData(undefined);
    void load();
    return () => {
      request.current?.abort();
      generation.current++;
    };
  }, [load]);
  useEffect(
    () => () => {
      mounted.current = false;
      // Inspection owns unmount cancellation; this shared scope is sticky denial only.
      request.current?.abort();
      generation.current++;
    },
    [],
  );
  useEffect(() => {
    if (
      !data?.items.some((i) =>
        ["running", "queued", "waiting"].includes(i.state),
      ) ||
      denied.current ||
      busy ||
      blocked
    )
      return;
    const timer = setTimeout(() => void load(), 5000);
    return () => clearTimeout(timer);
  }, [data, load, busy, blocked]);
  const jobDetail = useCallback(
    async (jobId: string, page: number, signal: AbortSignal) => {
      if (denied.current || !mounted.current) throw new SyncApiError(401);
      const data = await api.jobDetail(
        row.id,
        jobId,
        page,
        AbortSignal.any([signal, detailScope.current.signal]),
      );
      if (denied.current || !mounted.current) throw new SyncApiError(401);
      return data;
    },
    [row.id],
  );
  const reload = async () => {
    if ((await load()) && !denied.current) {
      flight.current = false;
      setBlocked(false);
      setFeedback("Đã tải trạng thái hiện tại từ máy chủ.");
    }
  };
  const mutate = async (
    operation: () => Promise<unknown>,
    schedule = false,
  ) => {
    if (!data || denied.current || flight.current || blocked) return;
    flight.current = true;
    setBusy(true);
    let confirmed = false;
    try {
      await operation();
      confirmed = true;
      if (mounted.current && !denied.current)
        setFeedback("Yêu cầu đã được lưu; đang đối chiếu trạng thái.");
    } catch (e) {
      if (!mounted.current || denied.current) return;
      if (e instanceof SyncApiError && e.status === 401) {
        deny();
        return;
      }
      setFeedback(
        "Chưa xác nhận toàn bộ kết quả ghi; đang đối chiếu trạng thái.",
      );
    } finally {
      if (mounted.current && !denied.current) {
        const reconciled = await load();
        if (mounted.current && !denied.current) {
          setBusy(false);
          setBlocked(!reconciled);
          flight.current = !reconciled;
          if (reconciled) {
            if (confirmed && schedule) setScheduleRevision((v) => v + 1);
            setFeedback(
              confirmed
                ? "Đã đối chiếu trạng thái trên máy chủ."
                : "Đã tải trạng thái hiện tại; hãy kiểm tra trước khi gửi lại.",
            );
          } else
            setFeedback(
              "Chưa đối chiếu được kết quả. Tải lại trước khi gửi yêu cầu khác.",
            );
        }
      }
    }
  };
  const save = (draft: ScheduleDraft) =>
    mutate(async () => {
      for (const [type, value] of Object.entries(draft)) {
        if (denied.current || !mounted.current) return;
        const item = data?.items.find((i) => i.id === type);
        if (
          item &&
          (item.available || (item.autoEnabled && !value.enabled)) &&
          (item.autoEnabled !== value.enabled ||
            item.autoInterval !== value.interval)
        )
          await api.configure(
            row.id,
            type as SyncType,
            value.enabled,
            Number(value.interval) as SyncConfigResponse["intervalMinutes"],
          );
      }
    }, true);
  return (
    <CarrierDataSyncDrawer
      row={row}
      data={data}
      denied={denied.current}
      jobDetail={jobDetail}
      onDetailUnauthorized={deny}
      onClose={onClose}
      onSync={(type) => void mutate(() => api.admit(row.id, type as SyncType))}
      onSaveSchedule={save}
      busy={busy}
      blocked={blocked || !data}
      feedback={feedback}
      onReload={() => void reload()}
      historyQuery={history}
      onHistoryChange={(patch) => {
        if (!denied.current && !flight.current)
          setHistory((h) => ({ ...h, ...patch }));
      }}
      scheduleRevision={scheduleRevision}
    />
  );
}
