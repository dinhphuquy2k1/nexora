"use client";

import Link from "next/link";
import { Menu, Settings } from "lucide-react";
import { Breadcrumb } from "./Breadcrumb.tsx";
import { NotificationMenu } from "./NotificationMenu.tsx";
import styles from "./Header.module.css";

interface HeaderProps {
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export function Header({ isSidebarCollapsed, onToggleSidebar }: HeaderProps) {
  return (
    <header className={styles.header} aria-label="Thanh công cụ đầu trang">
      {/* Left section: Sidebar Toggle & Breadcrumbs */}
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

        <Breadcrumb />
      </div>

      {/* Right section: Notifications & Settings */}
      <div className={styles.rightSection}>
        <NotificationMenu />
        <Link
          href="/settings"
          className={styles.iconButton}
          aria-label="Cài đặt hệ thống"
          title="Cài đặt hệ thống"
        >
          <Settings size={18} aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
