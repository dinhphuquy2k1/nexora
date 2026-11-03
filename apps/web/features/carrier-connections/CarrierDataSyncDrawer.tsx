"use client";
import { useId, useState, useEffect, useCallback } from "react";
import { Button, Overlay, TabBar } from "@nexora/ui";
import { RefreshCw, SlidersHorizontal, Clock } from "lucide-react";
import type { JobDetailReader } from "./sync-api.ts";
import type {
  CarrierConnectionRow,
  SyncPresentation,
  SyncItem,
} from "./types.ts";
import { UNAVAILABLE } from "./presentation.ts";
import {
  UNAVAILABLE_SYNC_ITEMS,
  initialSchedule,
  scheduleDirty,
} from "./sync-presentation.ts";
import { ConnectionBadge } from "./CarrierConnectionList.tsx";
import { CarrierDrawerFrame } from "./CarrierConnectionDrawer.tsx";
import {
  SyncStatusPanel,
  SyncSchedulePanel,
  SyncHistoryPanel,
  type HistoryQuery,
} from "./CarrierSyncPanels.tsx";
import {
  CarrierSyncInspection,
  type SyncInspection,
} from "./CarrierSyncInspection.tsx";
import styles from "./carrier-connections.module.css";
export function CarrierDataSyncDrawer({
  row,
  data,
  onClose,
  onSync,
  onSaveSchedule,
  busy = false,
  blocked = false,
  feedback,
  onReload,
  historyQuery,
  onHistoryChange,
  scheduleRevision = 0,
  jobDetail,
  onDetailUnauthorized,
  denied = false,
}: {
  denied?: boolean;
  jobDetail?: JobDetailReader;
  onDetailUnauthorized?: () => void;
  onSync?: (type: string) => void;
  onSaveSchedule?: (
    draft: ReturnType<typeof initialSchedule>,
  ) => Promise<unknown>;
  busy?: boolean;
  blocked?: boolean;
  feedback?: string;
  onReload?: () => void;
  historyQuery?: HistoryQuery;
  onHistoryChange?: (patch: Partial<HistoryQuery>) => void;
  scheduleRevision?: number;
  row?: CarrierConnectionRow;
  data?: SyncPresentation;
  onClose: () => void;
}) {
  const id = useId(),
    [tab, setTab] = useState<"status" | "schedule" | "history">("status"),
    [expanded, setExpanded] = useState(false),
    [inspection, setInspection] = useState<SyncInspection | null>(null),
    [discard, setDiscard] = useState(false);
  const items = data?.items ?? UNAVAILABLE_SYNC_ITEMS,
    [base, setBase] = useState(() => initialSchedule(items)),
    [draft, setDraft] = useState(base),
    dirty = scheduleDirty(base, draft),
    [localHistory, setHistory] = useState<HistoryQuery>({
      type: "all",
      state: "all",
      range: data?.historyRange ?? "",
      appliedRange: data?.historyRange ?? "",
      page: 1,
    });
  const history = historyQuery ?? localHistory;
  useEffect(() => {
    if (!data) return;
    const next = initialSchedule(items);
    // Accepted reads always rebase Cancel; preserve edits until a complete save.
    setBase(next);
    if (!scheduleDirty(base, draft)) setDraft(next);
  }, [items]);
  useEffect(() => {
    const next = initialSchedule(items);
    setBase(next);
    setDraft(next);
  }, [scheduleRevision]);
  const shown = expanded ? items : items.slice(0, 2);
  const requestClose = () => {
    if (dirty) setDiscard(true);
    else onClose();
  };
  const detailUnauthorized = useCallback(() => {
    setInspection(null);
    onDetailUnauthorized?.();
  }, [onDetailUnauthorized]);
  useEffect(() => {
    if (denied) setInspection(null);
  }, [denied]);
  const inspect = (kind: "progress" | "error", item: SyncItem) => {
    if (!denied) setInspection({ kind, item });
  };
  const readyScheduleText = onSaveSchedule
    ? "Cấu hình trên máy chủ"
    : "Chưa tích hợp cấu hình";
  let footer;
  if (tab === "schedule")
    footer = (
      <>
        <span className={dirty ? styles.dirtyIndicator : styles.muted}>
          {dirty ? "Có thay đổi chưa lưu" : readyScheduleText}
        </span>
        <div className={styles.actions}>
          <Button
            variant="secondary"
            disabled={!dirty}
            onClick={() => setDraft(base)}
          >
            Hủy
          </Button>
          <Button
            variant="emphasis"
            disabled={!onSaveSchedule || !dirty || busy || blocked}
            onClick={() => onSaveSchedule?.(draft)}
            title={!onSaveSchedule ? UNAVAILABLE : undefined}
          >
            Lưu cấu hình
          </Button>
        </div>
      </>
    );
  else if (tab === "history")
    footer = (
      <>
        <span className={styles.muted}>
          Tổng cộng:{" "}
          <strong>
            {data ? (data.serverHistory?.total ?? data.history.length) : "—"}
          </strong>{" "}
          phiên đồng bộ
        </span>
        {onReload && (
          <Button variant="secondary" onClick={onReload} disabled={busy}>
            Làm mới
          </Button>
        )}
        <Button variant="secondary" onClick={requestClose}>
          Đóng
        </Button>
      </>
    );
  else
    footer = (
      <>
        <span className={styles.muted}>
          {onReload
            ? "Đồng bộ chạy ở máy chủ khi được hỗ trợ"
            : "Đồng bộ dữ liệu chưa khả dụng"}
        </span>
        <Button variant="secondary" onClick={requestClose}>
          Đóng
        </Button>
      </>
    );
  return (
    <>
      <CarrierDrawerFrame
        title={`Đồng bộ dữ liệu - ${row?.providerName ?? "—"}`}
        subtitle={
          row
            ? `${row.displayName} · ${row.loginIdentifier ?? "—"}`
            : "Chưa chọn tài khoản kết nối"
        }
        status={row ? <ConnectionBadge row={row} /> : undefined}
        onClose={requestClose}
        footer={footer}
      >
        {feedback && (
          <p role="status">
            {feedback}{" "}
            {onReload && (
              <Button variant="secondary" onClick={onReload} disabled={busy}>
                Tải lại
              </Button>
            )}
          </p>
        )}
        <div className={styles.syncTabs}>
          <TabBar
            items={[
              {
                id: "status",
                title: "Trạng thái đồng bộ",
                icon: <RefreshCw size={16} />,
              },
              {
                id: "schedule",
                title: "Lịch tự động",
                icon: <SlidersHorizontal size={16} />,
              },
              {
                id: "history",
                title: "Lịch sử đồng bộ",
                icon: <Clock size={16} />,
              },
            ]}
            value={tab}
            onValueChange={setTab}
            idPrefix={id}
            panelId={id + "panel"}
            ariaLabel="Nội dung đồng bộ dữ liệu"
            renderTrailing={(item) =>
              item.id === "schedule" && dirty ? (
                <span
                  className={styles.dirtyDot}
                  aria-label="Có thay đổi chưa lưu"
                />
              ) : null
            }
          />
        </div>
        <div
          className={styles.drawerBody}
          key={tab}
          id={id + "panel"}
          role="tabpanel"
          aria-label={
            {
              status: "Trạng thái đồng bộ",
              schedule: "Lịch tự động",
              history: "Lịch sử đồng bộ",
            }[tab]
          }
        >
          {tab === "status" && (
            <SyncStatusPanel
              items={shown}
              onSync={onSync}
              busy={busy || blocked}
              expanded={expanded}
              hasData={!!data}
              onExpanded={() => setExpanded((v) => !v)}
              onInspect={inspect}
            />
          )}{" "}
          {tab === "schedule" && (
            <SyncSchedulePanel
              integrated={!!onSaveSchedule}
              busy={busy || blocked}
              items={shown}
              draft={draft}
              onChange={(key, value) =>
                setDraft((d) => ({ ...d, [key]: value }))
              }
            />
          )}{" "}
          {tab === "history" && (
            <SyncHistoryPanel
              data={data}
              query={history}
              onChange={(patch) =>
                onHistoryChange
                  ? onHistoryChange(patch)
                  : setHistory((h) => ({ ...h, ...patch }))
              }
              onInspect={(item) => {
                if (!denied) setInspection({ kind: "history", item });
              }}
            />
          )}
        </div>
      </CarrierDrawerFrame>
      {inspection && !denied && (
        <CarrierSyncInspection
          inspection={inspection}
          connectionId={row?.id}
          jobDetail={jobDetail}
          onUnauthorized={detailUnauthorized}
          onClose={() => setInspection(null)}
        />
      )}{" "}
      {discard && (
        <Overlay
          open
          onDismiss={() => setDiscard(false)}
          label="Thay đổi chưa lưu"
          className={styles.discardModal}
        >
          <h2>Thay đổi cấu hình lịch chưa lưu</h2>
          <p>Bản nháp chưa được lưu. Bạn có chắc muốn đóng và bỏ thay đổi?</p>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => setDiscard(false)}>
              Tiếp tục chỉnh sửa
            </Button>
            <Button variant="emphasis" onClick={onClose}>
              Bỏ thay đổi
            </Button>
          </div>
        </Overlay>
      )}
    </>
  );
}
