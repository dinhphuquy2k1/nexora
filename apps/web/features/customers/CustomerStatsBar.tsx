import { Button } from "@nexora/ui";
import { CustomerStatus, CustomerStatusLabelsVi } from "@nexora/shared";
import type { Query, Stats } from "./types.ts";
import styles from "./customers.module.css";
export function CustomerStatsBar({
  stats,
  loading,
  error,
  status,
  onChange,
}: {
  stats?: Stats | null;
  loading: boolean;
  error?: boolean;
  status?: Query["status"];
  onChange: (status: Query["status"]) => void;
}) {
  const tabs = [
    { code: undefined, label: "Tất cả", count: stats?.total },
    {
      code: CustomerStatus.ACTIVE,
      label: CustomerStatusLabelsVi.ACTIVE,
      count: stats?.active,
    },
    {
      code: CustomerStatus.INACTIVE,
      label: CustomerStatusLabelsVi.INACTIVE,
      count: stats?.inactive,
    },
  ];
  return (
    <div className={styles.statusBand} aria-busy={loading}>
      <div
        role="tablist"
        aria-label="Trạng thái khách hàng"
        className={styles.segments}
      >
        {tabs.map((tab, index) => (
          <Button
            key={tab.code ?? "all"}
            role="tab"
            id={`customer-tab-${tab.code ?? "all"}`}
            aria-controls="customer-results"
            aria-selected={status === tab.code}
            tabIndex={status === tab.code ? 0 : -1}
            variant={status === tab.code ? "primary" : "ghost"}
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
            <span>{tab.label}</span>
            <span className={styles.count}>
              {loading || error || !stats ? "—" : tab.count}
            </span>
          </Button>
        ))}
      </div>
      {loading && (
        <span role="status" className={styles.statsHint}>
          Đang tải thống kê…
        </span>
      )}
      {!loading && error && (
        <span className={styles.statsHint}>Không tải được thống kê.</span>
      )}
      {!loading && !error && !stats && (
        <span className={styles.statsHint}>
          Thống kê chưa khả dụng từ máy chủ.
        </span>
      )}
    </div>
  );
}
