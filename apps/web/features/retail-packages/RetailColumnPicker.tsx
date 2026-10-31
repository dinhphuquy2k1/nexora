"use client";

import { useEffect, useRef, useState } from "react";
import { Button, SelectButton, TextInput } from "@nexora/ui";
import { RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
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
  defaultOpen = false,
}: {
  visibility: ColumnVisibility;
  onChange: (next: ColumnVisibility) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [search, setSearch] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useDismissable({
    panelRef,
    triggerRef,
    isOpen: open,
    onClose: () => setOpen(false),
  });

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => searchInputRef.current?.focus());
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
        <SlidersHorizontal size={14} aria-hidden="true" />
        <span className={styles.colPickerTriggerLabel}>Cột hiển thị</span>{" "}
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
            appearance="text-actions"
            fluid
            options={PRESET_OPTIONS}
            value={activePreset}
            ariaLabel="Chọn cấu hình cột"
            onValueChange={handlePresetChange}
            renderOption={(opt) => {
              if (opt.value === "all") {
                return <span className={styles.colPresetAll}>{opt.label}</span>;
              }
              if (opt.value === "basic") {
                return (
                  <span className={styles.colPresetBasic}>{opt.label}</span>
                );
              }
              return (
                <span className={styles.colPresetDefault}>
                  <RotateCcw size={11} aria-hidden="true" />
                  <span>{opt.label}</span>
                </span>
              );
            }}
          />

          <div className={styles.colPickerSearchWrapper}>
            <Search
              size={12}
              className={styles.colPickerSearchIcon}
              aria-hidden="true"
            />
            <TextInput
              ref={searchInputRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Tìm tên cột"
              placeholder="Tìm tên cột…"
              className={styles.colPickerSearchInput}
            />
            {search && (
              <Button
                variant="ghost"
                icon
                aria-label="Xóa tìm kiếm"
                onClick={() => {
                  setSearch("");
                  searchInputRef.current?.focus();
                }}
                className={styles.colPickerSearchClearBtn}
              >
                <X size={14} aria-hidden="true" />
              </Button>
            )}
          </div>

          <div className={styles.columnChoices}>
            <SelectButton
              mode="multiple"
              layout="stacked"
              options={columnOptions}
              value={selectedColumnIds}
              ariaLabel="Danh sách cột hiển thị"
              onValueChange={handleColumnSelectionChange}
              renderOption={(opt, { selected }) => {
                const col = RETAIL_PACKAGE_COLUMNS.find(
                  (c) => c.id === opt.value,
                );
                const isRequired = Boolean(col?.required);
                return (
                  <span className={styles.colOptionRow}>
                    <span
                      className={`${styles.colOptionLabel} ${selected ? styles.colOptionSelected : ""} ${isRequired ? styles.colOptionRequired : ""}`.trim()}
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

          <div className={styles.colPickerFooter}>
            <span className={styles.colPickerFooterCount}>
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
