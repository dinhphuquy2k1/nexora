import { Button, TextInput } from "@nexora/ui";
import { Search, X, RefreshCw, SlidersHorizontal } from "lucide-react";
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
    <>
      <div className={styles.searchToolbar}>
        <div className={styles.searchBox}>
          <Search size={17} className={styles.searchIcon} aria-hidden="true" />
          <label className={styles.srOnly} htmlFor="customer-search">
            Tìm tên, mã, điện thoại
          </label>
          <TextInput
            id="customer-search"
            name="q"
            maxLength={200}
            className={styles.searchInput}
            placeholder="Tìm mã khách hàng, họ tên, số điện thoại, email..."
            value={draft}
            onChange={(e) => onSearch(e.target.value)}
          />
          {draft && (
            <Button
              icon
              variant="ghost"
              className={styles.searchClear}
              aria-label="Xóa tìm kiếm"
              onClick={onClear}
            >
              <X size={15} />
            </Button>
          )}
        </div>
        <div className={styles.toolbarActions}>
          {filtered && (
            <span className={styles.filterBadge}>
              <span>Đang lọc</span>
              <Button
                variant="ghost"
                icon
                aria-label="Xóa bộ lọc"
                onClick={onClearFilters}
              >
                <X size={14} />
              </Button>
            </span>
          )}
          <Button variant="secondary" onClick={onReload} aria-label="Tải lại">
            <RefreshCw size={14} aria-hidden="true" />
            <span>Làm mới</span>
          </Button>
        </div>
      </div>
      <details className={styles.advanced} open={!!query.phone || undefined}>
        <summary>
          <SlidersHorizontal size={15} aria-hidden="true" /> Bộ lọc nâng cao{" "}
          {query.phone && "· Đang lọc điện thoại"}
        </summary>
        <form
          key={query.phone ?? ""}
          onSubmit={(e) => {
            e.preventDefault();
            onQuery({
              phone:
                String(
                  new FormData(e.currentTarget).get("phone") ?? "",
                ).trim() || undefined,
              page: 1,
            });
          }}
        >
          <label>
            Điện thoại chính xác
            <TextInput
              name="phone"
              maxLength={64}
              defaultValue={query.phone ?? ""}
              placeholder="Số điện thoại khách hàng"
            />
          </label>
          <Button variant="secondary" type="submit">
            Áp dụng
          </Button>
          {query.phone && (
            <Button
              variant="ghost"
              onClick={() => onQuery({ phone: undefined, page: 1 })}
            >
              Bỏ lọc điện thoại
            </Button>
          )}
        </form>
      </details>
    </>
  );
}
