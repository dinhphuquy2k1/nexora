"use client";

import type { Ref } from "react";
import { ShippingScopeSelector } from "../../features/shipping-scope/ShippingScopeSelector.tsx";
import { Menu } from "lucide-react";
import { Breadcrumb } from "./Breadcrumb.tsx";
import { AccountMenu } from "./AccountMenu.tsx";
import styles from "./Header.module.css";

interface HeaderProps {
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  toggleRef?: Ref<HTMLButtonElement>;
  user?: { id: string; username: string };
}

export function Header({
  isSidebarCollapsed,
  onToggleSidebar,
  toggleRef,
  user,
}: HeaderProps) {
  return (
    <header className={styles.header} aria-label="Thanh công cụ đầu trang">
      {/* Left section: Sidebar Toggle & Breadcrumbs */}
      <div className={styles.leftSection}>
        <button
          ref={toggleRef}
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

      {/* Right section: User Account */}
      <div className={styles.rightSection}>
        <ShippingScopeSelector />
        <AccountMenu initialUser={user} />
      </div>
    </header>
  );
}
