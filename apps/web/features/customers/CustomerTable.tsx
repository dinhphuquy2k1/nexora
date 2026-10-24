import Link from "next/link";
import { Button, StatusBadge } from "@nexora/ui";
import {
  CustomerStatus,
  CustomerStatusLabelsVi,
  type CustomerStatusCode,
} from "@nexora/shared";
import type { Summary } from "./types.ts";
import styles from "./customers.module.css";
const tones = {
  [CustomerStatus.ACTIVE]: true,
  [CustomerStatus.INACTIVE]: false,
} satisfies Record<CustomerStatusCode, boolean>;
export function CustomerBadge({ status }: { status: CustomerStatusCode }) {
  return (
    <StatusBadge ok={tones[status]}>
      {CustomerStatusLabelsVi[status]}
    </StatusBadge>
  );
}
const date = (value: string) => {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("vi-VN") : "—";
};
export function CustomerTable({
  rows,
  onEdit,
}: {
  rows: Summary[];
  onEdit: (c: Summary) => void;
}) {
  return (
    <>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <caption className={styles.srOnly}>Danh sách khách hàng</caption>
          <thead>
            <tr>
              {[
                "Mã khách hàng",
                "Họ và tên",
                "Điện thoại",
                "Email",
                "Trạng thái",
                "Ngày tạo",
                "Thao tác",
              ].map((t) => (
                <th key={t} scope="col">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/customers/${encodeURIComponent(c.id)}`}>
                    {c.code}
                  </Link>
                </td>
                <td>{c.name}</td>
                <td>{c.phone}</td>
                <td>{c.email ?? "—"}</td>
                <td>
                  <CustomerBadge status={c.status} />
                </td>
                <td>{date(c.createdAt)}</td>
                <td>
                  <Button
                    onClick={() => onEdit(c)}
                    aria-label={`Sửa ${c.code}`}
                  >
                    Sửa
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.mobileCards}>
        {rows.map((c) => (
          <article className={styles.card} key={c.id}>
            <Link href={`/customers/${encodeURIComponent(c.id)}`}>
              {c.code} · {c.name}
            </Link>
            <p>{c.phone}</p>
            <p>{c.email ?? "—"}</p>
            <CustomerBadge status={c.status} />
            <Button onClick={() => onEdit(c)} aria-label={`Sửa ${c.code}`}>
              Sửa
            </Button>
          </article>
        ))}
      </div>
    </>
  );
}
