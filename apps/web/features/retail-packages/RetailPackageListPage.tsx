"use client";
/**
 * Retail Package List Page — M3 Milestone
 *
 * UI-only page. No real backend API exists for retail packages yet.
 * In production: renders an honest planned/empty state.
 * In development: displays synthetic test fixtures for visual verification.
 *
 * Architecture:
 * - Presentation only; no API calls in this component.
 * - No fabricated fees, statuses, or mock business behavior in production paths.
 * - All state is local; no global store.
 * - Exports plain RetailPackageListPage component; server page.tsx wraps it.
 */

import { useState, useMemo, useCallback, useRef } from "react";
import {
  Package,
  Search,
  Plus,
  RefreshCw,
  FileSpreadsheet,
  Eye,
  X,
  Columns3,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@nexora/ui";
import type {
  RetailPackage,
  StatusTabKey,
  RetailQuery,
  ColumnVisibility,
} from "./types.ts";
import {
  RETAIL_PACKAGE_COLUMNS,
  STATUS_TABS,
  DEFAULT_COLUMN_VISIBILITY,
  PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
} from "./columns.ts";
import { CreatePackageDrawer } from "./CreatePackageDrawer.tsx";
import { PackageDetailDrawer } from "./PackageDetailDrawer.tsx";
import styles from "./retail-packages.module.css";

/** Minimal props for the page. No ownerId needed (no API). */
export interface RetailPackageListPageProps {
  /**
   * Initial packages to display. In production this should be empty []
   * until a real shipment API is available. In tests, pass synthetic fixtures.
   */
  initialPackages: readonly RetailPackage[];
}

function getStatusClass(status: string): string {
  switch (status) {
    case "to_origin":
      return styles.statusToOrigin ?? "";
    case "at_origin":
      return styles.statusAtOrigin ?? "";
    case "in_transit":
      return styles.statusInTransit ?? "";
    case "at_dest":
      return styles.statusAtDest ?? "";
    case "delivered":
      return styles.statusDelivered ?? "";
    case "disputed":
      return styles.statusDisputed ?? "";
    default:
      return styles.statusToOrigin ?? "";
  }
}

function formatCNY(v: number): string {
  return `¥${v.toLocaleString("zh-CN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}

function formatVND(v: number): string {
  return `${v.toLocaleString("vi-VN")}đ`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleCopy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setCopied(false);
        timer.current = null;
      }, 1500);
    });
  }

  return (
    <button
      type="button"
      className={styles.copyButton}
      onClick={handleCopy}
      aria-label={copied ? "Đã sao chép" : `Sao chép ${text}`}
      title={copied ? "Đã sao chép" : "Sao chép mã vận đơn"}
    >
      {copied ? (
        <Check size={12} aria-hidden="true" />
      ) : (
        <Copy size={12} aria-hidden="true" />
      )}
    </button>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span className={`${styles.statusBadge} ${getStatusClass(status)}`}>
      <span className={styles.statusDot} aria-hidden="true" />
      {label}
    </span>
  );
}

interface ColumnPickerProps {
  visibility: ColumnVisibility;
  onChange: (id: string, visible: boolean) => void;
  onClose: () => void;
}

function ColumnPicker({ visibility, onChange, onClose }: ColumnPickerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={panelRef}
      className={styles.colPickerPanel}
      role="dialog"
      aria-label="Chọn cột hiển thị"
    >
      <div className={styles.colPickerTitle}>Cột hiển thị</div>
      {RETAIL_PACKAGE_COLUMNS.map((col) => {
        const isRequired = col.required;
        const checked = visibility[col.id] ?? col.defaultVisible;
        return (
          <label
            key={col.id}
            className={`${styles.colPickerRow}${isRequired ? ` ${styles.colPickerRowDisabled}` : ""}`}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={!!isRequired}
              onChange={(e) => {
                if (!isRequired) onChange(col.id, e.target.checked);
              }}
            />
            {col.label}
          </label>
        );
      })}
      <div
        style={{
          padding: "var(--space-2) var(--space-3)",
          borderTop: "1px solid var(--color-border)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            fontSize: "var(--font-size-xs)",
            color: "var(--color-text-muted)",
            cursor: "pointer",
            background: "none",
            border: "none",
            padding: 0,
          }}
        >
          Đóng
        </button>
      </div>
    </div>
  );
}

export function RetailPackageListPage({
  initialPackages,
}: RetailPackageListPageProps) {
  const [query, setQuery] = useState<RetailQuery>({
    status: "all",
    search: "",
    page: 1,
    pageSize: PAGE_SIZE,
    filters: [],
  });
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(
    DEFAULT_COLUMN_VISIBILITY,
  );
  const [showColPicker, setShowColPicker] = useState(false);
  const [detailPackage, setDetailPackage] = useState<RetailPackage | null>(
    null,
  );
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);

  // Filter packages client-side (no API)
  const filtered = useMemo(() => {
    let result = [...initialPackages];
    if (query.status !== "all") {
      result = result.filter((p) => p.status === query.status);
    }
    if (query.search.trim()) {
      const q = query.search.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.trackingCode.toLowerCase().includes(q) ||
          p.productName.toLowerCase().includes(q) ||
          p.carrierName.toLowerCase().includes(q),
      );
    }
    // Apply advanced filter conditions
    for (const cond of query.filters) {
      result = result.filter((p) => {
        const val = (p as unknown as Record<string, unknown>)[cond.field];
        const strVal = String(val ?? "").toLowerCase();
        switch (cond.operator) {
          case "contains":
            return strVal.includes(cond.value.toLowerCase());
          case "not_contains":
            return !strVal.includes(cond.value.toLowerCase());
          case "equals":
            return strVal === cond.value.toLowerCase();
          case "not_equals":
            return strVal !== cond.value.toLowerCase();
          default:
            return true;
        }
      });
    }
    return result;
  }, [initialPackages, query.status, query.search, query.filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / query.pageSize));
  const currentPage = Math.min(query.page, totalPages);
  const paginated = filtered.slice(
    (currentPage - 1) * query.pageSize,
    currentPage * query.pageSize,
  );

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: initialPackages.length };
    for (const pkg of initialPackages) {
      counts[pkg.status] = (counts[pkg.status] ?? 0) + 1;
    }
    return counts;
  }, [initialPackages]);

  const toggleColVisibility = useCallback((id: string, visible: boolean) => {
    setColumnVisibility((prev) => ({ ...prev, [id]: visible }));
  }, []);

  const visibleColumns = useMemo(
    () =>
      RETAIL_PACKAGE_COLUMNS.filter(
        (col) => columnVisibility[col.id] ?? col.defaultVisible,
      ),
    [columnVisibility],
  );

  function removeFilter(id: string) {
    setQuery((q) => ({
      ...q,
      filters: q.filters.filter((f) => f.id !== id),
      page: 1,
    }));
  }

  const isProduction = initialPackages.length === 0;

  return (
    <div className={styles.listPage} id="retail-packages-list-page">
      {/* Command deck */}
      <section
        className={styles.commandDeck}
        aria-label="Command deck kiện lẻ TMĐT"
      >
        {/* Title row */}
        <div className={styles.titleRow}>
          <div className={styles.titleGroup}>
            <span className={styles.brandIcon} aria-hidden="true">
              <Package size={18} />
            </span>
            <h1 id="retail-packages-heading" tabIndex={-1}>
              QUẢN LÝ KIỆN LẺ TMĐT
            </h1>
          </div>
          <div className={styles.headerActions}>
            <Button
              variant="secondary"
              disabled
              aria-label="Xuất Excel (chưa khả dụng)"
              title="Chức năng xuất báo cáo kiện lẻ ra tệp Excel hiện chưa được hỗ trợ bởi hệ thống máy chủ."
              className={styles.exportButton}
            >
              <FileSpreadsheet
                size={14}
                className={styles.exportIcon}
                aria-hidden="true"
              />
              <span className={styles.exportLabel}>Xuất Excel</span>
            </Button>
            <Button
              variant="emphasis"
              onClick={() => setShowCreateDrawer(true)}
              aria-label="Tạo kiện lẻ mới"
            >
              <Plus size={16} aria-hidden="true" />
              <span>Tạo kiện lẻ</span>
            </Button>
          </div>
        </div>

        {/* Status tab band */}
        <div
          className={styles.statusBand}
          role="tablist"
          aria-label="Lọc theo trạng thái"
        >
          {STATUS_TABS.map((tab) => {
            const isActive = query.status === tab.key;
            const count = tabCounts[tab.key] ?? 0;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`${styles.statusTab}${isActive ? ` ${styles.statusTabActive}` : ""}`}
                onClick={() =>
                  setQuery((q) => ({
                    ...q,
                    status: tab.key as StatusTabKey,
                    page: 1,
                  }))
                }
                id={`retail-tab-${tab.key}`}
                aria-controls="retail-packages-results"
              >
                {tab.label}
                <span
                  className={`${styles.tabCount}${isActive ? ` ${styles.tabCountActive}` : ` ${styles.tabCountInactive}`}`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.searchGroup}>
            <div className={styles.searchWrapper}>
              <Search
                size={14}
                className={styles.searchIcon}
                aria-hidden="true"
              />
              <input
                id="retail-packages-search"
                type="search"
                className={styles.searchInput}
                placeholder="Tìm theo mã vận đơn, tên sản phẩm…"
                value={query.search}
                onChange={(e) =>
                  setQuery((q) => ({ ...q, search: e.target.value, page: 1 }))
                }
                aria-label="Tìm kiếm kiện lẻ"
              />
            </div>
          </div>
          <div className={styles.toolbarRight}>
            <div className={styles.colPickerWrapper}>
              <Button
                variant="secondary"
                onClick={() => setShowColPicker((v) => !v)}
                aria-label="Tùy chọn cột"
                aria-expanded={showColPicker}
                aria-haspopup="dialog"
              >
                <Columns3 size={14} aria-hidden="true" />
                <span style={{ marginLeft: "4px" }}>Cột</span>
              </Button>
              {showColPicker && (
                <ColumnPicker
                  visibility={columnVisibility}
                  onChange={toggleColVisibility}
                  onClose={() => setShowColPicker(false)}
                />
              )}
            </div>
            <Button
              variant="secondary"
              disabled
              aria-label="Làm mới dữ liệu (chưa khả dụng)"
              title="Dữ liệu thực chưa khả dụng."
            >
              <RefreshCw size={14} aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Active filter chips */}
        {query.filters.length > 0 && (
          <div
            className={styles.filterChips}
            role="group"
            aria-label="Bộ lọc đang áp dụng"
          >
            {query.filters.map((cond) => (
              <span key={cond.id} className={styles.filterChip}>
                {cond.displayLabel}
                <button
                  type="button"
                  className={styles.chipRemove}
                  onClick={() => removeFilter(cond.id)}
                  aria-label={`Xóa bộ lọc: ${cond.displayLabel}`}
                >
                  <X size={10} aria-hidden="true" />
                </button>
              </span>
            ))}
            <button
              type="button"
              className={styles.chipRemove}
              onClick={() => setQuery((q) => ({ ...q, filters: [], page: 1 }))}
              style={{
                fontSize: "var(--font-size-xs)",
                padding: "2px 6px",
                color: "var(--color-text-muted)",
              }}
            >
              Xóa tất cả
            </button>
          </div>
        )}
      </section>

      {/* Data card */}
      <section
        className={styles.dataCard}
        id="retail-packages-results"
        role="tabpanel"
        aria-labelledby={`retail-tab-${query.status}`}
      >
        {isProduction ? (
          /* Honest planned state: no real data available yet */
          <div className={styles.emptyState} aria-live="polite">
            <Package
              size={48}
              className={styles.emptyIcon}
              aria-hidden="true"
            />
            <h2 className={styles.emptyTitle}>Tính năng đang phát triển</h2>
            <p className={styles.emptyDescription}>
              Quản lý kiện lẻ TMĐT sẽ tích hợp với Shipment API khi backend được
              triển khai. Hiện tại chưa có dữ liệu thực.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className={styles.tableScroll}>
              <table
                className={styles.table}
                aria-label="Danh sách kiện lẻ TMĐT"
              >
                <colgroup>
                  {visibleColumns.map((col) => (
                    <col key={col.id} />
                  ))}
                  <col /* actions */ />
                </colgroup>
                <thead className={styles.tableHead}>
                  <tr>
                    {visibleColumns.map((col) => (
                      <th
                        key={col.id}
                        scope="col"
                        className={
                          col.align === "right"
                            ? styles.alignRight
                            : col.align === "center"
                              ? styles.alignCenter
                              : undefined
                        }
                      >
                        {col.label}
                      </th>
                    ))}
                    <th scope="col" className={styles.alignCenter}>
                      CHI TIẾT
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td
                        colSpan={visibleColumns.length + 1}
                        style={{
                          textAlign: "center",
                          padding: "var(--space-8)",
                          color: "var(--color-text-muted)",
                        }}
                      >
                        Không tìm thấy kiện lẻ phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    paginated.map((pkg, rowIdx) => (
                      <tr
                        key={pkg.id}
                        className={styles.tableRow}
                        data-package-id={pkg.id}
                      >
                        {visibleColumns.map((col) => {
                          switch (col.id) {
                            case "index":
                              return (
                                <td
                                  key={col.id}
                                  className={`${styles.indexCell} ${styles.alignCenter}`}
                                >
                                  {(currentPage - 1) * query.pageSize +
                                    rowIdx +
                                    1}
                                </td>
                              );
                            case "trackingCode":
                              return (
                                <td key={col.id}>
                                  <div
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "6px",
                                    }}
                                  >
                                    <span className={styles.trackingCode}>
                                      {pkg.trackingCode}
                                    </span>
                                    <CopyButton text={pkg.trackingCode} />
                                  </div>
                                </td>
                              );
                            case "carrier":
                              return (
                                <td key={col.id}>
                                  <span
                                    style={{
                                      fontSize: "var(--font-size-xs)",
                                      fontWeight: "var(--font-weight-semibold)",
                                      color: "var(--color-primary)",
                                    }}
                                  >
                                    {pkg.carrierCode}
                                  </span>{" "}
                                  <span
                                    style={{
                                      fontSize: "var(--font-size-xs)",
                                      color: "var(--color-text-muted)",
                                    }}
                                  >
                                    {pkg.carrierName}
                                  </span>
                                </td>
                              );
                            case "productName":
                              return (
                                <td
                                  key={col.id}
                                  className={styles.productName}
                                  title={pkg.productName}
                                >
                                  {pkg.productName}
                                </td>
                              );
                            case "originWarehouseDate":
                              return (
                                <td
                                  key={col.id}
                                  className={`${styles.dateCell} ${styles.alignCenter}`}
                                >
                                  {pkg.originWarehouseDate ?? "—"}
                                </td>
                              );
                            case "originWarehouseExportDate":
                              return (
                                <td
                                  key={col.id}
                                  className={`${styles.dateCell} ${styles.alignCenter}`}
                                >
                                  {pkg.originWarehouseExportDate ?? "—"}
                                </td>
                              );
                            case "destWarehouseDate":
                              return (
                                <td
                                  key={col.id}
                                  className={`${styles.dateCell} ${styles.alignCenter}`}
                                >
                                  {pkg.destWarehouseDate ?? "—"}
                                </td>
                              );
                            case "destWarehouseExportDate":
                              return (
                                <td
                                  key={col.id}
                                  className={`${styles.dateCell} ${styles.alignCenter}`}
                                >
                                  {pkg.destWarehouseExportDate ?? "—"}
                                </td>
                              );
                            case "weightKg":
                              return (
                                <td
                                  key={col.id}
                                  className={`${styles.numericCell} ${styles.alignRight}`}
                                >
                                  {pkg.weightKg.toFixed(1)}
                                </td>
                              );
                            case "unitPriceCNY":
                              return (
                                <td
                                  key={col.id}
                                  className={`${styles.numericCell} ${styles.alignRight}`}
                                >
                                  {formatCNY(pkg.unitPriceCNY)}
                                </td>
                              );
                            case "domesticShipCNY":
                              return (
                                <td
                                  key={col.id}
                                  className={`${styles.numericCell} ${styles.alignRight}`}
                                >
                                  {pkg.domesticShipCNY > 0
                                    ? formatCNY(pkg.domesticShipCNY)
                                    : "—"}
                                </td>
                              );
                            case "valueCNY":
                              return (
                                <td
                                  key={col.id}
                                  className={`${styles.numericCell} ${styles.alignRight}`}
                                >
                                  {formatCNY(pkg.valueCNY)}
                                </td>
                              );
                            case "packageCount":
                              return (
                                <td
                                  key={col.id}
                                  className={`${styles.numericCell} ${styles.alignCenter}`}
                                >
                                  {pkg.packageCount}
                                </td>
                              );
                            case "itemCount":
                              return (
                                <td
                                  key={col.id}
                                  className={`${styles.numericCell} ${styles.alignCenter}`}
                                >
                                  {pkg.itemCount}
                                </td>
                              );
                            case "hasInsurance":
                              return (
                                <td key={col.id} className={styles.alignCenter}>
                                  {pkg.hasInsurance ? (
                                    <span
                                      className={styles.boolTrue}
                                      aria-label="Có bảo hiểm"
                                    >
                                      ✓
                                    </span>
                                  ) : (
                                    <span
                                      className={styles.boolFalse}
                                      aria-label="Không bảo hiểm"
                                    >
                                      —
                                    </span>
                                  )}
                                </td>
                              );
                            case "hasInspection":
                              return (
                                <td key={col.id} className={styles.alignCenter}>
                                  {pkg.hasInspection ? (
                                    <span
                                      className={styles.boolTrue}
                                      aria-label="Có kiểm đếm"
                                    >
                                      ✓
                                    </span>
                                  ) : (
                                    <span
                                      className={styles.boolFalse}
                                      aria-label="Không kiểm đếm"
                                    >
                                      —
                                    </span>
                                  )}
                                </td>
                              );
                            case "hasWoodenCrate":
                              return (
                                <td key={col.id} className={styles.alignCenter}>
                                  {pkg.hasWoodenCrate ? (
                                    <span
                                      className={styles.boolTrue}
                                      aria-label="Đóng gỗ"
                                    >
                                      ✓
                                    </span>
                                  ) : (
                                    <span
                                      className={styles.boolFalse}
                                      aria-label="Không đóng gỗ"
                                    >
                                      —
                                    </span>
                                  )}
                                </td>
                              );
                            case "hasBubbleWrap":
                              return (
                                <td key={col.id} className={styles.alignCenter}>
                                  {pkg.hasBubbleWrap ? (
                                    <span
                                      className={styles.boolTrue}
                                      aria-label="Bọt khí"
                                    >
                                      ✓
                                    </span>
                                  ) : (
                                    <span
                                      className={styles.boolFalse}
                                      aria-label="Không bọt khí"
                                    >
                                      —
                                    </span>
                                  )}
                                </td>
                              );
                            case "status":
                              return (
                                <td key={col.id} className={styles.alignCenter}>
                                  <StatusBadge
                                    status={pkg.status}
                                    label={pkg.statusText}
                                  />
                                </td>
                              );
                            case "totalAmountVND":
                              return (
                                <td
                                  key={col.id}
                                  className={`${styles.amountCell} ${styles.alignRight}`}
                                >
                                  {formatVND(pkg.totalAmountVND)}
                                </td>
                              );
                            default:
                              return <td key={col.id}>—</td>;
                          }
                        })}
                        <td className={styles.alignCenter}>
                          <div className={styles.rowActions}>
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() => setDetailPackage(pkg)}
                              aria-label={`Xem lộ trình: ${pkg.trackingCode}`}
                              title="Xem lộ trình vận chuyển"
                            >
                              <Eye size={13} aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div
              className={styles.mobileCards}
              aria-label="Danh sách kiện lẻ TMĐT (thẻ)"
            >
              {paginated.length === 0 ? (
                <p
                  style={{
                    textAlign: "center",
                    color: "var(--color-text-muted)",
                    padding: "var(--space-6)",
                  }}
                >
                  Không tìm thấy kiện lẻ phù hợp.
                </p>
              ) : (
                paginated.map((pkg) => (
                  <div
                    key={pkg.id}
                    className={styles.mobileCard}
                    onClick={() => setDetailPackage(pkg)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Xem chi tiết kiện hàng ${pkg.trackingCode}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        setDetailPackage(pkg);
                    }}
                  >
                    <div className={styles.mobileCardHeader}>
                      <span className={styles.mobileCardTracking}>
                        {pkg.trackingCode}
                      </span>
                      <StatusBadge status={pkg.status} label={pkg.statusText} />
                    </div>
                    <p className={styles.mobileCardProduct}>
                      {pkg.productName}
                    </p>
                    <div className={styles.mobileCardMeta}>
                      <span>{pkg.carrierName}</span>
                      <span>{pkg.weightKg} kg</span>
                      <span>{pkg.packageCount} kiện</span>
                    </div>
                    <div className={styles.mobileCardAmount}>
                      {formatVND(pkg.totalAmountVND)}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination footer */}
            <div className={styles.paginationBar} aria-label="Điều hướng trang">
              <div className={styles.pageSizeWrapper}>
                <span className={styles.paginationInfo}>
                  {filtered.length === 0
                    ? "Không có kết quả"
                    : `${(currentPage - 1) * query.pageSize + 1}–${Math.min(currentPage * query.pageSize, filtered.length)} / ${filtered.length} kiện`}
                </span>
                <label className={styles.pageSizeLabel}>
                  <span>Hiển thị:</span>
                  <select
                    className={styles.pageSizeSelect}
                    value={query.pageSize}
                    onChange={(e) =>
                      setQuery((q) => ({
                        ...q,
                        pageSize: Number(e.target.value),
                        page: 1,
                      }))
                    }
                    aria-label="Số kiện mỗi trang"
                  >
                    {PAGE_SIZE_OPTIONS.map((sz) => (
                      <option key={sz} value={sz}>
                        {sz} / trang
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div
                className={styles.paginationControls}
                role="group"
                aria-label="Trang"
              >
                <button
                  type="button"
                  className={styles.pageBtn}
                  disabled={currentPage <= 1}
                  onClick={() => setQuery((q) => ({ ...q, page: 1 }))}
                  aria-label="Trang đầu"
                >
                  <ChevronsLeft size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={styles.pageBtn}
                  disabled={currentPage <= 1}
                  onClick={() =>
                    setQuery((q) => ({ ...q, page: Math.max(1, q.page - 1) }))
                  }
                  aria-label="Trang trước"
                >
                  <ChevronLeft size={14} aria-hidden="true" />
                </button>
                <span
                  className={`${styles.pageBtn} ${styles.pageBtnActive}`}
                  aria-current="page"
                  aria-label={`Trang ${currentPage}`}
                >
                  {currentPage}
                </span>
                <button
                  type="button"
                  className={styles.pageBtn}
                  disabled={currentPage >= totalPages}
                  onClick={() =>
                    setQuery((q) => ({
                      ...q,
                      page: Math.min(totalPages, q.page + 1),
                    }))
                  }
                  aria-label="Trang sau"
                >
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={styles.pageBtn}
                  disabled={currentPage >= totalPages}
                  onClick={() => setQuery((q) => ({ ...q, page: totalPages }))}
                  aria-label="Trang cuối"
                >
                  <ChevronsRight size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Detail drawer */}
      {detailPackage && (
        <PackageDetailDrawer
          pkg={detailPackage}
          onClose={() => setDetailPackage(null)}
        />
      )}

      {/* Create package drawer */}
      {showCreateDrawer && (
        <CreatePackageDrawer onClose={() => setShowCreateDrawer(false)} />
      )}
    </div>
  );
}
