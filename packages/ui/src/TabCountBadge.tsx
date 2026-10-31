import type { ComponentPropsWithoutRef } from "react";
import styles from "./TabBar.module.css";

export interface TabCountBadgeProps extends ComponentPropsWithoutRef<"span"> {
  value?: number;
  active?: boolean;
  ariaLabel?: string;
  srText?: string;
}

export function TabCountBadge({
  value,
  active = false,
  className = "",
  ariaLabel,
  srText,
  ...rest
}: TabCountBadgeProps) {
  const display = value === undefined ? "—" : value === 0 ? "0" : String(value);

  const stateClass = active ? styles.badgeActive : styles.badgeInactive;

  return (
    <span
      {...rest}
      aria-label={ariaLabel ?? rest["aria-label"]}
      className={`${styles.badge} ${stateClass} ${className}`.trim()}
    >
      <span aria-hidden={Boolean(srText)}>{display}</span>
      {srText ? <span className={styles.srOnly}>{srText}</span> : null}
    </span>
  );
}
