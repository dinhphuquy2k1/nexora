import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, StatusBadge, buttonClassName } from "@nexora/ui";
import {
  Eye,
  Edit3,
  Power,
  MapPin,
  Search,
  Users,
  AlertCircle,
} from "lucide-react";
import {
  CustomerStatus,
  CustomerStatusLabelsVi,
  type CustomerStatusCode,
} from "@nexora/shared";
import type { Summary } from "./types.ts";
import type { customerError } from "./errors.ts";
import { customerColumns, customerTableMinWidth } from "./columns.ts";
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
  powerUnavailable = false,
  loading,
  pendingFilter = false,
  error,
  filtered,
  onClear,
  onRetry,
}: {
  rows: Summary[];
  onEdit: (c: Summary) => void;
  onToggleStatus?: (c: Summary) => void;
  togglingId?: string | null;
  powerUnavailable?: boolean;
  loading: boolean;
  pendingFilter?: boolean;
  error?: ReturnType<typeof customerError>;
  filtered: boolean;
  onClear: () => void;
  onRetry: () => void;
}) {
  let router: ReturnType<typeof useRouter> | null = null;
  try {
    router = useRouter();
  } catch {
    router = null;
  }
  let state;
  if (pendingFilter)
    state = (
      <>
        <h2 className={styles.stateTitle}>Bộ lọc chưa áp dụng</h2>
        <p className={styles.stateDesc}>
          Chọn Áp dụng hoặc Làm mới để tải danh sách theo số điện thoại đã nhập.
        </p>
      </>
    );
  else if (error)
    state = (
      <>
        <div className={styles.stateIconCircle}>
          <AlertCircle size={22} aria-hidden="true" />
        </div>
        <h2 className={styles.stateTitle}>Chưa tải được danh sách</h2>
        <Feedback live={false} error={error} />
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
  const skeleton = loading && !rows.length;
  const empty = !loading && !rows.length;
  return (
    <div
      className={styles.tableViewport}
      tabIndex={0}
      role="region"
      aria-label="Bảng khách hàng có thể cuộn"
    >
      {loading && (
        <span role="status" className={styles.srOnly}>
          Đang tải khách hàng…
        </span>
      )}
      {error && rows.length > 0 && (
        <div className={styles.staleFeedback}>
          <Feedback live={false} error={error} />
          <Button variant="secondary" onClick={onRetry}>
            Thử tải lại
          </Button>
        </div>
      )}
      <table
        style={{ minWidth: customerTableMinWidth }}
        data-stale={rows.length > 0 && (loading || !!error)}
        className={`${styles.table} ${empty ? styles.tableEmpty : ""}`}
        aria-busy={loading}
      >
        <caption className={styles.srOnly}>Danh sách khách hàng</caption>
        <colgroup>
          {customerColumns.map((column) => (
            <col key={column.key} style={{ width: column.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {customerColumns.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {skeleton ? (
            Array.from({ length: 5 }, (_, index) => (
              <tr key={index} data-skeleton="true" aria-hidden="true">
                {customerColumns.map((column) => (
                  <td key={column.key}>
                    <span className={styles.skeletonCell} />
                  </td>
                ))}
              </tr>
            ))
          ) : empty ? (
            <tr>
              <td colSpan={9} className={styles.stateCell}>
                <div className={styles.statePanel}>
                  <div>{state}</div>
                </div>
              </td>
            </tr>
          ) : (
            rows.map((c) => (
              <tr
                key={c.id}
                className={styles.tableRow}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (
                    target.closest(
                      "a, button, input, select, textarea, [data-no-row-click]",
                    )
                  ) {
                    return;
                  }
                  if (router) {
                    router.push(`/customers/${encodeURIComponent(c.id)}`);
                  } else if (typeof window !== "undefined") {
                    window.location.assign(
                      `/customers/${encodeURIComponent(c.id)}`,
                    );
                  }
                }}
              >
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
                      className={
                        c.status === CustomerStatus.ACTIVE
                          ? styles.powerDeactivate
                          : styles.powerActivate
                      }
                      onClick={() => onToggleStatus?.(c)}
                      disabled={powerUnavailable}
                      aria-busy={togglingId === c.id}
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
                          togglingId === c.id ? styles.spin : undefined
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
