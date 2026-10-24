"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Overlay } from "@nexora/ui";
import type { Customer, Address, ProfileDraft, AddressDraft } from "./types.ts";
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
}: {
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
  side?: boolean;
}) {
  const trigger = useRef<HTMLElement | null>(
    typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  useEffect(() => {
    return () => {
      queueMicrotask(() => {
        if (trigger.current?.isConnected) trigger.current.focus();
        else document.querySelector<HTMLElement>("main h1")?.focus();
      });
    };
  }, []);
  return (
    <Overlay
      open
      side={side}
      className={side ? styles.formOverlay : undefined}
      label={title}
      onDismiss={() => {
        if (!busy) onClose();
      }}
    >
      <div className={styles.drawer}>
        <header className={styles.drawerHeader}>
          <h2>{title}</h2>
          <Button onClick={onClose} disabled={busy} aria-label="Đóng biểu mẫu">
            Đóng
          </Button>
        </header>
        {children}
      </div>
    </Overlay>
  );
}
export function CustomerDrawer({
  customer,
  onClose,
  onSaved,
  refresh,
  reconciling = false,
}: {
  customer?: Customer | import("./types.ts").Summary;
  onClose: () => void;
  onSaved: () => void;
  refresh: () => void;
  reconciling?: boolean;
}) {
  const [baseline] = useState(customer);
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
      busy={mutation.busy}
      onClose={onClose}
    >
      <form
        aria-busy={mutation.busy}
        onSubmit={(e) => {
          e.preventDefault();
          if (reconciling) return;
          void mutation.run(
            () =>
              customer
                ? customerApi.update(
                    customer.id,
                    patchCustomerPayload(profile, baseline!),
                  )
                : customerApi.create(createCustomerPayload(profile, address)),
            onSaved,
          );
        }}
      >
        <fieldset
          disabled={mutation.busy || reconciling}
          className={styles.fieldset}
        >
          <CustomerProfileFields
            value={profile}
            onChange={setProfile}
            edit={!!customer}
            errorField={mutation.error?.field}
          />
          {!customer && (
            <>
              <h3>Địa chỉ đầu tiên</h3>
              <AddressForm
                value={address}
                onChange={setAddress}
                errorField={mutation.error?.field}
              />
            </>
          )}
        </fieldset>
        <div id="customer-field-error">
          <Feedback error={mutation.error} />
        </div>
        <Button type="submit" disabled={mutation.busy || reconciling}>
          {mutation.busy ? "Đang lưu…" : "Lưu khách hàng"}
        </Button>
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
      busy={mutation.busy}
      onClose={onClose}
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
        <div id="customer-field-error">
          <Feedback error={mutation.error} />
        </div>
        <Button type="submit" disabled={mutation.busy || reconciling}>
          {mutation.busy ? "Đang lưu…" : "Lưu địa chỉ"}
        </Button>
      </form>
    </DrawerFrame>
  );
}
