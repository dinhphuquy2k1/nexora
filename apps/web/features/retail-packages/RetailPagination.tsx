import { Button, Select } from "@nexora/ui";
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
  return (
    <div className={styles.paginationBar} aria-label="Phân trang kiện lẻ">
      <div className={styles.paginationInfo}>
        <span data-retail-count>{unavailable ? "—" : total} kiện lẻ</span>
        <label>
          Số dòng:{" "}
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
        </label>
      </div>
      <div
        className={styles.paginationControls}
        role="group"
        aria-label="Trang"
      >
        <Button
          variant="secondary"
          icon
          disabled={unavailable || page <= 1}
          onClick={() => onPage(1)}
          aria-label="Trang đầu"
        >
          <ChevronsLeft size={14} />
        </Button>
        <Button
          variant="secondary"
          icon
          disabled={unavailable || page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Trang trước"
        >
          <ChevronLeft size={14} />
        </Button>
        {pageWindow(page, pages).map((number, index, window) => (
          <span key={number} className={styles.pageNumber}>
            {index > 0 && number - window[index - 1] > 1 && (
              <span aria-hidden="true">…</span>
            )}
            <Button
              variant={number === page ? "emphasis" : "secondary"}
              aria-current={number === page ? "page" : undefined}
              aria-label={`Trang ${number}`}
              disabled={unavailable}
              onClick={() => onPage(number)}
            >
              {number}
            </Button>
          </span>
        ))}
        <Button
          variant="secondary"
          icon
          disabled={unavailable || page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label="Trang sau"
        >
          <ChevronRight size={14} />
        </Button>
        <Button
          variant="secondary"
          icon
          disabled={unavailable || page >= pages}
          onClick={() => onPage(pages)}
          aria-label="Trang cuối"
        >
          <ChevronsRight size={14} />
        </Button>
      </div>
    </div>
  );
}
