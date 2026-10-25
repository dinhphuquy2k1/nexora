import Link from "next/link";
import { Button, StatusBadge } from "@nexora/ui";
import {
  Eye,
  Edit3,
  Search,
  Users,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";
import {
  CustomerStatus,
  CustomerStatusLabelsVi,
  type CustomerStatusCode,
} from "@nexora/shared";
import type { Summary } from "./types.ts";
import type { customerError } from "./errors.ts";
import { Feedback } from "./Feedback.tsx";
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
export function customerDate(value: string) {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("vi-VN") : "—";
}
export function CustomerTable({
  rows,
  onEdit,
  loading,
  error,
  filtered,
  onClear,
  onRetry,
}: {
  rows: Summary[];
  onEdit: (c: Summary) => void;
  loading: boolean;
  error?: ReturnType<typeof customerError>;
  filtered: boolean;
  onClear: () => void;
  onRetry: () => void;
}) {
  let state;
  if (loading)
    state = (
      <>
        <LoaderCircle size={28} aria-hidden="true" />
        <p role="status">Đang tải khách hàng…</p>
        <p>Đang cập nhật danh sách và thống kê.</p>
      </>
    );
  else if (error)
    state = (
      <>
        <AlertCircle size={30} aria-hidden="true" />
        <h2>Chưa tải được danh sách</h2>
        <Feedback error={error} />
        <Button variant="secondary" onClick={onRetry}>
          Thử tải lại
        </Button>
      </>
    );
  else if (filtered)
    state = (
      <>
        <Search size={30} aria-hidden="true" />
        <h2>Không tìm thấy khách hàng phù hợp</h2>
        <p>Không có hồ sơ trùng khớp với từ khóa hoặc bộ lọc hiện tại.</p>
        <Button variant="secondary" onClick={onClear}>
          Xóa bộ lọc tìm kiếm
        </Button>
      </>
    );
  else
    state = (
      <>
        <Users size={30} aria-hidden="true" />
        <h2>Chưa có khách hàng</h2>
        <p>Thêm khách hàng đầu tiên để quản lý hồ sơ và địa chỉ nhận hàng.</p>
      </>
    );
  const empty = loading || !!error || !rows.length;
  return (
    <div
      className={styles.tableViewport}
      tabIndex={0}
      role="region"
      aria-label="Bảng khách hàng có thể cuộn"
    >
      <table
        className={`${styles.table} ${empty ? styles.tableEmpty : ""}`}
        aria-busy={loading}
      >
        <caption className={styles.srOnly}>Danh sách khách hàng</caption>
        <thead>
          <tr>
            {[
              "Chi tiết",
              "Mã khách hàng",
              "Họ và tên",
              "Số điện thoại",
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
          {empty ? (
            <tr>
              <td colSpan={8} className={styles.stateCell}>
                <div className={styles.statePanel}>
                  <div>{state}</div>
                </div>
              </td>
            </tr>
          ) : (
            rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link
                    className={styles.detailLink}
                    href={`/customers/${encodeURIComponent(c.id)}`}
                    aria-label={`Xem ${c.code}`}
                  >
                    <Eye size={17} />
                  </Link>
                </td>
                <td>
                  <Link
                    className={styles.codeLink}
                    href={`/customers/${encodeURIComponent(c.id)}`}
                  >
                    {c.code}
                  </Link>
                </td>
                <td className={styles.customerName}>{c.name}</td>
                <td className={styles.phoneCell}>{c.phone}</td>
                <td>{c.email ?? "—"}</td>
                <td>
                  <CustomerBadge status={c.status} />
                </td>
                <td>{customerDate(c.createdAt)}</td>
                <td>
                  <Button
                    icon
                    variant="ghost"
                    onClick={() => onEdit(c)}
                    aria-label={`Sửa ${c.code}`}
                  >
                    <Edit3 size={16} />
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
