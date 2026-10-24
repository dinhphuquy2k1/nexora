import type { Stats } from "./types.ts";
import styles from "./customers.module.css";
export function CustomerStatsBar({
  stats,
  loading,
  error,
}: {
  stats?: Stats | null;
  loading: boolean;
  error?: boolean;
}) {
  return (
    <section
      aria-label="Thống kê khách hàng"
      aria-busy={loading}
      className={styles.stats}
    >
      {loading ? (
        <p role="status">Đang tải thống kê…</p>
      ) : error ? (
        <p>Không tải được thống kê.</p>
      ) : !stats ? (
        <p>Thống kê chưa khả dụng từ máy chủ.</p>
      ) : (
        (
          [
            ["Tổng khách hàng", stats.total],
            ["Đang hoạt động", stats.active],
            ["Ngừng hoạt động", stats.inactive],
          ] as const
        ).map(([label, n]) => (
          <div className={styles.stat} key={label}>
            <span>{label}</span>
            <strong>{n}</strong>
          </div>
        ))
      )}
    </section>
  );
}
