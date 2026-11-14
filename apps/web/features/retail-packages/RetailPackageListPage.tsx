"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Package,
  Search,
  Plus,
  RefreshCw,
  FileSpreadsheet,
  X,
  Layers,
  Truck,
  Building2,
  Plane,
  Warehouse,
  CheckCircle2,
  AlertTriangle,
  Filter,
} from "lucide-react";
import {
  Button,
  TextInput,
  TabBar,
  TabCountBadge,
  type TabBarItem,
  type CssTokenReference,
} from "@nexora/ui";
import type { ColumnVisibility, RetailTabKey } from "./types.ts";
import {
  STATUS_TABS,
  DEFAULT_COLUMN_VISIBILITY,
  visibleColumns,
} from "./columns.ts";
import { shipmentApi, type ShipmentApi } from "./api.ts";
import { useShipmentList } from "./useShipmentRead.ts";
import { toRetailRow } from "./row.ts";
import { tabToStage } from "./presentation.ts";
import { useRetailQuery } from "./useRetailQuery.ts";
import { RetailColumnPicker } from "./RetailColumnPicker.tsx";
import { RetailPackageTable } from "./RetailPackageTable.tsx";
import { RetailPagination } from "./RetailPagination.tsx";
import { PackageDetailDrawer } from "./PackageDetailDrawer.tsx";
import styles from "./retail-packages.module.css";
export interface RetailPackageListPageProps {
  api?: ShipmentApi;
  initialSearch?: string;
}

const TAB_ICONS: Record<RetailTabKey, React.ReactNode> = {
  all: <Layers size={16} />,
  to_origin: <Truck size={16} />,
  at_origin: <Building2 size={16} />,
  in_transit: <Plane size={16} />,
  at_dest: <Warehouse size={16} />,
  delivered: <CheckCircle2 size={16} />,
  disputed: <AlertTriangle size={16} />,
};

const TAB_ACTIVE_ICON_COLORS: Record<RetailTabKey, CssTokenReference> = {
  all: "var(--color-retail-tab-all-icon)",
  to_origin: "var(--color-retail-tab-to-origin-icon)",
  at_origin: "var(--color-retail-tab-at-origin-icon)",
  in_transit: "var(--color-retail-tab-in-transit-icon)",
  at_dest: "var(--color-retail-tab-at-dest-icon)",
  delivered: "var(--color-retail-tab-delivered-icon)",
  disputed: "var(--color-retail-tab-disputed-icon)",
};

const RETAIL_TAB_ITEMS: readonly TabBarItem<RetailTabKey>[] = STATUS_TABS.map(
  (t) => ({
    id: t.key,
    title: t.label,
    icon: TAB_ICONS[t.key],
    activeIconColor: TAB_ACTIVE_ICON_COLORS[t.key],
    disabled: t.key === "disputed",
    tooltip: t.key === "disputed" ? "Chưa hỗ trợ" : undefined,
  }),
);

export function RetailPackageListPage({
  api = shipmentApi,
  initialSearch = "",
}: RetailPackageListPageProps) {
  const { query, invalid, change, navigationError } =
    useRetailQuery(initialSearch);
  const read = useShipmentList(query, api, !invalid);
  const data = read.data;
  const unavailable = !data;
  const stats = read.stats;
  const [visibility, setVisibility] = useState<ColumnVisibility>(
      DEFAULT_COLUMN_VISIBILITY,
    ),
    [detail, setDetail] = useState<string | null>(null);

  const [searchDraft, setSearchDraft] = useState(query.search);
  const isSearchSessionActive = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync searchDraft when query.search changes externally (popstate, direct URL changes)
  useEffect(() => {
    setSearchDraft(query.search);
  }, [query.search]);

  // Cancel pending debounce timer on popstate or unmount
  useEffect(() => {
    const handlePopState = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      isSearchSessionActive.current = false;
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, []);

  const commitSearch = useCallback(
    (nextSearch: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const clean = nextSearch.slice(0, 200);
      if (clean === query.search) {
        return;
      }
      const shouldReplace = isSearchSessionActive.current;
      change({ search: clean, page: 1 }, { replace: shouldReplace });
      isSearchSessionActive.current = true;
    },
    [query.search, change],
  );

  const handleSearchChange = (value: string) => {
    const val = value.slice(0, 200);
    setSearchDraft(val);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (val === "") {
      commitSearch("");
      isSearchSessionActive.current = false;
      return;
    }
    debounceTimerRef.current = setTimeout(() => {
      const shouldReplace = isSearchSessionActive.current;
      change({ search: val, page: 1 }, { replace: shouldReplace });
      isSearchSessionActive.current = true;
    }, 300);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      commitSearch(searchDraft);
      isSearchSessionActive.current = false;
    }
  };

  const handleSearchBlur = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    commitSearch(searchDraft);
    isSearchSessionActive.current = false;
  };
  const rows = useMemo(() => data?.shipments.map(toRetailRow) ?? [], [data]);
  const page = data?.pagination.page ?? query.page;
  const counts = Object.fromEntries(
    STATUS_TABS.map((tab) => {
      if (!stats || tab.key === "disputed") return [tab.key, undefined];
      if (tab.key === "all") return [tab.key, stats.total];
      const stage = tabToStage(tab.key);
      return [tab.key, stage ? stats.byStage[stage] : undefined];
    }),
  ) as Record<RetailTabKey, number | undefined>;
  return (
    <div
      className={styles.listPage}
      id="retail-packages-list-page"
      data-availability={unavailable ? "unavailable" : "available"}
      data-read-state={read.status}
    >
      <section
        className={styles.commandDeck}
        aria-label="Command deck kiện lẻ TMĐT"
      >
        <div className={styles.titleRow}>
          <div className={styles.titleGroup}>
            <span className={styles.brandIcon} aria-hidden="true">
              <Package size={18} />
            </span>
            <h1 id="retail-packages-heading" tabIndex={-1}>
              QUẢN LÝ KIỆN HÀNG TMĐT
            </h1>
          </div>
          <div className={styles.headerActions}>
            <Button
              variant="secondary"
              disabled
              aria-label="Xuất Excel (chưa khả dụng)"
              title="Máy chủ chưa hỗ trợ xuất kiện lẻ."
            >
              <FileSpreadsheet size={14} />
              <span className={styles.exportLabel}>Xuất Excel</span>
            </Button>
            <Button
              variant="emphasis"
              disabled
              aria-label="Tạo kiện lẻ mới"
              title="Chưa hỗ trợ"
            >
              <Plus size={14} />
              TẠO MỚI KIỆN HÀNG
            </Button>
          </div>
        </div>
        <div className={styles.tabBarWrapper}>
          <TabBar
            items={RETAIL_TAB_ITEMS}
            value={query.status}
            onValueChange={(status) => {
              change({ status, page: 1 });
            }}
            renderTrailing={(item, { active }) => (
              <TabCountBadge
                value={counts[item.id]}
                className={styles.tabCount}
                active={active}
                title={
                  item.id === "disputed"
                    ? "Chưa hỗ trợ"
                    : !stats
                      ? "Chưa có dữ liệu"
                      : undefined
                }
                srText={
                  item.id === "disputed"
                    ? "Chưa hỗ trợ"
                    : !stats
                      ? "chưa có dữ liệu"
                      : undefined
                }
              />
            )}
            idPrefix="retail-tab"
            panelId="retail-packages-results"
            ariaLabel="Trạng thái kiện hàng"
          />
        </div>
        <div className={styles.toolbar}>
          <div className={styles.searchGroup}>
            <div className={styles.popoverAnchor}>
              <Button
                variant="secondary"
                disabled
                aria-label="Bộ lọc nâng cao"
                title="Đang phát triển"
              >
                <Filter size={14} aria-hidden="true" /> Thêm điều kiện lọc{" "}
                {query.filters.length > 0 && (
                  <span>{query.filters.length}</span>
                )}
              </Button>
            </div>

            <div className={styles.searchWrapper}>
              <Search
                size={14}
                className={styles.searchIcon}
                aria-hidden="true"
              />
              <TextInput
                type="search"
                className={styles.searchInput}
                placeholder="Tìm mã vận đơn, tên sản phẩm…"
                aria-label="Tìm kiếm kiện lẻ"
                maxLength={200}
                value={searchDraft}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                onBlur={handleSearchBlur}
              />
            </div>
          </div>
          <div className={styles.toolbarRight}>
            <RetailColumnPicker
              visibility={visibility}
              onChange={setVisibility}
            />

            <Button
              variant="secondary"
              disabled
              aria-label="Làm mới dữ liệu (chưa khả dụng)"
              title="Chưa hỗ trợ"
            >
              <RefreshCw size={14} />
              <span>Làm mới</span>
            </Button>
          </div>
        </div>
        {query.filters.length > 0 && (
          <div
            className={styles.filterChips}
            role="group"
            aria-label="Bộ lọc đang áp dụng"
          >
            {query.filters.map((f) => (
              <span className={styles.filterChip} key={f.id}>
                {f.displayLabel}
                <Button
                  icon
                  variant="ghost"
                  aria-label={`Xóa bộ lọc: ${f.displayLabel}`}
                  onClick={() =>
                    change({
                      filters: query.filters.filter(
                        (other) => other.id !== f.id,
                      ),
                    })
                  }
                >
                  <X size={12} />
                </Button>
              </span>
            ))}
            <Button variant="ghost" onClick={() => change({ filters: [] })}>
              Xóa tất cả
            </Button>
          </div>
        )}
      </section>
      {navigationError && <p role="alert">{navigationError}</p>}
      {invalid && (
        <div role="alert">
          Bộ lọc URL không hợp lệ. Không hiển thị kết quả mở rộng.
          <Button variant="secondary" onClick={() => change({}, true)}>
            Đặt lại bộ lọc
          </Button>
        </div>
      )}
      <section
        className={styles.dataCard}
        id="retail-packages-results"
        role="tabpanel"
        aria-labelledby={`retail-tab-${query.status}`}
      >
        {read.error && (
          <p className={styles.availabilityNotice} role="alert">
            {read.error.message}{" "}
            <Button variant="secondary" onClick={read.refresh}>
              Thử lại
            </Button>
          </p>
        )}
        {query.status === "disputed" && (
          <p className={styles.availabilityNotice} role="status">
            Khiếu nại: Chưa hỗ trợ.
          </p>
        )}
        <RetailPackageTable
          paginated={rows}
          visibleColumns={visibleColumns(visibility)}
          onDetail={(row) => setDetail(row.id)}
          unavailable={unavailable}
          notice={
            !!stats?.byStage.UNKNOWN && (
              <p className={styles.availabilityNotice}>
                <AlertTriangle size={14} aria-hidden="true" />{" "}
                {stats.byStage.UNKNOWN} kiện có trạng thái chưa xác định từ
                hãng.
              </p>
            )
          }
          loading={read.loading}
          failed={!!read.error}
          emptyMessage={data ? "Chưa có kiện nào được đồng bộ." : "—"}
        />
        <RetailPagination
          page={page}
          pageSize={data?.pagination.pageSize ?? query.pageSize}
          total={data?.pagination.total ?? 0}
          unavailable={unavailable}
          onPage={(page) => change({ page })}
          onSize={(pageSize) => change({ pageSize, page: 1 })}
        />
      </section>
      {detail && (
        <PackageDetailDrawer
          id={detail}
          api={api}
          onClose={() => setDetail(null)}
        />
      )}{" "}
    </div>
  );
}
