"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Button, Select, TextInput } from "@nexora/ui";
import { Filter, X } from "lucide-react";
import { useDismissable } from "../../lib/hooks/use-dismissable.ts";
import {
  FILTER_FIELDS,
  FILTER_OPERATORS,
  FILTER_STATUS_OPTIONS,
  makeCarrierFilter,
} from "./presentation.ts";
import type {
  CarrierFilterCondition,
  CarrierProviderPresentation,
} from "./types.ts";
import styles from "./carrier-connections.module.css";
export function CarrierFilterPopover({
  conditions,
  providers,
  allowEnvironment,
  onAdd,
}: {
  conditions: readonly CarrierFilterCondition[];
  providers: readonly CarrierProviderPresentation[];
  allowEnvironment: boolean;
  onAdd: (f: CarrierFilterCondition) => boolean;
}) {
  const [open, setOpen] = useState(false),
    [field, setField] = useState("carrier"),
    [operator, setOperator] = useState("equals"),
    [value, setValue] = useState(providers[0]?.id ?? "uniship"),
    [error, setError] = useState("");
  const panelRef = useRef<HTMLDivElement>(null),
    triggerRef = useRef<HTMLButtonElement>(null),
    id = useId();
  const close = () => {
    setOpen(false);
    setError("");
  };
  useDismissable({ panelRef, triggerRef, isOpen: open, onClose: close });
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() =>
      panelRef.current?.querySelector("select")?.focus(),
    );
    return () => cancelAnimationFrame(raf);
  }, [open]);
  const cfg = FILTER_FIELDS.find((f) => f.id === field)!;
  const options = {
    carrier: providers.map((p) => ({
      value: p.id,
      label: `${p.name} (${p.code})`,
    })),
    status: FILTER_STATUS_OPTIONS,
    environment: [
      { value: "production", label: "Production" },
      { value: "sandbox", label: "Sandbox" },
    ],
  }[field];
  const draft = makeCarrierFilter(field, operator, value),
    duplicate = !!draft && conditions.some((c) => c.id === draft.id);
  function dismiss() {
    close();
    triggerRef.current?.focus();
  }
  return (
    <div className={styles.popoverAnchor}>
      <Button
        ref={triggerRef}
        variant="secondary"
        pressEffect="none"
        aria-label="Thêm điều kiện lọc"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <Filter size={14} />
        Thêm điều kiện lọc
        {conditions.length > 0 && <span>{conditions.length}</span>}
      </Button>
      {open && (
        <div
          ref={panelRef}
          className={styles.filterPanel}
          role="dialog"
          aria-label="Điều kiện lọc tài khoản"
        >
          <div className={styles.popoverHeading}>
            <strong>Hiển thị tài khoản theo điều kiện:</strong>
            <Button
              icon
              variant="ghost"
              aria-label="Đóng bộ lọc"
              onClick={dismiss}
            >
              <X size={14} />
            </Button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft || duplicate) {
                setError(
                  "Điều kiện lọc này đã có trong danh sách hoặc chưa hợp lệ.",
                );
                return;
              }
              if (!onAdd(draft)) {
                setError("Tối đa 12 điều kiện lọc.");
                return;
              }
              dismiss();
            }}
          >
            <label htmlFor={id + "field"}>Trường lọc</label>
            <Select
              id={id + "field"}
              value={field}
              onChange={(e) => {
                const next = FILTER_FIELDS.find(
                  (f) => f.id === e.target.value,
                )!;
                setField(next.id);
                setOperator(next.operators[0]);
                setValue(
                  {
                    carrier: providers[0]?.id ?? "uniship",
                    status: "connected",
                    environment: "production",
                    accountName: "",
                  }[next.id],
                );
                setError("");
              }}
            >
              {FILTER_FIELDS.map((f) => (
                <option
                  key={f.id}
                  value={f.id}
                  disabled={f.id === "environment" && !allowEnvironment}
                >
                  {f.label}
                  {f.id === "environment" && !allowEnvironment
                    ? " — chưa khả dụng"
                    : ""}
                </option>
              ))}
            </Select>
            <label htmlFor={id + "operator"}>Điều kiện so sánh</label>
            <Select
              id={id + "operator"}
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
            >
              {cfg.operators.map((op) => (
                <option key={op} value={op}>
                  {FILTER_OPERATORS[op]}
                </option>
              ))}
            </Select>
            <label htmlFor={id + "value"}>Giá trị lọc</label>
            {options ? (
              <Select
                id={id + "value"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              >
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            ) : (
              <TextInput
                id={id + "value"}
                maxLength={200}
                value={value}
                placeholder="Nhập tên hoặc ID tài khoản..."
                onChange={(e) => setValue(e.target.value)}
              />
            )}
            {(error || duplicate) && (
              <p role="alert">
                {error || "Điều kiện lọc này đã có trong danh sách."}
              </p>
            )}
            <div className={styles.popoverFooter}>
              <Button variant="secondary" onClick={dismiss}>
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={!draft || duplicate}
                className={styles.navyAction}
              >
                Thêm điều kiện lọc
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
