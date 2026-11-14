"use client";
import { Truck, X, Clock } from "lucide-react";
import { Button } from "@nexora/ui";
import { PackageFeeSection } from "./PackageFeeSection.tsx";
import { RetailPackageDialog } from "./RetailPackageDialog.tsx";
import { shipmentApi, type ShipmentApi } from "./api.ts";
import { useShipmentDetail } from "./useShipmentRead.ts";
import { toRetailRow } from "./row.ts";
import { formatDate, formatMoney } from "./format.ts";
import {
  stageLabel,
  MILESTONE_ORDER,
  MILESTONE_LABELS,
} from "./presentation.ts";
import styles from "./retail-packages.module.css";
export interface PackageDetailDrawerProps {
  readonly id: string;
  readonly api?: ShipmentApi;
  readonly onClose: () => void;
}
export function PackageDetailDrawer({
  id,
  api = shipmentApi,
  onClose,
}: PackageDetailDrawerProps) {
  const read = useShipmentDetail(id, api),
    data = read.data;
  const row = data ? toRetailRow(data.shipment) : null;
  return (
    <RetailPackageDialog
      label={
        row
          ? `Chi tiết lộ trình kiện hàng ${row.trackingCode}`
          : "Chi tiết kiện hàng"
      }
      onClose={onClose}
    >
      <div className={styles.modalContent} data-detail-state={read.status}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleRow}>
            <div className={styles.modalIconBox} aria-hidden="true">
              <Truck size={16} />
            </div>
            <div>
              <h2 className={styles.modalHeading}>
                <span>Lộ trình kiện hàng: {row?.trackingCode ?? "—"}</span>
                <span className={styles.modalTrackingBadge}>
                  {row?.weightKg ?? "—"} kg
                </span>
              </h2>
              <p className={styles.modalSubheading}>
                {row?.productName ?? "—"}
              </p>
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
        <div className={styles.modalBody}>
          {read.loading && <p role="status">Đang tải chi tiết kiện hàng…</p>}
          {read.error && (
            <p role="alert">
              {read.error.message}{" "}
              <Button variant="secondary" onClick={read.refresh}>
                Thử lại
              </Button>
            </p>
          )}
          {data && row && (
            <>
              <div className={styles.summaryStrip}>
                <div className={styles.summaryCol}>
                  <span className={styles.summaryLabel}>Trạng thái</span>
                  <span className={styles.summaryVal}>{row.statusText}</span>
                </div>
                <div className={styles.summaryCol}>
                  <span className={styles.summaryLabel}>Cân nặng</span>
                  <span className={styles.summaryVal}>{row.weightKg} kg</span>
                </div>
                <div className={styles.summaryCol}>
                  <span className={styles.summaryLabel}>Giá trị hàng</span>
                  <span className={styles.summaryVal}>{row.valueCNY}</span>
                </div>
                <div className={styles.summaryCol}>
                  <span className={styles.summaryLabel}>Tổng cước phí</span>
                  <span
                    className={`${styles.summaryVal} ${styles.summaryValHighlight}`}
                  >
                    {row.totalAmountVND.replace(/đ$/, " đ")}
                  </span>
                </div>
              </div>
              <div className={styles.warehouseBox}>
                <div>
                  <strong>Kho gửi TQ:</strong> {row.originWarehouseName}
                </div>
                <div>
                  <strong>Kho nhận VN:</strong> {row.destWarehouseName}
                </div>
              </div>
              <div className={styles.carrierCard}>
                <div className={styles.carrierLeft}>
                  <div className={styles.carrierBadge} aria-hidden="true">
                    —
                  </div>
                  <div>
                    <div className={styles.carrierTitle}>
                      <span>{row.carrierLabel}</span>
                    </div>
                    <div className={styles.carrierSub}>
                      Gói cước:{" "}
                      <strong>{data.shipment.serviceLevel ?? "—"}</strong>
                    </div>
                  </div>
                </div>
              </div>
              <PackageFeeSection shipment={data.shipment} />
              <section className={styles.timelineSection} aria-label="Mốc kho">
                <h3 className={styles.timelineHeading}>Mốc kho</h3>
                <div className={styles.timelineList}>
                  {MILESTONE_ORDER.map((code) => {
                    const m = data.shipment.milestones.find(
                      (m) => m.milestoneCode === code,
                    );
                    return (
                      <div key={code} className={styles.timelineItem}>
                        <div
                          className={`${styles.timelineDot} ${m ? styles.timelineDotCompleted : styles.timelineDotPending}`}
                          aria-hidden="true"
                        />
                        <div className={styles.timelineItemContent}>
                          <div className={styles.timelineItemHeader}>
                            <span className={styles.timelineItemTitle}>
                              {MILESTONE_LABELS[code]}
                            </span>
                            <span className={styles.timelineItemTime}>
                              {formatDate(m?.occurredAt ?? null, true)}
                            </span>
                          </div>
                          <p className={styles.timelineItemDesc}>
                            {m?.locationName ?? "—"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
              <section className={styles.timelineSection} aria-label="Hàng hóa">
                <h3 className={styles.timelineHeading}>Hàng hóa</h3>
                <div className={styles.timelineList}>
                  {[...data.shipment.items]
                    .sort((a, b) => a.lineNo - b.lineNo)
                    .map((item) => (
                      <div className={styles.timelineItem} key={item.id}>
                        <div className={styles.timelineItemContent}>
                          <div className={styles.timelineItemHeader}>
                            <span className={styles.timelineItemTitle}>
                              {item.name}
                            </span>
                            <span className={styles.timelineItemTime}>
                              {formatMoney(item.unitValue, item.currency)}
                            </span>
                          </div>
                          <p className={styles.timelineItemDesc}>
                            Số lượng: {item.quantity ?? "—"}
                          </p>
                        </div>
                      </div>
                    ))}
                  {data.shipment.items.length === 0 && (
                    <p>Chưa có dữ liệu hàng hóa.</p>
                  )}
                </div>
              </section>
              <div className={styles.timelineSection}>
                <h3 className={styles.timelineHeading}>
                  <Clock size={14} aria-hidden="true" />
                  <span>Tiến trình vận chuyển</span>
                </h3>
                <div className={styles.timelineList}>
                  {data.history.history.map((step, index) => (
                    <div key={step.id} className={styles.timelineItem}>
                      <div
                        className={`${styles.timelineDot} ${styles.timelineDotCompleted}`}
                        aria-hidden="true"
                      />
                      <div className={styles.timelineItemContent}>
                        <div className={styles.timelineItemHeader}>
                          <span
                            className={`${styles.timelineItemTitle} ${index === 0 ? styles.timelineItemCurrent : ""}`}
                          >
                            {stageLabel(step.toStage)}
                          </span>
                          <span className={styles.timelineItemTime}>
                            {formatDate(step.observedAt, true)}
                          </span>
                        </div>
                        <p className={styles.timelineItemDesc}>
                          {step.providerChangedAt
                            ? `Hãng ghi nhận: ${formatDate(step.providerChangedAt, true)}`
                            : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                  {data.history.history.length === 0 && (
                    <p>Chưa có lịch sử chuyển chặng.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        <div className={styles.modalFooter}>
          <Button variant="secondary" onClick={onClose}>
            Đóng chi tiết
          </Button>
        </div>
      </div>
    </RetailPackageDialog>
  );
}
