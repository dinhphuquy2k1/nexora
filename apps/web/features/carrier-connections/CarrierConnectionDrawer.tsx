"use client";
import { useId, useState, type ReactNode } from "react";
import { Overlay, Button, TextInput } from "@nexora/ui";
import {
  X,
  Truck,
  KeyRound,
  Lock,
  Activity,
  Check,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import type {
  CarrierConnectionRow,
  ConnectionDraft,
  CarrierProviderPresentation,
} from "./types.ts";
import { UNAVAILABLE, validateConnectionDraft } from "./presentation.ts";
import { CarrierLogo, ConnectionBadge } from "./CarrierConnectionList.tsx";
import styles from "./carrier-connections.module.css";
export function CarrierDrawerFrame({
  title,
  subtitle,
  children,
  onClose,
  footer,
  form = false,
  centered = false,
  row,
  status,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  form?: boolean;
  centered?: boolean;
  row?: CarrierConnectionRow;
  status?: ReactNode;
}) {
  let brand = <Truck size={20} />;
  if (form) brand = <KeyRound size={16} />;
  if (centered && row) brand = <CarrierLogo row={row} />;
  return (
    <Overlay
      open
      side={!centered}
      onDismiss={onClose}
      label={title}
      className={`${centered ? styles.modal : styles.drawer} ${form ? styles.formDrawer : ""}`}
    >
      <header className={styles.drawerHeader}>
        <span className={styles.drawerBrand}>{brand}</span>
        <div>
          <div className={styles.drawerTitleLine}>
            <h2>{title}</h2>
            {status}
          </div>
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
      {footer && <footer className={styles.drawerFooter}>{footer}</footer>}
    </Overlay>
  );
}
const UNISHIP: CarrierProviderPresentation = {
  id: "uniship",
  name: "Uniship",
  code: "UNI",
};
export function CarrierConnectionDrawer({
  row,
  providers,
  onClose,
}: {
  row?: CarrierConnectionRow;
  providers?: readonly CarrierProviderPresentation[];
  onClose: () => void;
}) {
  const id = useId(),
    [draft, setDraft] = useState<ConnectionDraft>({
      displayName: row?.displayName ?? "",
      loginIdentifier: row?.loginIdentifier ?? "",
      password: "",
    }),
    [touched, setTouched] = useState<
      Partial<Record<keyof ConnectionDraft, boolean>>
    >({});
  const errors = validateConnectionDraft(draft);
  const title = row
    ? `Cấu hình tài khoản: ${row.displayName}`
    : "Kết nối tài khoản hãng vận chuyển mới";
  const choices = providers ?? [UNISHIP];
  return (
    <CarrierDrawerFrame
      title={title}
      subtitle="Liên kết tài khoản giữa Nexora và hệ thống hãng"
      form
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button variant="emphasis" disabled title={UNAVAILABLE}>
            {row ? "Lưu thay đổi" : "Kích hoạt kết nối"}
          </Button>
        </>
      }
    >
      <form
        className={styles.drawerBody}
        noValidate
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          setTouched({
            displayName: true,
            loginIdentifier: true,
            password: true,
          });
        }}
      >
        <div className={styles.form}>
          <section>
            <label>
              1. Chọn đối tác hãng vận chuyển{" "}
              <span className={styles.dangerText}>*</span>
            </label>
            <div className={styles.providerGrid}>
              {choices.map((p) => (
                <Button
                  key={p.id}
                  variant="ghost"
                  size="large"
                  className={styles.providerCard}
                  disabled={p.id !== "uniship"}
                  aria-pressed={p.id === (row?.provider ?? "uniship")}
                  title={
                    p.id === "uniship"
                      ? "Biểu mẫu Uniship; chưa tích hợp"
                      : "Chưa hỗ trợ tích hợp"
                  }
                >
                  <span className={styles.providerLogo}>{p.code}</span>
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      Mã: {p.code}
                      {p.id !== "uniship" ? " · Chưa hỗ trợ" : ""}
                    </small>
                  </span>
                  {p.id === "uniship" && <Check size={16} />}
                </Button>
              ))}
            </div>
          </section>
          {row && row.provider !== "uniship" ? (
            <p className={styles.muted}>
              Biểu mẫu cấu hình hãng này chưa được hỗ trợ.
            </p>
          ) : (
            (
              [
                {
                  key: "displayName",
                  label: "2. Tên gợi nhớ tài khoản",
                  placeholder: "Ví dụ: Tài khoản chính, Tài khoản chi nhánh...",
                  max: 100,
                  type: "text",
                },
                {
                  key: "loginIdentifier",
                  label: "3. Tên đăng nhập / Mã tài khoản hãng",
                  placeholder: "Tên đăng nhập Uniship",
                  max: 128,
                  type: "text",
                },
                {
                  key: "password",
                  label: "4. Mật khẩu kết nối",
                  placeholder: "Nhập mật khẩu tài khoản hãng",
                  max: 1024,
                  type: "password",
                },
              ] as const
            ).map((f) => (
              <section key={f.key}>
                <label htmlFor={id + f.key}>
                  {f.label}
                  <span className={styles.dangerText}> *</span>
                </label>
                <div className={styles.fieldAccessory}>
                  <TextInput
                    id={id + f.key}
                    name={f.key}
                    type={f.type}
                    value={draft[f.key]}
                    placeholder={f.placeholder}
                    maxLength={f.max}
                    required
                    autoComplete={
                      f.type === "password" ? "new-password" : "off"
                    }
                    aria-invalid={!!touched[f.key] && !!errors[f.key]}
                    aria-describedby={
                      touched[f.key] && errors[f.key]
                        ? id + f.key + "-error"
                        : undefined
                    }
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [f.key]: e.target.value }))
                    }
                    onBlur={() => setTouched((t) => ({ ...t, [f.key]: true }))}
                  />
                  {f.type === "password" && <Lock size={14} />}
                </div>
                {touched[f.key] && errors[f.key] && (
                  <p
                    role="alert"
                    id={id + f.key + "-error"}
                    className={styles.error}
                  >
                    {errors[f.key]}
                  </p>
                )}
              </section>
            ))
          )}
          <section>
            <label>5. Môi trường vận hành</label>
            <div className={styles.environmentGrid}>
              {[
                { value: "production", label: "Production (Thực tế)" },
                { value: "sandbox", label: "Sandbox (Thử nghiệm)" },
              ].map((env) => (
                <div
                  className={styles.environmentCard}
                  key={env.value}
                  data-selected={row?.preview?.environment === env.value}
                >
                  <span aria-hidden="true">○</span>
                  <span>
                    <strong>{env.label}</strong>
                    <small>
                      {row?.preview?.environment === env.value
                        ? "Thông tin bản xem trước"
                        : "Chưa có thông tin tích hợp"}
                    </small>
                  </span>
                </div>
              ))}
            </div>
          </section>
          <section>
            <Button
              variant="secondary"
              className={styles.fullWidth}
              disabled
              title={UNAVAILABLE}
            >
              <Activity size={14} />
              Kiểm tra kết nối API ngay
            </Button>
            <p className={styles.formHelp}>
              Thông tin chỉ là bản nháp, không được lưu. Xác minh và lưu kết nối
              chưa khả dụng.
            </p>
          </section>
        </div>
      </form>
    </CarrierDrawerFrame>
  );
}
export function CarrierConnectionDetails({
  row,
  onClose,
  onEdit,
}: {
  row: CarrierConnectionRow;
  onClose: () => void;
  onEdit?: () => void;
}) {
  return (
    <CarrierDrawerFrame
      title={row.displayName}
      subtitle={`Hãng: ${row.providerName} (${row.preview?.code ?? "—"})`}
      row={row}
      centered
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onEdit} disabled={!onEdit}>
            Chỉnh sửa tài khoản
          </Button>
          <Button className={styles.navyAction} onClick={onClose}>
            Đóng
          </Button>
        </>
      }
    >
      <div className={styles.drawerBody}>
        <div className={styles.metadataGrid}>
          <div>
            <small>Tên đăng nhập / ID</small>
            <strong>{row.loginIdentifier ?? "—"}</strong>
          </div>
          <div>
            <small>Môi trường</small>
            <span
              className={styles.environmentPill}
              data-value={row.preview?.environment}
            >
              {row.preview?.environment
                ? { production: "Production", sandbox: "Sandbox" }[
                    row.preview.environment
                  ]
                : "—"}
            </span>
          </div>
          <div>
            <small>Trạng thái kết nối</small>
            <ConnectionBadge row={row} />
          </div>
          <div>
            <small>Lần đồng bộ gần nhất</small>
            <span>{row.preview?.lastSyncDisplay ?? "—"}</span>
          </div>
        </div>
        <section className={styles.metadataSection}>
          <strong>Tính năng phân quyền:</strong>
          <div className={styles.featureBadges}>
            {row.preview?.features?.length ? (
              row.preview.features.map((f) => <span key={f}>{f}</span>)
            ) : (
              <span>—</span>
            )}
          </div>
        </section>
        <p className={styles.information}>
          <ShieldCheck size={16} />
          {UNAVAILABLE}
        </p>
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
    <Overlay
      open
      onDismiss={onClose}
      label="Xác nhận ngắt kết nối"
      className={styles.confirmModal}
    >
      <span className={styles.warningIcon}>
        <AlertCircle size={20} />
      </span>
      <h2>Xác nhận ngắt kết nối tài khoản?</h2>
      <p>
        Bạn có chắc chắn muốn ngắt kết nối tài khoản{" "}
        <strong>{row.displayName}</strong> thuộc hãng{" "}
        <strong>{row.providerName}</strong>? Thao tác hiện chưa khả dụng; tài
        khoản không bị thay đổi.
      </p>
      <div className={styles.confirmActions}>
        <Button variant="secondary" onClick={onClose}>
          Hủy bỏ
        </Button>
        <Button disabled className={styles.dangerAction} title={UNAVAILABLE}>
          Xác nhận ngắt kết nối
        </Button>
      </div>
    </Overlay>
  );
}
