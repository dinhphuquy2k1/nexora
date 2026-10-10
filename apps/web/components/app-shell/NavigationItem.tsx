import Link from "next/link";
import { type NavItem } from "../../lib/navigation/nav-config.ts";
import { getNavIcon } from "../../lib/icons.ts";
import styles from "./Sidebar.module.css";

interface NavigationItemProps {
  item: NavItem;
  isActive: boolean;
  isCollapsed: boolean;
}

export function NavigationItem({
  item,
  isActive,
  isCollapsed,
}: NavigationItemProps) {
  const IconComponent = getNavIcon(item.iconKey);

  if (item.status === "available" && item.href) {
    return (
      <div className={styles.navItemContainer}>
        <Link
          href={item.href}
          className={`${styles.navItemLink} ${isActive ? styles.navItemActive : ""} ${
            isCollapsed ? styles.itemCentered : ""
          }`}
          aria-current={isActive ? "page" : undefined}
          aria-label={isCollapsed ? item.label : undefined}
          title={isCollapsed ? item.label : undefined}
        >
          {isActive && (
            <span className={styles.activeIndicator} aria-hidden="true" />
          )}
          <span
            className={`${styles.itemIcon} ${isActive ? styles.itemIconActive : ""}`}
            aria-hidden="true"
          >
            <IconComponent size={18} />
          </span>
          {!isCollapsed && (
            <span className={styles.itemLabel}>{item.label}</span>
          )}
        </Link>
        {isCollapsed && (
          <div
            className={styles.collapsedTooltip}
            role="tooltip"
            aria-hidden="true"
          >
            {item.label}
          </div>
        )}
      </div>
    );
  }

  // Planned item: Truthful, non-navigable disabled presentation
  return (
    <div className={styles.navItemContainer}>
      <button
        type="button"
        disabled
        aria-disabled="true"
        aria-label={isCollapsed ? `${item.label} (Chưa triển khai)` : undefined}
        className={`${styles.navItemDisabled} ${
          isCollapsed ? styles.itemCentered : ""
        }`}
        title={isCollapsed ? `${item.label} (Chưa triển khai)` : undefined}
      >
        <span className={styles.itemIcon} aria-hidden="true">
          <IconComponent size={18} />
        </span>
        {!isCollapsed && (
          <>
            <span className={styles.itemLabel}>{item.label}</span>
            <span className={styles.plannedBadge}>Chưa triển khai</span>
          </>
        )}
      </button>
      {isCollapsed && (
        <div
          className={styles.collapsedTooltip}
          role="tooltip"
          aria-hidden="true"
        >
          {item.label} (Chưa triển khai)
        </div>
      )}
    </div>
  );
}
