import { Button, TextInput } from "@nexora/ui";
import { Search, X, RefreshCw } from "lucide-react";
import type { Query } from "./types.ts";
import styles from "./customers.module.css";
export function CustomerFilters({
  query,
  draft,
  onSearch,
  onQuery,
  onClear,
  onReload,
  onClearFilters,
}: {
  query: Query;
  draft: string;
  onSearch: (q: string) => void;
  onQuery: (p: Partial<Query>) => void;
  onClear: () => void;
  onReload: () => void;
  onClearFilters: () => void;
}) {
  const filtered = !!(query.q || query.status || query.phone);
  return (
    <div className={styles.searchToolbar}>
      <div className={styles.searchBox}>
        <Search size={16} className={styles.searchIcon} aria-hidden="true" />
        <label className={styles.srOnly} htmlFor="customer-search">
          Tìm mã khách hàng, họ tên, số điện thoại
        </label>
        <TextInput
          id="customer-search"
          name="q"
          maxLength={200}
          className={styles.searchInput}
          placeholder="Tìm mã khách hàng, họ tên, số điện thoại..."
          value={draft}
          onChange={(e) => onSearch(e.target.value)}
        />
        {draft && (
          <Button
            icon
            variant="ghost"
            className={styles.searchClear}
            aria-label="Xóa từ khóa tìm kiếm"
            title="Xóa từ khóa tìm kiếm"
            onClick={onClear}
          >
            <X size={14} />
          </Button>
        )}
      </div>
      <details className={styles.secondaryFilter}>
        <summary>Lọc số điện thoại</summary>
        <label htmlFor="customer-phone">Số điện thoại chính xác</label>
        <TextInput
          id="customer-phone"
          name="phone"
          inputMode="tel"
          maxLength={64}
          value={query.phone ?? ""}
          onChange={(e) =>
            onQuery({ phone: e.target.value || undefined, page: 1 })
          }
        />
      </details>
      <div className={styles.toolbarActions}>
        {filtered && (
          <span className={styles.filterBadge}>
            <span>Đang lọc</span>
            <Button
              variant="ghost"
              icon
              aria-label="Xóa các điều kiện lọc hiện tại"
              title="Xóa lọc"
              onClick={onClearFilters}
            >
              <X size={12} />
            </Button>
          </span>
        )}
        <Button variant="secondary" onClick={onReload} aria-label="Làm mới">
          <RefreshCw size={14} aria-hidden="true" />
          <span>Làm mới</span>
        </Button>
      </div>
    </div>
  );
}
