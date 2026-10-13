import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { PAGE_SIZE_OPTIONS } from "../types.ts";
import styles from "../parcels.module.css";

interface ParcelPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function ParcelPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
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
        {startItem}–{endItem} / {totalItems} kiện hàng
      </div>

      <div className={styles.paginationActions}>
        <div className={styles.pageSizeSelector}>
          <label htmlFor="pageSizeSelect" className={styles.pageSizeLabel}>
            Số dòng/trang:
          </label>
          <div className={styles.pageSizeSelectWrapper}>
            <select
              id="pageSizeSelect"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className={styles.pageSizeSelect}
              aria-label="Chọn số dòng mỗi trang"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className={styles.pageSizeSelectIcon}
              aria-hidden="true"
            />
          </div>
        </div>

        <div className={styles.paginationControls}>
          <button
            type="button"
            className={styles.paginationButton}
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            aria-label="Trang trước"
            title="Về trang trước"
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
            title="Sang trang sau"
          >
            <span>Sau</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </nav>
  );
}
