import type { ComponentPropsWithoutRef } from "react";
import styles from "./TabBar.module.css";

export interface TabCountBadgeProps extends ComponentPropsWithoutRef<"span"> {
  value?: number;
  active?: boolean;
  ariaLabel?: string;
}

export function TabCountBadge({
  value,
  active = false,
  className = "",
  ariaLabel,
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
      {display}
    </span>
  );
}
