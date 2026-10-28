import { TextInput, Textarea, Select } from "@nexora/ui";
import { CustomerStatus, CustomerStatusLabelsVi } from "@nexora/shared";
import type { ProfileDraft } from "./types.ts";
import styles from "./customers.module.css";
export function CustomerProfileFields({
  value,
  onChange,
  edit = false,
  errorField,
}: {
  value: ProfileDraft;
  onChange: (v: ProfileDraft) => void;
  edit?: boolean;
  errorField?: string;
}) {
  const change = (field: keyof ProfileDraft, v: string) =>
    onChange({ ...value, [field]: v });
  return (
    <div className={styles.fields}>
      {(
        [
          { name: "name", label: "Họ và tên", max: 200, required: true },
          { name: "phone", label: "Số điện thoại", max: 64, required: true },
          { name: "email", label: "Email", max: 254, required: false },
        ] as const
      ).map((f) => (
        <label key={f.name}>
          {f.label}
          {f.required ? " *" : ""}
          <TextInput
            name={f.name}
            type={f.name === "email" ? "email" : "text"}
            maxLength={f.max}
            required={f.required}
            value={value[f.name]}
            onChange={(e) => change(f.name, e.target.value)}
            aria-invalid={errorField === f.name}
            aria-describedby={
              errorField === f.name ? "customer-field-error" : undefined
            }
          />
        </label>
      ))}
      <label>
        Ghi chú
        <Textarea
          name="note"
          maxLength={5000}
          value={value.note}
          onChange={(e) => change("note", e.target.value)}
        />
      </label>
      {edit && (
        <label>
          Trạng thái
          <Select
            name="status"
            value={value.status}
            onChange={(e) => change("status", e.target.value)}
          >
            {Object.values(CustomerStatus).map((code) => (
              <option key={code} value={code}>
                {CustomerStatusLabelsVi[code]}
              </option>
            ))}
          </Select>
        </label>
      )}
    </div>
  );
}
