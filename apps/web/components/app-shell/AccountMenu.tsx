"use client";

import type { DeploymentPresentation } from "../../lib/auth/deployment-presentation.ts";
import { useEffect, useId, useRef, useState } from "react";
import { User, ChevronDown, LogOut } from "lucide-react";
import { useDismissable } from "../../lib/hooks/use-dismissable.ts";
import styles from "./AccountMenu.module.css";

interface UserInfo {
  id: string;
  username: string;
}

interface AccountMenuProps {
  initialUser?: UserInfo | null;
  deployment: DeploymentPresentation;
}

export function AccountMenu({ initialUser, deployment }: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(initialUser ?? null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useDismissable({
    panelRef,
    triggerRef,
    isOpen,
    onClose: () => setIsOpen(false),
  });

  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted && data?.user) {
          setUser(data.user);
        }
      })
      .catch(() => {
        // Silently fail if session check cannot connect
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Không thể hủy phiên làm việc trên máy chủ.");
      }
      window.location.href = "/login";
    } catch {
      setLogoutError("Đăng xuất không thành công. Vui lòng thử lại.");
      setIsLoggingOut(false);
    }
  };

  const displayName = user ? user.username : "Tài khoản";

  return (
    <div className={styles.menuContainer}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        aria-label={`Tài khoản người dùng: ${displayName}`}
        title={`Tài khoản: ${displayName}`}
        className={styles.accountButton}
      >
        <div className={styles.avatar} aria-hidden="true">
          <User size={16} />
        </div>
        <div
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
          aria-hidden="true"
        >
          <ChevronDown size={14} />
        </div>
      </button>

      {isOpen && (
        <div
          id={panelId}
          ref={panelRef}
          className={styles.dropdownPanel}
          role="region"
          aria-label="Thông tin tài khoản"
        >
          <div className={styles.panelHeader}>
            <div className={styles.titleRow}>
              <h4 className={styles.panelTitle}>
                {user ? user.username : "Tài khoản người dùng"}
              </h4>
              <span className={user ? styles.activeBadge : styles.plannedBadge}>
                {user ? deployment.badge : "Chưa kết nối"}
              </span>
            </div>
            <p className={styles.panelDescription}>
              {user
                ? deployment.session
                : "Quản lý danh tính và phiên làm việc"}
            </p>
          </div>
          <div className={styles.panelBody}>
            <div className={styles.statusNotice}>
              {user
                ? `Đang đăng nhập với tư cách "${user.username}".`
                : "Chưa xác thực danh tính người dùng."}
            </div>
            <p className={styles.infoFootnote}>{deployment.runtime}</p>

            {user && (
              <>
                <button
                  type="button"
                  className={styles.logoutButton}
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  aria-label="Đăng xuất khỏi hệ thống"
                >
                  <LogOut size={16} aria-hidden="true" />
                  {isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
                </button>
                {logoutError && (
                  <p className={styles.logoutError} role="alert">
                    {logoutError}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
