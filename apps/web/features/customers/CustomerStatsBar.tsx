import { Button } from "@nexora/ui";
import { CustomerStatus, CustomerStatusLabelsVi } from "@nexora/shared";
import type { Query, Stats } from "./types.ts";
import styles from "./customers.module.css";
export function CustomerStatsBar({
  stats,
  stale = false,
  loading,
  error,
  status,
  onChange,
}: {
  stats?: Stats | null;
  stale?: boolean;
  loading: boolean;
  error?: boolean;
  status?: Query["status"];
  onChange: (status: Query["status"]) => void;
}) {
  const tabs = [
    { code: undefined, label: "TẤT CẢ", count: stats?.total, dot: false },
    {
      code: CustomerStatus.ACTIVE,
      label:
        CustomerStatusLabelsVi[CustomerStatus.ACTIVE].toLocaleUpperCase("vi"),
      count: stats?.active,
      dot: true,
    },
    {
      code: CustomerStatus.INACTIVE,
      label:
        CustomerStatusLabelsVi[CustomerStatus.INACTIVE].toLocaleUpperCase("vi"),
      count: stats?.inactive,
      dot: true,
    },
  ];
  let freshness = "unavailable";
  if (stats) freshness = stale ? "stale" : "fresh";
  return (
    <div
      className={styles.statusBand}
      aria-busy={loading}
      data-freshness={freshness}
    >
      <div
        role="tablist"
        aria-label="Trạng thái khách hàng"
        className={styles.segments}
      >
        {tabs.map((tab, index) => {
          const selected = status === tab.code;
          return (
            <Button
              key={tab.code ?? "all"}
              role="tab"
              id={`customer-tab-${tab.code ?? "all"}`}
              aria-controls="customer-results"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              variant={selected ? "emphasis" : "ghost"}
              className={`${styles.tabButton} ${selected ? styles.tabSelected : styles.tabUnselected}`}
              onClick={() => onChange(tab.code)}
              onKeyDown={(e) => {
                let next: number;
                if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
                else if (e.key === "ArrowLeft")
                  next = (index + tabs.length - 1) % tabs.length;
                else if (e.key === "Home") next = 0;
                else if (e.key === "End") next = tabs.length - 1;
                else return;
                e.preventDefault();
                const buttons =
                  e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                    "[role=tab]",
                  );
                buttons?.[next]?.focus();
                onChange(tabs[next].code);
              }}
            >
              {tab.dot && (
                <span
                  className={`${styles.tabDot} ${
                    selected
                      ? styles.tabDotSelected
                      : tab.code === CustomerStatus.ACTIVE
                        ? styles.tabDotActive
                        : styles.tabDotInactive
                  }`}
                  aria-hidden="true"
                />
              )}
              <span>{tab.label}</span>
              <span
                className={`${styles.count} ${
                  selected ? styles.countSelected : styles.countUnselected
                }`}
              >
                {!stats ? "—" : tab.count}
              </span>
            </Button>
          );
        })}
      </div>
      <span role="status" className={styles.srOnly}>
        {loading
          ? "Đang tải thống kê…"
          : error
            ? "Không tải được thống kê. Các số đã giữ lại chưa được đối chiếu."
            : !stats
              ? "Thống kê chưa khả dụng từ máy chủ."
              : ""}
      </span>
    </div>
  );
}
