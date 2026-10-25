import { Button, TextInput, Textarea } from "@nexora/ui";
import type { AddressDraft } from "./types.ts";
import styles from "./customers.module.css";
export function AddressLabelField({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <div>
      <label>
        Nhãn địa chỉ
        <TextInput
          name="label"
          maxLength={100}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <div className={styles.chips}>
        {["Nhà riêng", "Cửa hàng", "Kho hàng", "Văn phòng"].map((label) => (
          <Button
            key={label}
            variant={value === label ? "primary" : "secondary"}
            aria-pressed={value === label}
            onClick={() => onChange(value === label ? "" : label)}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
export function AddressForm({
  value,
  onChange,
  edit = false,
  errorField,
}: {
  value: AddressDraft;
  onChange: (v: AddressDraft) => void;
  edit?: boolean;
  errorField?: string;
}) {
  const change = (field: keyof AddressDraft, v: string) =>
    onChange({ ...value, [field]: v });
  return (
    <div className={styles.fields}>
      <AddressLabelField
        value={value.label}
        onChange={(v) => change("label", v)}
      />
      <div className={styles.fieldPair}>
        {(
          [
            { name: "recipientName", label: "Tên người nhận", max: 200 },
            { name: "recipientPhone", label: "Điện thoại người nhận", max: 64 },
          ] as const
        ).map((f) => (
          <label key={f.name}>
            {f.label}
            <TextInput
              name={f.name}
              maxLength={f.max}
              required={edit}
              value={value[f.name]}
              onChange={(e) => change(f.name, e.target.value)}
              aria-invalid={errorField === f.name}
              aria-describedby={
                errorField === f.name ? "customer-field-error" : undefined
              }
            />
          </label>
        ))}
      </div>
      <label>
        Mã quốc gia ISO (VN)
        <TextInput
          name="countryCode"
          maxLength={2}
          required
          value={value.countryCode}
          onChange={(e) => change("countryCode", e.target.value)}
          aria-invalid={errorField === "countryCode"}
        />
      </label>
      {!edit && (
        <p className={styles.muted}>
          Bỏ trống người nhận để dùng tên và điện thoại khách hàng.
        </p>
      )}
      <label>
        Địa chỉ nhận hàng *
        <Textarea
          name="addressText"
          required
          maxLength={2000}
          value={value.addressText}
          onChange={(e) => change("addressText", e.target.value)}
          aria-invalid={errorField === "addressText"}
          aria-describedby={
            errorField === "addressText" ? "customer-field-error" : undefined
          }
        />
      </label>
    </div>
  );
}
