"use client";

import { useState } from "react";
import { Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import type { ParcelItem } from "../types.ts";
import {
  formatVnd,
  formatWeight,
  formatDate,
  getStatusToneKey,
} from "../utils.ts";
import styles from "../parcels.module.css";

interface ParcelCardListProps {
  parcels: readonly ParcelItem[];
}

export function ParcelCardList({ parcels }: ParcelCardListProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div
      className={styles.mobileCardList}
      aria-label="Danh sách kiện hàng dạng thẻ di động"
    >
      {parcels.map((parcel) => {
        const isCopied = copiedId === parcel.id;
        const isExpanded = expandedIds.has(parcel.id);
        const statusClass = styles[getStatusToneKey(parcel.status)];

        return (
          <article key={parcel.id} className={styles.mobileCard}>
            {/* Header: Tracking number + Status */}
            <div className={styles.mobileCardHeader}>
              <div className={styles.trackingCell}>
                <span className={styles.trackingCode}>
                  {parcel.trackingNumber}
                </span>
                <button
                  type="button"
                  className={`${styles.copyButton} ${
                    isCopied ? styles.copySuccess : ""
                  }`}
                  onClick={() => handleCopy(parcel.id, parcel.trackingNumber)}
                  title="Sao chép mã"
                  aria-label={`Sao chép mã vận đơn ${parcel.trackingNumber}`}
                >
                  {isCopied ? (
                    <Check size={14} aria-hidden="true" />
                  ) : (
                    <Copy size={14} aria-hidden="true" />
                  )}
                </button>
              </div>

              <span className={`${styles.statusBadge} ${statusClass}`}>
                <span className={styles.statusDot} aria-hidden="true" />
                <span>{parcel.statusLabel}</span>
              </span>
            </div>

            {/* Product Title */}
            <h2 className={styles.mobileProductTitle}>{parcel.productName}</h2>

            {/* 3 Key Metrics */}
            <div className={styles.mobileMetricsGrid}>
              <div className={styles.mobileMetricItem}>
                <span className={styles.mobileMetricLabel}>Cân nặng</span>
                <span className={styles.mobileMetricValue}>
                  {formatWeight(parcel.weightKg)}
                </span>
              </div>
              <div className={styles.mobileMetricItem}>
                <span className={styles.mobileMetricLabel}>Số kiện</span>
                <span className={styles.mobileMetricValue}>
                  {parcel.packageCount} kiện
                </span>
              </div>
              <div className={styles.mobileMetricItem}>
                <span className={styles.mobileMetricLabel}>Tổng tiền</span>
                <span
                  className={`${styles.mobileMetricValue} ${styles.mobileTotalHighlight}`}
                >
                  {formatVnd(parcel.totalAmount)}
                </span>
              </div>
            </div>

            {/* Toggle Full Details */}
            <button
              type="button"
              className={styles.mobileToggleDetailsButton}
              onClick={() => toggleExpand(parcel.id)}
              aria-expanded={isExpanded}
            >
              <span>
                {isExpanded
                  ? "Ẩn chi tiết"
                  : "Xem chi tiết dịch vụ & mốc thời gian"}
              </span>
              {isExpanded ? (
                <ChevronUp size={16} aria-hidden="true" />
              ) : (
                <ChevronDown size={16} aria-hidden="true" />
              )}
            </button>

            {/* Expanded Detailed Section */}
            {isExpanded && (
              <div className={styles.mobileDetailsSection}>
                <div className={styles.mobileDetailRow}>
                  <span>Số lượng sản phẩm</span>
                  <span>{parcel.itemCount}</span>
                </div>
                <div className={styles.mobileDetailRow}>
                  <span>Đơn giá</span>
                  <span>{formatVnd(parcel.unitPrice)}</span>
                </div>
                <div className={styles.mobileDetailRow}>
                  <span>Ship nội địa</span>
                  <span>
                    {parcel.domesticShippingFee > 0
                      ? formatVnd(parcel.domesticShippingFee)
                      : "0 ₫"}
                  </span>
                </div>
                <div className={styles.mobileDetailRow}>
                  <span>Giá trị hàng</span>
                  <span>{formatVnd(parcel.declaredValue)}</span>
                </div>

                {/* Warehouse Dates */}
                <div className={styles.mobileDetailRow}>
                  <span>Nhập kho gửi</span>
                  <span>{formatDate(parcel.departureInboundDate)}</span>
                </div>
                <div className={styles.mobileDetailRow}>
                  <span>Xuất kho gửi</span>
                  <span>{formatDate(parcel.departureOutboundDate)}</span>
                </div>
                <div className={styles.mobileDetailRow}>
                  <span>Nhập kho nhận</span>
                  <span>{formatDate(parcel.destinationInboundDate)}</span>
                </div>
                <div className={styles.mobileDetailRow}>
                  <span>Xuất kho nhận</span>
                  <span>{formatDate(parcel.destinationOutboundDate)}</span>
                </div>

                {/* Services */}
                <div className={styles.mobileServicesRow}>
                  <span
                    className={`${styles.mobileServiceBadge} ${
                      parcel.hasInsurance ? styles.mobileServiceBadgeActive : ""
                    }`}
                  >
                    {parcel.hasInsurance ? "✓ Bảo hiểm" : "Bảo hiểm: Không"}
                  </span>
                  <span
                    className={`${styles.mobileServiceBadge} ${
                      parcel.hasInspection
                        ? styles.mobileServiceBadgeActive
                        : ""
                    }`}
                  >
                    {parcel.hasInspection ? "✓ Kiểm đếm" : "Kiểm đếm: Không"}
                  </span>
                  <span
                    className={`${styles.mobileServiceBadge} ${
                      parcel.hasWoodenCrate
                        ? styles.mobileServiceBadgeActive
                        : ""
                    }`}
                  >
                    {parcel.hasWoodenCrate ? "✓ Đóng gỗ" : "Đóng gỗ: Không"}
                  </span>
                  <span
                    className={`${styles.mobileServiceBadge} ${
                      parcel.hasBubbleWrap
                        ? styles.mobileServiceBadgeActive
                        : ""
                    }`}
                  >
                    {parcel.hasBubbleWrap ? "✓ Bọt khí" : "Bọt khí: Không"}
                  </span>
                </div>

                {parcel.note && (
                  <div
                    style={{
                      marginTop: 6,
                      color: "var(--color-status-error-text)",
                      fontStyle: "italic",
                    }}
                  >
                    Ghi chú: {parcel.note}
                  </div>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
