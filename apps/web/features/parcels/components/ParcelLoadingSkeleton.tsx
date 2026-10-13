import styles from "../parcels.module.css";

export function ParcelLoadingSkeleton() {
  return (
    <div
      className={styles.skeletonContainer}
      aria-busy="true"
      aria-label="Đang tải danh sách kiện hàng..."
    >
      <div
        className={styles.skeletonBlock}
        style={{ height: 60, width: "100%" }}
      />
      <div
        className={styles.skeletonBlock}
        style={{ height: 40, width: "100%" }}
      />
      <div
        className={styles.skeletonBlock}
        style={{ height: 400, width: "100%" }}
      />
    </div>
  );
}
