import { Plus } from "lucide-react";
import styles from "../parcels.module.css";

export function ParcelListHeader() {
  return (
    <header className={styles.headerRow}>
      <div className={styles.titleGroup}>
        <span className={styles.eyebrow}>LOGISTICS · KIỆN LẺ</span>
        <h1 className={styles.pageTitle}>Kiện hàng lẻ</h1>
        <p className={styles.subtitle}>
          Quản lý danh sách kiện hàng lẻ nhập kho, trung chuyển và giao nhận.
        </p>
      </div>

      <div className={styles.headerActions}>
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Chức năng tạo mới kiện hàng lẻ chưa triển khai trong phiên bản này"
          className={styles.createButtonDisabled}
        >
          <Plus size={16} aria-hidden="true" />
          <span>Tạo mới</span>
          <span className={styles.createButtonBadge}>Chưa triển khai</span>
        </button>
      </div>
    </header>
  );
}
