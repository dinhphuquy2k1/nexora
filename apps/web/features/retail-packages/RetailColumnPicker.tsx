"use client";

import { useEffect, useRef, useState } from "react";
import { Button, SelectButton, TextInput } from "@nexora/ui";
import { Columns3, SlidersHorizontal, X } from "lucide-react";
import { useDismissable } from "../../lib/hooks/use-dismissable.ts";
import {
  RETAIL_PACKAGE_COLUMNS,
  columnPreset,
  searchColumns,
  visibleColumns,
} from "./columns.ts";
import type { ColumnVisibility } from "./types.ts";
import styles from "./retail-packages.module.css";

const PRESET_OPTIONS = [
  { value: "all", label: "Tất cả" },
  { value: "basic", label: "Cơ bản" },
  { value: "default", label: "Mặc định" },
] as const;

export function RetailColumnPicker({
  visibility,
  onChange,
}: {
  visibility: ColumnVisibility;
  onChange: (next: ColumnVisibility) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

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

  const visibleCount = visibleColumns(visibility).length;
  const totalCount = RETAIL_PACKAGE_COLUMNS.length;
  const isFiltered = visibleCount < totalCount;
  const pickerState = open ? "open" : isFiltered ? "filtered" : "full";

  const triggerClassName =
    pickerState === "open"
      ? styles.colPickerTrigger_open
      : pickerState === "filtered"
        ? styles.colPickerTrigger_filtered
        : styles.colPickerTrigger_full;

  const badgeClassName = `${styles.colPickerBadge} ${
    pickerState === "open"
      ? styles.colPickerBadge_open
      : pickerState === "filtered"
        ? styles.colPickerBadge_filtered
        : styles.colPickerBadge_full
  }`;

  // Dynamically derive activePreset from current visible column IDs
  const currentVisibleIds = visibleColumns(visibility)
    .map((c) => c.id)
    .join(",");
  const activePreset: "all" | "basic" | "default" | null =
    (["all", "basic", "default"] as const).find(
      (p) =>
        visibleColumns(columnPreset(p))
          .map((c) => c.id)
          .join(",") === currentVisibleIds,
    ) ?? null;

  const handlePresetChange = (preset: "all" | "basic" | "default" | null) => {
    if (preset) {
      onChange(columnPreset(preset));
    }
  };

  const selectedColumnIds = visibleColumns(visibility).map((c) => c.id);

  const handleColumnSelectionChange = (nextIds: string[]) => {
    const nextVisibility: ColumnVisibility = {};
    for (const col of RETAIL_PACKAGE_COLUMNS) {
      if (col.required) {
        nextVisibility[col.id] = true;
      } else {
        nextVisibility[col.id] = nextIds.includes(col.id);
      }
    }
    onChange(nextVisibility);
  };

  const filteredColumns = searchColumns(search);
  const columnOptions = filteredColumns.map((c) => ({
    value: c.id,
    label: c.label,
    disabled: Boolean(c.required),
  }));

  return (
    <div className={styles.popoverAnchor}>
      <Button
        ref={triggerRef}
        variant="secondary"
        className={triggerClassName}
        onClick={() => setOpen((v) => !v)}
        aria-label="Tùy chỉnh cột hiển thị"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Columns3 size={14} aria-hidden="true" /> Cột{" "}
        <span className={badgeClassName}>
          {visibleCount}/{totalCount}
        </span>
      </Button>

      {open && (
        <div
          ref={panelRef}
          className={styles.colPickerPanel}
          role="dialog"
          aria-label="Tùy chỉnh cột hiển thị"
        >
          <div className={styles.colPickerHeader}>
            <div className={styles.colPickerHeaderLeft}>
              <SlidersHorizontal
                size={14}
                className={styles.colPickerHeaderIcon}
                aria-hidden="true"
              />
              <span className={styles.colPickerHeaderTitle}>
                Tùy chỉnh cột hiển thị
              </span>
            </div>
            <Button
              variant="ghost"
              icon
              className={styles.colPickerCloseBtn}
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              aria-label="Đóng tùy chỉnh cột"
            >
              <X size={14} aria-hidden="true" />
            </Button>
          </div>

          <SelectButton
            mode="single"
            layout="segmented"
            fluid
            options={PRESET_OPTIONS}
            value={activePreset}
            ariaLabel="Chọn cấu hình cột"
            onValueChange={handlePresetChange}
          />

          <TextInput
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Tìm tên cột"
            placeholder="Tìm tên cột…"
          />

          <div className={styles.columnChoices}>
            <SelectButton
              mode="multiple"
              layout="stacked"
              options={columnOptions}
              value={selectedColumnIds}
              ariaLabel="Danh sách cột hiển thị"
              onValueChange={handleColumnSelectionChange}
              renderOption={(opt) => {
                const col = RETAIL_PACKAGE_COLUMNS.find(
                  (c) => c.id === opt.value,
                );
                const isRequired = Boolean(col?.required);
                return (
                  <span className={styles.colOptionRow}>
                    <span
                      className={`${styles.colOptionLabel} ${isRequired ? styles.colOptionRequired : ""}`.trim()}
                    >
                      {opt.label}
                    </span>
                    {isRequired && (
                      <span className={styles.colPinnedBadge}>Cố định</span>
                    )}
                  </span>
                );
              }}
            />
          </div>

          <div className={styles.popoverFooter}>
            <span>
              Đang bật: <strong>{visibleCount}</strong>/{totalCount} cột
            </span>
            <Button
              className={styles.colPickerDoneBtn}
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
            >
              Đã xong
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
