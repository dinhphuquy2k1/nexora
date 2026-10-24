"use client";
import { useState } from "react";
import { Button, Select } from "@nexora/ui";
import type { Address } from "./types.ts";
import { DrawerFrame } from "./CustomerDrawers.tsx";
import { useCustomerMutation } from "./useCustomerMutation.ts";
import { customerApi } from "./api.ts";
import { deleteCustomerAddress } from "./address-actions.ts";
import { Feedback } from "./Feedback.tsx";
import styles from "./customers.module.css";
export function DeleteAddressModal({
  id,
  target,
  addresses,
  refresh,
  onClose,
  onSaved,
  reconciling,
}: {
  id: string;
  target: Address;
  addresses: Address[];
  refresh: () => void;
  onClose: () => void;
  onSaved: () => void;
  reconciling: boolean;
}) {
  const [replacement, setReplacement] = useState("");
  const [partial, setPartial] = useState(false);
  const mutation = useCustomerMutation(refresh);
  const others = addresses.filter((a) => a.id !== target.id);
  return (
    <DrawerFrame title="Xóa địa chỉ" busy={mutation.busy} onClose={onClose}>
      <p>Bạn muốn xóa địa chỉ {target.label ?? target.addressText}?</p>
      {!others.length ? (
        <p role="alert">
          Không thể xóa địa chỉ cuối cùng. Hãy thêm địa chỉ trước.
        </p>
      ) : (
        <>
          {target.isDefault && (
            <label>
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
          )}
          {partial && (
            <p role="alert" className={styles.notice}>
              Đã chuyển mặc định. Xóa chưa được xác nhận; dữ liệu được tải lại
              trước khi thử lại. Không hoàn tác mặc định mới.
            </p>
          )}
          <Feedback error={mutation.error} />
          {reconciling && (
            <div role="status">
              <p>Chưa đối chiếu xong dữ liệu. Chưa thể thử xóa lại.</p>
              <Button disabled={mutation.busy} onClick={refresh}>
                Đối chiếu lại dữ liệu
              </Button>
            </div>
          )}
          <Button
            disabled={
              mutation.busy ||
              reconciling ||
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
                  refresh();
                  throw result.error;
                }
                if (result.kind === "failed") {
                  refresh();
                  throw result.error;
                }
                if (result.kind !== "deleted") throw Error("RECONCILE");
              }, onSaved)
            }
          >
            {mutation.busy ? "Đang xóa…" : "Xác nhận xóa"}
          </Button>
        </>
      )}
    </DrawerFrame>
  );
}
