"use client";
import { useId, useState, type ReactNode } from "react";
import { Overlay, Button, TextInput, Select, StatusBadge } from "@nexora/ui";
import { X, Truck } from "lucide-react";
import type { CarrierConnectionRow, ConnectionDraft } from "./types.ts";
import {
  CONNECTION_STATES,
  displayTime,
  UNAVAILABLE,
  validateConnectionDraft,
} from "./presentation.ts";
import styles from "./carrier-connections.module.css";
export function CarrierDrawerFrame({
  title,
  subtitle,
  children,
  onClose,
  footer,
  form = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  form?: boolean;
}) {
  return (
    <Overlay
      open
      side
      onDismiss={onClose}
      label={title}
      className={`${styles.drawer} ${form ? styles.formDrawer : ""}`}
    >
      <header className={styles.drawerHeader}>
        <span className={styles.titleIcon}>
          <Truck size={20} />
        </span>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <Button
          icon
          variant="ghost"
          pressEffect="none"
          className={styles.closeButton}
          aria-label={`Đóng ${title}`}
          onClick={onClose}
        >
          <X size={16} />
        </Button>
      </header>
      {children}
      <footer className={styles.drawerFooter}>
        {footer}
        <Button variant="secondary" pressEffect="none" onClick={onClose}>
          Đóng
        </Button>
      </footer>
    </Overlay>
  );
}
export function CarrierConnectionDrawer({
  row,
  onClose,
}: {
  row?: CarrierConnectionRow;
  onClose: () => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<ConnectionDraft>({
    displayName: row?.displayName ?? "",
    loginIdentifier: row?.loginIdentifier ?? "",
    password: "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof ConnectionDraft, string>>
  >({});
  const [notice, setNotice] = useState("");
  const supported = !row || row.provider === "uniship";
  const title = row ? "Chỉnh sửa tài khoản kết nối" : "Kết nối hãng mới";
  return (
    <CarrierDrawerFrame
      title={title}
      onClose={onClose}
      form
      footer={
        supported && (
          <Button type="submit" form={id} variant="emphasis" pressEffect="none">
            Kiểm tra thông tin
          </Button>
        )
      }
    >
      <div className={styles.drawerBody}>
        <p className={styles.notice}>
          {UNAVAILABLE} Thông tin nhập chỉ là bản nháp, không được lưu.
        </p>
        {supported ? (
          <form
            id={id}
            noValidate
            autoComplete="off"
            onSubmit={(e) => {
              e.preventDefault();
              const next = validateConnectionDraft(draft);
              setErrors(next);
              setNotice(
                Object.keys(next).length
                  ? "Vui lòng kiểm tra các trường được đánh dấu."
                  : "Chưa thể lưu kết nối: chưa tích hợp dịch vụ. Thông tin chưa được xác thực với hãng.",
              );
            }}
            className={styles.form}
          >
            <label>
              Hãng vận chuyển
              <Select
                aria-label="Hãng vận chuyển kết nối"
                value="uniship"
                disabled
              >
                <option value="uniship">Uniship</option>
              </Select>
            </label>
            {(
              [
                {
                  key: "displayName",
                  label: "Tên gợi nhớ tài khoản",
                  max: 100,
                  type: "text",
                },
                {
                  key: "loginIdentifier",
                  label: "Tên đăng nhập hãng",
                  max: 128,
                  type: "text",
                },
                {
                  key: "password",
                  label: "Mật khẩu kết nối",
                  max: 1024,
                  type: "password",
                },
              ] as const
            ).map((field) => (
              <label key={field.key} htmlFor={`${id}-${field.key}`}>
                {field.label}
                <TextInput
                  id={`${id}-${field.key}`}
                  name={field.key}
                  required
                  type={field.type}
                  value={draft[field.key]}
                  maxLength={field.max}
                  autoComplete={
                    field.type === "password" ? "new-password" : "off"
                  }
                  aria-invalid={!!errors[field.key]}
                  aria-describedby={
                    errors[field.key] ? `${id}-${field.key}-error` : undefined
                  }
                  onChange={(e) => {
                    setDraft((previous) => ({
                      ...previous,
                      [field.key]: e.target.value,
                    }));
                    setNotice("");
                  }}
                />
                {errors[field.key] && (
                  <span
                    id={`${id}-${field.key}-error`}
                    className={styles.error}
                  >
                    {errors[field.key]}
                  </span>
                )}
              </label>
            ))}
            <p className={styles.muted}>
              Không có kiểm tra credential hoặc thao tác lưu trong giai đoạn
              này.
            </p>
            {notice && (
              <p role="alert" className={styles.notice}>
                {notice}
              </p>
            )}
          </form>
        ) : (
          <p>Biểu mẫu cấu hình cho hãng này chưa được hỗ trợ.</p>
        )}
      </div>
    </CarrierDrawerFrame>
  );
}
export function CarrierConnectionDetails({
  row,
  onClose,
}: {
  row: CarrierConnectionRow;
  onClose: () => void;
}) {
  return (
    <CarrierDrawerFrame
      title="Chi tiết tài khoản kết nối"
      subtitle={row.displayName}
      onClose={onClose}
    >
      <div className={styles.drawerBody}>
        <p className={styles.notice}>{UNAVAILABLE}</p>
        <dl className={styles.details}>
          <dt>Hãng vận chuyển</dt>
          <dd>{row.providerName}</dd>
          <dt>Tên gợi nhớ</dt>
          <dd>{row.displayName}</dd>
          <dt>Tên đăng nhập hãng</dt>
          <dd>{row.loginIdentifier ?? "—"}</dd>
          <dt>Trạng thái</dt>
          <dd>
            <StatusBadge ok={CONNECTION_STATES[row.status].ok}>
              {CONNECTION_STATES[row.status].label}
            </StatusBadge>
          </dd>
          <dt>Xác minh gần nhất</dt>
          <dd>{displayTime(row.lastVerifiedAt)}</dd>
          <dt>Ngày tạo</dt>
          <dd>{displayTime(row.createdAt)}</dd>
        </dl>
      </div>
    </CarrierDrawerFrame>
  );
}
export function CarrierConfirmDialog({
  row,
  onClose,
}: {
  row: CarrierConnectionRow;
  onClose: () => void;
}) {
  return (
    <Overlay open onDismiss={onClose} label="Xác nhận ngắt kết nối">
      <h2>Ngắt kết nối {row.displayName}?</h2>
      <p>{UNAVAILABLE} Tài khoản không bị thay đổi.</p>
      <div className={styles.actions}>
        <Button variant="secondary" pressEffect="none" onClick={onClose}>
          Hủy
        </Button>
        <Button disabled title={UNAVAILABLE}>
          Ngắt kết nối chưa khả dụng
        </Button>
      </div>
    </Overlay>
  );
}
