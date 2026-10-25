import type { ReactNode } from "react";
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
  let content: ReactNode;
  if (loading) content = <p role="status">Đang tải thống kê…</p>;
  else if (error) content = <p>Không tải được thống kê.</p>;
  else if (!stats) content = <p>Thống kê chưa khả dụng từ máy chủ.</p>;
  else
    content = (
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
    ));
  return (
    <section
      aria-label="Thống kê khách hàng"
      aria-busy={loading}
      className={styles.stats}
    >
      {content}
    </section>
  );
}
