"use client";
import { useEffect, useRef, useState } from "react";
import { Button, Checkbox, TextInput } from "@nexora/ui";
import { Columns3 } from "lucide-react";
import { useDismissable } from "../../lib/hooks/use-dismissable.ts";
import {
  RETAIL_PACKAGE_COLUMNS,
  columnPreset,
  searchColumns,
  visibleColumns,
} from "./columns.ts";
import type { ColumnVisibility } from "./types.ts";
import styles from "./retail-packages.module.css";
export function RetailColumnPicker({
  visibility,
  onChange,
}: {
  visibility: ColumnVisibility;
  onChange: (next: ColumnVisibility) => void;
}) {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState("");
  const panelRef = useRef<HTMLDivElement>(null),
    triggerRef = useRef<HTMLButtonElement>(null);
  useDismissable({
    panelRef,
    triggerRef,
    isOpen: open,
    onClose: () => setOpen(false),
  });
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() =>
      panelRef.current
        ?.querySelector<HTMLInputElement>("input[type=search]")
        ?.focus(),
    );
    return () => cancelAnimationFrame(raf);
  }, [open]);
  return (
    <div className={styles.popoverAnchor}>
      <Button
        ref={triggerRef}
        variant="secondary"
        onClick={() => setOpen((v) => !v)}
        aria-label="Tùy chỉnh cột hiển thị"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Columns3 size={14} aria-hidden="true" /> Cột{" "}
        <span>
          {visibleColumns(visibility).length}/{RETAIL_PACKAGE_COLUMNS.length}
        </span>
      </Button>
      {open && (
        <div
          ref={panelRef}
          className={styles.colPickerPanel}
          role="dialog"
          aria-label="Tùy chỉnh cột hiển thị"
        >
          <strong>Tùy chỉnh cột hiển thị</strong>
          <div className={styles.presetRow}>
            {(["all", "basic", "default"] as const).map((preset, i) => (
              <Button
                key={preset}
                variant="secondary"
                onClick={() => onChange(columnPreset(preset))}
              >
                {["Tất cả", "Cơ bản", "Mặc định"][i]}
              </Button>
            ))}
          </div>
          <TextInput
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Tìm tên cột"
            placeholder="Tìm tên cột…"
          />
          <div className={styles.columnChoices}>
            {searchColumns(search).map((c) => (
              <Checkbox
                key={c.id}
                checked={!!c.required || (visibility[c.id] ?? c.defaultVisible)}
                disabled={!!c.required}
                onChange={(e) =>
                  onChange({ ...visibility, [c.id]: e.target.checked })
                }
              >
                {c.label}
                {c.required ? " (bắt buộc)" : ""}
              </Checkbox>
            ))}
          </div>
          <div className={styles.popoverFooter}>
            <span>Đang bật: {visibleColumns(visibility).length}/20 cột</span>
            <Button
              variant="emphasis"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
            >
              Hoàn tất
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
