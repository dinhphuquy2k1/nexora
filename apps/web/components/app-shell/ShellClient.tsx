"use client";

import { ShippingScopeProvider } from "../../features/shipping-scope/ShippingScopeProvider.tsx";
import { useRef, useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar.tsx";
import { Header } from "./Header.tsx";
import styles from "./AppShell.module.css";

interface ShellClientProps {
  children: ReactNode;
  user?: { id: string; username: string };
}

export function ShellClient({ children, user }: ShellClientProps) {
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeSidebar = () => {
    setIsSidebarCollapsed(true);
    toggleRef.current?.focus();
  };
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  return (
    <ShippingScopeProvider>
      <div className={styles.container}>
        {/* Collapsible Logistics Sidebar */}
        <Sidebar isCollapsed={isSidebarCollapsed} onClose={closeSidebar} />
        {!isSidebarCollapsed && (
          <button
            type="button"
            className={styles.mobileBackdrop}
            aria-label="Đóng ngăn điều hướng"
            onClick={closeSidebar}
          />
        )}

        {/* Main Workspace Area */}
        <div className={styles.mainWrapper}>
          <Header
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={handleToggleSidebar}
            toggleRef={toggleRef}
            user={user}
          />

          <main className={styles.contentArea}>{children}</main>
        </div>
      </div>
    </ShippingScopeProvider>
  );
}
