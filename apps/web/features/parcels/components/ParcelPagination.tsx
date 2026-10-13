import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "../parcels.module.css";

interface ParcelPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function ParcelPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: ParcelPaginationProps) {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <nav
      className={styles.paginationBar}
      aria-label="Điều hướng phân trang danh sách kiện hàng"
    >
      <div className={styles.paginationRange}>
        Hiển thị <strong>{startItem}</strong> - <strong>{endItem}</strong> trong{" "}
        <strong>{totalItems}</strong> kiện hàng
      </div>

      <div className={styles.paginationControls}>
        <button
          type="button"
          className={styles.paginationButton}
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Trang trước"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          <span>Trước</span>
        </button>

        <span className={styles.pageIndicator}>
          Trang {currentPage} / {totalPages}
        </span>

        <button
          type="button"
          className={styles.paginationButton}
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Trang sau"
        >
          <span>Sau</span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
