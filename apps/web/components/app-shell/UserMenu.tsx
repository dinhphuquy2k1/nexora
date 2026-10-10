"use client";

import { useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { FOUNDATION_VERSION } from "@nexora/shared";
import { useDismissable } from "../../lib/hooks/use-dismissable.ts";
import styles from "./Header.module.css";

export function UserMenu() {
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
        aria-label="Thông tin không gian làm việc"
        className={styles.userButton}
      >
        <div className={styles.avatar} aria-hidden="true">
          NX
        </div>
        <div className={styles.userMeta}>
          <span className={styles.userName}>Không gian cục bộ</span>
          <span className={styles.userSubtitle}>
            Phiên bản {FOUNDATION_VERSION}
          </span>
        </div>
        <ChevronDown size={14} color="#94a3b8" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          id={panelId}
          ref={panelRef}
          className={styles.dropdownMenu}
          aria-label="Chi tiết môi trường"
        >
          <div className={styles.dropdownHeader}>
            <h4 className={styles.dropdownTitle}>Môi trường làm việc</h4>
            <p className={styles.dropdownDescription}>
              Ứng dụng đang vận hành ở chế độ cục bộ (Local-first).
            </p>
          </div>
          <div className={styles.dropdownBody}>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Phiên bản nền tảng:</span>
              <span className={styles.metaValue}>{FOUNDATION_VERSION}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Chế độ vận hành:</span>
              <span className={styles.metaValue}>Một máy (Single-node)</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Phiên làm việc:</span>
              <span className={styles.metaValue}>Cục bộ (Localhost)</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Xác thực mạng:</span>
              <span className={styles.metaValue}>
                Chưa triển khai (ADR-002)
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
