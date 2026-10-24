import { Button, TextInput, Select } from "@nexora/ui";
import { CustomerStatus, CustomerStatusLabelsVi } from "@nexora/shared";
import type { Query } from "./types.ts";
import styles from "./customers.module.css";
export function CustomerFilters({
  query,
  draft,
  onSearch,
  onQuery,
  onClear,
}: {
  query: Query;
  draft: string;
  onSearch: (q: string) => void;
  onQuery: (p: Partial<Query>) => void;
  onClear: () => void;
}) {
  return (
    <div className={styles.filters}>
      <label>
        Tìm tên, mã, điện thoại
        <TextInput
          name="q"
          maxLength={200}
          value={draft}
          onChange={(e) => onSearch(e.target.value)}
        />
      </label>
      <Button onClick={onClear}>Xóa tìm kiếm</Button>
      <label>
        Trạng thái
        <Select
          name="filter-status"
          value={query.status ?? ""}
          onChange={(e) =>
            onQuery({
              status: (e.target.value as Query["status"]) || undefined,
              page: 1,
            })
          }
        >
          <option value="">Tất cả</option>
          {Object.values(CustomerStatus).map((s) => (
            <option value={s} key={s}>
              {CustomerStatusLabelsVi[s]}
            </option>
          ))}
        </Select>
      </label>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          onQuery({
            phone: String(data.get("phone") ?? "").trim() || undefined,
            page: 1,
          });
        }}
        key={query.phone ?? ""}
      >
        <label>
          Điện thoại chính xác
          <TextInput
            name="phone"
            maxLength={64}
            defaultValue={query.phone ?? ""}
          />
        </label>
        <Button type="submit">Lọc điện thoại</Button>
      </form>
    </div>
  );
}
