"use client";
import { useId, useState } from "react";
import {
  Button,
  Checkbox,
  Overlay,
  Select,
  StatusBadge,
  TabBar,
} from "@nexora/ui";
import { Package, Users, Clock, History, RefreshCw } from "lucide-react";
import type {
  CarrierConnectionRow,
  SyncHistoryEntry,
  SyncItem,
  SyncPresentation,
} from "./types.ts";
import { UNAVAILABLE, displayTime, SYNC_LABELS } from "./presentation.ts";
import { CarrierDrawerFrame } from "./CarrierConnectionDrawer.tsx";
import styles from "./carrier-connections.module.css";
const unavailableItems: readonly SyncItem[] = [
  { id: "shipment", label: "Kiện hàng", state: "unavailable" },
  { id: "customer", label: "Khách hàng", state: "unavailable" },
];
export function CarrierDataSyncDrawer({
  row,
  data,
  onClose,
}: {
  row?: CarrierConnectionRow;
  data?: SyncPresentation;
  onClose: () => void;
}) {
  const id = useId();
  const [tab, setTab] = useState<"status" | "schedule" | "history">("status");
  const [schedule, setSchedule] = useState<
    Record<string, { enabled: boolean; interval: string }>
  >({});
  const [historyState, setHistoryState] = useState("all");
  const [inspect, setInspect] = useState<{
    title: string;
    detail: string;
    state: SyncItem["state"];
  } | null>(null);
  const items = data?.items ?? unavailableItems;
  const history = (data?.history ?? []).filter(
    (entry) => historyState === "all" || entry.state === historyState,
  );
  const inspectHistory = (entry: SyncHistoryEntry) =>
    setInspect({
      title: "Chi tiết lịch sử đồng bộ",
      detail: entry.detail,
      state: entry.state,
    });
  return (
    <>
      <CarrierDrawerFrame
        title="Quản lý đồng bộ dữ liệu"
        subtitle={row?.displayName ?? "Chưa chọn tài khoản kết nối"}
        onClose={onClose}
        footer={
          <Button disabled title={UNAVAILABLE}>
            <RefreshCw size={14} />
            Đồng bộ ngay
          </Button>
        }
      >
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
              icon: <Clock size={16} />,
            },
            {
              id: "history",
              title: "Lịch sử đồng bộ",
              icon: <History size={16} />,
            },
          ]}
          value={tab}
          onValueChange={setTab}
          idPrefix={id}
          panelId={`${id}-panel`}
          ariaLabel="Nội dung đồng bộ dữ liệu"
        />
        <div
          className={styles.drawerBody}
          role="tabpanel"
          id={`${id}-panel`}
          aria-label={
            {
              status: "Trạng thái đồng bộ",
              schedule: "Lịch tự động",
              history: "Lịch sử đồng bộ",
            }[tab]
          }
        >
          <p className={styles.notice}>{UNAVAILABLE}</p>
          {tab === "status" && (
            <section>
              <h3>Các loại dữ liệu</h3>
              <p className={styles.muted}>
                Trạng thái và tiến độ chỉ được hiển thị khi có nguồn dữ liệu.
              </p>
              <div className={styles.syncList}>
                {items.map((item, index) => (
                  <article key={item.id} className={styles.syncItem}>
                    <div className={styles.syncHeading}>
                      {index % 2 ? <Users size={18} /> : <Package size={18} />}
                      <strong>{item.label}</strong>
                      <StatusBadge
                        ok={item.state === "completed" ? true : null}
                      >
                        {SYNC_LABELS[item.state]}
                      </StatusBadge>
                    </div>
                    <p>
                      Lần thành công:{" "}
                      <strong>{displayTime(item.lastSuccess)}</strong>
                    </p>
                    {item.progress !== undefined && (
                      <div className={styles.progress}>
                        <label htmlFor={`${id}-${item.id}`}>
                          Tiến độ: {Math.min(100, Math.max(0, item.progress))}%
                        </label>
                        <progress
                          id={`${id}-${item.id}`}
                          max={100}
                          value={Math.min(100, Math.max(0, item.progress))}
                        />
                        <span>
                          {item.processed ?? "—"} / {item.total ?? "—"} bản ghi
                        </span>
                      </div>
                    )}
                    <div className={styles.syncActions}>
                      <Button disabled title={UNAVAILABLE}>
                        Đồng bộ ngay
                      </Button>
                      {item.detail && (
                        <Button
                          variant="secondary"
                          pressEffect="none"
                          onClick={() =>
                            setInspect({
                              title:
                                item.state === "failed"
                                  ? "Chi tiết lỗi đồng bộ"
                                  : "Chi tiết tiến độ đồng bộ",
                              detail: item.detail!,
                              state: item.state,
                            })
                          }
                        >
                          {item.state === "failed" ? "Xem lỗi" : "Xem tiến độ"}
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
          {tab === "schedule" && (
            <section>
              <h3>Lịch đồng bộ tự động</h3>
              <p>
                Chỉ là bản nháp trên màn hình; lịch chưa được lưu hoặc thực thi.
              </p>
              <div className={styles.syncList}>
                {items.map((item) => {
                  const value = schedule[item.id] ?? {
                    enabled: false,
                    interval: "60",
                  };
                  return (
                    <section key={item.id} className={styles.syncItem}>
                      <h4>{item.label}</h4>
                      <Checkbox
                        checked={value.enabled}
                        onChange={(e) =>
                          setSchedule((previous) => ({
                            ...previous,
                            [item.id]: { ...value, enabled: e.target.checked },
                          }))
                        }
                      >
                        Bật tự động cho {item.label}
                      </Checkbox>
                      <label className={styles.interval}>
                        Chu kỳ
                        <Select
                          aria-label={`Chu kỳ ${item.label}`}
                          value={value.interval}
                          onChange={(e) =>
                            setSchedule((previous) => ({
                              ...previous,
                              [item.id]: { ...value, interval: e.target.value },
                            }))
                          }
                        >
                          <option value="15">15 phút</option>
                          <option value="30">30 phút</option>
                          <option value="60">60 phút</option>
                          <option value="daily">Mỗi ngày</option>
                        </Select>
                      </label>
                      <p>Chạy tiếp theo: —</p>
                    </section>
                  );
                })}
              </div>
              <Button disabled title={UNAVAILABLE}>
                Lưu cấu hình chưa khả dụng
              </Button>
            </section>
          )}
          {tab === "history" && (
            <section>
              <div className={styles.historyHeading}>
                <h3>Lịch sử đồng bộ</h3>
                <Select
                  aria-label="Lọc lịch sử đồng bộ"
                  value={historyState}
                  onChange={(e) => setHistoryState(e.target.value)}
                >
                  <option value="all">Tất cả trạng thái</option>
                  {Object.entries(SYNC_LABELS).map(([state, label]) => (
                    <option key={state} value={state}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              {!history.length ? (
                <p className={styles.emptyHistory}>
                  Chưa có dữ liệu lịch sử đồng bộ.
                </p>
              ) : (
                <ol className={styles.history}>
                  {history.map((entry) => (
                    <li key={entry.id}>
                      <div>
                        <strong>{entry.dataType}</strong>
                        <span>
                          {entry.time} · {entry.source}
                        </span>
                        <span>
                          {SYNC_LABELS[entry.state]} · {entry.records ?? "—"}{" "}
                          bản ghi
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        pressEffect="none"
                        aria-label={`Chi tiết lịch sử ${entry.id}`}
                        onClick={() => inspectHistory(entry)}
                      >
                        Chi tiết
                      </Button>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </div>
      </CarrierDrawerFrame>
      {inspect && (
        <Overlay open onDismiss={() => setInspect(null)} label={inspect.title}>
          <h2>{inspect.title}</h2>
          <StatusBadge ok={inspect.state === "completed" ? true : null}>
            {SYNC_LABELS[inspect.state]}
          </StatusBadge>
          <p className={styles.inspection}>{inspect.detail}</p>
          <Button
            variant="secondary"
            pressEffect="none"
            onClick={() => setInspect(null)}
          >
            Đóng chi tiết
          </Button>
        </Overlay>
      )}
    </>
  );
}
