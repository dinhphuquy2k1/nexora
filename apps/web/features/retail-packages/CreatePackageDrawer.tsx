"use client";

/**
 * Create Package Drawer — M3 Presentation Component
 *
 * Implements the UI layout for creating a new retail package from the reference ZIP.
 * Reuses @nexora/ui Overlay and standard form controls.
 *
 * In accordance with M3 non-goals:
 * - Shipment backend CRUD is NOT implemented.
 * - Form submission is disabled with a truthful status message.
 * - No fake tracking codes or simulated persistent packages are created.
 */

import { useState } from "react";
import { Package, X, ShieldCheck } from "lucide-react";
import { Button, TextInput, Select, Checkbox } from "@nexora/ui";
import { RetailPackageDialog } from "./RetailPackageDialog.tsx";
import styles from "./retail-packages.module.css";

export interface CreatePackageDrawerProps {
  readonly onClose: () => void;
}

export function CreatePackageDrawer({ onClose }: CreatePackageDrawerProps) {
  const [trackingCode, setTrackingCode] = useState("");
  const [productName, setProductName] = useState("");
  const [weight, setWeight] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [originWarehouse, setOriginWarehouse] = useState("Quảng Châu");
  const [destWarehouse, setDestWarehouse] = useState("Hà Nội");
  const [hasInsurance, setHasInsurance] = useState(false);
  const [hasInspection, setHasInspection] = useState(false);
  const [hasWoodenCrate, setHasWoodenCrate] = useState(false);
  const [hasBubbleWrap, setHasBubbleWrap] = useState(false);

  return (
    <RetailPackageDialog label="Tạo mới kiện hàng TMĐT" onClose={onClose}>
      <div className={styles.modalContent}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleRow}>
            <div className={styles.modalIconBox} aria-hidden="true">
              <Package size={16} />
            </div>
            <div>
              <h2 className={styles.modalHeading}>Tạo mới kiện hàng TMĐT</h2>
              <p className={styles.modalSubheading}>
                Khai báo mã vận đơn sàn TMĐT (Taobao, 1688, Tmall, Douyin)
              </p>
            </div>
          </div>
          <Button
            icon
            variant="secondary"
            onClick={onClose}
            aria-label="Đóng biểu mẫu"
            autoFocus
          >
            <X size={16} aria-hidden="true" />
          </Button>
        </div>

        {/* Body Form */}
        <form
          className={styles.createForm}
          onSubmit={(e) => e.preventDefault()}
        >
          {/* Notice banner */}
          <div className={styles.createNotice} role="status">
            Chức năng tạo kiện lẻ mới chưa được triển khai trên máy chủ. Biểu
            mẫu này hiển thị bố cục giao diện chuẩn theo thiết kế.
          </div>

          {/* Carrier selection */}
          <div className={styles.formGroup}>
            <label htmlFor="create-carrier" className={styles.formLabel}>
              Hãng vận chuyển đối tác
            </label>
            <Select id="create-carrier" disabled defaultValue="">
              <option value="">Chưa có dữ liệu hãng vận chuyển</option>
            </Select>
            <div className={styles.carrierSyncNote}>
              <ShieldCheck
                size={14}
                className={styles.carrierSyncIcon}
                aria-hidden="true"
              />
              <span>Đồng bộ lộ trình qua API đối tác (chưa khả dụng)</span>
            </div>
          </div>

          {/* Tracking code */}
          <div className={styles.formGroup}>
            <label htmlFor="create-tracking-code" className={styles.formLabel}>
              Mã vận đơn đối tác (Bắt buộc) *
            </label>
            <TextInput
              id="create-tracking-code"
              type="text"
              required
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value)}
              placeholder="Ví dụ: SF294810293, JT77381920, NXR8819201..."
            />
          </div>

          {/* Product name */}
          <div className={styles.formGroup}>
            <label htmlFor="create-product-name" className={styles.formLabel}>
              Tên sản phẩm / Ghi chú hàng hóa
            </label>
            <TextInput
              id="create-product-name"
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Ví dụ: Áo khoác mùa đông, Tai nghe bluetooth..."
            />
          </div>

          {/* Weight & Value row */}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="create-weight" className={styles.formLabel}>
                Cân nặng ước tính (kg)
              </label>
              <TextInput
                id="create-weight"
                type="number"
                step="0.1"
                min="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="create-value" className={styles.formLabel}>
                Giá trị hàng (¥)
              </label>
              <TextInput
                id="create-value"
                type="number"
                min="0"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
              />
            </div>
          </div>

          {/* Warehouses row */}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="create-origin-wh" className={styles.formLabel}>
                Kho gửi Trung Quốc
              </label>
              <Select
                id="create-origin-wh"
                value={originWarehouse}
                onChange={(e) => setOriginWarehouse(e.target.value)}
              >
                <option value="Quảng Châu">Kho TMĐT Quảng Châu</option>
                <option value="Bằng Tường">Kho Bằng Tường</option>
                <option value="Đông Hưng">Kho Đông Hưng</option>
              </Select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="create-dest-wh" className={styles.formLabel}>
                Kho nhận tại Việt Nam
              </label>
              <Select
                id="create-dest-wh"
                value={destWarehouse}
                onChange={(e) => setDestWarehouse(e.target.value)}
              >
                <option value="Hà Nội">Kho Hà Nội (Mỹ Đình)</option>
                <option value="TP.HCM">Kho TP.HCM (Tân Bình)</option>
                <option value="Đà Nẵng">Kho Đà Nẵng (Hải Châu)</option>
              </Select>
            </div>
          </div>

          {/* Value-added services */}
          <div className={styles.formGroup}>
            <span className={styles.formLabel}>
              Dịch vụ gia tăng bảo vệ kiện hàng:
            </span>
            <div className={styles.servicesGrid}>
              <Checkbox
                checked={hasInsurance}
                onChange={(e) => setHasInsurance(e.target.checked)}
              >
                Bảo hiểm hàng hóa
              </Checkbox>
              <Checkbox
                checked={hasInspection}
                onChange={(e) => setHasInspection(e.target.checked)}
              >
                Kiểm đếm số lượng
              </Checkbox>
              <Checkbox
                checked={hasWoodenCrate}
                onChange={(e) => setHasWoodenCrate(e.target.checked)}
              >
                Đóng khung gỗ
              </Checkbox>
              <Checkbox
                checked={hasBubbleWrap}
                onChange={(e) => setHasBubbleWrap(e.target.checked)}
              >
                Bọc màng bọt khí
              </Checkbox>
            </div>
          </div>

          {/* Footer buttons */}
          <div className={styles.modalFooter}>
            <Button variant="secondary" onClick={onClose}>
              Hủy bỏ
            </Button>
            <Button
              variant="emphasis"
              type="submit"
              disabled
              title="Chức năng tạo kiện lẻ mới chưa được triển khai trên máy chủ."
            >
              Xác nhận tạo kiện
            </Button>
          </div>
        </form>
      </div>
    </RetailPackageDialog>
  );
}
