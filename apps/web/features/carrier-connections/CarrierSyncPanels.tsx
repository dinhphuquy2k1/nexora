"use client";
import { Fragment } from "react";
import { Button, Select, TextInput } from "@nexora/ui";
import {
  Package,
  User,
  MapPin,
  DollarSign,
  FileText,
  Layers,
  Tag,
  AlertTriangle,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle2,
  Info,
  ExternalLink,
  RotateCcw,
  Calendar,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";
import { pageWindow } from "../../lib/pagination.ts";
import {
  SYNC_LABELS,
  HISTORY_SYNC_LABELS,
  UNAVAILABLE,
  displayTime,
} from "./presentation.ts";
import {
  SYNC_INTERVALS,
  filterSyncHistory,
  historyDataTypes,
  historySummary,
  type ScheduleDraft,
} from "./sync-presentation.ts";
import type {
  SyncItem,
  SyncHistoryEntry,
  SyncPresentation,
  SyncState,
} from "./types.ts";
import styles from "./carrier-connections.module.css";
export function DataTypeIcon({ item }: { item: Pick<SyncItem, "icon"> }) {
  const Icon = {
    package: Package,
    user: User,
    tracking: MapPin,
    money: DollarSign,
    file: FileText,
    layers: Layers,
    tag: Tag,
    dispute: AlertTriangle,
  }[item.icon ?? "package"];
  return <Icon size={18} />;
}
export function SyncBadge({
  state,
  history = false,
}: {
  state: SyncState;
  history?: boolean;
}) {
  const Icon = {
    running: RefreshCw,
    completed: CheckCircle2,
    failed: AlertCircle,
    waiting: Clock,
    queued: Clock,
    idle: Clock,
    unavailable: Clock,
  }[state];
  return (
    <span
      className={styles.syncBadge}
      data-state={state}
      data-context={history ? "history" : undefined}
    >
      {history ? (
        <span className={styles.historyStatusDot} aria-hidden="true" />
      ) : (
        <Icon size={12} />
      )}
      {(history ? HISTORY_SYNC_LABELS : SYNC_LABELS)[state]}
    </span>
  );
}
export function SyncStatusPanel({
  items,
  expanded,
  hasData,
  onExpanded,
  onInspect,
  onSync,
  busy = false,
}: {
  onSync?: (type: string) => void;
  busy?: boolean;
  items: readonly SyncItem[];
  expanded: boolean;
  hasData: boolean;
  onExpanded: () => void;
  onInspect: (kind: "progress" | "error", item: SyncItem) => void;
}) {
  return (
    <div className={styles.syncPanel}>
      <div className={styles.syncContext}>
        <div>
          <h3>Trạng thái các luồng dữ liệu</h3>
          <p>Chưa tích hợp thao tác đồng bộ dữ liệu.</p>
        </div>
        {hasData && (
          <Button variant="secondary" onClick={onExpanded}>
            <Layers size={14} />
            {expanded ? "Thu gọn: 2 loại" : "Mô phỏng: 8 loại dữ liệu"}
          </Button>
        )}
      </div>
      <div className={styles.syncList}>
        {items.map((item) => (
          <article key={item.id} className={styles.syncItem}>
            <div className={styles.syncItemHeading}>
              <div className={styles.syncType}>
                <span className={styles.typeIcon} data-icon={item.icon}>
                  <DataTypeIcon item={item} />
                </span>
                <div>
                  <strong title={item.label}>{item.label}</strong>
                  <small>Mã luồng: {item.code ?? "—"}</small>
                </div>
              </div>
              <SyncBadge state={item.state} />
            </div>
            {item.progress !== undefined && (
              <div className={styles.progressBox}>
                <div>
                  <strong>
                    Tiến độ: {Math.max(0, Math.min(100, item.progress))}%
                  </strong>
                  <span>
                    Trang {item.currentPage ?? "—"} / {item.totalPages ?? "—"}{" "}
                    (Đã nạp {item.processed ?? "—"} / ~{item.total ?? "—"} bản
                    ghi)
                  </span>
                </div>
                <progress
                  aria-label={`Tiến độ ${item.label}`}
                  max={100}
                  value={Math.max(0, Math.min(100, item.progress))}
                />
              </div>
            )}
            {(item.state === "waiting" || item.state === "queued") &&
              item.waitingNote && (
                <p className={styles.information}>
                  <Info size={14} />
                  {item.waitingNote}
                </p>
              )}
            {item.state === "failed" && (
              <p className={styles.syncError}>
                <AlertCircle size={14} />
                <span>
                  <strong>{item.errorCode ?? "—"}: </strong>
                  {item.detail ?? "Chưa có thông tin lỗi."}
                </span>
              </p>
            )}
            <div className={styles.syncItemFooter}>
              <span className={styles.muted}>
                {item.state === "running" ? (
                  <span
                    className={styles.runningNote}
                    data-carrier-running-note
                  >
                    <i aria-hidden="true" />
                    Tiến trình đang xử lý theo lô phân trang
                  </span>
                ) : (
                  <>
                    Thành công gần nhất:{" "}
                    <strong>
                      {item.lastSuccessDisplay ?? displayTime(item.lastSuccess)}
                    </strong>
                  </>
                )}
              </span>
              <div className={styles.actions}>
                {(item.state === "running" || item.state === "waiting") &&
                  item.detail && (
                    <Button
                      variant="secondary"
                      onClick={() => onInspect("progress", item)}
                    >
                      <ExternalLink size={12} />
                      Xem tiến độ
                    </Button>
                  )}
                {item.state === "failed" && (
                  <>
                    <Button
                      variant="ghost"
                      className={styles.dangerText}
                      onClick={() => onInspect("error", item)}
                    >
                      Xem lỗi
                    </Button>
                    <Button variant="emphasis" disabled title={UNAVAILABLE}>
                      <RotateCcw size={12} />
                      Thử lại ngay
                    </Button>
                  </>
                )}
                {!["running", "waiting", "failed"].includes(item.state) && (
                  <Button
                    variant="secondary"
                    disabled={!item.available || !onSync || busy}
                    onClick={() => onSync?.(item.id)}
                    title={!item.available ? UNAVAILABLE : undefined}
                  >
                    <RefreshCw size={12} />
                    Đồng bộ ngay
                  </Button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      <p className={styles.information}>
        <Info size={16} />
        <span>
          <strong>Cơ chế xử lý nền: </strong>Chưa tích hợp dữ liệu hoặc thao tác
          đồng bộ. Các trạng thái chỉ hiển thị khi có nguồn dữ liệu; không khởi
          chạy tiến trình trong giao diện này.
        </span>
      </p>
    </div>
  );
}
export function SyncSchedulePanel({
  items,
  draft,
  onChange,
}: {
  items: readonly SyncItem[];
  draft: ScheduleDraft;
  onChange: (id: string, value: { enabled: boolean; interval: string }) => void;
}) {
  return (
    <div className={styles.syncPanel}>
      <div>
        <h3>Cấu hình lịch đồng bộ tự động</h3>
        <p className={styles.muted}>
          Thiết lập chu kỳ độc lập cho từng loại dữ liệu. Đây chỉ là bản nháp
          chưa được lưu.
        </p>
      </div>
      <div className={styles.scheduleList}>
        {items.map((item) => {
          const value = draft[item.id] ?? { enabled: false, interval: "60" };
          return (
            <article
              key={item.id}
              className={styles.scheduleCard}
              data-enabled={value.enabled}
            >
              <div className={styles.syncItemHeading}>
                <div className={styles.syncType}>
                  <span className={styles.typeIcon}>
                    <DataTypeIcon item={item} />
                  </span>
                  <div>
                    <strong title={item.label}>{item.label}</strong>
                    <small>Mã luồng: {item.code ?? "—"}</small>
                  </div>
                </div>
                <div className={styles.switchControl}>
                  <small>{value.enabled ? "Đang bật" : "Đang tắt"}</small>
                  <Button
                    variant="ghost"
                    role="switch"
                    aria-checked={value.enabled}
                    aria-label={`Bật tự động cho ${item.label}`}
                    className={styles.switchTarget}
                    onClick={() =>
                      onChange(item.id, { ...value, enabled: !value.enabled })
                    }
                  >
                    <span className={styles.switchTrack}>
                      <span />
                    </span>
                  </Button>
                </div>
              </div>
              {value.enabled ? (
                <div className={styles.scheduleFields}>
                  <label>
                    Chu kỳ đồng bộ
                    <Select
                      aria-label={`Chu kỳ ${item.label}`}
                      value={value.interval}
                      onChange={(e) =>
                        onChange(item.id, {
                          ...value,
                          interval: e.target.value,
                        })
                      }
                    >
                      {SYNC_INTERVALS.map((n) => (
                        <option key={n} value={n}>
                          Mỗi {n} phút{n === "120" ? " (2 giờ)" : ""}
                          {n === "240" ? " (4 giờ)" : ""}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label>
                    Lần chạy tiếp theo
                    <span className={styles.readonlyField}>—</span>
                  </label>
                </div>
              ) : (
                <p className={styles.scheduleOff}>
                  Lịch tự động đang tắt. Thao tác đồng bộ chưa khả dụng.
                </p>
              )}
            </article>
          );
        })}
      </div>
      <p className={styles.information}>
        <Info size={16} />
        <span>
          Thay đổi lịch hiện chỉ là bản nháp; <strong>Lưu cấu hình</strong> chưa
          khả dụng và không tạo lịch chạy.
        </span>
      </p>
    </div>
  );
}
export interface HistoryQuery {
  type: string;
  state: string;
  range: string;
  appliedRange: string;
  page: number;
}
function HistoryTypeIcon({ type }: { type: string }) {
  if (type === "Shipment") return <Package size={14} />;
  if (type === "Customer") return <User size={14} />;
  return <Layers size={14} />;
}
export function SyncHistoryPanel({
  data,
  query,
  onChange,
  onInspect,
}: {
  data?: SyncPresentation;
  query: HistoryQuery;
  onChange: (q: Partial<HistoryQuery>) => void;
  onInspect: (item: SyncHistoryEntry) => void;
}) {
  const filtered = filterSyncHistory(
      data?.history ?? [],
      query.type,
      query.state,
      query.appliedRange,
    ),
    draftCheck = filterSyncHistory([], "all", "all", query.range),
    totalPages = Math.max(1, Math.ceil(filtered.entries.length / 4)),
    page = Math.min(query.page, totalPages),
    history = filtered.entries.slice((page - 1) * 4, page * 4),
    counts = historySummary(data),
    dataTypes = historyDataTypes(data?.history ?? []),
    pages =
      totalPages <= 5
        ? Array.from({ length: totalPages }, (_, i) => i + 1)
        : pageWindow(page, totalPages);
  const nav = (
    label: string,
    to: number,
    disabled: boolean,
    Icon: typeof ChevronLeft,
  ) => (
    <Button
      icon
      variant="secondary"
      aria-label={label}
      disabled={!data || disabled}
      onClick={() => onChange({ page: to })}
    >
      <Icon size={14} />
    </Button>
  );
  return (
    <div className={styles.historyPanel}>
      <header className={styles.historyHeading}>
        <h3>Lịch sử các lượt đồng bộ</h3>
        <span>
          Hiển thị {data ? filtered.entries.length : "—"} bản ghi gần nhất
        </span>
      </header>
      <div className={styles.historyFilters}>
        <label>
          Loại dữ liệu
          <Select
            aria-label="Lọc loại dữ liệu đồng bộ"
            value={query.type}
            onChange={(e) => onChange({ type: e.target.value, page: 1 })}
          >
            <option value="all">Tất cả loại dữ liệu</option>
            {dataTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </label>
        <label>
          Trạng thái
          <Select
            aria-label="Lọc lịch sử đồng bộ"
            value={query.state}
            onChange={(e) => onChange({ state: e.target.value, page: 1 })}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="running">Đang chạy</option>
            <option value="completed">Hoàn tất</option>
            <option value="failed">Thất bại</option>
          </Select>
        </label>
      </div>
      <div className={styles.historyDate}>
        <div className={styles.search}>
          <Calendar size={14} />
          <TextInput
            aria-label="Khoảng ngày lịch sử"
            value={query.range}
            placeholder="dd/mm/yyyy - dd/mm/yyyy"
            onChange={(e) => onChange({ range: e.target.value })}
            maxLength={30}
            aria-invalid={!!draftCheck.error}
          />
        </div>
        <Button
          variant="secondary"
          onClick={() => onChange({ appliedRange: query.range, page: 1 })}
          disabled={!!draftCheck.error}
        >
          <RefreshCw size={14} />
          Lọc lại
        </Button>
      </div>
      {(draftCheck.error || filtered.error) && (
        <p role="alert" className={styles.error}>
          {draftCheck.error || filtered.error}
        </p>
      )}
      <div className={styles.historyKpis}>
        {(
          [
            { key: "total", label: "Tổng" },
            { key: "completed", label: "Xong" },
            { key: "running", label: "Chạy" },
            { key: "failed", label: "Lỗi" },
          ] as const
        ).map((k) => (
          <div key={k.key} data-state={k.key}>
            <span /> {k.label}: <strong>{counts ? counts[k.key] : "—"}</strong>
          </div>
        ))}
      </div>
      <div className={styles.historyList}>
        {history.map((item) => (
          <button
            type="button"
            key={item.id}
            className={styles.historyRow}
            data-carrier-history-id={item.id}
            onClick={() => onInspect(item)}
          >
            <span className={styles.srOnly}>
              Chi tiết lượt đồng bộ {item.id}:{" "}
            </span>
            <span className={styles.historyRowHeading}>
              <span className={styles.historyIdentity}>
                <span className={styles.historyIcon} data-type={item.dataType}>
                  <HistoryTypeIcon type={item.dataType} />
                </span>
                <strong>{item.dataType}</strong>
                <span
                  className={styles.sourceChip}
                  data-manual={item.source === "Thủ công"}
                >
                  {item.source}
                </span>
              </span>
              <SyncBadge state={item.state} history />
            </span>
            <span className={styles.historyRowMeta}>
              <span>
                Bắt đầu: <strong>{item.time}</strong>
                {item.detail && item.detail !== "-" && (
                  <em className={styles.historyNote} title={item.detail}>
                    ({item.detail})
                  </em>
                )}
              </span>
              <strong>
                {item.records?.toLocaleString("vi-VN") ?? "—"} bản ghi
              </strong>
            </span>
          </button>
        ))}
        {!history.length && (
          <p className={styles.emptyHistory}>
            {data
              ? "Không tìm thấy lịch sử phù hợp với bộ lọc hiện tại."
              : "Chưa có dữ liệu lịch sử đồng bộ."}
          </p>
        )}
      </div>
      <div className={styles.historyPagination}>
        <span>
          Trang <strong>{data ? page : "—"}</strong> /{" "}
          <strong>{data ? totalPages : "—"}</strong>
        </span>
        <nav className={styles.pageButtons} aria-label="Phân trang lịch sử">
          {nav("Trang đầu lịch sử", 1, page === 1, ChevronsLeft)}
          {nav("Trang trước lịch sử", page - 1, page === 1, ChevronLeft)}
          {data &&
            pages.map((n, i) => (
              <Fragment key={n}>
                {i > 0 && n - pages[i - 1] > 1 && <span>…</span>}
                <Button
                  icon
                  variant={page === n ? "emphasis" : "secondary"}
                  aria-label={`Trang lịch sử ${n}`}
                  aria-current={page === n ? "page" : undefined}
                  onClick={() => onChange({ page: n })}
                >
                  {n}
                </Button>
              </Fragment>
            ))}
          {nav(
            "Trang sau lịch sử",
            page + 1,
            page === totalPages,
            ChevronRight,
          )}
          {nav(
            "Trang cuối lịch sử",
            totalPages,
            page === totalPages,
            ChevronsRight,
          )}
        </nav>
      </div>
    </div>
  );
}
