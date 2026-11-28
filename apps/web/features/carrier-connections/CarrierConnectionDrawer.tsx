"use client";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
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
import {
  UNAVAILABLE,
  validateConnectionDraft,
  validateEditConnectionDraft,
} from "./presentation.ts";
import { SyncApiError } from "./sync-api.ts";
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
  onSubmit,
}: {
  row?: CarrierConnectionRow;
  providers?: readonly CarrierProviderPresentation[];
  onClose: () => void;
  onSubmit?: (draft: ConnectionDraft) => Promise<void>;
}) {
  const id = useId(),
    flight = useRef(false),
    [draft, setDraft] = useState<ConnectionDraft>({
      displayName: row?.displayName ?? "",
      loginIdentifier: row?.loginIdentifier ?? "",
      password: "",
    }),
    [touched, setTouched] = useState<
      Partial<Record<keyof ConnectionDraft, boolean>>
    >({}),
    [busy, setBusy] = useState(false),
    [submitError, setSubmitError] = useState("");
  const isLive = Boolean(onSubmit),
    errors = row
      ? validateEditConnectionDraft(draft)
      : validateConnectionDraft(draft),
    dirty =
      !row ||
      draft.displayName.trim() !== row.displayName ||
      draft.password.length > 0,
    canSubmit =
      isLive &&
      !busy &&
      Object.keys(errors).length === 0 &&
      dirty &&
      (!row || row.provider === "uniship");
  const title = row
    ? `Cấu hình tài khoản: ${row.displayName}`
    : "Kết nối tài khoản hãng vận chuyển mới";
  const choices = providers ?? [UNISHIP];
  const formId = id + "-form";
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!onSubmit || flight.current) return;
    setTouched({
      displayName: true,
      loginIdentifier: !row,
      password: !row || draft.password.length > 0,
    });
    if (
      Object.keys(errors).length > 0 ||
      (row && !dirty) ||
      (row && row.provider !== "uniship")
    )
      return;
    flight.current = true;
    setBusy(true);
    setSubmitError("");
    try {
      await onSubmit({
        displayName: draft.displayName.trim(),
        loginIdentifier: draft.loginIdentifier.trim(),
        password: draft.password,
      });
      setDraft((d) => ({ ...d, password: "" }));
      onClose();
    } catch (error) {
      if (error instanceof SyncApiError && error.status === 401)
        setDraft((d) => ({ ...d, password: "" }));
      setSubmitError(
        error instanceof SyncApiError
          ? error.message
          : "Không thể kết nối hoặc cập nhật tài khoản. Vui lòng thử lại.",
      );
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  const submitLabel = busy
    ? "Đang xử lý..."
    : row
      ? "Lưu thay đổi"
      : "Kích hoạt kết nối";
  return (
    <CarrierDrawerFrame
      title={title}
      subtitle="Liên kết tài khoản giữa Nexora và hệ thống hãng"
      form
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Hủy
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="emphasis"
            disabled={!canSubmit}
            title={!isLive ? UNAVAILABLE : undefined}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className={styles.drawerBody}
        noValidate
        autoComplete="off"
        aria-busy={busy}
        onSubmit={handleSubmit}
      >
        <div className={styles.form}>
          {submitError && (
            <p role="alert" className={styles.syncError}>
              <AlertCircle size={14} />
              <span>{submitError}</span>
            </p>
          )}
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
                      ? isLive
                        ? "Uniship"
                        : "Biểu mẫu Uniship; chưa tích hợp"
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
                  required: true,
                },
                {
                  key: "loginIdentifier",
                  label: "3. Tên đăng nhập / Mã tài khoản hãng",
                  placeholder: "Tên đăng nhập Uniship",
                  max: 128,
                  type: "text",
                  required: !row,
                },
                {
                  key: "password",
                  label: row
                    ? "4. Mật khẩu kết nối mới (để trống nếu chỉ đổi tên)"
                    : "4. Mật khẩu kết nối",
                  placeholder: row
                    ? "Nhập mật khẩu mới nếu muốn xác thực lại"
                    : "Nhập mật khẩu tài khoản hãng",
                  max: 1024,
                  type: "password",
                  required: !row,
                },
              ] as const
            ).map((f) => {
              const fieldDisabled =
                busy || (f.key === "loginIdentifier" && Boolean(row));
              const fieldError =
                f.key === "loginIdentifier" && row ? undefined : errors[f.key];
              return (
                <section key={f.key}>
                  <label htmlFor={id + f.key}>
                    {f.label}
                    {f.required && (
                      <span className={styles.dangerText}> *</span>
                    )}
                  </label>
                  <div className={styles.fieldAccessory}>
                    <TextInput
                      id={id + f.key}
                      name={f.key}
                      type={f.type}
                      value={draft[f.key]}
                      placeholder={f.placeholder}
                      maxLength={f.max}
                      required={f.required}
                      disabled={fieldDisabled}
                      autoComplete={
                        f.type === "password" ? "new-password" : "off"
                      }
                      aria-invalid={!!touched[f.key] && !!fieldError}
                      aria-describedby={
                        touched[f.key] && fieldError
                          ? id + f.key + "-error"
                          : undefined
                      }
                      onChange={(e) => {
                        setSubmitError("");
                        setDraft((d) => ({ ...d, [f.key]: e.target.value }));
                      }}
                      onBlur={() =>
                        setTouched((t) => ({ ...t, [f.key]: true }))
                      }
                    />
                    {f.type === "password" && <Lock size={14} />}
                  </div>
                  {touched[f.key] && fieldError && (
                    <p
                      role="alert"
                      id={id + f.key + "-error"}
                      className={styles.error}
                    >
                      {fieldError}
                    </p>
                  )}
                </section>
              );
            })
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
                  data-selected={
                    row?.preview?.environment === env.value ||
                    (isLive && env.value === "production" && !row)
                  }
                >
                  <span aria-hidden="true">○</span>
                  <span>
                    <strong>{env.label}</strong>
                    <small>
                      {row?.preview?.environment === env.value
                        ? "Thông tin bản xem trước"
                        : isLive && env.value === "production"
                          ? "Theo cấu hình máy chủ hiện tại"
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
              {isLive
                ? "Thông tin đăng nhập được mã hóa và xác minh trực tiếp với hệ thống hãng trên máy chủ."
                : "Thông tin chỉ là bản nháp, không được lưu. Xác minh và lưu kết nối chưa khả dụng."}
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
  onConfirm,
}: {
  row: CarrierConnectionRow;
  onClose: () => void;
  onConfirm?: () => Promise<void>;
}) {
  const flight = useRef(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    isLive = Boolean(onConfirm);
  async function handleConfirm() {
    if (!onConfirm || flight.current) return;
    flight.current = true;
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(
        err instanceof SyncApiError
          ? err.message
          : "Không thể ngắt kết nối tài khoản. Vui lòng thử lại.",
      );
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  return (
    <Overlay
      open
      onDismiss={() => {
        if (!busy) onClose();
      }}
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
        <strong>{row.providerName}</strong>?
        {!isLive &&
          " Thao tác hiện chưa khả dụng; tài khoản không bị thay đổi."}
      </p>
      {error && (
        <p role="alert" className={styles.syncError}>
          <AlertCircle size={14} />
          <span>{error}</span>
        </p>
      )}
      <div className={styles.confirmActions}>
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          Hủy bỏ
        </Button>
        <Button
          disabled={!isLive || busy}
          className={styles.dangerAction}
          title={!isLive ? UNAVAILABLE : undefined}
          onClick={handleConfirm}
        >
          {busy ? "Đang ngắt..." : "Xác nhận ngắt kết nối"}
        </Button>
      </div>
    </Overlay>
  );
}
