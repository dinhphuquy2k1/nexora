import { Button, Select } from "@nexora/ui";
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";
import type { CustomerPage, Query, Stats } from "./types.ts";
import { derivePaginationModel } from "./pagination.ts";
import styles from "./customers.module.css";

export function CustomerPagination({
  pagination,
  stats,
  query,
  rowCount,
  onQuery,
  loading,
}: {
  pagination?: CustomerPage["pagination"];
  stats?: Stats;
  query: Query;
  rowCount: number;
  onQuery: (patch: Partial<Query>) => void;
  loading: boolean;
}) {
  const model = derivePaginationModel({
    query,
    pagination,
    stats,
    rowCount,
    loading,
  });

  return (
    <footer className={styles.pagination}>
      <div className={styles.paginationSummary}>
        <div className={styles.paginationText}>
          <span>Hiển thị</span>
          <strong className={styles.paginationBold}>
            {model.summaryRange}
          </strong>
          <span>/</span>
          <strong className={styles.paginationBold}>
            {model.summaryTotal}
          </strong>
          <span>khách hàng</span>
        </div>
        <span className={styles.paginationDivider} aria-hidden="true">
          |
        </span>
        <label className={styles.pageSizeLabel}>
          <span>Số dòng:</span>
          <Select
            aria-label="Số dòng mỗi trang"
            value={model.pageSize}
            onChange={(e) =>
              onQuery({ pageSize: Number(e.target.value), page: 1 })
            }
          >
            {[5, 10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / trang
              </option>
            ))}
          </Select>
        </label>
      </div>
      <nav aria-label="Phân trang khách hàng" className={styles.pageButtons}>
        <Button
          icon
          variant="secondary"
          pressEffect="none"
          aria-label="Trang đầu"
          disabled={!model.canFirst}
          onClick={() => onQuery({ page: 1 })}
        >
          <ChevronsLeft size={16} />
        </Button>
        <Button
          icon
          variant="secondary"
          pressEffect="none"
          aria-label="Trang trước"
          disabled={!model.canPrev}
          onClick={() => onQuery({ page: Math.max(1, model.page - 1) })}
        >
          <ChevronLeft size={16} />
        </Button>
        {model.pages.map((n, i) => (
          <span key={n} className={styles.pageNumber}>
            {i > 0 && n - model.pages[i - 1] > 1 && (
              <span aria-hidden="true">…</span>
            )}
            <Button
              icon
              variant={model.page === n ? "primary" : "secondary"}
              pressEffect="none"
              className={
                model.page === n ? styles.pageSelected : styles.pageUnselected
              }
              aria-label={`Trang ${n}`}
              aria-current={model.page === n ? "page" : undefined}
              disabled={loading}
              onClick={() => onQuery({ page: n })}
            >
              {n}
            </Button>
          </span>
        ))}
        <Button
          icon
          variant="secondary"
          pressEffect="none"
          aria-label="Trang sau"
          disabled={!model.canNext}
          onClick={() => onQuery({ page: model.page + 1 })}
        >
          <ChevronRight size={16} />
        </Button>
        <Button
          icon
          variant="secondary"
          pressEffect="none"
          aria-label="Trang cuối"
          disabled={!model.canLast}
          onClick={() => onQuery({ page: model.totalPages })}
        >
          <ChevronsRight size={16} />
        </Button>
      </nav>
    </footer>
  );
}
