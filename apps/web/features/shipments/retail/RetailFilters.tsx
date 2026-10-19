"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Filter, X } from "lucide-react";
import { useDismissable } from "../../../lib/hooks/use-dismissable.ts";
import { FILTER_FIELDS, formatDate, type DraftFilter } from "./model.ts";
import styles from "./retail.module.css";
export function RetailFilters({
  filters,
  onChange,
}: {
  filters: DraftFilter[];
  onChange: (filters: DraftFilter[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<DraftFilter["field"]>("tracking");
  const [value, setValue] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const id = useId();
  useDismissable({
    panelRef,
    triggerRef,
    isOpen: open,
    onClose: () => setOpen(false),
  });
  useEffect(() => {
    if (open) selectRef.current?.focus();
  }, [open]);
  const config = FILTER_FIELDS.find((f) => f.id === field)!;
  const invalid =
    !value.trim() ||
    (config.type === "date" && formatDate(value) === "—") ||
    filters.some((f) => f.field === field && f.value === value.trim());
  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }
  return (
    <>
      <div className={styles.disclosure}>
        <button
          ref={triggerRef}
          type="button"
          className={styles.secondary}
          aria-expanded={open}
          aria-controls={id}
          aria-haspopup="dialog"
          onClick={() => setOpen(!open)}
        >
          <Filter size={15} aria-hidden="true" />
          Thêm điều kiện lọc
        </button>
        {open && (
          <div
            ref={panelRef}
            id={id}
            role="dialog"
            aria-label="Điều kiện lọc dự thảo"
            className={`${styles.popover} ${styles.filterPopover}`}
          >
            <h2>Điều kiện lọc dự thảo</h2>
            <p>Điều kiện hiện chỉ là dự thảo, chưa dùng để tra cứu.</p>
            <label>
              Trường lọc
              <select
                ref={selectRef}
                className="control"
                value={field}
                onChange={(e) => {
                  setField(e.target.value as DraftFilter["field"]);
                  setValue("");
                }}
              >
                {FILTER_FIELDS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {config.type === "date" ? "Ngày (bằng)" : "Nội dung (chứa)"}
              <input
                className="control"
                type={config.type}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                maxLength={200}
              />
            </label>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondary}
                onClick={close}
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={invalid}
                onClick={() => {
                  onChange([...filters, { field, value: value.trim() }]);
                  setValue("");
                  close();
                }}
              >
                Thêm dự thảo
              </button>
            </div>
          </div>
        )}
      </div>
      {filters.length > 0 && (
        <div className={styles.chips} aria-label="Điều kiện dự thảo">
          {filters.map((filter, index) => (
            <span key={`${filter.field}-${filter.value}`}>
              {FILTER_FIELDS.find((f) => f.id === filter.field)?.label}:{" "}
              {filter.value}
              <button
                type="button"
                aria-label={`Xóa điều kiện ${index + 1}`}
                onClick={() => onChange(filters.filter((_, i) => i !== index))}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
    </>
  );
}
