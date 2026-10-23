"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Button, Overlay } from "@nexora/ui";
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 900px)");
    const compact = window.matchMedia("(max-width: 1100px)");
    const update = () => {
      setIsMobile(mobile.matches);
      setIsSidebarCollapsed(compact.matches);
      setMobileOpen(false);
    };
    update();
    mobile.addEventListener("change", update);
    compact.addEventListener("change", update);
    return () => {
      mobile.removeEventListener("change", update);
      compact.removeEventListener("change", update);
    };
  }, []);
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);
  function dismiss() {
    setMobileOpen(false);
    toggleRef.current?.focus();
  }
  return (
    <div className={styles.container}>
      <div className={styles.desktopSidebar}>
        <Sidebar isCollapsed={isSidebarCollapsed} />
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
          <Button className={styles.closeNavigation} onClick={dismiss}>
            Đóng menu di động
          </Button>
          <Sidebar isCollapsed={false} />
        </div>
      </Overlay>
      <div className={styles.mainWrapper}>
        <Header
          isSidebarCollapsed={isSidebarCollapsed}
          isMobile={isMobile}
          mobileOpen={mobileOpen}
          toggleRef={toggleRef}
          onToggleSidebar={() => {
            if (isMobile) {
              toggleRef.current?.focus();
              setMobileOpen((v) => !v);
            } else setIsSidebarCollapsed((v) => !v);
          }}
          user={user}
          deployment={deployment}
        />
        <main
          className={styles.contentArea}
          id="workspace-content"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
