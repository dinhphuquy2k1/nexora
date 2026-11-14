"use client";
import type { ShipmentDetail } from "./types.ts";
import { formatMoney } from "./format.ts";
import { chargeLabel } from "./presentation.ts";
import styles from "./retail-packages.module.css";
export function PackageFeeSection({ shipment }: { shipment: ShipmentDetail }) {
  return (
    <div className={styles.feeSection} aria-label="Chi tiết phí">
      <div className={styles.feeHeader}>
        <span className={styles.feeTitle}>Cước phí dự kiến</span>
        <span className={styles.feeAmount}>
          {formatMoney(shipment.totalAmount, shipment.totalCurrency).replace(
            /đ$/,
            " đ",
          )}
        </span>
      </div>
      {[...shipment.charges]
        .sort((a, b) => a.lineNo - b.lineNo)
        .map((line) => (
          <div className={styles.feeNotice} key={line.id}>
            <span>{chargeLabel(line.chargeCode, line.providerLabel)}</span>
            {": "}
            <span>{formatMoney(line.amount, line.currency)}</span>
          </div>
        ))}
      {shipment.charges.length === 0 && (
        <p className={styles.feeNotice}>Chưa có dữ liệu phí.</p>
      )}
    </div>
  );
}
