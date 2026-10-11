import type { ReactNode } from "react";
import { resolveStatusTone } from "./status-tone";
import styles from "./StatusBadge.module.css";

export interface StatusBadgeProps {
  ok: boolean | null;
  children: ReactNode;
  className?: string;
}

export function StatusBadge({ ok, children, className }: StatusBadgeProps) {
  const tone = resolveStatusTone(ok);
  const statusClass = styles[tone];

  const badgeClassName = className
    ? `${styles.badge} ${statusClass} ${className}`
    : `${styles.badge} ${statusClass}`;

  return <span className={badgeClassName}>{children}</span>;
}
