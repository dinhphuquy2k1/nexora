"use client";
import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Package,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import { useShippingScope } from "../../shipping-scope/ShippingScopeProvider.tsx";
import { ColumnSettings } from "./ColumnSettings.tsx";
import { RetailFilters } from "./RetailFilters.tsx";
import { RetailTable } from "./RetailTable.tsx";
import {
  DEFAULT_COLUMNS,
  STATUS_REFERENCE,
  readQuery,
  updateQuery,
  type DraftFilter,
  type RetailState,
} from "./model.ts";
import styles from "./retail.module.css";

export function RetailPackagesPage() {
  const { metadata, valid, label, retry } = useShippingScope();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const query = readQuery(new URLSearchParams(params.toString()));
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [filters, setFilters] = useState<DraftFilter[]>([]);
  const detailsRef = useRef<HTMLDialogElement>(null);
  const state: RetailState =
    metadata.status === "loading"
      ? "loading"
      : metadata.status === "error"
        ? "error"
        : !valid
          ? "invalid"
          : "unsupported";
  function change(updates: Record<string, string>) {
    const next = updateQuery(
      new URLSearchParams(window.location.search),
      updates,
    ).toString();
    router.push(`${pathname}${next ? `?${next}` : ""}${window.location.hash}`, {
      scroll: false,
    });
  }
  return (
    <div className={styles.page}>
      <section className={styles.deck} aria-label="Bộ công cụ kiện lẻ">
        <div className={styles.titleRow}>
          <div className={styles.title}>
            <span className={styles.titleIcon}>
              <Package size={20} aria-hidden="true" />
            </span>
            <div>
              <h1>Kiện lẻ</h1>
              <p>Quản lý kiện hàng theo hãng và tài khoản vận chuyển</p>
            </div>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondary}
              disabled
              title="Xuất file chưa được triển khai"
            >
              <FileSpreadsheet size={15} aria-hidden="true" />
              Xuất Excel
            </button>
            <button type="button" disabled title="Tạo mới chưa được triển khai">
              <Plus size={15} aria-hidden="true" />
              Tạo mới kiện hàng
            </button>
          </div>
        </div>
        <div
          className={styles.statusBar}
          aria-label="Thiết kế trạng thái tham khảo, chờ contract Shipment"
        >
          {STATUS_REFERENCE.map((status, index) => (
            <button
              type="button"
              key={status}
              disabled
              className={index === 0 ? styles.statusActive : styles.statusItem}
              title="Bộ lọc trạng thái và số lượng chưa triển khai"
            >
              <span className={styles.dot} />
              {status}
              <span className={styles.count}>—</span>
            </button>
          ))}
        </div>
        <div className={styles.toolbar}>
          <RetailFilters filters={filters} onChange={setFilters} />
          <form
            className={styles.search}
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              change({ q: String(data.get("q") ?? "") });
            }}
          >
            <Search size={15} aria-hidden="true" />
            <input
              key={query.q}
              className="control"
              type="search"
              name="q"
              aria-label="Tìm kiếm kiện lẻ (dự thảo)"
              placeholder="Tìm mã vận đơn, tên sản phẩm…"
              defaultValue={query.q}
              maxLength={200}
            />
            <button type="submit" className={styles.secondary}>
              Lưu từ khóa
            </button>
          </form>
          <ColumnSettings columns={columns} onChange={setColumns} />
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              setFilters([]);
              change({ q: "" });
            }}
          >
            <RotateCcw size={14} aria-hidden="true" />
            Đặt lại lọc
          </button>
        </div>
        <div className={styles.scopeNote}>
          <span>
            Phạm vi: <strong>{label}</strong>
          </span>
          <span>
            Từ khóa và điều kiện là dự thảo; chưa áp dụng vào dữ liệu.
          </span>
          {query.q && (
            <span className={styles.queryChip}>Từ khóa: {query.q}</span>
          )}
        </div>
      </section>
      <RetailTable columns={columns} state={state} />
      <footer className={styles.pagination}>
        <div>
          Tổng số kiện: <strong>—</strong>{" "}
          <span className={styles.separator}>|</span>{" "}
          <label>
            Số dòng:{" "}
            <select
              className="control"
              value={query.size}
              onChange={(e) => change({ size: e.target.value })}
            >
              {[5, 10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size} / trang
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            disabled
            aria-label="Trang trước"
            className={styles.secondary}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <span>Trang — / —</span>
          <button
            type="button"
            disabled
            aria-label="Trang sau"
            className={styles.secondary}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </footer>
      <div className={styles.footnote}>
        <span>Trạng thái, số lượng và lịch sử hiện chưa khả dụng.</span>
        {state === "error" && (
          <button type="button" className={styles.secondary} onClick={retry}>
            Thử lại
          </button>
        )}
        <button
          type="button"
          className={styles.textButton}
          onClick={() => detailsRef.current?.showModal()}
        >
          Chi tiết &amp; lịch sử: chưa triển khai
        </button>
      </div>
      <dialog
        ref={detailsRef}
        className={styles.dialog}
        aria-labelledby="retail-detail-title"
      >
        <h2 id="retail-detail-title">Chi tiết và lịch sử chưa triển khai</h2>
        <p>
          Chức năng xem chi tiết và lịch sử vận chuyển chưa được triển khai.
        </p>
        <form method="dialog">
          <button type="submit">Đóng</button>
        </form>
      </dialog>
    </div>
  );
}
