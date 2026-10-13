"use client";

import { useState, type ReactNode } from "react";
import { Copy, Check } from "lucide-react";
import type { ParcelItem } from "../types.ts";
import type { ParcelColumnKey, ParcelColumnDef } from "../columns.ts";
import {
  formatVnd,
  formatWeight,
  formatDate,
  getStatusToneKey,
} from "../utils.ts";
import styles from "../parcels.module.css";

interface ParcelTableProps {
  parcels: readonly ParcelItem[];
  orderedVisibleColumns: readonly ParcelColumnDef[];
}

export function ParcelTable({
  parcels,
  orderedVisibleColumns,
}: ParcelTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getHeaderAlignClass = (id: ParcelColumnKey): string => {
    switch (id) {
      case "weightKg":
      case "totalAmount":
      case "packageCount":
      case "itemCount":
      case "unitPrice":
      case "domesticShippingFee":
      case "declaredValue":
        return styles.textRight;
      case "status":
      case "insurance":
      case "inspection":
      case "woodenCrate":
      case "bubbleWrap":
        return styles.textCenter;
      default:
        return styles.textLeft;
    }
  };

  const getColumnWidthClass = (id: ParcelColumnKey): string => {
    switch (id) {
      case "trackingNumber":
        return styles.colTrackingNumber;
      case "productName":
        return styles.colProductName;
      case "status":
        return styles.colStatus;
      case "weightKg":
        return styles.colWeight;
      case "totalAmount":
        return styles.colTotalAmount;
      case "packageCount":
        return styles.colPackageCount;
      case "itemCount":
        return styles.colItemCount;
      case "unitPrice":
        return styles.colUnitPrice;
      case "domesticShippingFee":
        return styles.colShippingFee;
      case "declaredValue":
        return styles.colDeclaredValue;
      case "insurance":
      case "inspection":
      case "woodenCrate":
      case "bubbleWrap":
        return styles.colService;
      case "departureInboundDate":
      case "departureOutboundDate":
      case "destinationInboundDate":
      case "destinationOutboundDate":
        return styles.colDate;
      default:
        return "";
    }
  };

  const renderCellContent = (
    id: ParcelColumnKey,
    parcel: ParcelItem,
  ): ReactNode => {
    switch (id) {
      case "trackingNumber": {
        const isCopied = copiedId === parcel.id;
        return (
          <div className={styles.trackingCell}>
            <span className={styles.trackingCode}>{parcel.trackingNumber}</span>
            <button
              type="button"
              className={`${styles.copyButton} ${
                isCopied ? styles.copySuccess : ""
              }`}
              onClick={() => handleCopy(parcel.id, parcel.trackingNumber)}
              title={
                isCopied ? "Đã sao chép mã vận đơn!" : "Sao chép mã vận đơn"
              }
              aria-label={`Sao chép mã vận đơn ${parcel.trackingNumber}`}
            >
              {isCopied ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <Copy size={14} aria-hidden="true" />
              )}
            </button>
          </div>
        );
      }
      case "productName":
        return (
          <span className={styles.productCell} title={parcel.productName}>
            {parcel.productName}
          </span>
        );
      case "status": {
        const statusClass = styles[getStatusToneKey(parcel.status)];
        return (
          <span className={`${styles.statusBadge} ${statusClass}`}>
            <span className={styles.statusDot} aria-hidden="true" />
            <span>{parcel.statusLabel}</span>
          </span>
        );
      }
      case "weightKg":
        return (
          <span className={styles.numberCell}>
            {formatWeight(parcel.weightKg)}
          </span>
        );
      case "totalAmount":
        return (
          <span className={styles.totalAmountCell}>
            {formatVnd(parcel.totalAmount)}
          </span>
        );
      case "packageCount":
        return <span className={styles.numberCell}>{parcel.packageCount}</span>;
      case "itemCount":
        return <span className={styles.numberCell}>{parcel.itemCount}</span>;
      case "unitPrice":
        return (
          <span className={styles.numberCell}>
            {formatVnd(parcel.unitPrice)}
          </span>
        );
      case "domesticShippingFee":
        return (
          <span className={styles.numberCell}>
            {parcel.domesticShippingFee > 0
              ? formatVnd(parcel.domesticShippingFee)
              : "0 ₫"}
          </span>
        );
      case "declaredValue":
        return (
          <span className={styles.numberCell}>
            {formatVnd(parcel.declaredValue)}
          </span>
        );
      case "insurance":
        return parcel.hasInsurance ? (
          <span className={styles.serviceTagActive} title="Có bảo hiểm">
            ✓
          </span>
        ) : (
          <span className={styles.serviceTagInactive}>—</span>
        );
      case "inspection":
        return parcel.hasInspection ? (
          <span className={styles.serviceTagActive} title="Có kiểm đếm">
            ✓
          </span>
        ) : (
          <span className={styles.serviceTagInactive}>—</span>
        );
      case "woodenCrate":
        return parcel.hasWoodenCrate ? (
          <span className={styles.serviceTagActive} title="Có đóng gỗ">
            ✓
          </span>
        ) : (
          <span className={styles.serviceTagInactive}>—</span>
        );
      case "bubbleWrap":
        return parcel.hasBubbleWrap ? (
          <span className={styles.serviceTagActive} title="Có bọt khí">
            ✓
          </span>
        ) : (
          <span className={styles.serviceTagInactive}>—</span>
        );
      case "departureInboundDate":
        return (
          <span className={styles.dateCell}>
            {formatDate(parcel.departureInboundDate)}
          </span>
        );
      case "departureOutboundDate":
        return (
          <span className={styles.dateCell}>
            {formatDate(parcel.departureOutboundDate)}
          </span>
        );
      case "destinationInboundDate":
        return (
          <span className={styles.dateCell}>
            {formatDate(parcel.destinationInboundDate)}
          </span>
        );
      case "destinationOutboundDate":
        return (
          <span className={styles.dateCell}>
            {formatDate(parcel.destinationOutboundDate)}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.tableCard}>
      <div className={styles.tableScrollWrapper}>
        <table
          className={styles.parcelTable}
          aria-label="Danh sách kiện hàng lẻ"
        >
          <thead>
            <tr>
              {orderedVisibleColumns.map((col) => {
                const isSticky = col.id === "trackingNumber";
                const alignClass = getHeaderAlignClass(col.id);
                const widthClass = getColumnWidthClass(col.id);

                return (
                  <th
                    key={col.id}
                    scope="col"
                    className={`${alignClass} ${widthClass} ${
                      isSticky ? styles.stickyColumnTh : ""
                    }`}
                  >
                    {col.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {parcels.map((parcel) => (
              <tr key={parcel.id} className={styles.parcelRow}>
                {orderedVisibleColumns.map((col) => {
                  const isSticky = col.id === "trackingNumber";
                  const alignClass = getHeaderAlignClass(col.id);
                  const widthClass = getColumnWidthClass(col.id);

                  return (
                    <td
                      key={col.id}
                      className={`${alignClass} ${widthClass} ${
                        isSticky ? styles.stickyColumnTd : ""
                      }`}
                    >
                      {renderCellContent(col.id, parcel)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
