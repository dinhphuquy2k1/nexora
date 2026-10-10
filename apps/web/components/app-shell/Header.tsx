"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { PRODUCT_NAME } from "@nexora/shared";
import { Breadcrumb } from "./Breadcrumb.tsx";
import { NotificationMenu } from "./NotificationMenu.tsx";
import { UserMenu } from "./UserMenu.tsx";
import styles from "./Header.module.css";

interface HeaderProps {
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export function Header({ isSidebarCollapsed, onToggleSidebar }: HeaderProps) {
  return (
    <header className={styles.header} aria-label="Thanh công cụ đầu trang">
      {/* Left zone: Sidebar Toggle & Collapsed Brand & Breadcrumbs */}
      <div className={styles.leftSection}>
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={
            isSidebarCollapsed
              ? "Mở rộng thanh điều hướng"
              : "Thu gọn thanh điều hướng"
          }
          className={styles.toggleButton}
          title={
            isSidebarCollapsed
              ? "Mở rộng thanh điều hướng"
              : "Thu gọn thanh điều hướng"
          }
        >
          <Menu size={18} aria-hidden="true" />
        </button>

        {isSidebarCollapsed && (
          <Link
            href="/"
            className={styles.collapsedBrand}
            title="Về trang tổng quan"
          >
            <div className={styles.collapsedLogo} aria-hidden="true">
              <span>N</span>
              <span className={styles.collapsedLogoDot} />
            </div>
            <span className={styles.collapsedBrandName}>{PRODUCT_NAME}</span>
          </Link>
        )}

        <Breadcrumb />
      </div>

      {/* Right zone: Local Indicator, Notifications & User Workspace */}
      <div className={styles.rightSection}>
        <div className={styles.localBadge}>
          <span className={styles.statusDot} aria-hidden="true" />
          <span>Không gian cục bộ</span>
        </div>

        <NotificationMenu />
        <UserMenu />
      </div>
    </header>
  );
}
