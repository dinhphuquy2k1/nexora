"use client";
import { Button } from "@nexora/ui";

import type { RefObject } from "react";
import type { DeploymentPresentation } from "../../lib/auth/deployment-presentation.ts";
import { NotificationMenu } from "./NotificationMenu.tsx";
import { Menu } from "lucide-react";
import { Breadcrumb } from "./Breadcrumb.tsx";
import { AccountMenu } from "./AccountMenu.tsx";
import frame from "./WorkspaceFrame.module.css";
import styles from "./Header.module.css";

interface HeaderProps {
  isSidebarCollapsed: boolean;
  isResponsive?: boolean;
  isMobile: boolean;
  mobileOpen: boolean;
  toggleRef: RefObject<HTMLButtonElement | null>;
  deployment: DeploymentPresentation;
  onToggleSidebar: () => void;
  user?: { id: string; username: string };
}

export function Header({
  isSidebarCollapsed,
  isResponsive = false,
  onToggleSidebar,
  user,
  isMobile,
  mobileOpen,
  toggleRef,
  deployment,
}: HeaderProps) {
  let toggleLabel = "Thu gọn thanh điều hướng";
  if (isMobile) {
    toggleLabel = mobileOpen ? "Đóng menu di động" : "Mở menu di động";
  } else if (isSidebarCollapsed) {
    toggleLabel = "Mở rộng thanh điều hướng";
  }

  return (
    <header className={styles.header} aria-label="Thanh công cụ đầu trang">
      <div
        className={`${frame.frame} ${styles.inner}`}
        data-workspace-frame="header"
      >
        {/* Left section: Sidebar Toggle & Breadcrumbs */}
        <div className={styles.leftSection}>
          {isResponsive ? (
            <>
              {/* Desktop expanded: >= 1101px */}
              <Button
                variant="ghost"
                icon
                type="button"
                onClick={onToggleSidebar}
                aria-expanded="true"
                aria-label="Thu gọn thanh điều hướng"
                title="Thu gọn thanh điều hướng"
                className={`${styles.toggleButton} ${styles.desktopExpandedToggle}`}
              >
                <Menu size={18} aria-hidden="true" />
              </Button>
              {/* Desktop compact: 901px - 1100px */}
              <Button
                variant="ghost"
                icon
                type="button"
                onClick={onToggleSidebar}
                aria-expanded="false"
                aria-label="Mở rộng thanh điều hướng"
                title="Mở rộng thanh điều hướng"
                className={`${styles.toggleButton} ${styles.desktopCompactToggle}`}
              >
                <Menu size={18} aria-hidden="true" />
              </Button>
              {/* Mobile: <= 900px */}
              <Button
                variant="ghost"
                icon
                ref={toggleRef}
                type="button"
                onClick={onToggleSidebar}
                aria-expanded={mobileOpen}
                aria-label={
                  mobileOpen ? "Đóng menu di động" : "Mở menu di động"
                }
                title={mobileOpen ? "Đóng menu di động" : "Mở menu di động"}
                className={`${styles.toggleButton} ${styles.mobileToggle}`}
              >
                <Menu size={18} aria-hidden="true" />
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              icon
              ref={toggleRef}
              aria-expanded={isMobile ? mobileOpen : !isSidebarCollapsed}
              type="button"
              onClick={onToggleSidebar}
              aria-label={toggleLabel}
              className={styles.toggleButton}
              title={toggleLabel}
            >
              <Menu size={18} aria-hidden="true" />
            </Button>
          )}

          {((isResponsive && !isMobile) ||
            (isSidebarCollapsed && !isMobile)) && (
            <div
              className={`${styles.collapsedBrand} ${isResponsive ? styles.responsiveBrand : ""}`}
              aria-hidden="true"
            >
              <div className={styles.collapsedLogo}>
                <span className={styles.collapsedLogoLetter}>N</span>
                <span className={styles.collapsedLogoDot} />
              </div>
              <span className={styles.collapsedBrandName}>NEXORA</span>
            </div>
          )}

          <Breadcrumb />
        </div>

        {/* Right section: User Account */}
        <div className={styles.rightSection}>
          <NotificationMenu />
          <AccountMenu initialUser={user} deployment={deployment} />
        </div>
      </div>
    </header>
  );
}
