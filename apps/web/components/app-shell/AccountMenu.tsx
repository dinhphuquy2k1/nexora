"use client";

import { useId, useRef, useState } from "react";
import { User, ChevronDown } from "lucide-react";
import { useDismissable } from "../../lib/hooks/use-dismissable.ts";
import styles from "./AccountMenu.module.css";

export function AccountMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useDismissable({
    panelRef,
    triggerRef,
    isOpen,
    onClose: () => setIsOpen(false),
  });

  return (
    <div className={styles.menuContainer}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        aria-label="Tài khoản người dùng"
        title="Tài khoản người dùng"
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
              <h4 className={styles.panelTitle}>Tài khoản người dùng</h4>
              <span className={styles.plannedBadge}>Chưa triển khai</span>
            </div>
            <p className={styles.panelDescription}>
              Quản lý danh tính và phiên làm việc
            </p>
          </div>
          <div className={styles.panelBody}>
            <div className={styles.statusNotice}>
              Chức năng tài khoản và đăng nhập sẽ được triển khai trong phiên
              bản sau.
            </div>
            <p className={styles.infoFootnote}>
              Không gian làm việc chưa thiết lập xác thực người dùng.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
