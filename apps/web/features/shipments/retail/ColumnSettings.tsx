"use client";
import { useEffect, useId, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useDismissable } from "../../../lib/hooks/use-dismissable.ts";
import {
  BASIC_COLUMNS,
  COLUMNS,
  DEFAULT_COLUMNS,
  visibleColumns,
} from "./model.ts";
import styles from "./retail.module.css";
export function ColumnSettings({
  columns,
  onChange,
}: {
  columns: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  useDismissable({
    panelRef,
    triggerRef,
    isOpen: open,
    onClose: () => setOpen(false),
  });
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }
  return (
    <div className={styles.disclosure}>
      <button
        ref={triggerRef}
        className={styles.secondary}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
      >
        <SlidersHorizontal size={15} aria-hidden="true" />
        Cột hiển thị{" "}
        <span>
          {visibleColumns(columns).length}/{COLUMNS.length}
        </span>
      </button>
      {open && (
        <div
          ref={panelRef}
          id={id}
          role="dialog"
          aria-label="Tùy chỉnh cột"
          className={styles.popover}
        >
          <h2>Tùy chỉnh cột hiển thị</h2>
          <div className={styles.presets}>
            <button
              type="button"
              onClick={() => onChange(COLUMNS.map((c) => c.id))}
            >
              Tất cả
            </button>
            <button type="button" onClick={() => onChange(BASIC_COLUMNS)}>
              Cơ bản
            </button>
            <button type="button" onClick={() => onChange(DEFAULT_COLUMNS)}>
              Mặc định
            </button>
          </div>
          <input
            ref={inputRef}
            className="control"
            type="search"
            aria-label="Tìm tên cột"
            placeholder="Tìm tên cột…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className={styles.checklist}>
            {COLUMNS.filter((c) =>
              c.label
                .toLocaleLowerCase("vi")
                .includes(query.toLocaleLowerCase("vi")),
            ).map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={c.id === "tracking" || columns.includes(c.id)}
                  disabled={c.id === "tracking"}
                  onChange={() =>
                    onChange(
                      columns.includes(c.id)
                        ? columns.filter((id) => id !== c.id)
                        : [...columns, c.id],
                    )
                  }
                />
                {c.label}
                {c.id === "tracking" && <small>Cố định</small>}
              </label>
            ))}
          </div>
          <button type="button" onClick={close}>
            Đã xong
          </button>
        </div>
      )}
    </div>
  );
}
