"use client";
import { useEffect, useRef, useState } from "react";
import {
  JOB_ISSUE_PAGE_SIZE,
  SyncApiError,
  type JobDetailReader,
  type SyncJobDetail,
} from "./sync-api.ts";
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
  connectionId,
  jobDetail,
  onUnauthorized,
}: {
  inspection: SyncInspection;
  connectionId?: string;
  jobDetail?: JobDetailReader;
  onUnauthorized?: () => void;
  onClose: () => void;
}) {
  const jobId =
    inspection.kind === "history" ? inspection.item.id : inspection.item.jobId;
  const key = connectionId && jobId ? connectionId + ":" + jobId : null;
  const generation = useRef(0);
  const [pagination, setPagination] = useState({ key, page: 1 });
  const page = pagination.key === key ? pagination.page : 1;
  const [revision, setRevision] = useState(0);
  const [read, setRead] = useState<{
    key: string;
    page: number;
    data?: SyncJobDetail;
    error?: number;
  }>();
  const visible = read?.key === key && read.page === page ? read : undefined;
  useEffect(() => {
    const abort = new AbortController(),
      version = ++generation.current;
    if (jobDetail && key && jobId) {
      setRead({ key, page });
      void jobDetail(jobId, page, abort.signal)
        .then((data) => {
          if (abort.signal.aborted || version !== generation.current) return;
          const last = Math.max(
            1,
            Math.ceil(data.issueTotal / JOB_ISSUE_PAGE_SIZE),
          );
          if (page > last) {
            setPagination({ key, page: last });
            return;
          }
          setRead({ key, page, data });
        })
        .catch((error) => {
          if (abort.signal.aborted || version !== generation.current) return;
          const status = error instanceof SyncApiError ? error.status : 500;
          setRead({ key, page, error: status });
          if (status === 401) onUnauthorized?.();
        });
    }
    return () => {
      generation.current++;
      abort.abort();
    };
  }, [jobDetail, key, jobId, page, revision, onUnauthorized]);
  let readError = "Không thể tải chi tiết job. Hãy thử lại.";
  if (visible?.error === 403)
    readError = "Bạn không có quyền xem chi tiết job này.";
  else if (visible?.error === 404)
    readError = "Không tìm thấy job trong kết nối này.";
  else if (visible?.error === 401) readError = "Phiên đăng nhập đã kết thúc.";
  let previewLogs: readonly string[] | undefined;
  if (!jobDetail && inspection.kind === "progress")
    previewLogs = inspection.item.logs;
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
            {previewLogs && previewLogs.length > 0 && (
              <>
                <strong className={styles.logHeading}>
                  Nhật ký Worker thời gian thực
                </strong>
                <pre className={styles.workerLog}>{previewLogs.join("\n")}</pre>
              </>
            )}
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
        {jobDetail && key && (
          <section
            className={styles.metadataSection}
            aria-label="Bản ghi cần kiểm tra"
            aria-busy={!visible?.data && !visible?.error}
          >
            <strong className={styles.logHeading}>
              Bản ghi cần kiểm tra
              {visible?.data ? ` (${visible.data.issueTotal})` : ""}
            </strong>
            {!visible?.data && !visible?.error && (
              <p role="status">Đang tải chi tiết job…</p>
            )}
            {visible?.error && (
              <div role="alert">
                <p>{readError}</p>
                <Button
                  variant="secondary"
                  onClick={() => setRevision((v) => v + 1)}
                >
                  Thử lại chi tiết
                </Button>
              </div>
            )}
            {visible?.data && (
              <>
                {visible.data.issues.length === 0 && (
                  <p role="status">Không có bản ghi cần kiểm tra.</p>
                )}
                {visible.data.issues.map((issue) => (
                  <article
                    key={issue.id}
                    className={styles.metadataSection}
                    data-sync-issue={issue.id}
                  >
                    <div className={styles.metadataGrid}>
                      {[
                        { label: "Source ID", value: issue.sourceId },
                        { label: "Source Version", value: issue.sourceVersion },
                        {
                          label: "Processor Version",
                          value: issue.processorVersion,
                        },
                        { label: "Outcome", value: issue.outcome },
                        { label: "Error Code", value: issue.errorCode ?? "—" },
                      ].map((field) => (
                        <div key={field.label}>
                          <small>{field.label}</small>
                          <strong className={styles.mono}>{field.value}</strong>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
                {visible.data.issueTotal > JOB_ISSUE_PAGE_SIZE && (
                  <nav
                    className={styles.pageButtons}
                    aria-label="Phân trang bản ghi lỗi"
                  >
                    <Button
                      variant="secondary"
                      aria-label="Trang lỗi trước"
                      disabled={page === 1}
                      onClick={() => setPagination({ key, page: page - 1 })}
                    >
                      Trước
                    </Button>
                    <span>
                      Trang {page} /{" "}
                      {Math.max(
                        1,
                        Math.ceil(
                          visible.data.issueTotal / JOB_ISSUE_PAGE_SIZE,
                        ),
                      )}
                    </span>
                    <Button
                      variant="secondary"
                      aria-label="Trang lỗi sau"
                      disabled={
                        page * JOB_ISSUE_PAGE_SIZE >= visible.data.issueTotal
                      }
                      onClick={() => setPagination({ key, page: page + 1 })}
                    >
                      Sau
                    </Button>
                  </nav>
                )}
              </>
            )}
          </section>
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
