import Link from "next/link";
import { Button, StatusBadge, buttonClassName } from "@nexora/ui";
import {
  Eye,
  Edit3,
  Power,
  MapPin,
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
  const active = status === CustomerStatus.ACTIVE;
  return (
    <StatusBadge
      ok={tones[status]}
      className={`${styles.statusChip} ${active ? styles.statusChipActive : styles.statusChipInactive}`}
    >
      <span
        className={`${styles.chipDot} ${active ? styles.chipDotActive : styles.chipDotInactive}`}
        aria-hidden="true"
      />
      <span>{CustomerStatusLabelsVi[status]}</span>
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
  onToggleStatus,
  togglingId,
  loading,
  error,
  filtered,
  onClear,
  onRetry,
}: {
  rows: Summary[];
  onEdit: (c: Summary) => void;
  onToggleStatus?: (c: Summary) => void;
  togglingId?: string | null;
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
        <div className={styles.stateIconCircle}>
          <LoaderCircle size={22} className={styles.spin} aria-hidden="true" />
        </div>
        <p role="status" className={styles.stateTitle}>
          Đang tải danh sách khách hàng...
        </p>
        <p className={styles.stateDesc}>Đang cập nhật danh sách và thống kê.</p>
      </>
    );
  else if (error)
    state = (
      <>
        <div className={styles.stateIconCircle}>
          <AlertCircle size={22} aria-hidden="true" />
        </div>
        <h2 className={styles.stateTitle}>Chưa tải được danh sách</h2>
        <Feedback error={error} />
        <Button variant="secondary" onClick={onRetry}>
          Thử tải lại
        </Button>
      </>
    );
  else if (filtered)
    state = (
      <>
        <div className={styles.stateIconCircle}>
          <Search size={22} aria-hidden="true" />
        </div>
        <h2 className={styles.stateTitle}>Không tìm thấy khách hàng phù hợp</h2>
        <p className={styles.stateDesc}>
          Không có hồ sơ nào trùng khớp với từ khóa tìm kiếm hoặc bộ lọc trạng
          thái hiện tại.
        </p>
        <Button variant="secondary" onClick={onClear}>
          Xóa bộ lọc tìm kiếm
        </Button>
      </>
    );
  else
    state = (
      <>
        <div className={styles.stateIconCircle}>
          <Users size={22} aria-hidden="true" />
        </div>
        <h2 className={styles.stateTitle}>Chưa có khách hàng</h2>
        <p className={styles.stateDesc}>
          Thêm khách hàng đầu tiên để quản lý hồ sơ và địa chỉ nhận hàng.
        </p>
      </>
    );
  const empty = loading || !!error || !rows.length;
  const columns = [
    "CHI TIẾT",
    "MÃ KHÁCH HÀNG",
    "HỌ VÀ TÊN",
    "SỐ ĐIỆN THOẠI",
    "EMAIL",
    "SỐ ĐỊA CHỈ",
    "TRẠNG THÁI",
    "NGÀY TẠO",
    "THAO TÁC",
  ];
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
            {columns.map((t) => (
              <th key={t} scope="col">
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {empty ? (
            <tr>
              <td colSpan={9} className={styles.stateCell}>
                <div className={styles.statePanel}>
                  <div>{state}</div>
                </div>
              </td>
            </tr>
          ) : (
            rows.map((c) => (
              <tr key={c.id} className={styles.tableRow}>
                <td className={styles.detailCell}>
                  <Link
                    data-size="default"
                    className={buttonClassName(
                      "ghost",
                      true,
                      styles.detailLink,
                    )}
                    href={`/customers/${encodeURIComponent(c.id)}`}
                    aria-label={`Xem ${c.code}`}
                    title="Xem chi tiết hồ sơ & quản lý địa chỉ"
                  >
                    <Eye size={15} />
                  </Link>
                </td>
                <td className={styles.codeCell}>
                  <Link
                    className={styles.codeLink}
                    href={`/customers/${encodeURIComponent(c.id)}`}
                  >
                    {c.code}
                  </Link>
                </td>
                <td className={styles.customerName}>{c.name}</td>
                <td className={styles.phoneCell}>{c.phone}</td>
                <td className={styles.emailCell}>{c.email ?? "—"}</td>
                <td className={styles.addressCountCell}>
                  <span
                    className={styles.addressCountBadge}
                    title="Số địa chỉ khả dụng trong chi tiết hồ sơ"
                  >
                    <MapPin
                      size={12}
                      className={styles.addressCountIcon}
                      aria-hidden="true"
                    />
                    <span>—</span>
                  </span>
                </td>
                <td className={styles.statusCell}>
                  <CustomerBadge status={c.status} />
                </td>
                <td className={styles.dateCell}>{customerDate(c.createdAt)}</td>
                <td
                  className={styles.actionCell}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={styles.actionGroup}>
                    <Button
                      icon
                      variant="ghost"
                      onClick={() => onEdit(c)}
                      aria-label={`Sửa ${c.code}`}
                      title="Chỉnh sửa thông tin khách hàng"
                    >
                      <Edit3 size={15} />
                    </Button>
                    <Button
                      icon
                      variant="ghost"
                      onClick={() => onToggleStatus?.(c)}
                      disabled={togglingId === c.id}
                      aria-label={
                        c.status === CustomerStatus.ACTIVE
                          ? `Tạm ngừng hoạt động ${c.code}`
                          : `Kích hoạt lại ${c.code}`
                      }
                      title={
                        c.status === CustomerStatus.ACTIVE
                          ? "Tạm ngừng hoạt động"
                          : "Kích hoạt lại tài khoản"
                      }
                    >
                      <Power
                        size={14}
                        className={
                          togglingId === c.id
                            ? styles.spin
                            : c.status === CustomerStatus.ACTIVE
                              ? styles.powerActive
                              : styles.powerInactive
                        }
                      />
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
