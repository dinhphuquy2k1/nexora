"use client";
import { Button, Overlay } from "@nexora/ui";
import { RefreshCw, AlertCircle, Clock, X } from "lucide-react";
import type { SyncItem, SyncHistoryEntry } from "./types.ts";
import { UNAVAILABLE } from "./presentation.ts";
import styles from "./carrier-connections.module.css";
export type SyncInspection =
  | { kind: "progress" | "error"; item: SyncItem }
  | { kind: "history"; item: SyncHistoryEntry };
export function CarrierSyncInspection({
  inspection,
  onClose,
}: {
  inspection: SyncInspection;
  onClose: () => void;
}) {
  const { kind } = inspection;
  const title = {
    progress: "Tiến trình đồng bộ",
    error: "Chi tiết lỗi đồng bộ",
    history: "Chi tiết lượt đồng bộ",
  }[kind];
  const Icon = { progress: RefreshCw, error: AlertCircle, history: Clock }[
    kind
  ];
  let subtitle: string;
  if (inspection.kind === "history")
    subtitle = `Khởi tạo: ${inspection.item.time}`;
  else if (inspection.kind === "progress")
    subtitle = `Job ID: ${inspection.item.jobId ?? "—"}`;
  else subtitle = inspection.item.label;
  return (
    <Overlay
      open
      onDismiss={onClose}
      label={title}
      className={styles.inspectionModal}
    >
      <header className={styles.drawerHeader}>
        <span className={styles.drawerBrand} data-danger={kind === "error"}>
          <Icon size={16} />
        </span>
        <div>
          <h2>
            {title}
            {inspection.kind === "progress" ? ` ${inspection.item.label}` : ""}
            {kind === "history" ? ` #${inspection.item.id}` : ""}
          </h2>
          <p>{subtitle}</p>
        </div>
        <Button
          variant="ghost"
          icon
          className={styles.closeButton}
          aria-label={`Đóng ${title}`}
          onClick={onClose}
        >
          <X size={16} />
        </Button>
      </header>
      <div className={styles.drawerBody}>
        {inspection.kind === "progress" && (
          <>
            <div className={styles.inspectionProgress}>
              <div>
                <strong>Trạng thái: {inspection.item.detail ?? "—"}</strong>
                <span>{inspection.item.progress ?? "—"}%</span>
              </div>
              {inspection.item.progress !== undefined && (
                <progress
                  aria-label="Tiến độ job"
                  max={100}
                  value={Math.max(0, Math.min(100, inspection.item.progress))}
                />
              )}
              <div>
                <span>
                  Trang hiện tại: {inspection.item.currentPage ?? "—"} /{" "}
                  {inspection.item.totalPages ?? "—"} trang
                </span>
                <span>
                  Đã nhận: {inspection.item.processed ?? "—"} / ~
                  {inspection.item.total ?? "—"} bản ghi
                </span>
              </div>
            </div>
            <strong className={styles.logHeading}>
              Nhật ký Worker thời gian thực
            </strong>
            <pre className={styles.workerLog}>
              {inspection.item.logs?.join("\n") ?? "Chưa có nhật ký."}
            </pre>
            {inspection.item.waitingNote && (
              <p className={styles.information}>
                <Clock size={16} />
                {inspection.item.waitingNote}
              </p>
            )}
          </>
        )}
        {inspection.kind === "error" && (
          <>
            <div className={styles.syncError}>
              <strong>Mã lỗi: {inspection.item.errorCode ?? "—"}</strong>
              <p>{inspection.item.detail ?? "—"}</p>
            </div>
            <p>
              Thời gian xảy ra:{" "}
              <span className={styles.mono}>
                {inspection.item.errorTime ?? "—"}
              </span>
            </p>
            <p>
              Điểm đánh dấu (Checkpoint): {inspection.item.checkpoint ?? "—"}
            </p>
          </>
        )}
        {inspection.kind === "history" && (
          <>
            <div className={styles.historyDetailGrid}>
              {[
                { label: "Loại dữ liệu", value: inspection.item.dataType },
                { label: "Nguồn kích hoạt", value: inspection.item.source },
                { label: "Thời gian bắt đầu", value: inspection.item.time },
                {
                  label: "Số bản ghi đã nạp",
                  value:
                    inspection.item.records?.toLocaleString("vi-VN") ?? "—",
                },
              ].map((f) => (
                <div key={f.label}>
                  <small>{f.label}</small>
                  <strong>{f.value}</strong>
                </div>
              ))}
            </div>
            <section className={styles.metadataSection}>
              <small>Ghi chú vận hành</small>
              <p className={styles.information}>
                {inspection.item.detail || "—"}
              </p>
            </section>
          </>
        )}
      </div>
      <footer className={styles.drawerFooter}>
        <Button
          variant={kind === "error" ? "secondary" : "primary"}
          className={kind === "error" ? "" : styles.navyAction}
          onClick={onClose}
        >
          Đóng
        </Button>
        {kind === "error" && (
          <Button variant="emphasis" disabled title={UNAVAILABLE}>
            Thử lại ngay
          </Button>
        )}
      </footer>
    </Overlay>
  );
}
