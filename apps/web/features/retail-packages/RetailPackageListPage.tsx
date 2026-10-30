"use client";
import { useMemo, useState } from "react";
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
} from "lucide-react";
import {
  Button,
  TextInput,
  TabBar,
  TabCountBadge,
  type TabBarItem,
} from "@nexora/ui";
import type { RetailPackage, ColumnVisibility, StatusTabKey } from "./types.ts";
import {
  STATUS_TABS,
  DEFAULT_COLUMN_VISIBILITY,
  visibleColumns,
} from "./columns.ts";
import { addFilter, filterPackages } from "./filters.ts";
import { useRetailQuery } from "./useRetailQuery.ts";
import { RetailFilterPopover } from "./RetailFilterPopover.tsx";
import { RetailColumnPicker } from "./RetailColumnPicker.tsx";
import { RetailPackageTable } from "./RetailPackageTable.tsx";
import { RetailPagination } from "./RetailPagination.tsx";
import { CreatePackageDrawer } from "./CreatePackageDrawer.tsx";
import { PackageDetailDrawer } from "./PackageDetailDrawer.tsx";
import styles from "./retail-packages.module.css";
export interface RetailPackageListPageProps {
  initialPackages: readonly RetailPackage[];
  availability: "unavailable" | "available";
  initialSearch?: string;
}

const TAB_ICONS: Record<StatusTabKey, React.ReactNode> = {
  all: <Layers size={16} />,
  to_origin: <Truck size={16} />,
  at_origin: <Building2 size={16} />,
  in_transit: <Plane size={16} />,
  at_dest: <Warehouse size={16} />,
  delivered: <CheckCircle2 size={16} />,
  disputed: <AlertTriangle size={16} />,
};

const TAB_ACTIVE_ICON_COLORS: Record<StatusTabKey, string> = {
  all: "var(--color-retail-tab-all-icon)",
  to_origin: "var(--color-retail-tab-to-origin-icon)",
  at_origin: "var(--color-retail-tab-at-origin-icon)",
  in_transit: "var(--color-retail-tab-in-transit-icon)",
  at_dest: "var(--color-retail-tab-at-dest-icon)",
  delivered: "var(--color-retail-tab-delivered-icon)",
  disputed: "var(--color-retail-tab-disputed-icon)",
};

const RETAIL_TAB_ITEMS: readonly TabBarItem<StatusTabKey>[] = STATUS_TABS.map(
  (t) => ({
    id: t.key,
    title: t.label,
    icon: TAB_ICONS[t.key],
    activeIconColor: TAB_ACTIVE_ICON_COLORS[t.key],
  }),
);

export function RetailPackageListPage({
  initialPackages,
  availability,
  initialSearch = "",
}: RetailPackageListPageProps) {
  const { query, invalid, change, navigationError } =
    useRetailQuery(initialSearch);
  const unavailable = availability === "unavailable";
  const [visibility, setVisibility] = useState<ColumnVisibility>(
      DEFAULT_COLUMN_VISIBILITY,
    ),
    [detail, setDetail] = useState<RetailPackage | null>(null),
    [create, setCreate] = useState(false);
  const filtered = useMemo(
    () =>
      unavailable || invalid ? [] : filterPackages(initialPackages, query),
    [initialPackages, query, unavailable, invalid],
  );
  const page = Math.min(
    query.page,
    Math.max(1, Math.ceil(filtered.length / query.pageSize)),
  );
  const rows = filtered.slice(
    (page - 1) * query.pageSize,
    page * query.pageSize,
  );
  const counts = useMemo<Record<StatusTabKey, number>>(() => {
    const out: Record<StatusTabKey, number> = {
      all: initialPackages.length,
      to_origin: 0,
      at_origin: 0,
      in_transit: 0,
      at_dest: 0,
      delivered: 0,
      disputed: 0,
    };
    for (const p of initialPackages) {
      if (p.status in out) {
        out[p.status as StatusTabKey] += 1;
      }
    }
    return out;
  }, [initialPackages]);
  return (
    <div
      className={styles.listPage}
      id="retail-packages-list-page"
      data-availability={availability}
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
              disabled={unavailable}
              onClick={() => setCreate(true)}
              aria-label="Tạo kiện lẻ mới"
              title={unavailable ? "Shipment API chưa khả dụng." : undefined}
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
                value={unavailable ? 0 : counts[item.id]}
                active={active}
                title={
                  unavailable
                    ? "Chưa đồng bộ từ máy chủ (tạm tính: 0)"
                    : undefined
                }
                ariaLabel={
                  unavailable ? `${item.title} (chưa đồng bộ: 0)` : undefined
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
            <RetailFilterPopover
              filters={query.filters}
              onAdd={(f) =>
                change({ filters: addFilter(query.filters, f), page: 1 })
              }
            />

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
                value={query.search}
                onChange={(e) => change({ search: e.target.value, page: 1 })}
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
              icon
              disabled
              aria-label="Làm mới dữ liệu (chưa khả dụng)"
              title="Shipment API chưa khả dụng."
            >
              <RefreshCw size={14} />
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
                      page: 1,
                    })
                  }
                >
                  <X size={12} />
                </Button>
              </span>
            ))}
            <Button
              variant="ghost"
              onClick={() => change({ filters: [], page: 1 })}
            >
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
        {unavailable && (
          <p className={styles.availabilityNotice} role="status">
            Shipment API chưa khả dụng. Chưa có dữ liệu kiện lẻ từ máy chủ; tạo
            kiện, xuất Excel và làm mới đang tạm khóa.
          </p>
        )}
        <RetailPackageTable
          paginated={rows}
          visibleColumns={visibleColumns(visibility)}
          onDetail={setDetail}
          unavailable={unavailable}
        />
        <RetailPagination
          page={page}
          pageSize={query.pageSize}
          total={filtered.length}
          unavailable={unavailable}
          onPage={(page) => change({ page })}
          onSize={(pageSize) => change({ pageSize, page: 1 })}
        />
      </section>
      {detail && (
        <PackageDetailDrawer pkg={detail} onClose={() => setDetail(null)} />
      )}{" "}
      {create && <CreatePackageDrawer onClose={() => setCreate(false)} />}
    </div>
  );
}
