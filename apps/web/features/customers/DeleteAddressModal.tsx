"use client";
import { useState } from "react";
import { Button, Select } from "@nexora/ui";
import { AlertTriangle } from "lucide-react";
import type { Address } from "./types.ts";
import { DrawerFrame } from "./CustomerDrawers.tsx";
import {
  useCustomerMutation,
  type SettlementTarget,
} from "./useCustomerMutation.ts";
import { customerApi } from "./api.ts";
import { deleteCustomerAddress } from "./address-actions.ts";
import { Feedback } from "./Feedback.tsx";
import styles from "./customers.module.css";
export function DeleteAddressModal({
  id,
  target,
  addresses,
  refresh,
  onDenied,
  onClose,
  onSaved,
  reconciling,
  settlement,
  writeBlocked = false,
  onUnresolved,
}: {
  id: string;
  target: Address;
  addresses: Address[];
  refresh: () => void;
  onDenied: () => void;
  onClose: () => void;
  onSaved: () => void;
  reconciling: boolean;
  settlement?: SettlementTarget;
  writeBlocked?: boolean;
  onUnresolved?: () => void;
}) {
  const [replacement, setReplacement] = useState("");
  const [partial, setPartial] = useState(false);
  const mutation = useCustomerMutation(
    settlement ?? refresh,
    onDenied,
    onUnresolved,
  );
  const others = addresses.filter((a) => a.id !== target.id);
  const isReconciling = reconciling || mutation.phase === "blocked";
  return (
    <DrawerFrame
      title="Xóa địa chỉ"
      description="Kiểm tra thông tin trước khi xác nhận."
      icon={<AlertTriangle size={20} />}
      busy={!mutation.canClose}
      onClose={onClose}
      side={false}
    >
      <div className={styles.drawerBody}>
        <div className={styles.targetSummary}>
          <strong>{target.label ?? "Địa chỉ nhận hàng"}</strong>
          <p>
            {target.recipientName} · {target.recipientPhone}
          </p>
          <p>{target.addressText}</p>
        </div>
        {!others.length ? (
          <p role="alert">
            Không thể xóa địa chỉ cuối cùng. Hãy thêm địa chỉ trước.
          </p>
        ) : (
          <>
            {target.isDefault && (
              <>
                <h3>Chuyển địa chỉ mặc định trước khi xóa</h3>
                <p className={styles.notice}>
                  Địa chỉ này đang là mặc định. Chọn rõ địa chỉ thay thế; hệ
                  thống không tự chọn cho bạn.
                </p>
                <label className={styles.fields}>
                  Chọn địa chỉ mặc định thay thế
                  <Select
                    name="replacement"
                    value={replacement}
                    disabled={mutation.busy}
                    onChange={(e) => setReplacement(e.target.value)}
                  >
                    <option value="">Chọn địa chỉ</option>
                    {others.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label ?? a.addressText}
                      </option>
                    ))}
                  </Select>
                </label>
              </>
            )}
            {!target.isDefault && (
              <p>
                Bạn có chắc muốn xóa địa chỉ này? Các địa chỉ còn lại được giữ
                nguyên.
              </p>
            )}
            {partial && (
              <p role="alert" className={styles.notice}>
                Đã chuyển mặc định. Xóa chưa được xác nhận; dữ liệu được tải lại
                trước khi thử lại. Không hoàn tác mặc định mới.
              </p>
            )}
            <Feedback error={mutation.error} />
            {isReconciling && (
              <div role="status" className={styles.notice}>
                <p>Chưa đối chiếu xong dữ liệu. Chưa thể thử xóa lại.</p>
                <Button
                  variant="secondary"
                  disabled={
                    mutation.phase === "reconciling" ||
                    (reconciling &&
                      mutation.phase === "idle" &&
                      settlement?.outcome !== "error")
                  }
                  onClick={() => {
                    if (mutation.canRetryRead) mutation.retryReconciliation();
                    else refresh();
                  }}
                >
                  Đối chiếu lại dữ liệu
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      <footer className={styles.drawerFooter}>
        <Button
          variant="secondary"
          disabled={!mutation.canClose}
          onClick={onClose}
        >
          Hủy
        </Button>
        <Button
          variant="emphasis"
          disabled={
            !others.length ||
            mutation.busy ||
            writeBlocked ||
            isReconciling ||
            (target.isDefault && !others.some((a) => a.id === replacement))
          }
          onClick={() =>
            void mutation.run(async () => {
              const result = await deleteCustomerAddress(
                customerApi,
                id,
                target,
                addresses.length,
                replacement,
              );
              if (result.kind === "partial") {
                setPartial(true);
                const partialErr =
                  result.error instanceof Error
                    ? Object.assign(result.error, { isPartial: true })
                    : Object.assign(new Error("PARTIAL_MUTATION"), {
                        isPartial: true,
                      });
                throw partialErr;
              }
              if (result.kind === "failed") {
                throw result.error;
              }
              if (result.kind !== "deleted") throw Error("RECONCILE");
            }, onSaved)
          }
        >
          {mutation.busy ? "Đang xóa…" : "Xác nhận xóa"}
        </Button>
      </footer>
    </DrawerFrame>
  );
}
