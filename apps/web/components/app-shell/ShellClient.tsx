"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Button, Overlay } from "@nexora/ui";
import { X } from "lucide-react";
import { Sidebar } from "./Sidebar.tsx";
import { Header } from "./Header.tsx";
import type { DeploymentPresentation } from "../../lib/auth/deployment-presentation.ts";
import styles from "./AppShell.module.css";
interface ShellClientProps {
  children: ReactNode;
  user?: { id: string; username: string };
  deployment: DeploymentPresentation;
}
export function ShellClient({ children, user, deployment }: ShellClientProps) {
  const [mounted, setMounted] = useState(false);
  const [userOverride, setUserOverride] = useState<boolean | null>(null);
  const [isCompact, setIsCompact] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    setMounted(true);
    const mobile = window.matchMedia("(max-width: 900px)");
    const compact = window.matchMedia("(max-width: 1100px)");
    const update = () => {
      setIsMobile(mobile.matches);
      setIsCompact(compact.matches);
      setMobileOpen(false);
    };

    update();

    const handleBoundaryChange = () => {
      setUserOverride(null);
      update();
    };
    mobile.addEventListener("change", handleBoundaryChange);
    compact.addEventListener("change", handleBoundaryChange);
    return () => {
      mobile.removeEventListener("change", handleBoundaryChange);
      compact.removeEventListener("change", handleBoundaryChange);
    };
  }, []);
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);
  function dismiss() {
    setMobileOpen(false);
    toggleRef.current?.focus();
  }
  const isEffectiveCollapsed = userOverride !== null ? userOverride : isCompact;
  const isResponsive = userOverride === null;
  return (
    <div
      className={styles.container}
      data-hydrated={mounted ? "true" : undefined}
    >
      <div className={styles.desktopSidebar}>
        <Sidebar
          isCollapsed={isEffectiveCollapsed}
          isResponsive={isResponsive}
        />
      </div>
      <Overlay
        open={isMobile && mobileOpen}
        onDismiss={dismiss}
        label="Điều hướng di động"
        side
      >
        <div
          className={styles.mobileNavigation}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a[href]")) dismiss();
          }}
        >
          <Button
            variant="ghost"
            icon
            type="button"
            className={styles.mobileCloseButton}
            onClick={dismiss}
            aria-label="Đóng menu di động"
            title="Đóng menu di động"
          >
            <X size={18} aria-hidden="true" />
          </Button>
          <Sidebar isCollapsed={false} isResponsive={false} />
        </div>
      </Overlay>
      <div className={styles.mainWrapper}>
        <Header
          isSidebarCollapsed={isEffectiveCollapsed}
          isResponsive={!mounted}
          isMobile={isMobile}
          mobileOpen={mobileOpen}
          toggleRef={toggleRef}
          onToggleSidebar={() => {
            if (isMobile) {
              toggleRef.current?.focus();
              setMobileOpen((v) => !v);
            } else {
              setUserOverride((prev) => (prev !== null ? !prev : !isCompact));
            }
          }}
          user={user}
          deployment={deployment}
        />

        <main
          className={
            pathname?.startsWith("/customers")
              ? `${styles.contentArea} ${styles.customerContentArea}`
              : styles.contentArea
          }
          id="workspace-content"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
