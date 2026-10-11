import type { ReactNode } from "react";
import styles from "./StatusBadge.module.css";

export interface StatusBadgeProps {
  ok: boolean | null;
  children: ReactNode;
  className?: string;
}

export function StatusBadge({ ok, children, className }: StatusBadgeProps) {
  const statusClass =
    ok === true ? styles.good : ok === false ? styles.bad : styles.pending;

  const badgeClassName = className
    ? `${styles.badge} ${statusClass} ${className}`
    : `${styles.badge} ${statusClass}`;

  return <span className={badgeClassName}>{children}</span>;
}
