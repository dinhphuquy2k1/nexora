"use client";

import { useState, useRef } from "react";
import { SlidersHorizontal, RotateCcw } from "lucide-react";
import { useDismissable } from "../../../lib/hooks/use-dismissable.ts";
import { PARCEL_COLUMNS, type ParcelColumnKey } from "../columns.ts";
import styles from "../parcels.module.css";

interface ParcelColumnToggleProps {
  isColumnVisible: (key: ParcelColumnKey) => boolean;
  onToggleColumn: (key: ParcelColumnKey) => void;
  onResetColumns: () => void;
  isCustomized: boolean;
}

export function ParcelColumnToggle({
  isColumnVisible,
  onToggleColumn,
  onResetColumns,
  isCustomized,
}: ParcelColumnToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useDismissable({
    panelRef,
    triggerRef,
    isOpen,
    onClose: () => setIsOpen(false),
  });

  return (
    <div className={styles.columnToggleContainer}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.columnToggleButton} ${
          isOpen ? styles.columnToggleButtonActive : ""
        }`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="column-toggle-dialog"
        title="Tùy chỉnh các cột hiển thị trong bảng"
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        <span>Tùy chỉnh cột</span>
        {isCustomized && (
          <span
            className={styles.customizedDot}
            aria-label="Đã tùy chỉnh cột"
          />
        )}
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          id="column-toggle-dialog"
          role="dialog"
          aria-label="Tùy chỉnh hiển thị cột"
          className={styles.columnTogglePopover}
        >
          <div className={styles.popoverHeader}>
            <span className={styles.popoverTitle}>Cột hiển thị</span>
            <button
              type="button"
              className={styles.popoverResetButton}
              onClick={onResetColumns}
              disabled={!isCustomized}
              title="Khôi phục các cột về mặc định"
            >
              <RotateCcw size={12} aria-hidden="true" />
              <span>Khôi phục mặc định</span>
            </button>
          </div>

          <div className={styles.popoverBody}>
            {PARCEL_COLUMNS.map((col) => {
              const isChecked = isColumnVisible(col.id);
              const isRequired = col.isRequired;

              return (
                <label
                  key={col.id}
                  className={`${styles.columnCheckboxLabel} ${
                    isRequired ? styles.columnCheckboxDisabled : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    className={styles.columnCheckbox}
                    checked={isChecked}
                    disabled={isRequired}
                    onChange={() => onToggleColumn(col.id)}
                    aria-label={`Hiển thị cột ${col.label}`}
                  />
                  <span className={styles.columnCheckboxText}>{col.label}</span>
                  {isRequired && (
                    <span className={styles.requiredBadge}>Cố định</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
