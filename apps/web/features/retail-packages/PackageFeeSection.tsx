"use client";

/**
 * Package Fee Section — M3 Presentation Component
 *
 * Requirements:
 * - No hard-coded price formulas (e.g., weight * 28000).
 * - No unverified carrier surcharge calculations.
 * - Displays "Chưa có báo giá" when authorized pricing data is absent.
 */

import styles from "./retail-packages.module.css";

export interface PackageFeeSectionProps {
  /** Total calculated amount in VND, if available from authorized source */
  readonly totalAmountVND?: number;
  /** Currency breakdown values if present */
  readonly weightKg?: number;
  readonly unitPriceCNY?: number;
  readonly domesticShipCNY?: number;
}

export function PackageFeeSection({
  totalAmountVND,
  weightKg,
}: PackageFeeSectionProps) {
  const hasAuthorizedPricing =
    typeof totalAmountVND === "number" && totalAmountVND > 0;

  return (
    <div className={styles.feeSection} aria-label="Báo giá cước phí">
      <div className={styles.feeHeader}>
        <span className={styles.feeTitle}>Cước phí dự kiến</span>
        {hasAuthorizedPricing ? (
          <span className={styles.feeAmount}>
            {totalAmountVND.toLocaleString("vi-VN")} đ
          </span>
        ) : (
          <span className={styles.feeUnavailable}>Chưa có báo giá</span>
        )}
      </div>
      <p className={styles.feeNotice}>
        {hasAuthorizedPricing
          ? `Cước phí tính trên trọng lượng ${weightKg ?? 0} kg từ kho gửi đến kho nhận.`
          : "Biểu phí chính thức cho tuyến này chưa được cấu hình hoặc chưa có kết nối bảng giá từ máy chủ."}
      </p>
    </div>
  );
}
