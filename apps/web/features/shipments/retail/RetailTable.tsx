import { PackageOpen } from "lucide-react";
import { stateMessage, visibleColumns, type RetailState } from "./model.ts";
import styles from "./retail.module.css";

export function RetailTable({
  columns,
  state,
}: {
  columns: string[];
  state: RetailState;
}) {
  const shown = visibleColumns(columns);
  const message = stateMessage(state);
  return (
    <section className={styles.tablePanel} aria-label="Danh sách kiện lẻ">
      <div
        className={styles.tableScroll}
        tabIndex={0}
        role="region"
        aria-label="Bảng kiện lẻ, cuộn ngang để xem cột"
      >
        <table className={styles.table}>
          <caption className={styles.srOnly}>
            Danh sách kiện lẻ — chức năng chưa được triển khai
          </caption>
          <thead>
            <tr>
              {shown.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  style={{ minWidth: column.width }}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={shown.length} className={styles.stateCell}>
                <div
                  className={styles.state}
                  role={
                    state === "error" || state === "invalid"
                      ? "alert"
                      : "status"
                  }
                >
                  <PackageOpen size={32} aria-hidden="true" />
                  <h2>{message.title}</h2>
                  <p>{message.description}</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
