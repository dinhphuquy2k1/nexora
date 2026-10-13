import { PackageSearch } from "lucide-react";
import styles from "../parcels.module.css";

interface ParcelEmptyStateProps {
  hasFilters: boolean;
  onResetFilters: () => void;
}

export function ParcelEmptyState({
  hasFilters,
  onResetFilters,
}: ParcelEmptyStateProps) {
  return (
    <div className={styles.emptyStateCard} role="status">
      <div className={styles.emptyStateIcon} aria-hidden="true">
        <PackageSearch size={28} />
      </div>

      <h3 className={styles.emptyStateTitle}>
        {hasFilters ? "Không tìm thấy kiện hàng nào" : "Chưa có kiện hàng nào"}
      </h3>

      <p className={styles.emptyStateText}>
        {hasFilters
          ? "Không có kiện hàng nào khớp với mã vận đơn hoặc bộ lọc trạng thái đã chọn. Vui lòng thử từ khóa khác."
          : "Danh sách kiện hàng hiện đang trống. Dữ liệu sẽ xuất hiện khi có kiện hàng mới được nhập."}
      </p>

      {hasFilters && (
        <button
          type="button"
          className={styles.resetFilterButton}
          onClick={onResetFilters}
        >
          Xóa bộ lọc tìm kiếm
        </button>
      )}
    </div>
  );
}
