"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@nexora/ui";
import { customerApi } from "./api.ts";
import { useCustomerRead } from "./useCustomerRead.ts";
import { useCustomerMutation } from "./useCustomerMutation.ts";
import { CustomerBadge } from "./CustomerTable.tsx";
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
    <div className={styles.page}>
      <Link href="/customers">← Danh sách khách hàng</Link>
      <div className={styles.toolbar}>
        <h1 tabIndex={-1}>Chi tiết khách hàng</h1>
        <Button onClick={read.refresh}>Tải lại</Button>
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
        <>
          <section className={styles.card}>
            <div className={styles.toolbar}>
              <h2>
                {c.code} · {c.name}
              </h2>
              <Button
                disabled={mutation.busy}
                onClick={() => setMode({ kind: "profile" })}
              >
                Sửa khách hàng
              </Button>
            </div>
            <CustomerBadge status={c.status} />
            <dl className={styles.profile}>
              <dt>Điện thoại</dt>
              <dd>{c.phone}</dd>
              <dt>Email</dt>
              <dd>{c.email ?? "—"}</dd>
              <dt>Ghi chú</dt>
              <dd>{c.note ?? "Chưa có ghi chú"}</dd>
            </dl>
          </section>
          <section className={styles.card}>
            <div className={styles.toolbar}>
              <h2>Địa chỉ nhận hàng ({c.addresses.length})</h2>
              <Button
                disabled={mutation.busy}
                onClick={() => setMode({ kind: "add" })}
              >
                Thêm địa chỉ
              </Button>
            </div>
            {!c.addresses.length && (
              <p>Chưa có địa chỉ. Thêm địa chỉ thật để tiếp tục quản lý.</p>
            )}
            {!!c.addresses.length && !c.addresses.some((a) => a.isDefault) && (
              <p role="status">
                Chưa có địa chỉ mặc định. Hãy chọn rõ một địa chỉ bên dưới.
              </p>
            )}
            {c.addresses.map((a) => (
              <article className={styles.address} key={a.id}>
                <h3>
                  {a.label ?? "Địa chỉ nhận hàng"}{" "}
                  {a.isDefault && <span>· Mặc định</span>}
                </h3>
                <p>
                  {a.recipientName} · {a.recipientPhone}
                </p>
                <p>
                  {a.addressText} · {a.countryCode}
                </p>
                <div className={styles.actions}>
                  {!a.isDefault && (
                    <Button
                      disabled={mutation.busy || !!mode}
                      onClick={() =>
                        void mutation.run(
                          () => customerApi.setDefault(id, a.id),
                          saved,
                        )
                      }
                    >
                      Đặt mặc định
                    </Button>
                  )}
                  <Button
                    disabled={mutation.busy}
                    onClick={() => setMode({ kind: "address", id: a.id })}
                  >
                    Sửa địa chỉ
                  </Button>
                  <Button
                    disabled={mutation.busy || c.addresses.length <= 1}
                    title={
                      c.addresses.length <= 1
                        ? "Không thể xóa địa chỉ cuối cùng"
                        : undefined
                    }
                    onClick={() => setMode({ kind: "delete", id: a.id })}
                  >
                    Xóa địa chỉ
                  </Button>
                </div>
              </article>
            ))}
          </section>
        </>
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
          reconciling={read.loading || !!read.error}
          onClose={() => setMode(null)}
          onSaved={saved}
        />
      )}
    </div>
  );
}
