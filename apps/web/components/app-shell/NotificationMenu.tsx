"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useDismissable } from "../../lib/hooks/use-dismissable.ts";
import styles from "./Header.module.css";

export function NotificationMenu() {
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
    <div className={styles.menuTrigger}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        aria-label="Thông báo hệ thống"
        className={styles.iconButton}
        title="Thông báo hệ thống"
      >
        <Bell size={18} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          id={panelId}
          ref={panelRef}
          className={styles.dropdownMenu}
          aria-label="Thông báo hệ thống"
        >
          <div className={styles.dropdownHeader}>
            <h4 className={styles.dropdownTitle}>Thông báo</h4>
            <p className={styles.dropdownDescription}>
              Chức năng thông báo chưa được triển khai.
            </p>
          </div>
          <div className={styles.dropdownBody}>
            <p className={styles.emptyNoticeText}>
              Chưa có thông báo nào trong phiên làm việc này.
            </p>
            <div className={styles.noticeActionContainer}>
              <Link
                href="/system"
                className={styles.actionLink}
                onClick={() => setIsOpen(false)}
              >
                Xem trạng thái hệ thống →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
