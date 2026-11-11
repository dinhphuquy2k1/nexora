"use client";
import { useId, useState } from "react";
import { Button, Select, TextInput } from "@nexora/ui";
import { Filter } from "lucide-react";
import { FilterPopoverShell } from "../../components/filter-popover/FilterPopoverShell.tsx";
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
  const [field, setField] = useState("carrier"),
    [operator, setOperator] = useState("equals"),
    [value, setValue] = useState(providers[0]?.id ?? "uniship"),
    [error, setError] = useState("");
  const id = useId();
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
  return (
    <FilterPopoverShell
      triggerLabel="Thêm điều kiện lọc"
      dialogLabel="Điều kiện lọc tài khoản"
      title="Hiển thị tài khoản theo điều kiện:"
      anchorClassName={styles.popoverAnchor}
      panelClassName={styles.filterPanel}
      headingClassName={styles.popoverHeading}
      triggerPressEffect="none"
      onDismiss={() => setError("")}
      trigger={
        <>
          <Filter size={14} />
          Thêm điều kiện lọc
          {conditions.length > 0 && <span>{conditions.length}</span>}
        </>
      }
    >
      {({ close }) => (
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
            close();
          }}
        >
          <label htmlFor={id + "field"}>Trường lọc</label>
          <Select
            id={id + "field"}
            value={field}
            onChange={(e) => {
              const next = FILTER_FIELDS.find((f) => f.id === e.target.value)!;
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
            <Button variant="secondary" onClick={close}>
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
      )}
    </FilterPopoverShell>
  );
}
