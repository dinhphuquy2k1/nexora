import { Pager, Select } from "@nexora/ui";
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
      <Pager
        page={model.page}
        pages={model.pages}
        targets={{
          first: 1,
          previous: Math.max(1, model.page - 1),
          next: model.page + 1,
          last: model.totalPages,
        }}
        disabled={{
          first: !model.canFirst,
          previous: !model.canPrev,
          numbers: loading || !model.isAuthoritative,
          next: !model.canNext,
          last: !model.canLast,
        }}
        onPage={(page) => onQuery({ page })}
        selectedVariant="primary"
        numberIcon
        pressEffect="none"
        className={styles.pageButtons}
        selectedClassName={styles.pageSelected}
        unselectedClassName={styles.pageUnselected}
        labels={{
          navigation: "Phân trang khách hàng",
          first: "Trang đầu",
          previous: "Trang trước",
          next: "Trang sau",
          last: "Trang cuối",
          page: (n) => `Trang ${n}`,
        }}
        icons={{
          first: <ChevronsLeft size={16} />,
          previous: <ChevronLeft size={16} />,
          next: <ChevronRight size={16} />,
          last: <ChevronsRight size={16} />,
        }}
        summaryClassName={styles.paginationSummary}
        summary={
          <>
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
          </>
        }
        pageSize={
          <>
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
          </>
        }
      />
    </footer>
  );
}
