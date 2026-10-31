"use client";

/**
 * Package Detail Drawer — M3 Presentation Component
 *
 * Displays detailed route, warehouse locations, and tracking timeline
 * for an inspected package. Reuses @nexora/ui Overlay.
 */

import { Truck, X, Clock } from "lucide-react";
import { Button } from "@nexora/ui";
import type { RetailPackage } from "./types.ts";
import { PackageFeeSection } from "./PackageFeeSection.tsx";
import { RetailPackageDialog } from "./RetailPackageDialog.tsx";
import styles from "./retail-packages.module.css";

export interface PackageDetailDrawerProps {
  readonly pkg: RetailPackage;
  readonly onClose: () => void;
}

export function PackageDetailDrawer({
  pkg,
  onClose,
}: PackageDetailDrawerProps) {
  return (
    <RetailPackageDialog
      label={`Chi tiết lộ trình kiện hàng ${pkg.trackingCode}`}
      onClose={onClose}
    >
      <div className={styles.modalContent}>
        {/* Modal Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleRow}>
            <div className={styles.modalIconBox} aria-hidden="true">
              <Truck size={16} />
            </div>
            <div>
              <h2 className={styles.modalHeading}>
                <span>Lộ trình kiện hàng: {pkg.trackingCode}</span>
                <span className={styles.modalTrackingBadge}>
                  {pkg.weightKg} kg
                </span>
              </h2>
              <p className={styles.modalSubheading}>{pkg.productName}</p>
            </div>
          </div>
          <Button
            icon
            variant="secondary"
            onClick={onClose}
            aria-label="Đóng chi tiết"
            autoFocus
          >
            <X size={16} aria-hidden="true" />
          </Button>
        </div>

        {/* Modal Content */}
        <div className={styles.modalBody}>
          {/* Summary Strip */}
          <div className={styles.summaryStrip}>
            <div className={styles.summaryCol}>
              <span className={styles.summaryLabel}>Trạng thái</span>
              <span className={styles.summaryVal}>{pkg.statusText}</span>
            </div>
            <div className={styles.summaryCol}>
              <span className={styles.summaryLabel}>Cân nặng</span>
              <span className={styles.summaryVal}>{pkg.weightKg} kg</span>
            </div>
            <div className={styles.summaryCol}>
              <span className={styles.summaryLabel}>Giá trị hàng</span>
              <span className={styles.summaryVal}>¥{pkg.valueCNY}</span>
            </div>
            <div className={styles.summaryCol}>
              <span className={styles.summaryLabel}>Tổng cước phí</span>
              <span
                className={`${styles.summaryVal} ${styles.summaryValHighlight}`}
              >
                {typeof pkg.totalAmountVND === "number" &&
                Number.isFinite(pkg.totalAmountVND) &&
                pkg.totalAmountVND >= 0
                  ? pkg.totalAmountVND.toLocaleString("vi-VN") + " đ"
                  : "Chưa có báo giá"}
              </span>
            </div>
          </div>

          {/* Warehouses Info */}
          <div className={styles.warehouseBox}>
            <div>
              <strong>Kho gửi TQ:</strong> {pkg.originWarehouseName}
            </div>
            <div>
              <strong>Kho nhận VN:</strong> {pkg.destWarehouseName}
            </div>
          </div>

          {/* Carrier Info Card */}
          <div className={styles.carrierCard}>
            <div className={styles.carrierLeft}>
              <div className={styles.carrierBadge} aria-hidden="true">
                {pkg.carrierCode || "—"}
              </div>
              <div>
                <div className={styles.carrierTitle}>
                  <span>
                    {pkg.carrierName || "Chưa có dữ liệu hãng vận chuyển"}
                  </span>
                </div>
                <div className={styles.carrierSub}>
                  Gói cước:{" "}
                  <strong>{pkg.carrierService || "Chưa có dữ liệu"}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Fee Section */}
          <PackageFeeSection
            totalAmountVND={pkg.totalAmountVND}
            weightKg={pkg.weightKg}
            unitPriceCNY={pkg.unitPriceCNY}
            domesticShipCNY={pkg.domesticShipCNY}
          />

          {/* Progress Timeline */}
          <div className={styles.timelineSection}>
            <h3 className={styles.timelineHeading}>
              <Clock size={14} aria-hidden="true" />
              <span>Tiến trình vận chuyển</span>
            </h3>

            <div className={styles.timelineList}>
              {pkg.timeline.map((step, idx) => (
                <div key={idx} className={styles.timelineItem}>
                  <div
                    className={`${styles.timelineDot} ${
                      step.completed
                        ? styles.timelineDotCompleted
                        : styles.timelineDotPending
                    }`}
                    aria-hidden="true"
                  />
                  <div className={styles.timelineItemContent}>
                    <div className={styles.timelineItemHeader}>
                      <span
                        className={`${styles.timelineItemTitle} ${
                          step.current ? styles.timelineItemCurrent : ""
                        }`}
                      >
                        {step.title}
                      </span>
                      <span className={styles.timelineItemTime}>
                        {step.time}
                      </span>
                    </div>
                    <p className={styles.timelineItemDesc}>
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className={styles.modalFooter}>
          <Button variant="secondary" onClick={onClose}>
            Đóng chi tiết
          </Button>
        </div>
      </div>
    </RetailPackageDialog>
  );
}
