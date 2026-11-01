import { Button, Select, TextInput, StatusBadge } from "@nexora/ui";
import {
  Eye,
  Pencil,
  Settings,
  Trash2,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Truck,
} from "lucide-react";
import type {
  CarrierConnectionRow,
  CarrierQuery,
  SyncPresentation,
} from "./types.ts";
import {
  CARRIER_COLUMNS,
  CONNECTION_STATES,
  SYNC_LABELS,
  displayTime,
  latestSyncSuccess,
  UNAVAILABLE,
  selectConnections,
} from "./presentation.ts";
import styles from "./carrier-connections.module.css";
export type RowAction = "detail" | "edit" | "sync" | "disconnect";
export function CarrierConnectionToolbar({
  query,
  providers,
  onChange,
}: {
  query: CarrierQuery;
  providers: readonly { id: string; name: string }[];
  onChange: (q: Partial<CarrierQuery>) => void;
}) {
  return (
    <div className={styles.toolbar}>
      <label className={styles.search}>
        <Search size={16} aria-hidden="true" />
        <TextInput
          aria-label="Tìm tài khoản kết nối"
          placeholder="Tìm hãng, tên hoặc tài khoản..."
          value={query.search}
          onChange={(e) => onChange({ search: e.target.value })}
        />
      </label>
      <Select
        aria-label="Lọc hãng vận chuyển"
        value={query.provider}
        onChange={(e) => onChange({ provider: e.target.value })}
      >
        <option value="all">Tất cả hãng</option>
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Lọc trạng thái kết nối"
        value={query.status}
        onChange={(e) =>
          onChange({ status: e.target.value as CarrierQuery["status"] })
        }
      >
        <option value="all">Tất cả trạng thái</option>
        {Object.entries(CONNECTION_STATES).map(([key, state]) => (
          <option key={key} value={key}>
            {state.label}
          </option>
        ))}
      </Select>
      <Button
        variant="secondary"
        pressEffect="none"
        onClick={() => onChange({ search: "", provider: "all", status: "all" })}
      >
        Đặt lại bộ lọc
      </Button>
      <div className={styles.chips} aria-label="Bộ lọc đang áp dụng">
        {query.search && (
          <Button
            variant="ghost"
            pressEffect="none"
            onClick={() => onChange({ search: "" })}
          >
            Từ khóa: {query.search}
            <X size={14} />
          </Button>
        )}
        {query.provider !== "all" && (
          <Button
            variant="ghost"
            pressEffect="none"
            onClick={() => onChange({ provider: "all" })}
          >
            Hãng: {providers.find((p) => p.id === query.provider)?.name}
            <X size={14} />
          </Button>
        )}
        {query.status !== "all" && (
          <Button
            variant="ghost"
            pressEffect="none"
            onClick={() => onChange({ status: "all" })}
          >
            Trạng thái: {CONNECTION_STATES[query.status].label}
            <X size={14} />
          </Button>
        )}
      </div>
    </div>
  );
}
export function CarrierConnectionTable({
  model,
  known,
  sync,
  onAction,
}: {
  model: ReturnType<typeof selectConnections>;
  known: boolean;
  sync: Readonly<Record<string, SyncPresentation>>;
  onAction: (action: RowAction, row: CarrierConnectionRow) => void;
}) {
  return (
    <div
      className={styles.tableScroll}
      tabIndex={0}
      role="region"
      aria-label="Bảng tài khoản kết nối cuộn ngang"
    >
      <table className={styles.table}>
        <caption className={styles.srOnly}>
          Tài khoản kết nối hãng vận chuyển
        </caption>
        <colgroup>
          {CARRIER_COLUMNS.map((col) => (
            <col key={col.label} style={{ width: col.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {CARRIER_COLUMNS.map((col) => (
              <th key={col.label} scope="col">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {model.rows.map((row, index) => (
            <tr key={row.id}>
              <td>{model.start + index}</td>
              <td>
                <div className={styles.carrierName}>
                  <span className={styles.logo}>
                    <Truck size={18} />
                  </span>
                  <strong>{row.providerName}</strong>
                </div>
              </td>
              <td>
                <strong className={styles.wrap}>{row.displayName}</strong>
                <span className={styles.muted}>
                  {row.loginIdentifier ?? "—"}
                </span>
              </td>
              <td>
                <StatusBadge ok={CONNECTION_STATES[row.status].ok}>
                  {CONNECTION_STATES[row.status].label}
                </StatusBadge>
              </td>
              <td>
                <Button
                  variant="ghost"
                  pressEffect="none"
                  onClick={() => onAction("sync", row)}
                >
                  Quản lý đồng bộ
                </Button>
                {sync[row.id]?.items.length ? (
                  <div className={styles.syncSummary}>
                    {sync[row.id].items.slice(0, 2).map((item) => (
                      <div key={item.id}>
                        <span>
                          {item.label}: {SYNC_LABELS[item.state]}
                        </span>
                        {item.progress !== undefined && (
                          <progress
                            aria-label={`Tiến độ ${item.label}`}
                            max={100}
                            value={Math.min(100, Math.max(0, item.progress))}
                          />
                        )}
                      </div>
                    ))}
                    {sync[row.id].items.length > 2 && (
                      <span className={styles.muted}>
                        +{sync[row.id].items.length - 2} loại dữ liệu
                      </span>
                    )}
                  </div>
                ) : (
                  <span className={styles.muted}>Chưa khả dụng</span>
                )}
              </td>
              <td>{displayTime(latestSyncSuccess(sync[row.id]))}</td>
              <td>
                <div className={styles.actions}>
                  {(
                    [
                      { action: "detail", label: "Chi tiết", Icon: Eye },
                      { action: "edit", label: "Chỉnh sửa", Icon: Pencil },
                      { action: "sync", label: "Đồng bộ", Icon: Settings },
                      {
                        action: "disconnect",
                        label: "Ngắt kết nối",
                        Icon: Trash2,
                      },
                    ] as const
                  ).map(({ action, label, Icon }) => (
                    <Button
                      key={action}
                      icon
                      variant="ghost"
                      pressEffect="none"
                      aria-label={`${label} ${row.displayName}`}
                      onClick={() => onAction(action, row)}
                    >
                      <Icon size={14} />
                    </Button>
                  ))}
                </div>
              </td>
            </tr>
          ))}
          {!model.rows.length && (
            <tr>
              <td colSpan={7} className={styles.empty}>
                <Truck size={32} />
                <strong>
                  {known
                    ? "Không có kết quả phù hợp"
                    : "Chưa tích hợp dữ liệu kết nối"}
                </strong>
                <span>
                  {known
                    ? "Thử thay đổi hoặc đặt lại bộ lọc."
                    : "Chưa thể xác định danh sách tài khoản từ hệ thống hãng."}
                </span>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export function CarrierConnectionPagination({
  model,
  known,
  onChange,
}: {
  model: ReturnType<typeof selectConnections>;
  known: boolean;
  onChange: (q: Partial<CarrierQuery>) => void;
}) {
  return (
    <footer className={styles.pagination}>
      <div className={styles.summary}>
        Hiển thị{" "}
        <strong>
          {known ? `${model.start}–${model.end} / ${model.total}` : "—"}
        </strong>{" "}
        tài khoản
        <label>
          Số dòng:
          <Select
            aria-label="Số dòng tài khoản mỗi trang"
            value={model.pageSize}
            onChange={(e) =>
              onChange({ pageSize: Number(e.target.value), page: 1 })
            }
          >
            {[5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n} / trang
              </option>
            ))}
          </Select>
        </label>
      </div>
      <nav className={styles.actions} aria-label="Phân trang tài khoản">
        {(
          [
            {
              label: "Trang đầu tài khoản",
              to: 1,
              disabled: model.page === 1,
              Icon: ChevronsLeft,
            },
            {
              label: "Trang trước tài khoản",
              to: model.page - 1,
              disabled: model.page === 1,
              Icon: ChevronLeft,
            },
            {
              label: "Trang sau tài khoản",
              to: model.page + 1,
              disabled: model.page === model.totalPages,
              Icon: ChevronRight,
            },
            {
              label: "Trang cuối tài khoản",
              to: model.totalPages,
              disabled: model.page === model.totalPages,
              Icon: ChevronsRight,
            },
          ] as const
        ).map(({ label, to, disabled, Icon }, index) => (
          <span key={label}>
            {index === 2 && (
              <span
                className={styles.pageNumber}
                aria-current={known ? "page" : undefined}
              >
                {known ? `${model.page} / ${model.totalPages}` : "—"}
              </span>
            )}
            <Button
              icon
              variant="secondary"
              pressEffect="none"
              aria-label={label}
              disabled={!known || disabled}
              onClick={() => onChange({ page: to })}
            >
              <Icon size={14} />
            </Button>
          </span>
        ))}
      </nav>
      <span className={styles.srOnly}>{UNAVAILABLE}</span>
    </footer>
  );
}
