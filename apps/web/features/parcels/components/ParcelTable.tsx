"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import type { ParcelItem } from "../types.ts";
import {
  formatVnd,
  formatWeight,
  formatDate,
  getStatusToneKey,
} from "../utils.ts";
import styles from "../parcels.module.css";

interface ParcelTableProps {
  parcels: readonly ParcelItem[];
}

export function ParcelTable({ parcels }: ParcelTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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
              <th
                scope="col"
                className={`${styles.textLeft} ${styles.stickyColumnTh}`}
              >
                Mã vận đơn
              </th>
              <th scope="col" className={styles.textLeft}>
                Tên sản phẩm
              </th>
              <th scope="col" className={styles.textCenter}>
                Trạng thái
              </th>
              <th scope="col" className={styles.textRight}>
                Cân nặng (kg)
              </th>
              <th scope="col" className={styles.textRight}>
                Tổng tiền
              </th>
              <th scope="col" className={styles.textRight}>
                Số kiện
              </th>
              <th scope="col" className={styles.textRight}>
                Số sản phẩm
              </th>
              <th scope="col" className={styles.textRight}>
                Đơn giá
              </th>
              <th scope="col" className={styles.textRight}>
                Ship nội địa
              </th>
              <th scope="col" className={styles.textRight}>
                Giá trị hàng
              </th>
              <th scope="col" className={styles.textCenter}>
                Bảo hiểm
              </th>
              <th scope="col" className={styles.textCenter}>
                Kiểm đếm
              </th>
              <th scope="col" className={styles.textCenter}>
                Đóng gỗ
              </th>
              <th scope="col" className={styles.textCenter}>
                Bọt khí
              </th>
              <th scope="col" className={styles.textLeft}>
                Ngày nhập kho gửi
              </th>
              <th scope="col" className={styles.textLeft}>
                Ngày xuất kho gửi
              </th>
              <th scope="col" className={styles.textLeft}>
                Ngày nhập kho nhận
              </th>
              <th scope="col" className={styles.textLeft}>
                Ngày xuất kho nhận
              </th>
            </tr>
          </thead>
          <tbody>
            {parcels.map((parcel) => {
              const isCopied = copiedId === parcel.id;
              const statusClass = styles[getStatusToneKey(parcel.status)];

              return (
                <tr key={parcel.id} className={styles.parcelRow}>
                  {/* Mã vận đơn (Sticky Column) */}
                  <td className={`${styles.textLeft} ${styles.stickyColumnTd}`}>
                    <div className={styles.trackingCell}>
                      <span className={styles.trackingCode}>
                        {parcel.trackingNumber}
                      </span>
                      <button
                        type="button"
                        className={`${styles.copyButton} ${
                          isCopied ? styles.copySuccess : ""
                        }`}
                        onClick={() =>
                          handleCopy(parcel.id, parcel.trackingNumber)
                        }
                        title={
                          isCopied
                            ? "Đã sao chép mã vận đơn!"
                            : "Sao chép mã vận đơn"
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
                  </td>

                  {/* Tên sản phẩm */}
                  <td
                    className={`${styles.textLeft} ${styles.productCell}`}
                    title={parcel.productName}
                  >
                    <span className={styles.productTooltip}>
                      {parcel.productName}
                    </span>
                  </td>

                  {/* Trạng thái */}
                  <td className={styles.textCenter}>
                    <span className={`${styles.statusBadge} ${statusClass}`}>
                      <span className={styles.statusDot} aria-hidden="true" />
                      <span>{parcel.statusLabel}</span>
                    </span>
                  </td>

                  {/* Cân nặng (kg) */}
                  <td className={`${styles.textRight} ${styles.numberCell}`}>
                    {formatWeight(parcel.weightKg)}
                  </td>

                  {/* Tổng tiền */}
                  <td
                    className={`${styles.textRight} ${styles.totalAmountCell}`}
                  >
                    {formatVnd(parcel.totalAmount)}
                  </td>

                  {/* Số kiện */}
                  <td className={`${styles.textRight} ${styles.numberCell}`}>
                    {parcel.packageCount}
                  </td>

                  {/* Số sản phẩm */}
                  <td className={`${styles.textRight} ${styles.numberCell}`}>
                    {parcel.itemCount}
                  </td>

                  {/* Đơn giá */}
                  <td className={`${styles.textRight} ${styles.numberCell}`}>
                    {formatVnd(parcel.unitPrice)}
                  </td>

                  {/* Ship nội địa */}
                  <td className={`${styles.textRight} ${styles.numberCell}`}>
                    {parcel.domesticShippingFee > 0
                      ? formatVnd(parcel.domesticShippingFee)
                      : "0 ₫"}
                  </td>

                  {/* Giá trị hàng */}
                  <td className={`${styles.textRight} ${styles.numberCell}`}>
                    {formatVnd(parcel.declaredValue)}
                  </td>

                  {/* Dịch vụ phụ: Bảo hiểm, Kiểm đếm, Đóng gỗ, Bọt khí */}
                  <td className={styles.textCenter}>
                    {parcel.hasInsurance ? (
                      <span
                        className={styles.serviceTagActive}
                        title="Có bảo hiểm"
                      >
                        ✓
                      </span>
                    ) : (
                      <span className={styles.serviceTagInactive}>—</span>
                    )}
                  </td>
                  <td className={styles.textCenter}>
                    {parcel.hasInspection ? (
                      <span
                        className={styles.serviceTagActive}
                        title="Có kiểm đếm"
                      >
                        ✓
                      </span>
                    ) : (
                      <span className={styles.serviceTagInactive}>—</span>
                    )}
                  </td>
                  <td className={styles.textCenter}>
                    {parcel.hasWoodenCrate ? (
                      <span
                        className={styles.serviceTagActive}
                        title="Có đóng gỗ"
                      >
                        ✓
                      </span>
                    ) : (
                      <span className={styles.serviceTagInactive}>—</span>
                    )}
                  </td>
                  <td className={styles.textCenter}>
                    {parcel.hasBubbleWrap ? (
                      <span
                        className={styles.serviceTagActive}
                        title="Có quấn bọt khí"
                      >
                        ✓
                      </span>
                    ) : (
                      <span className={styles.serviceTagInactive}>—</span>
                    )}
                  </td>

                  {/* Các mốc thời gian */}
                  <td className={`${styles.textLeft} ${styles.dateCell}`}>
                    {formatDate(parcel.departureInboundDate)}
                  </td>
                  <td className={`${styles.textLeft} ${styles.dateCell}`}>
                    {formatDate(parcel.departureOutboundDate)}
                  </td>
                  <td className={`${styles.textLeft} ${styles.dateCell}`}>
                    {formatDate(parcel.destinationInboundDate)}
                  </td>
                  <td className={`${styles.textLeft} ${styles.dateCell}`}>
                    {formatDate(parcel.destinationOutboundDate)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
