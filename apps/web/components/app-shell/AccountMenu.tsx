"use client";
import Link from "next/link";
import { CARRIER_CONNECTIONS_ROUTE } from "../../lib/navigation/nav-config.ts";
import { Button, buttonClassName } from "@nexora/ui";
import type { DeploymentPresentation } from "../../lib/auth/deployment-presentation.ts";
import type { SessionUser } from "../../lib/api/session.ts";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Truck, UserRound } from "lucide-react";
import { useDismissable } from "../../lib/hooks/use-dismissable.ts";
import styles from "./AccountMenu.module.css";

interface AccountMenuProps {
  initialUser?: SessionUser | null;
  // Retained for Header composition compatibility; deployment is not identity.
  deployment: DeploymentPresentation;
}
const plannedItems = [{ label: "Thông tin cá nhân", icon: UserRound }];
function Avatar({
  user,
  large = false,
}: {
  user: SessionUser | null;
  large?: boolean;
}) {
  const initials = user
    ? Array.from(user.username).slice(0, 2).join("").toLocaleUpperCase("vi")
    : "TK";
  return (
    <div
      className={`${styles.avatar} ${large ? styles.summaryAvatar : ""}`}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

/** AppShell presentation shared by the disclosure and its rendered contract tests. */
export function AccountMenuContent({
  user,
  isLoggingOut,
  logoutError,
  onLogout,
}: {
  user: SessionUser | null;
  isLoggingOut: boolean;
  logoutError: string | null;
  onLogout: () => void;
}) {
  const plannedId = useId();
  return (
    <>
      <div className={styles.panelHeader}>
        <Avatar user={user} large />
        <div className={styles.summaryText}>
          <h4 className={styles.panelTitle}>{user?.username ?? "Tài khoản"}</h4>
          <p className={styles.panelSubtitle}>Tài khoản Nexora</p>
        </div>
      </div>
      <div className={styles.menuList}>
        <span id={plannedId} className={styles.srOnly}>
          Chưa triển khai
        </span>
        {plannedItems.map(({ label, icon: Icon }) => (
          <Button
            key={label}
            variant="ghost"
            pressEffect="none"
            className={styles.menuItem}
            disabled
            title="Chưa triển khai"
            aria-describedby={plannedId}
          >
            <Icon className={styles.menuIcon} size={16} aria-hidden="true" />
            <span className={styles.itemLabel}>{label}</span>
          </Button>
        ))}
        <Link
          href={CARRIER_CONNECTIONS_ROUTE.href}
          className={buttonClassName("ghost", false, styles.menuItem, "none")}
          data-size="default"
          data-press-effect="none"
        >
          <Truck className={styles.menuIcon} size={16} aria-hidden="true" />
          <span className={styles.itemLabel}>
            {CARRIER_CONNECTIONS_ROUTE.label}
          </span>
        </Link>
      </div>
      <div className={styles.logoutSection}>
        <Button
          variant="ghost"
          pressEffect="none"
          className={`${styles.menuItem} ${styles.logoutButton}`}
          onClick={onLogout}
          disabled={!user || isLoggingOut}
          aria-label="Đăng xuất khỏi hệ thống"
          aria-busy={isLoggingOut}
        >
          <LogOut className={styles.menuIcon} size={16} aria-hidden="true" />
          <span className={styles.itemLabel}>
            {isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
          </span>
        </Button>
        {logoutError && (
          <p className={styles.logoutError} role="alert">
            {logoutError}
          </p>
        )}
      </div>
    </>
  );
}

export function AccountMenu({ initialUser }: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(initialUser ?? null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const logoutInFlight = useRef(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useDismissable({
    panelRef,
    triggerRef,
    isOpen,
    onClose: () => setIsOpen(false),
  });
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);
  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted && data?.user) setUser(data.user);
      })
      .catch(() => {
        /* Preserve the already verified SSR user on temporary outage. */
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = async () => {
    if (logoutInFlight.current) return;
    logoutInFlight.current = true;
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok)
        throw new Error("Không thể hủy phiên làm việc trên máy chủ.");
      window.location.href = "/login";
    } catch {
      logoutInFlight.current = false;
      setLogoutError("Đăng xuất không thành công. Vui lòng thử lại.");
      setIsLoggingOut(false);
    }
  };
  const displayName = user?.username ?? "Tài khoản";
  return (
    <div className={styles.menuContainer}>
      <Button
        variant="ghost"
        size="medium"
        pressEffect="none"
        ref={triggerRef}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        aria-label={`Tài khoản người dùng: ${displayName}`}
        title={`Tài khoản: ${displayName}`}
        className={styles.accountButton}
      >
        <Avatar user={user} />
        <span className={styles.accountInfo}>
          <span className={styles.accountName}>{displayName}</span>
          <span className={styles.accountSubtitle}>Tài khoản Nexora</span>
        </span>
        <ChevronDown className={styles.chevron} size={16} aria-hidden="true" />
      </Button>
      {isOpen && (
        <div
          id={panelId}
          ref={panelRef}
          className={styles.dropdownPanel}
          role="region"
          aria-label="Thông tin tài khoản"
        >
          <AccountMenuContent
            user={user}
            isLoggingOut={isLoggingOut}
            logoutError={logoutError}
            onLogout={handleLogout}
          />
        </div>
      )}
    </div>
  );
}
