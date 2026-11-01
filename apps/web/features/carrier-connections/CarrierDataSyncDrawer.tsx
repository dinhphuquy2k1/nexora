"use client";
import { useId, useState } from "react";
import { Button, Overlay, TabBar } from "@nexora/ui";
import { RefreshCw, SlidersHorizontal, Clock } from "lucide-react";
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
}: {
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
    [base] = useState(() => initialSchedule(items)),
    [draft, setDraft] = useState(base),
    dirty = scheduleDirty(base, draft),
    [history, setHistory] = useState<HistoryQuery>({
      type: "all",
      state: "all",
      range: data?.historyRange ?? "",
      appliedRange: data?.historyRange ?? "",
      page: 1,
    });
  const shown = expanded ? items : items.slice(0, 2);
  const requestClose = () => {
    if (dirty) setDiscard(true);
    else onClose();
  };
  const inspect = (kind: "progress" | "error", item: SyncItem) =>
    setInspection({ kind, item });
  let footer;
  if (tab === "schedule")
    footer = (
      <>
        <span className={dirty ? styles.dirtyIndicator : styles.muted}>
          {dirty ? "Có thay đổi chưa lưu" : "Chưa tích hợp cấu hình"}
        </span>
        <div className={styles.actions}>
          <Button
            variant="secondary"
            disabled={!dirty}
            onClick={() => setDraft(base)}
          >
            Hủy
          </Button>
          <Button variant="emphasis" disabled title={UNAVAILABLE}>
            Lưu cấu hình
          </Button>
        </div>
      </>
    );
  else if (tab === "history")
    footer = (
      <>
        <span className={styles.muted}>
          Tổng cộng: <strong>{data ? data.history.length : "—"}</strong> phiên
          đồng bộ
        </span>
        <Button variant="secondary" onClick={requestClose}>
          Đóng
        </Button>
      </>
    );
  else
    footer = (
      <>
        <span className={styles.muted}>Đồng bộ dữ liệu chưa khả dụng</span>
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
              expanded={expanded}
              hasData={!!data}
              onExpanded={() => setExpanded((v) => !v)}
              onInspect={inspect}
            />
          )}{" "}
          {tab === "schedule" && (
            <SyncSchedulePanel
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
              onChange={(patch) => setHistory((h) => ({ ...h, ...patch }))}
              onInspect={(item) => setInspection({ kind: "history", item })}
            />
          )}
        </div>
      </CarrierDrawerFrame>
      {inspection && (
        <CarrierSyncInspection
          inspection={inspection}
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
