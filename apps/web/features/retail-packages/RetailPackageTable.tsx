"use client";
import { useState, useRef, useEffect } from "react";
import { Button } from "@nexora/ui";
import { Copy, Check, Eye } from "lucide-react";
import type { RetailPackage, ColumnConfig } from "./types.ts";
import styles from "./retail-packages.module.css";
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

function formatVND(v?: number): string {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0)
    return "Chưa có báo giá";
  return `${v.toLocaleString("vi-VN")}đ`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function handleCopy() {
    void navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          setCopied(false);
          timer.current = null;
        }, 1500);
      })
      .catch(() => setCopied(false));
  }

  return (
    <Button
      icon
      variant="ghost"
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Đã sao chép" : `Sao chép ${text}`}
      title={copied ? "Đã sao chép" : "Sao chép mã vận đơn"}
    >
      {copied ? (
        <Check size={12} aria-hidden="true" />
      ) : (
        <Copy size={12} aria-hidden="true" />
      )}
    </Button>
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

export function RetailPackageTable({
  paginated,
  visibleColumns,
  onDetail,
  unavailable,
}: {
  paginated: readonly RetailPackage[];
  visibleColumns: readonly ColumnConfig[];
  onDetail: (p: RetailPackage) => void;
  unavailable: boolean;
}) {
  const emptyMessage = unavailable
    ? "Dữ liệu kiện lẻ chưa khả dụng từ máy chủ."
    : "Không tìm thấy kiện lẻ phù hợp với bộ lọc.";
  return (
    <>
      {" "}
      {/* Desktop table */}
      <div className={styles.tableScroll}>
        <table
          style={{ width: visibleColumns.reduce((n, c) => n + c.width, 0) }}
          className={styles.table}
          aria-label="Danh sách kiện lẻ TMĐT"
        >
          <colgroup>
            {visibleColumns.map((col) => (
              <col key={col.id} style={{ width: col.width }} />
            ))}
          </colgroup>
          <thead className={styles.tableHead}>
            <tr>
              {visibleColumns.map((col) => (
                <th
                  key={col.id}
                  data-column={col.id}
                  scope="col"
                  className={
                    col.id === "trackingCode"
                      ? styles.stickyTracking
                      : col.align === "right"
                        ? styles.alignRight
                        : col.align === "center"
                          ? styles.alignCenter
                          : undefined
                  }
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length}
                  style={{
                    textAlign: "center",
                    padding: "var(--space-8)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginated.map((pkg) => (
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
                            <Button
                              icon
                              variant="ghost"
                              onClick={() => onDetail(pkg)}
                              aria-label={`Xem lộ trình: ${pkg.trackingCode}`}
                            >
                              <Eye size={14} />
                            </Button>
                          </td>
                        );
                      case "trackingCode":
                        return (
                          <td
                            key={col.id}
                            data-column={col.id}
                            className={styles.stickyTracking}
                          >
                            <div className={styles.trackingActions}>
                              <Button
                                variant="ghost"
                                className={styles.trackingAction}
                                onClick={() => onDetail(pkg)}
                                aria-label={`Xem lộ trình: ${pkg.trackingCode}`}
                              >
                                <span
                                  className={styles.trackingCode}
                                  title={pkg.trackingCode}
                                >
                                  {pkg.trackingCode}
                                </span>
                              </Button>
                              <CopyButton text={pkg.trackingCode} />
                            </div>
                            <div className={styles.trackingMeta}>
                              {pkg.carrierProviderName} · {pkg.accountName}
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
                            {pkg.weightKg.toFixed(2)}
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
            {emptyMessage}
          </p>
        ) : (
          paginated.map((pkg) => (
            <div
              key={pkg.id}
              className={styles.mobileCard}
              onClick={() => onDetail(pkg)}
              role="button"
              tabIndex={0}
              aria-label={`Xem chi tiết kiện hàng ${pkg.trackingCode}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onDetail(pkg);
                }
              }}
            >
              <div className={styles.mobileCardHeader}>
                <span className={styles.mobileCardTracking}>
                  {pkg.trackingCode}
                </span>
                <StatusBadge status={pkg.status} label={pkg.statusText} />
              </div>
              <p className={styles.mobileCardProduct}>{pkg.productName}</p>
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
    </>
  );
}
