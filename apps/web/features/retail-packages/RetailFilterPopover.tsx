"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Button, Select, TextInput } from "@nexora/ui";
import { Filter, Plus, X } from "lucide-react";
import { useDismissable } from "../../lib/hooks/use-dismissable.ts";
import { FILTER_FIELDS, makeFilter } from "./filters.ts";
import type { FilterCondition } from "./types.ts";
import styles from "./retail-packages.module.css";
export function RetailFilterPopover({
  filters,
  onAdd,
}: {
  filters: readonly FilterCondition[];
  onAdd: (filter: FilterCondition) => boolean;
}) {
  const [open, setOpen] = useState(false),
    [field, setField] = useState(FILTER_FIELDS[0].id),
    [operator, setOperator] = useState(FILTER_FIELDS[0].operators[0].value),
    [value, setValue] = useState(FILTER_FIELDS[0].defaultValue),
    [error, setError] = useState("");
  const panelRef = useRef<HTMLDivElement>(null),
    triggerRef = useRef<HTMLButtonElement>(null),
    id = useId();
  const cfg = FILTER_FIELDS.find((f) => f.id === field)!;
  useDismissable({
    panelRef,
    triggerRef,
    isOpen: open,
    onClose: () => setOpen(false),
  });
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() =>
      panelRef.current?.querySelector("select")?.focus(),
    );
    return () => cancelAnimationFrame(raf);
  }, [open]);
  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }
  return (
    <div className={styles.popoverAnchor}>
      <Button
        ref={triggerRef}
        variant="secondary"
        aria-label="Bộ lọc nâng cao"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <Filter size={14} aria-hidden="true" /> Thêm điều kiện lọc{" "}
        {filters.length > 0 && <span>{filters.length}</span>}
      </Button>
      {open && (
        <div
          ref={panelRef}
          className={styles.filterPanel}
          role="dialog"
          aria-label="Bộ lọc nâng cao"
        >
          <div className={styles.popoverHeading}>
            <strong>Thêm điều kiện lọc</strong>
            <Button
              icon
              variant="ghost"
              aria-label="Đóng bộ lọc"
              onClick={close}
            >
              <X size={14} />
            </Button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const next = makeFilter(field, operator, value);
              if (!next) {
                setError("Nhập giá trị hợp lệ cho trường đã chọn.");
                return;
              }
              if (filters.some((f) => f.id === next.id)) {
                setError("Điều kiện lọc đã tồn tại.");
                return;
              }
              if (filters.length >= 12) {
                setError("Tối đa 12 điều kiện lọc.");
                return;
              }
              if (!onAdd(next)) return;
              setError("");
              close();
            }}
          >
            <label htmlFor={id + "-field"}>Trường lọc</label>
            <Select
              id={id + "-field"}
              value={field}
              onChange={(e) => {
                const next = FILTER_FIELDS.find(
                  (f) => f.id === e.target.value,
                )!;
                setField(next.id);
                setOperator(next.operators[0].value);
                setValue(next.defaultValue);
                setError("");
              }}
            >
              {FILTER_FIELDS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </Select>
            <label htmlFor={id + "-operator"}>Toán tử</label>
            <Select
              id={id + "-operator"}
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
            >
              {cfg.operators.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </Select>
            <label htmlFor={id + "-value"}>Giá trị</label>
            {cfg.type === "select" ? (
              <Select
                id={id + "-value"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              >
                {cfg.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            ) : (
              <TextInput
                id={id + "-value"}
                type={cfg.type === "text" ? "text" : cfg.type}
                step={cfg.type === "number" ? "any" : undefined}
                min={cfg.type === "number" ? 0 : undefined}
                maxLength={200}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-invalid={!!error}
                aria-describedby={error ? id + "-error" : undefined}
              />
            )}{" "}
            {error && (
              <p id={id + "-error"} role="alert">
                {error}
              </p>
            )}
            <Button type="submit" variant="emphasis">
              <Plus size={14} />
              Thêm điều kiện
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
