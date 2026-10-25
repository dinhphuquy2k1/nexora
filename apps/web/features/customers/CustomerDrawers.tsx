"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Overlay } from "@nexora/ui";
import { X, UserPlus, Edit3, MapPin, CheckCircle2 } from "lucide-react";
import type {
  Customer,
  Address,
  ProfileDraft,
  AddressDraft,
  Summary,
} from "./types.ts";
import { CustomerProfileFields } from "./CustomerProfileFields.tsx";
import { AddressForm } from "./AddressForm.tsx";
import {
  createCustomerPayload,
  patchCustomerPayload,
  addressPayload,
} from "./payload.ts";
import { customerApi } from "./api.ts";
import { useCustomerMutation } from "./useCustomerMutation.ts";
import { Feedback } from "./Feedback.tsx";
import styles from "./customers.module.css";
const emptyAddress = (): AddressDraft => ({
  label: "",
  recipientName: "",
  recipientPhone: "",
  countryCode: "VN",
  addressText: "",
});
export function DrawerFrame({
  title,
  busy,
  onClose,
  children,
  side = true,
  description,
  icon,
  address = false,
}: {
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
  side?: boolean;
  description?: string;
  icon?: ReactNode;
  address?: boolean;
}) {
  const trigger = useRef<HTMLElement | null>(
    typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  useEffect(
    () => () => {
      queueMicrotask(() => {
        if (trigger.current?.isConnected) trigger.current.focus();
        else document.querySelector<HTMLElement>("main h1")?.focus();
      });
    },
    [],
  );
  let layout = styles.confirmOverlay;
  if (side)
    layout = address
      ? `${styles.formOverlay} ${styles.addressOverlay}`
      : styles.formOverlay;
  return (
    <Overlay
      open
      side={side}
      label={title}
      className={layout}
      onDismiss={() => {
        if (!busy) onClose();
      }}
    >
      <div className={side ? styles.drawer : styles.confirmation}>
        <header className={styles.drawerHeader}>
          <div className={styles.titleGroup}>
            {icon && <span className={styles.brandIcon}>{icon}</span>}
            <div>
              <h2>{title}</h2>
              {description && <p className={styles.muted}>{description}</p>}
            </div>
          </div>
          <Button
            icon
            variant="ghost"
            disabled={busy}
            onClick={onClose}
            aria-label="Đóng biểu mẫu"
          >
            <X size={18} />
          </Button>
        </header>
        {children}
      </div>
    </Overlay>
  );
}
function ReconcileNotice({
  busy,
  refresh,
}: {
  busy: boolean;
  refresh: () => void;
}) {
  return (
    <div role="status" className={styles.notice}>
      <p>
        Chưa đối chiếu xong dữ liệu. Chỉ thử lưu lại sau khi tải thành công.
      </p>
      <Button variant="secondary" disabled={busy} onClick={refresh}>
        Đối chiếu lại dữ liệu
      </Button>
    </div>
  );
}
export function CustomerDrawer({
  customer,
  onClose,
  onSaved,
  refresh,
  reconciling = false,
}: {
  customer?: Customer | Summary;
  onClose: () => void;
  onSaved: () => void;
  refresh: () => void;
  reconciling?: boolean;
}) {
  const [baseline] = useState(customer);
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileDraft>(() => ({
    name: customer?.name ?? "",
    phone: customer?.phone ?? "",
    email: customer?.email ?? "",
    note: customer?.note ?? "",
    status: customer?.status,
  }));
  const [address, setAddress] = useState(emptyAddress);
  const mutation = useCustomerMutation(refresh);
  return (
    <DrawerFrame
      title={customer ? "Sửa khách hàng" : "Thêm khách hàng"}
      description={
        customer
          ? `${customer.code} · Cập nhật hồ sơ, giữ nguyên người nhận của địa chỉ.`
          : "Tạo hồ sơ và địa chỉ nhận hàng đầu tiên."
      }
      icon={customer ? <Edit3 size={19} /> : <UserPlus size={19} />}
      busy={mutation.busy}
      onClose={onClose}
    >
      <form
        aria-busy={mutation.busy}
        onSubmit={(e) => {
          e.preventDefault();
          if (reconciling) return;
          const openAfter =
            !customer &&
            (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ===
              "open";
          let createdId: string | undefined;
          void mutation.run(
            async () => {
              if (customer)
                return customerApi.update(
                  customer.id,
                  patchCustomerPayload(profile, baseline!),
                );
              const result = await customerApi.create(
                createCustomerPayload(profile, address),
              );
              createdId = result.id;
              return result;
            },
            () => {
              onSaved();
              if (openAfter && createdId)
                router.push(`/customers/${encodeURIComponent(createdId)}`);
            },
          );
        }}
      >
        <div className={styles.drawerBody} data-customer-form-body>
          <fieldset
            disabled={mutation.busy || reconciling}
            className={styles.fieldset}
          >
            <section className={styles.formSection}>
              <div className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>1</span>
                <h3>Thông tin khách hàng</h3>
              </div>
              <CustomerProfileFields
                value={profile}
                onChange={setProfile}
                edit={!!customer}
                errorField={mutation.error?.field}
              />
            </section>
            {!customer && (
              <section className={styles.formSection}>
                <div className={styles.sectionHeading}>
                  <span className={styles.sectionNumber}>2</span>
                  <h3>Địa chỉ nhận hàng đầu tiên</h3>
                </div>
                <p className={styles.muted}>
                  Địa chỉ là bắt buộc và được lưu đồng thời với hồ sơ khách
                  hàng.
                </p>
                <AddressForm
                  value={address}
                  onChange={setAddress}
                  errorField={mutation.error?.field}
                />
                <p className={styles.notice}>
                  <CheckCircle2 size={16} aria-hidden="true" /> Địa chỉ này sẽ
                  là địa chỉ mặc định đầu tiên.
                </p>
              </section>
            )}
          </fieldset>
          {customer && (
            <section className={styles.formSection}>
              <h3 className={styles.muted}>Địa chỉ nhận hàng</h3>
              <p className={styles.muted}>
                Sửa hồ sơ không thay đổi người nhận của các địa chỉ đã lưu.
              </p>
              {"addresses" in customer &&
                customer.addresses.map((a) => (
                  <p className={styles.targetSummary} key={a.id}>
                    {a.label ?? "Địa chỉ"}
                    {a.isDefault ? " · Mặc định" : ""}
                    <br />
                    {a.addressText}
                  </p>
                ))}
              {!mutation.busy && !reconciling && (
                <Link href={`/customers/${encodeURIComponent(customer.id)}`}>
                  Mở hồ sơ để quản lý địa chỉ
                </Link>
              )}
            </section>
          )}
          {reconciling && (
            <ReconcileNotice busy={mutation.busy} refresh={refresh} />
          )}
          <div id="customer-field-error">
            <Feedback error={mutation.error} />
          </div>
        </div>
        <footer className={styles.drawerFooter}>
          <Button
            variant="secondary"
            disabled={mutation.busy}
            onClick={onClose}
          >
            Hủy
          </Button>
          <div className={styles.actions}>
            <Button
              variant={customer ? "primary" : "secondary"}
              type="submit"
              disabled={mutation.busy || reconciling}
            >
              {mutation.busy ? "Đang lưu…" : "Lưu khách hàng"}
            </Button>
            {!customer && (
              <Button
                type="submit"
                value="open"
                disabled={mutation.busy || reconciling}
              >
                Lưu và mở hồ sơ
              </Button>
            )}
          </div>
        </footer>
      </form>
    </DrawerFrame>
  );
}
export function AddressDrawer({
  id,
  address,
  onClose,
  onSaved,
  refresh,
  reconciling = false,
}: {
  id: string;
  address?: Address;
  onClose: () => void;
  onSaved: () => void;
  refresh: () => void;
  reconciling?: boolean;
}) {
  const [baseline] = useState(address);
  const [draft, setDraft] = useState<AddressDraft>(() =>
    address
      ? {
          label: address.label ?? "",
          recipientName: address.recipientName,
          recipientPhone: address.recipientPhone,
          countryCode: address.countryCode,
          addressText: address.addressText,
        }
      : emptyAddress(),
  );
  const mutation = useCustomerMutation(refresh);
  return (
    <DrawerFrame
      title={address ? "Sửa địa chỉ" : "Thêm địa chỉ"}
      description={
        address?.isDefault
          ? "Địa chỉ mặc định · Cập nhật thông tin người nhận."
          : "Thông tin người nhận và địa chỉ giao hàng."
      }
      icon={<MapPin size={19} />}
      busy={mutation.busy}
      onClose={onClose}
      address
    >
      <form
        aria-busy={mutation.busy}
        onSubmit={(e) => {
          e.preventDefault();
          if (reconciling) return;
          void mutation.run(
            () =>
              address
                ? customerApi.patchAddress(
                    id,
                    address.id,
                    addressPayload(draft, baseline!),
                  )
                : customerApi.add(id, addressPayload(draft)),
            onSaved,
          );
        }}
      >
        <div className={styles.drawerBody} data-customer-form-body>
          <fieldset
            disabled={mutation.busy || reconciling}
            className={styles.fieldset}
          >
            <AddressForm
              value={draft}
              onChange={setDraft}
              edit={!!address}
              errorField={mutation.error?.field}
            />
          </fieldset>
          {reconciling && (
            <ReconcileNotice busy={mutation.busy} refresh={refresh} />
          )}
          <div id="customer-field-error">
            <Feedback error={mutation.error} />
          </div>
        </div>
        <footer className={styles.drawerFooter}>
          <Button
            variant="secondary"
            disabled={mutation.busy}
            onClick={onClose}
          >
            Hủy
          </Button>
          <Button type="submit" disabled={mutation.busy || reconciling}>
            {mutation.busy ? "Đang lưu…" : "Lưu địa chỉ"}
          </Button>
        </footer>
      </form>
    </DrawerFrame>
  );
}
