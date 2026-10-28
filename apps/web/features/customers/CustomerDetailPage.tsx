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
import { Button, Panel, useToast } from "@nexora/ui";
import { useReadNotice } from "./useReadNotice.ts";
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
function getMonogram(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "KH";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
export function CustomerDetailPage({ id }: { id: string }) {
  const toast = useToast();
  const read = useCustomerRead(id, (signal) => customerApi.get(id, signal));
  const [writeUnresolved, setWriteUnresolved] = useState(false);
  const mutation = useCustomerMutation(read, read.deny, () =>
    setWriteUnresolved(true),
  );
  useReadNotice(read);
  const [mode, setMode] = useState<Mode | null>(null);
  const [notice, setNotice] = useState("");
  const c = read.data;
  const [retained, setRetained] = useState(c);
  useEffect(() => {
    if (c) setRetained(c);
  }, [c]);
  const data = read.denied ? undefined : (c ?? retained);
  const detailReadUnavailable =
    read.loading || !!read.error || read.denied || read.outcome !== "success";
  const mutationDisabled =
    mutation.busy || writeUnresolved || detailReadUnavailable;
  useEffect(() => {
    if (read.denied) {
      setRetained(undefined);
      setMode(null);
      if (read.error?.unauthenticated || read.outcome === "idle") toast.clear();
    }
  }, [read.denied, read.error?.unauthenticated, read.outcome, toast]);
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
    setNotice("");
  };
  return (
    <div
      className={`${styles.page} ${styles.detailPage}`}
      aria-busy={read.loading || mutation.busy}
      data-stale={!!c && (read.loading || mutation.busy || !!read.error)}
    >
      <div className={styles.toolbar}>
        <div className={`${styles.titleGroup} ${styles.detailHeading}`}>
          <Link
            className={styles.backLink}
            href="/customers"
            aria-label="Danh sách khách hàng"
            title="Quay lại danh sách khách hàng"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Quay lại danh sách</span>
          </Link>
          <span className={styles.toolbarDivider} aria-hidden="true" />
          {c && (
            <div className={styles.monogramAvatar} aria-hidden="true">
              {getMonogram(c.name)}
            </div>
          )}
          <div>
            <div className={styles.detailTitleRow}>
              <h1
                id="customer-heading"
                tabIndex={-1}
                className={styles.detailTitle}
              >
                {c?.name ?? "Chi tiết khách hàng"}
              </h1>
              {c && <span className={styles.codeBadge}>{c.code}</span>}
              {c && <CustomerBadge status={c.status} />}
            </div>
            {c && (
              <p className={styles.detailSubtitle}>
                SĐT: {c.phone} {c.email ? `· Email: ${c.email}` : ""}
              </p>
            )}
          </div>
        </div>
        <div className={styles.actions}>
          <Button
            variant="secondary"
            onClick={read.refresh}
            aria-label="Tải lại"
          >
            Tải lại
          </Button>
          {c && (
            <Button
              variant="emphasis"
              disabled={mutationDisabled}
              onClick={() => setMode({ kind: "profile" })}
            >
              <Edit3 size={15} aria-hidden="true" />
              <span>Chỉnh sửa thông tin</span>
            </Button>
          )}
        </div>
      </div>
      {writeUnresolved && (
        <div role="alert" className={styles.notice}>
          <p>
            Kết quả thao tác ghi chưa xác định. Không gửi lại thao tác; hãy kiểm
            tra dữ liệu đã tải lại.
          </p>
          <div className={styles.actions}>
            <Button
              variant="secondary"
              disabled={read.loading}
              onClick={() => {
                if (mutation.canRetryRead) mutation.retryReconciliation();
                else read.refresh();
              }}
            >
              Đối chiếu lại dữ liệu
            </Button>
            {read.outcome === "success" && !read.loading && !mode && (
              <Button
                variant="secondary"
                onClick={() => {
                  const recovered =
                    !mutation.isUnresolved ||
                    mutation.resolveUnresolved("acknowledged");
                  if (recovered) setWriteUnresolved(false);
                }}
              >
                Đã kiểm tra xong
              </Button>
            )}
          </div>
        </div>
      )}
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}
      <Feedback live={false} error={read.error} />
      <Feedback error={mutation.error} />
      {(read.loading || mutation.busy) && (
        <p role="status">Đang tải khách hàng…</p>
      )}
      {c && (
        <div className={styles.detailGrid}>
          <Panel
            density="compact"
            title={
              <span className={styles.titleGroup}>
                <span className={styles.brandIcon}>
                  <UserRound size={16} aria-hidden="true" />
                </span>
                THÔNG TIN KHÁCH HÀNG
              </span>
            }
            actions={
              <Button
                variant="ghost"
                disabled={mutationDisabled}
                onClick={() => setMode({ kind: "profile" })}
              >
                Sửa
              </Button>
            }
          >
            <dl className={styles.profile}>
              {[
                ["Mã khách hàng", c.code],
                ["Họ và tên", c.name],
                ["Số điện thoại", c.phone],
                ["Email", c.email ?? "—"],
                ["Trạng thái", c.status],
                ["Ngày đăng ký hồ sơ", customerDate(c.createdAt)],
                ["Số địa chỉ nhận hàng", `${c.addresses.length} địa chỉ`],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    {label === "Mã khách hàng" ? (
                      <span className={styles.codeText}>{value}</span>
                    ) : label === "Trạng thái" ? (
                      <CustomerBadge status={c.status} />
                    ) : (
                      value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <div className={styles.profileNote}>
              <h3>Ghi chú nội bộ</h3>
              <div className={styles.noteBox}>
                {c.note || (
                  <span className={styles.muted}>
                    Chưa có ghi chú nội bộ cho khách hàng này.
                  </span>
                )}
              </div>
            </div>
          </Panel>
          <Panel
            density="compact"
            title={
              <span className={styles.titleGroup}>
                <span className={styles.brandIcon}>
                  <MapPin size={16} aria-hidden="true" />
                </span>
                ĐỊA CHỈ NHẬN HÀNG{" "}
                <span className={styles.addressCountBadge}>
                  {c.addresses.length}
                </span>
              </span>
            }
            actions={
              <Button
                variant="emphasis"
                aria-label="Thêm địa chỉ"
                disabled={mutationDisabled}
                onClick={() => setMode({ kind: "add" })}
              >
                <Plus size={16} aria-hidden="true" />
                <span>THÊM ĐỊA CHỈ</span>
              </Button>
            }
          >
            {!c.addresses.length && (
              <div className={styles.emptyAddressState}>
                <div className={styles.emptyIconCircle}>
                  <MapPin size={24} aria-hidden="true" />
                </div>
                <h3>Khách hàng chưa có địa chỉ nhận hàng.</h3>
                <p>
                  Thêm địa chỉ giao hàng để hệ thống tự động gán vào kiện hàng
                  TMĐT và xử lý giao nhận nhanh chóng.
                </p>
                <Button
                  variant="secondary"
                  disabled={mutationDisabled}
                  onClick={() => setMode({ kind: "add" })}
                >
                  <Plus size={15} aria-hidden="true" />
                  <span>Thêm địa chỉ đầu tiên</span>
                </Button>
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
                    <MapPin size={16} aria-hidden="true" />
                    <h3>{a.label ?? "Địa chỉ nhận hàng"}</h3>
                    {a.isDefault && (
                      <span className={styles.defaultBadge}>
                        <Star
                          size={11}
                          fill="currentColor"
                          aria-hidden="true"
                        />
                        <span>MẶC ĐỊNH</span>
                      </span>
                    )}
                  </div>
                  <div className={styles.actions}>
                    {!a.isDefault && (
                      <Button
                        variant="secondary"
                        disabled={mutationDisabled || !!mode}
                        onClick={() =>
                          void mutation.run(
                            () => customerApi.setDefault(id, a.id),
                            saved,
                          )
                        }
                      >
                        <Star size={14} aria-hidden="true" />
                        <span>Đặt làm mặc định</span>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      icon
                      aria-label="Sửa địa chỉ"
                      title="Chỉnh sửa địa chỉ"
                      disabled={mutationDisabled}
                      onClick={() => setMode({ kind: "address", id: a.id })}
                    >
                      <Edit3 size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      icon
                      aria-label="Xóa địa chỉ"
                      disabled={
                        mutationDisabled || !!mode || c.addresses.length <= 1
                      }
                      title={
                        c.addresses.length <= 1
                          ? "Không thể xóa địa chỉ cuối cùng"
                          : "Xóa địa chỉ"
                      }
                      onClick={() => setMode({ kind: "delete", id: a.id })}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>
                <div className={styles.addressMeta}>
                  <strong className={styles.recipientName}>
                    {a.recipientName}
                  </strong>
                  <span>·</span>
                  <span className={styles.recipientPhone}>
                    {a.recipientPhone}
                  </span>
                </div>
                <p className={styles.addressText}>{a.addressText}</p>
                <p className={styles.addressCountry}>
                  Quốc gia: {a.countryCode}
                </p>
              </article>
            ))}
          </Panel>
        </div>
      )}
      {mode?.kind === "profile" && data && (
        <CustomerDrawer
          customer={data}
          onClose={() => setMode(null)}
          onSaved={saved}
          refresh={read.refresh}
          onDenied={read.deny}
          reconciling={read.loading || !!read.error}
          settlement={read}
          writeBlocked={writeUnresolved}
          onUnresolved={() => setWriteUnresolved(true)}
          onResolved={() => setWriteUnresolved(false)}
        />
      )}
      {mode?.kind === "add" && !read.denied && (
        <AddressDrawer
          id={id}
          onClose={() => setMode(null)}
          onSaved={saved}
          refresh={read.refresh}
          onDenied={read.deny}
          reconciling={read.loading || !!read.error}
          settlement={read}
          writeBlocked={writeUnresolved}
          onUnresolved={() => setWriteUnresolved(true)}
          onResolved={() => setWriteUnresolved(false)}
        />
      )}
      {mode?.kind === "address" && target && (
        <AddressDrawer
          id={id}
          address={target}
          onClose={() => setMode(null)}
          onSaved={saved}
          refresh={read.refresh}
          onDenied={read.deny}
          reconciling={read.loading || !!read.error}
          settlement={read}
          writeBlocked={writeUnresolved}
          onUnresolved={() => setWriteUnresolved(true)}
          onResolved={() => setWriteUnresolved(false)}
        />
      )}
      {mode?.kind === "delete" && data && target && (
        <DeleteAddressModal
          id={id}
          target={target}
          addresses={data.addresses}
          refresh={read.refresh}
          onDenied={read.deny}
          onClose={() => setMode(null)}
          onSaved={() => {
            setWriteUnresolved(false);
            saved();
          }}
          reconciling={read.loading || !!read.error}
          settlement={read}
          writeBlocked={writeUnresolved}
          onUnresolved={() => setWriteUnresolved(true)}
          onResolved={() => setWriteUnresolved(false)}
        />
      )}
    </div>
  );
}
