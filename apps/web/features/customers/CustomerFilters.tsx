import { Button, TextInput } from "@nexora/ui";
import { Search, X, RefreshCw } from "lucide-react";
import type { Query } from "./types.ts";
import styles from "./customers.module.css";
export function CustomerFilters({
  query,
  draft,
  phoneDraft,
  onPhoneDraft,
  onSearch,
  onQuery,
  onClear,
  onReload,
  onClearFilters,
  filteredTotal,
  statsTotal,
}: {
  query: Query;
  draft: string;
  phoneDraft: string;
  onPhoneDraft: (value: string) => void;
  onSearch: (q: string) => void;
  onQuery: (p: Partial<Query>) => void;
  onClear: () => void;
  onReload: () => void;
  onClearFilters: () => void;
  filteredTotal?: number;
  statsTotal?: number;
}) {
  const filtered = !!(query.q || query.status || query.phone);
  return (
    <div className={styles.searchToolbar}>
      <div className={styles.searchBox}>
        <Search size={14} className={styles.searchIcon} aria-hidden="true" />
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
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onQuery({ phone: phoneDraft.trim() || undefined, page: 1 });
          }}
        >
          <label htmlFor="customer-phone">Số điện thoại chính xác</label>
          <TextInput
            id="customer-phone"
            name="phone"
            inputMode="tel"
            maxLength={64}
            value={phoneDraft}
            onChange={(e) => onPhoneDraft(e.target.value)}
          />
          <Button type="submit" variant="secondary">
            Áp dụng
          </Button>
        </form>
      </details>
      <div className={styles.toolbarActions}>
        {filtered && (
          <div className={styles.filterBadge}>
            <span>Đang lọc</span>
            {filteredTotal !== undefined && (
              <span className={styles.filterCounts}>
                ({filteredTotal}
                {statsTotal !== undefined ? `/${statsTotal}` : ""})
              </span>
            )}
            <button
              type="button"
              className={styles.filterClearAction}
              aria-label="Xóa các điều kiện lọc hiện tại"
              title="Xóa các điều kiện lọc hiện tại"
              onClick={onClearFilters}
            >
              <X size={12} aria-hidden="true" />
              <span>Xóa lọc</span>
            </button>
          </div>
        )}
        <Button variant="secondary" onClick={onReload} aria-label="Làm mới">
          <RefreshCw size={14} aria-hidden="true" />
          <span>Làm mới</span>
        </Button>
      </div>
    </div>
  );
}
