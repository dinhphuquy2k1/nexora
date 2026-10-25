import { Button, Select } from "@nexora/ui";
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";
import type { CustomerPage, Query } from "./types.ts";
import { customerPageWindow } from "./pagination.ts";
import styles from "./customers.module.css";
export function CustomerPagination({
  pagination,
  query,
  rowCount,
  onQuery,
  loading,
}: {
  pagination?: CustomerPage["pagination"];
  query: Query;
  rowCount: number;
  onQuery: (patch: Partial<Query>) => void;
  loading: boolean;
}) {
  const last = Math.max(
    1,
    Math.min(
      pagination?.totalPages ?? 1,
      Math.floor(2147483647 / query.pageSize) + 1,
      2147483647,
    ),
  );
  const pages = customerPageWindow(query.page, last);
  const from = rowCount ? (query.page - 1) * query.pageSize + 1 : 0;
  const to = rowCount ? from + rowCount - 1 : 0;
  return (
    <footer className={styles.pagination}>
      <div className={styles.paginationSummary}>
        <div className={styles.paginationText}>
          <span>Hiển thị</span>
          <strong className={styles.paginationBold}>
            {rowCount ? `${from}–${to}` : "0"}
          </strong>
          <span>/</span>
          <strong className={styles.paginationBold}>
            {pagination?.total ?? 0}
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
            value={query.pageSize}
            onChange={(e) =>
              onQuery({ pageSize: Number(e.target.value), page: 1 })
            }
          >
            {[10, 20, 50, 100].map((n) => (
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
          aria-label="Trang đầu"
          disabled={loading || !pagination || query.page <= 1}
          onClick={() => onQuery({ page: 1 })}
        >
          <ChevronsLeft size={16} />
        </Button>
        <Button
          icon
          variant="secondary"
          aria-label="Trang trước"
          disabled={loading || !pagination || query.page <= 1}
          onClick={() =>
            onQuery({ page: Math.max(1, Math.min(last, query.page - 1)) })
          }
        >
          <ChevronLeft size={16} />
        </Button>
        {pages.map((n, i) => (
          <span key={n} className={styles.pageNumber}>
            {i > 0 && n - pages[i - 1] > 1 && <span aria-hidden="true">…</span>}
            <Button
              icon
              variant={query.page === n ? "primary" : "ghost"}
              aria-label={`Trang ${n}`}
              aria-current={query.page === n ? "page" : undefined}
              disabled={loading || !pagination}
              onClick={() => onQuery({ page: n })}
            >
              {n}
            </Button>
          </span>
        ))}
        <Button
          icon
          variant="secondary"
          aria-label="Trang sau"
          disabled={loading || !pagination || query.page >= last}
          onClick={() => onQuery({ page: query.page + 1 })}
        >
          <ChevronRight size={16} />
        </Button>
        <Button
          icon
          variant="secondary"
          aria-label="Trang cuối"
          disabled={loading || !pagination || query.page >= last}
          onClick={() => onQuery({ page: last })}
        >
          <ChevronsRight size={16} />
        </Button>
      </nav>
    </footer>
  );
}
