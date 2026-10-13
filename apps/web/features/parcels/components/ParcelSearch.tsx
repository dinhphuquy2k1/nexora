import { Search, X } from "lucide-react";
import styles from "../parcels.module.css";

interface ParcelSearchProps {
  searchQuery: string;
  totalResults: number;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
}

export function ParcelSearch({
  searchQuery,
  totalResults,
  onSearchChange,
  onClearSearch,
}: ParcelSearchProps) {
  return (
    <div className={styles.controlsBar}>
      <div className={styles.searchWrapper}>
        <Search size={16} className={styles.searchIcon} aria-hidden="true" />
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Tìm mã vận đơn..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Tìm kiếm theo mã vận đơn hoặc tên sản phẩm"
        />
        {searchQuery.trim().length > 0 && (
          <button
            type="button"
            className={styles.searchClearButton}
            onClick={onClearSearch}
            aria-label="Xóa tìm kiếm"
            title="Xóa tìm kiếm"
          >
            <X size={12} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className={styles.resultsMeta}>
        Hiển thị{" "}
        <span className={styles.resultsCountHighlight}>{totalResults}</span>{" "}
        kiện hàng
      </div>
    </div>
  );
}
