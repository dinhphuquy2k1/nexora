"use client";

import type { DeploymentPresentation } from "../../lib/auth/deployment-presentation.ts";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar.tsx";
import { Header } from "./Header.tsx";
import styles from "./AppShell.module.css";

interface ShellClientProps {
  children: ReactNode;
  user?: { id: string; username: string };
  deployment: DeploymentPresentation;
}

export function ShellClient({ children, user, deployment }: ShellClientProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  return (
    <div className={styles.container}>
      {/* Collapsible Logistics Sidebar */}
      <Sidebar isCollapsed={isSidebarCollapsed} />

      {/* Main Workspace Area */}
      <div className={styles.mainWrapper}>
        <Header
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
          user={user}
          deployment={deployment}
        />

        <main className={styles.contentArea}>{children}</main>
      </div>
    </div>
  );
}
