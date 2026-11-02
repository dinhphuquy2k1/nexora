"use client";
import { useState } from "react";
import { Button, Select, TextInput } from "@nexora/ui";
import {
  Truck,
  Search,
  X,
  Filter,
  RefreshCw,
  Clock,
  Copy,
  Check,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { pageWindow } from "../../lib/pagination.ts";
import { CarrierFilterPopover } from "./CarrierFilterPopover.tsx";
import { CarrierRowActions, type RowAction } from "./CarrierRowActions.tsx";
import {
  CARRIER_COLUMNS,
  CONNECTION_STATES,
  FILTER_FIELDS,
  FILTER_OPERATORS,
  FILTER_STATUS_OPTIONS,
  SYNC_LABELS,
  UNAVAILABLE,
  displayTime,
  latestSyncSuccess,
  selectConnections,
} from "./presentation.ts";
import type {
  CarrierConnectionRow,
  CarrierQuery,
  CarrierProviderPresentation,
  CarrierFilterCondition,
  SyncPresentation,
} from "./types.ts";
import styles from "./carrier-connections.module.css";
export type { RowAction } from "./CarrierRowActions.tsx";
export function CarrierLogo({
  row,
}: {
  row: Pick<CarrierConnectionRow, "provider" | "preview">;
}) {
  return (
    <span className={styles.logo} data-tone={row.preview?.tone ?? "primary"}>
      {row.preview?.code ??
        (row.provider === "uniship"
          ? "UNI"
          : row.provider.slice(0, 3).toUpperCase())}
    </span>
  );
}
export function ConnectionBadge({ row }: { row: CarrierConnectionRow }) {
  return (
    <span
      className={styles.connectionBadge}
      data-tone={CONNECTION_STATES[row.status].ok ? "good" : "bad"}
    >
      <span />
      {row.preview?.environment === "sandbox"
        ? "Sandbox"
        : CONNECTION_STATES[row.status].label}
    </span>
  );
}
export function CarrierConnectionToolbar({
  query,
  providers,
  allowEnvironment,
  onChange,
  onAdd,
}: {
  query: CarrierQuery;
  providers: readonly CarrierProviderPresentation[];
  known?: boolean;
  total?: number;
  allowEnvironment: boolean;
  onChange: (q: Partial<CarrierQuery>) => void;
  onAdd: (f: CarrierFilterCondition) => boolean;
}) {
  const label = (f: CarrierFilterCondition) => {
    if (f.field === "carrier")
      return providers.find((p) => p.id === f.value)?.name ?? f.value;
    if (f.field === "status")
      return (
        FILTER_STATUS_OPTIONS.find((s) => s.value === f.value)?.label ?? f.value
      );
    return f.value;
  };
  return (
    <>
      <div className={styles.toolbar} data-carrier-toolbar>
        <div className={styles.toolbarLeft}>
          <CarrierFilterPopover
            conditions={query.conditions}
            providers={providers}
            allowEnvironment={allowEnvironment}
            onAdd={onAdd}
          />
          <div className={styles.search}>
            <Search size={14} />
            <TextInput
              aria-label="Tìm tài khoản kết nối"
              value={query.search}
              placeholder="Tìm theo tên hãng, tài khoản..."
              maxLength={200}
              onChange={(e) => onChange({ search: e.target.value })}
            />
            {query.search && (
              <Button
                icon
                variant="ghost"
                aria-label="Xóa từ khóa tìm kiếm"
                onClick={() => onChange({ search: "" })}
              >
                <X size={14} />
              </Button>
            )}
          </div>
        </div>
        <div className={styles.toolbarRight}>
          <Button
            variant="secondary"
            aria-label="Làm mới danh sách"
            disabled
            title={UNAVAILABLE}
          >
            <RefreshCw size={14} />
            Làm mới
          </Button>
        </div>
      </div>
      {query.conditions.length > 0 && (
        <div className={styles.chips} aria-label="Bộ lọc đang áp dụng">
          <span>
            <Filter size={12} />
            Đang áp dụng:
          </span>
          {query.conditions.map((f) => (
            <span className={styles.filterChip} key={f.id}>
              <span>{FILTER_FIELDS.find((c) => c.id === f.field)?.label}:</span>
              <em>{FILTER_OPERATORS[f.operator]}</em>
              <strong>{label(f)}</strong>
              <Button
                icon
                variant="ghost"
                aria-label={`Xóa điều kiện ${f.id}`}
                onClick={() =>
                  onChange({
                    conditions: query.conditions.filter((c) => c.id !== f.id),
                  })
                }
              >
                <X size={12} />
              </Button>
            </span>
          ))}
          <Button variant="ghost" onClick={() => onChange({ conditions: [] })}>
            Xóa tất cả
          </Button>
        </div>
      )}
    </>
  );
}
function CopyIdentifier({ value }: { value: string }) {
  const [result, setResult] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <>
      <Button
        icon
        variant="ghost"
        aria-label="Sao chép tên tài khoản"
        title={result === "copied" ? "Đã sao chép" : "Sao chép tên tài khoản"}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setResult("copied");
          } catch {
            setResult("failed");
          }
        }}
      >
        {result === "copied" ? <Check size={12} /> : <Copy size={12} />}
      </Button>
      {result !== "idle" && (
        <span role="status" className={styles.srOnly}>
          {result === "copied"
            ? "Đã sao chép tên tài khoản"
            : "Không thể sao chép tên tài khoản"}
        </span>
      )}
    </>
  );
}
function SummaryIcon({ state }: { state: import("./types.ts").SyncState }) {
  const Icon = state === "running" ? RefreshCw : CheckCircle2;
  if (state === "failed") return <AlertCircle size={14} />;
  return <Icon size={14} />;
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
          {CARRIER_COLUMNS.map((c) => (
            <col key={c.label} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {CARRIER_COLUMNS.map((c) => (
              <th
                key={c.label}
                scope="col"
                style={
                  c.sizing === "width"
                    ? { width: c.width }
                    : { minWidth: c.width }
                }
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {model.rows.map((row, index) => (
            <tr key={row.id} data-carrier-row={row.id}>
              <td>{model.start + index}</td>
              <td>
                <div className={styles.carrierName}>
                  <CarrierLogo row={row} />
                  <div>
                    <div className={styles.providerTitle}>
                      <strong>{row.providerName}</strong>
                      <span
                        className={styles.apiTag}
                        title="Thông tin hãng; chưa tích hợp"
                      >
                        API
                      </span>
                    </div>
                    <span className={styles.muted}>
                      {row.providerName} (
                      {row.preview?.code ??
                        (row.provider === "uniship" ? "UNI" : "—")}
                      )
                    </span>
                  </div>
                </div>
              </td>
              <td>
                <strong className={styles.accountName} title={row.displayName}>
                  {row.displayName}
                </strong>
                <div className={styles.identifier}>
                  <span>{row.loginIdentifier ?? "—"}</span>
                  {row.loginIdentifier && (
                    <CopyIdentifier value={row.loginIdentifier} />
                  )}
                </div>
              </td>
              <td>
                <ConnectionBadge row={row} />
              </td>
              <td>
                <div className={styles.syncSummary}>
                  {sync[row.id]?.items.length ? (
                    sync[row.id].items.slice(0, 2).map((item) => (
                      <div key={item.id}>
                        <span data-state={item.state}>
                          <SummaryIcon state={item.state} />
                          <strong>{item.label.split(" (")[0]}:</strong>{" "}
                          <span>{SYNC_LABELS[item.state]}</span>
                          {item.progress !== undefined
                            ? ` ${item.progress}%`
                            : ""}
                          {item.state === "completed" &&
                            item.total !== undefined && (
                              <small>
                                ({item.total.toLocaleString("vi-VN")})
                              </small>
                            )}
                        </span>
                        {item.progress !== undefined && (
                          <progress
                            aria-label={`Tiến độ ${item.label}`}
                            max={100}
                            value={Math.max(0, Math.min(100, item.progress))}
                          />
                        )}
                      </div>
                    ))
                  ) : (
                    <span className={styles.muted}>Chưa khả dụng</span>
                  )}
                </div>
              </td>
              <td>
                <div className={styles.timestamp}>
                  <span className={styles.clockIcon}>
                    <Clock size={14} />
                  </span>
                  <div>
                    <strong>
                      {row.preview?.lastSyncDisplay ??
                        displayTime(latestSyncSuccess(sync[row.id]))}
                    </strong>
                    <div className={styles.timestampMeta}>
                      <span data-recent={row.preview?.lastSyncRecent}>
                        {row.preview?.lastSyncRelative ?? "—"}
                      </span>
                      <small>· {row.preview?.lastSyncSource ?? "—"}</small>
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <CarrierRowActions row={row} onAction={onAction} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!model.rows.length && (
        <div className={styles.empty} role="status">
          <div className={styles.emptyIcon}>
            <Truck size={20} />
          </div>
          <strong>
            {known
              ? "Không tìm thấy tài khoản hãng phù hợp"
              : "Chưa tích hợp dữ liệu kết nối"}
          </strong>
          <p>
            {known
              ? "Không có hồ sơ nào trùng khớp với từ khóa tìm kiếm hoặc bộ lọc trạng thái hiện tại."
              : "Chưa thể xác định danh sách tài khoản từ hệ thống hãng. Thao tác kết nối và đồng bộ chưa khả dụng."}
          </p>
        </div>
      )}
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
  const pages = known ? Math.max(1, model.totalPages) : 1;
  const start = known
    ? model.total === 0
      ? 0
      : (model.page - 1) * model.pageSize + 1
    : 0;
  const end = known ? Math.min(model.page * model.pageSize, model.total) : 0;
  const rangeDisplay = !known ? "—" : `${start}–${end}`;
  const windowPages = known ? pageWindow(model.page, pages) : [1];

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
      disabled={!known || disabled}
      onClick={() => onChange({ page: to })}
    >
      <Icon size={14} />
    </Button>
  );

  return (
    <footer
      className={styles.pagination}
      data-carrier-pagination
      aria-label="Phân trang tài khoản"
    >
      <div className={styles.summary}>
        <div className={styles.paginationSummary}>
          <span>Hiển thị</span>{" "}
          <strong className={styles.paginationRange}>{rangeDisplay}</strong>{" "}
          <span>/</span>{" "}
          <span data-carrier-count>{!known ? "—" : model.total} tài khoản</span>
        </div>
        <span className={styles.separator} aria-hidden="true">
          |
        </span>
        <label className={styles.pageSizeLabel}>
          <span>Số dòng:</span>
          <div className={styles.pageSizeSelectWrapper}>
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
          </div>
        </label>
      </div>
      <nav
        className={styles.pageButtons}
        role="group"
        aria-label="Trang tài khoản"
      >
        {nav("Trang đầu tài khoản", 1, model.page <= 1, ChevronsLeft)}
        {nav(
          "Trang trước tài khoản",
          model.page - 1,
          model.page <= 1,
          ChevronLeft,
        )}
        {windowPages.map((pageNumber, i, window) => (
          <span key={pageNumber} className={styles.pageNumber}>
            {i > 0 && pageNumber - window[i - 1] > 1 && (
              <span aria-hidden="true">…</span>
            )}
            <Button
              variant={pageNumber === model.page ? "emphasis" : "secondary"}
              aria-label={`Trang tài khoản ${pageNumber}`}
              aria-current={
                known && pageNumber === model.page ? "page" : undefined
              }
              disabled={!known}
              onClick={() => onChange({ page: pageNumber })}
            >
              {pageNumber}
            </Button>
          </span>
        ))}
        {nav(
          "Trang sau tài khoản",
          model.page + 1,
          model.page >= pages,
          ChevronRight,
        )}
        {nav("Trang cuối tài khoản", pages, model.page >= pages, ChevronsRight)}
      </nav>
    </footer>
  );
}
