"use client";

import type { RefObject } from "react";
import { X } from "lucide-react";
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
  onClose: () => void;
  onNavigate: (href: string) => void;
  isMobile: boolean;
  sidebarRef: RefObject<HTMLElement | null>;
}

const GROUPS: readonly NavGroup[] = ["Workspace", "System"] as const;

export function Sidebar({
  isCollapsed,
  onClose,
  onNavigate,
  isMobile,
  sidebarRef,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      ref={sidebarRef}
      inert={isMobile && isCollapsed}
      role={isMobile && !isCollapsed ? "dialog" : undefined}
      aria-modal={isMobile && !isCollapsed ? true : undefined}
      className={`${styles.sidebar} ${
        isCollapsed ? styles.collapsed : styles.expanded
      }`}
      aria-label="Thanh điều hướng chính"
    >
      {/* Brand Header */}
      <div className={styles.brand}>
        <Link
          href="/"
          onNavigate={() => onNavigate("/")}
          className={styles.brandLink}
          title="Về trang tổng quan"
        >
          <div className={styles.logoMonogram} aria-hidden="true">
            <span className={styles.logoLetter}>N</span>
            <span className={styles.logoDot} />
          </div>

          {!isCollapsed && (
            <div className={styles.brandText}>
              <span className={styles.brandTitle}>{PRODUCT_NAME}</span>
              <span className={styles.brandSubtitle}>QUẢN LÝ VẬN ĐƠN</span>
            </div>
          )}
        </Link>
        <button
          type="button"
          className={styles.mobileClose}
          aria-label="Đóng menu di động"
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
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
              {!isCollapsed && (
                <div className={styles.groupTitle}>{GROUP_LABELS[group]}</div>
              )}
              {groupItems.map((item) => (
                <NavigationItem
                  key={item.id}
                  item={item}
                  isActive={isItemActive(item, pathname)}
                  isCollapsed={isCollapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
