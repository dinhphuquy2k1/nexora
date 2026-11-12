import { Pager, Select } from "@nexora/ui";
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";
import { pageWindow } from "../../lib/pagination.ts";
import { PAGE_SIZE_OPTIONS } from "./columns.ts";
import styles from "./retail-packages.module.css";
export function RetailPagination({
  page,
  pageSize,
  total,
  unavailable,
  onPage,
  onSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  unavailable: boolean;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const rangeDisplay = unavailable ? "—" : `${start}–${end}`;
  return (
    <div className={styles.paginationBar}>
      <Pager
        page={page}
        pages={pageWindow(page, pages)}
        targets={{ first: 1, previous: page - 1, next: page + 1, last: pages }}
        disabled={{
          first: unavailable || page <= 1,
          previous: unavailable || page <= 1,
          numbers: unavailable,
          next: unavailable || page >= pages,
          last: unavailable || page >= pages,
        }}
        onPage={onPage}
        selectedVariant="emphasis"
        labels={{
          navigation: "Phân trang kiện lẻ",
          first: "Trang đầu",
          previous: "Trang trước",
          next: "Trang sau",
          last: "Trang cuối",
          page: (n) => `Trang ${n}`,
        }}
        icons={{
          first: <ChevronsLeft size={14} />,
          previous: <ChevronLeft size={14} />,
          next: <ChevronRight size={14} />,
          last: <ChevronsRight size={14} />,
        }}
        summaryClassName={styles.paginationInfo}
        summary={
          <>
            <div className={styles.paginationSummary}>
              <span>Hiển thị</span>{" "}
              <strong className={styles.paginationRange}>{rangeDisplay}</strong>{" "}
              <span>/</span>{" "}
              <span data-retail-count>{unavailable ? "—" : total} kiện lẻ</span>
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
              <div className={styles.pageSizeSelectWrapper}>
                <Select
                  aria-label="Số dòng mỗi trang"
                  value={pageSize}
                  onChange={(e) => onSize(Number(e.target.value))}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size} / trang
                    </option>
                  ))}
                </Select>
              </div>
            </label>
          </>
        }
      />
    </div>
  );
}
