"use client";

import { useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useDismissable } from "../../lib/hooks/use-dismissable.ts";
import styles from "./Header.module.css";

export function NotificationMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useDismissable(menuRef, () => setIsOpen(false), isOpen);

  return (
    <div className={styles.menuTrigger} ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="Thông báo hệ thống"
        className={styles.iconButton}
        title="Thông báo hệ thống"
      >
        <Bell size={18} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          className={styles.dropdownMenu}
          role="dialog"
          aria-label="Thông báo hệ thống"
        >
          <div className={styles.dropdownHeader}>
            <h4 className={styles.dropdownTitle}>Thông báo</h4>
            <p className={styles.dropdownDescription}>
              Cảnh báo và sự kiện vận hành
            </p>
          </div>
          <div
            className={styles.dropdownBody}
            style={{ textAlign: "center", padding: "20px 16px" }}
          >
            <p
              style={{
                color: "var(--color-text-muted)",
                margin: 0,
                fontSize: "13px",
              }}
            >
              Không có thông báo mới.
            </p>
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>
              Hệ thống vận hành bình thường.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
