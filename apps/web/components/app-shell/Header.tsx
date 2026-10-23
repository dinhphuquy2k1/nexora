"use client";

import type { RefObject } from "react";
import type { DeploymentPresentation } from "../../lib/auth/deployment-presentation.ts";
import { NotificationMenu } from "./NotificationMenu.tsx";
import { Menu } from "lucide-react";
import { Breadcrumb } from "./Breadcrumb.tsx";
import { AccountMenu } from "./AccountMenu.tsx";
import styles from "./Header.module.css";

interface HeaderProps {
  isSidebarCollapsed: boolean;
  isMobile: boolean;
  mobileOpen: boolean;
  toggleRef: RefObject<HTMLButtonElement | null>;
  deployment: DeploymentPresentation;
  onToggleSidebar: () => void;
  user?: { id: string; username: string };
}

export function Header({
  isSidebarCollapsed,
  onToggleSidebar,
  user,
  isMobile,
  mobileOpen,
  toggleRef,
  deployment,
}: HeaderProps) {
  let toggleLabel = "Thu gọn thanh điều hướng";
  if (isMobile) toggleLabel = "Mở menu di động";
  else if (isSidebarCollapsed) toggleLabel = "Mở rộng thanh điều hướng";
  return (
    <header className={styles.header} aria-label="Thanh công cụ đầu trang">
      {/* Left section: Sidebar Toggle & Breadcrumbs */}
      <div className={styles.leftSection}>
        <button
          ref={toggleRef}
          aria-expanded={isMobile ? mobileOpen : !isSidebarCollapsed}
          type="button"
          onClick={onToggleSidebar}
          aria-label={toggleLabel}
          className={styles.toggleButton}
          title={toggleLabel}
        >
          <Menu size={18} aria-hidden="true" />
        </button>

        <Breadcrumb />
      </div>

      {/* Right section: User Account */}
      <div className={styles.rightSection}>
        <NotificationMenu />
        <AccountMenu initialUser={user} deployment={deployment} />
      </div>
    </header>
  );
}
