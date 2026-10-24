"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRODUCT_NAME } from "@nexora/shared";
import {
  NAVIGATION_ITEMS,
  GROUP_LABELS,
  type NavGroup,
} from "../../lib/navigation/nav-config.ts";
import { isItemActive } from "../../lib/navigation/resolve-active.ts";
import { NavigationItem } from "./NavigationItem.tsx";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  isCollapsed: boolean;
  isResponsive?: boolean;
}

const GROUPS: readonly NavGroup[] = ["Workspace", "System"] as const;

export function Sidebar({ isCollapsed, isResponsive = false }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`${styles.sidebar} ${
        isResponsive
          ? styles.responsive
          : isCollapsed
            ? styles.collapsed
            : styles.expanded
      }`}
      aria-label="Thanh điều hướng chính"
    >
      {/* Brand Header */}
      <div className={styles.brand}>
        <Link href="/" className={styles.brandLink} title="Về trang tổng quan">
          <div className={styles.logoMonogram} aria-hidden="true">
            <span className={styles.logoLetter}>N</span>
            <span className={styles.logoDot} />
          </div>

          <div className={styles.brandText}>
            <span className={styles.brandTitle}>{PRODUCT_NAME}</span>
            <span className={styles.brandSubtitle}>Logistics Hub</span>
          </div>
        </Link>
      </div>

      {/* Navigation Groups */}
      <nav className={styles.nav} aria-label="Menu chức năng">
        {GROUPS.map((group) => {
          const groupItems = NAVIGATION_ITEMS.filter(
            (item) => item.group === group,
          );
          if (groupItems.length === 0) return null;

          return (
            <div key={group} className={styles.navGroup}>
              <div className={styles.groupTitle}>{GROUP_LABELS[group]}</div>
              {groupItems.map((item) => (
                <NavigationItem
                  key={item.id}
                  item={item}
                  isActive={isItemActive(item, pathname)}
                  isCollapsed={!isResponsive && isCollapsed}
                />
              ))}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
