"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  UserRound,
  MapPin,
  Plus,
  Edit3,
  Trash2,
  Star,
} from "lucide-react";
import { Button } from "@nexora/ui";
import { customerApi } from "./api.ts";
import { useCustomerRead } from "./useCustomerRead.ts";
import { useCustomerMutation } from "./useCustomerMutation.ts";
import { CustomerBadge, customerDate } from "./CustomerTable.tsx";
import { CustomerDrawer, AddressDrawer } from "./CustomerDrawers.tsx";
import { DeleteAddressModal } from "./DeleteAddressModal.tsx";
import { Feedback } from "./Feedback.tsx";
import styles from "./customers.module.css";
type Mode =
  | { kind: "profile" }
  | { kind: "add" }
  | { kind: "address" | "delete"; id: string };
export function CustomerDetailPage({ id }: { id: string }) {
  const read = useCustomerRead(id, (signal) => customerApi.get(id, signal));
  const mutation = useCustomerMutation(read.refresh);
  const [mode, setMode] = useState<Mode | null>(null);
  const [notice, setNotice] = useState("");
  const c = read.data;
  const [retained, setRetained] = useState(c);
  useEffect(() => {
    if (c) setRetained(c);
  }, [c]);
  const data = c ?? retained;
  const target = data?.addresses.find(
    (a) => mode && "id" in mode && a.id === mode.id,
  );
  useEffect(() => {
    if (
      c &&
      mode &&
      "id" in mode &&
      !c.addresses.some((a) => a.id === mode.id)
    ) {
      setMode(null);
      setNotice("Địa chỉ không còn tồn tại. Dữ liệu đã được tải lại.");
    }
  }, [c, mode]);
  const saved = () => {
    setMode(null);
    setNotice(
      "Đã lưu thay đổi. Đang tải lại; nếu không tải được, dùng Tải lại.",
    );
  };
  return (
    <div className={`${styles.page} ${styles.detailPage}`}>
      <div className={styles.toolbar}>
        <div className={styles.titleGroup}>
          <Link
            className={styles.backLink}
            href="/customers"
            aria-label="Danh sách khách hàng"
          >
            <ArrowLeft size={17} />
            Danh sách
          </Link>
          <span className={styles.brandIcon}>
            <UserRound size={19} />
          </span>
          <div>
            <h1
              id="customer-heading"
              tabIndex={-1}
              className={styles.detailTitle}
            >
              {c?.name ?? "Chi tiết khách hàng"}
            </h1>
            {c && <span className={styles.drawerCode}>{c.code}</span>}
          </div>
          {c && <CustomerBadge status={c.status} />}
        </div>
        <Button variant="secondary" onClick={read.refresh} aria-label="Tải lại">
          Tải lại
        </Button>
      </div>
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}
      <Feedback error={read.error} />
      <Feedback error={mutation.error} />
      {read.loading && <p role="status">Đang tải khách hàng…</p>}
      {c && (
        <div className={styles.detailGrid}>
          <section className={styles.card}>
            <div className={styles.cardHeading}>
              <div className={styles.titleGroup}>
                <span className={styles.brandIcon}>
                  <UserRound size={17} />
                </span>
                <h2>Thông tin khách hàng</h2>
              </div>
              <Button
                variant="ghost"
                disabled={mutation.busy}
                onClick={() => setMode({ kind: "profile" })}
              >
                Sửa khách hàng
              </Button>
            </div>
            <dl className={styles.profile}>
              {[
                ["Mã khách hàng", c.code],
                ["Họ và tên", c.name],
                ["Số điện thoại", c.phone],
                ["Email", c.email ?? "—"],
                ["Ngày tạo", customerDate(c.createdAt)],
                ["Địa chỉ nhận hàng", String(c.addresses.length)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div className={styles.profileNote}>
              <h3>Ghi chú nội bộ</h3>
              <p className={styles.targetSummary}>
                {c.note ?? "Chưa có ghi chú nội bộ."}
              </p>
            </div>
          </section>
          <section className={styles.card}>
            <div className={styles.cardHeading}>
              <div className={styles.titleGroup}>
                <span className={styles.brandIcon}>
                  <MapPin size={18} />
                </span>
                <h2>Địa chỉ nhận hàng ({c.addresses.length})</h2>
              </div>
              <Button
                disabled={mutation.busy}
                onClick={() => setMode({ kind: "add" })}
              >
                <Plus size={17} />
                Thêm địa chỉ
              </Button>
            </div>
            {!c.addresses.length && (
              <div className={styles.targetSummary}>
                <MapPin size={25} />
                <h3>Chưa có địa chỉ nhận hàng</h3>
                <p>Thêm địa chỉ thật để tiếp tục quản lý hồ sơ.</p>
              </div>
            )}
            {!!c.addresses.length && !c.addresses.some((a) => a.isDefault) && (
              <p role="status" className={styles.notice}>
                Chưa có địa chỉ mặc định. Hãy chọn rõ một địa chỉ bên dưới.
              </p>
            )}
            {c.addresses.length === 1 && (
              <p className={styles.muted}>
                Không thể xóa địa chỉ cuối cùng. Hãy thêm một địa chỉ trước.
              </p>
            )}
            {c.addresses.map((a) => (
              <article
                aria-label={
                  a.isDefault ? "Địa chỉ mặc định" : "Địa chỉ nhận hàng"
                }
                className={`${styles.address} ${a.isDefault ? styles.defaultAddress : ""}`}
                key={a.id}
                data-address-id={a.id}
              >
                <div className={styles.toolbar}>
                  <div className={styles.titleGroup}>
                    <MapPin size={17} aria-hidden="true" />
                    <h3>{a.label ?? "Địa chỉ nhận hàng"}</h3>
                    {a.isDefault && (
                      <span className={styles.defaultTag}>
                        <Star size={13} aria-hidden="true" /> Mặc định
                      </span>
                    )}
                  </div>
                  <div className={styles.actions}>
                    {!a.isDefault && (
                      <Button
                        variant="secondary"
                        disabled={mutation.busy || !!mode}
                        onClick={() =>
                          void mutation.run(
                            () => customerApi.setDefault(id, a.id),
                            saved,
                          )
                        }
                      >
                        <Star size={15} />
                        Đặt mặc định
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      icon
                      aria-label="Sửa địa chỉ"
                      disabled={mutation.busy}
                      onClick={() => setMode({ kind: "address", id: a.id })}
                    >
                      <Edit3 size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      icon
                      aria-label="Xóa địa chỉ"
                      disabled={mutation.busy || c.addresses.length <= 1}
                      title={
                        c.addresses.length <= 1
                          ? "Không thể xóa địa chỉ cuối cùng"
                          : undefined
                      }
                      onClick={() => setMode({ kind: "delete", id: a.id })}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
                <p>
                  <strong>{a.recipientName}</strong> · {a.recipientPhone}
                </p>
                <p>{a.addressText}</p>
                <p className={styles.muted}>{a.countryCode}</p>
              </article>
            ))}
          </section>
        </div>
      )}
      {mode?.kind === "profile" && data && (
        <CustomerDrawer
          customer={data}
          onClose={() => setMode(null)}
          onSaved={saved}
          refresh={read.refresh}
          reconciling={read.loading || !!read.error}
        />
      )}
      {mode?.kind === "add" && (
        <AddressDrawer
          id={id}
          onClose={() => setMode(null)}
          onSaved={saved}
          refresh={read.refresh}
          reconciling={read.loading || !!read.error}
        />
      )}
      {mode?.kind === "address" && target && (
        <AddressDrawer
          id={id}
          address={target}
          onClose={() => setMode(null)}
          onSaved={saved}
          refresh={read.refresh}
          reconciling={read.loading || !!read.error}
        />
      )}
      {mode?.kind === "delete" && data && target && (
        <DeleteAddressModal
          id={id}
          target={target}
          addresses={data.addresses}
          refresh={read.refresh}
          onClose={() => setMode(null)}
          onSaved={saved}
          reconciling={read.loading || !!read.error}
        />
      )}
    </div>
  );
}
