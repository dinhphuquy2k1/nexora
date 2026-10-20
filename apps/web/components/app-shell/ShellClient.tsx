"use client";

import { ShippingScopeProvider } from "../../features/shipping-scope/ShippingScopeProvider.tsx";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useDismissable } from "../../lib/hooks/use-dismissable.ts";
import { Sidebar } from "./Sidebar.tsx";
import { Header } from "./Header.tsx";
import styles from "./AppShell.module.css";

interface ShellClientProps {
  children: ReactNode;
  user?: { id: string; username: string };
}

export function ShellClient({ children, user }: ShellClientProps) {
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const pendingFocus = useRef<"trigger" | "content" | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 600px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const closeSidebar = () => {
    pendingFocus.current = "trigger";
    setIsSidebarCollapsed(true);
  };
  function closeForNavigation() {
    pendingFocus.current = sidebarRef.current?.contains(document.activeElement)
      ? "content"
      : null;
    setIsSidebarCollapsed(true);
  }
  useEffect(() => {
    const changed = previousPath.current !== pathname;
    previousPath.current = pathname;
    if (changed && isMobile) closeForNavigation();
  }, [pathname, isMobile]);
  useEffect(() => {
    if (!isSidebarCollapsed) return;
    const target = pendingFocus.current;
    pendingFocus.current = null;
    if (target === "trigger" && toggleRef.current?.isConnected)
      toggleRef.current.focus();
    if (
      target === "content" &&
      (document.activeElement === document.body ||
        sidebarRef.current?.contains(document.activeElement))
    )
      mainRef.current?.focus({ preventScroll: true });
  }, [isSidebarCollapsed]);
  const drawerOpen = isMobile && !isSidebarCollapsed;
  useDismissable({
    panelRef: sidebarRef,
    triggerRef: toggleRef,
    isOpen: drawerOpen,
    onClose: closeSidebar,
  });
  useEffect(() => {
    if (!drawerOpen) return;
    const panel = sidebarRef.current;
    panel
      ?.querySelector<HTMLButtonElement>(
        'button[aria-label="Đóng menu di động"]',
      )
      ?.focus();
    function trapFocus(event: KeyboardEvent) {
      if (event.key !== "Tab" || !panel) return;
      const elements = [
        ...panel.querySelectorAll<HTMLElement>(
          "a[href],button:not([disabled])",
        ),
      ].filter((element) => element.getClientRects().length > 0);
      const first = elements[0],
        last = elements.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    panel?.addEventListener("keydown", trapFocus);
    return () => panel?.removeEventListener("keydown", trapFocus);
  }, [drawerOpen]);
  function handleMenuNavigation(href: string) {
    if (isMobile && new URL(href, window.location.href).pathname === pathname)
      closeForNavigation();
  }

  return (
    <ShippingScopeProvider>
      <div className={styles.container}>
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          isMobile={isMobile}
          sidebarRef={sidebarRef}
          onClose={closeSidebar}
          onNavigate={handleMenuNavigation}
        />
        {!isSidebarCollapsed && (
          <button
            type="button"
            className={styles.mobileBackdrop}
            aria-label="Đóng ngăn điều hướng"
            onClick={closeSidebar}
          />
        )}
        <div className={styles.mainWrapper} inert={drawerOpen}>
          <Header
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed((value) => !value)}
            toggleRef={toggleRef}
            user={user}
          />
          <main ref={mainRef} tabIndex={-1} className={styles.contentArea}>
            {children}
          </main>
        </div>
      </div>
    </ShippingScopeProvider>
  );
}
