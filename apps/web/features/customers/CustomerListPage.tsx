"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button, useToast } from "@nexora/ui";
import {
  statisticsScope,
  captureStatistics,
  visibleStatistics,
  type StatisticsSnapshot,
} from "./list-statistics.ts";
import { CustomerPowerFlight } from "./power-flight.ts";
import { customerError, customerPowerFailure } from "./errors.ts";
import { sanitizeReturnUrl } from "../../lib/auth/sanitize.ts";
import { useReadNotice } from "./useReadNotice.ts";
import { CustomerStatus } from "@nexora/shared";
import { parseCustomerQuery, customerQueryString } from "./query.ts";
import type { Query, Summary } from "./types.ts";
import { customerApi } from "./api.ts";
import { useCustomerRead } from "./useCustomerRead.ts";
import { Users, Plus, FileSpreadsheet } from "lucide-react";
import { CustomerPagination } from "./CustomerPagination.tsx";
import { CustomerStatsBar } from "./CustomerStatsBar.tsx";
import { CustomerFilters } from "./CustomerFilters.tsx";
import { CustomerTable } from "./CustomerTable.tsx";
import { CustomerDrawer } from "./CustomerDrawers.tsx";
import styles from "./customers.module.css";
export function CustomerListPage({ ownerId }: { ownerId: string }) {
  const params = useSearchParams();
  const search = params.toString();
  let query: Query = { page: 1, pageSize: 10 },
    invalid = false;
  try {
    query = parseCustomerQuery(new URLSearchParams(search));
  } catch {
    invalid = true;
  }
  const key = invalid ? "invalid:" + search : customerQueryString(query);
  const read = useCustomerRead(
    key,
    (signal) => customerApi.list(query, signal),
    !invalid,
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draft, setDraft] = useState(query.q ?? "");
  const [phoneDraft, setPhoneDraft] = useState(query.phone ?? "");
  useEffect(() => {
    setPhoneDraft(query.phone ?? "");
  }, [query.phone]);
  const [statistics, setStatistics] = useState<StatisticsSnapshot>();
  const committedScope = statisticsScope(ownerId, query);
  const displayScope = statisticsScope(
    ownerId,
    { ...query, phone: phoneDraft },
    draft,
  );
  useEffect(() => {
    if (read.denied || invalid) {
      setStatistics(undefined);
      return;
    }
    if (
      read.outcome === "success" &&
      read.key === key &&
      committedScope === displayScope
    )
      setStatistics((previous) =>
        captureStatistics(
          previous,
          read.data?.stats,
          committedScope,
          read.settledId,
        ),
      );
  }, [
    read.denied,
    read.outcome,
    read.data,
    read.key,
    read.settledId,
    key,
    invalid,
    committedScope,
    displayScope,
  ]);
  const compatible = !invalid && committedScope === displayScope;
  let stats = invalid
    ? undefined
    : visibleStatistics(statistics, displayScope, read.denied);
  if (read.outcome === "success" && compatible && !read.denied)
    stats = read.data?.stats ?? undefined;
  const rows = compatible && !read.denied ? read.data?.customers : undefined;

  const [overlay, setOverlay] = useState<Summary | "create" | null>(null);
  const power = useRef(new CustomerPowerFlight());
  const powerInstance = useId();
  const mounted = useRef(true);
  const [powerState, setPowerState] = useState(power.current.snapshot());
  const toast = useToast();
  useEffect(() => {
    if (read.denied) {
      setOverlay(null);
      power.current.cancel();
      setPowerState(null);
      if (read.error?.unauthenticated || read.outcome === "idle") toast.clear();
    }
  }, [read.denied, read.error?.unauthenticated, read.outcome, toast]);
  const router = useRouter();
  useReadNotice(read);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      power.current.cancel();
    };
  }, []);
  useEffect(() => {
    if (power.current.observe(read, key))
      setPowerState(power.current.snapshot());
  }, [
    read.key,
    read.requestId,
    read.settledId,
    read.loading,
    read.outcome,
    key,
  ]);
  function cancel() {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }
  useEffect(() => {
    cancel();
    setDraft(new URLSearchParams(search).get("q") ?? "");
    const pop = () => {
      cancel();
      read.refresh();
    };
    window.addEventListener("popstate", pop);
    return () => {
      cancel();
      window.removeEventListener("popstate", pop);
    };
  }, [search, read.invalidate, read.refresh]);
  function change(patch: Partial<Query>, replace = false) {
    cancel();
    read.invalidate();
    let current: Query;
    try {
      current = parseCustomerQuery(new URLSearchParams(location.search));
    } catch {
      current = { page: 1, pageSize: 10 };
    }
    const next = { ...current, ...patch };
    const sameKey = customerQueryString(current) === customerQueryString(next);
    const url = "/customers?" + customerQueryString(next);
    if (url !== location.pathname + location.search)
      window.history[replace ? "replaceState" : "pushState"](null, "", url);
    if (sameKey) read.refresh();
  }
  function searchChange(q: string) {
    cancel();
    read.invalidate();
    setDraft(q);
    timer.current = setTimeout(
      () => change({ q: q.trim() || undefined, page: 1 }, true),
      300,
    );
  }
  function handleReload() {
    cancel();
    read.invalidate();
    const trimmedDraft = draft.trim();
    let current: Query;
    try {
      current = parseCustomerQuery(new URLSearchParams(location.search));
    } catch {
      current = { page: 1, pageSize: 10 };
    }
    const currentQ = (current.q ?? "").trim();
    const trimmedPhone = phoneDraft.trim();
    if (
      trimmedDraft !== currentQ ||
      trimmedPhone !== (current.phone ?? "").trim()
    ) {
      change(
        {
          q: trimmedDraft || undefined,
          phone: trimmedPhone || undefined,
          page: 1,
        },
        true,
      );
    } else {
      if (draft !== trimmedDraft) {
        setDraft(trimmedDraft);
      }
      read.refresh();
    }
  }
  async function handleToggleStatus(c: Summary) {
    if (read.isDenied()) return;
    const token = power.current.begin(c.id);
    if (token === null) return;
    setPowerState(power.current.snapshot());
    const nextStatus =
      c.status === CustomerStatus.ACTIVE
        ? CustomerStatus.INACTIVE
        : CustomerStatus.ACTIVE;
    try {
      await customerApi.update(c.id, { status: nextStatus });
      if (!mounted.current || !power.current.matches(token)) return;
      if (read.isDenied()) {
        power.current.reject(token);
        setPowerState(null);
        return;
      }
      toast.enqueue({
        id: `${powerInstance}-power-${token}-success`,
        tone: "success",
        message: "Đã cập nhật trạng thái khách hàng.",
      });
      power.current.reconcile(token, read.refresh());
      setPowerState(power.current.snapshot());
    } catch (error) {
      if (!mounted.current || !power.current.matches(token)) return;
      const safe = customerError(error);
      if (safe.unauthenticated) {
        read.deny();
        toast.clear();
        setOverlay(null);
        setStatistics(undefined);
        power.current.reject(token);
        const from = sanitizeReturnUrl(location.pathname + location.search);
        router.replace(
          from ? `/login?from=${encodeURIComponent(from)}` : "/login",
        );
      } else {
        const failure = customerPowerFailure(error);
        toast.enqueue({
          id: `${powerInstance}-power-${token}-error`,
          tone: "error",
          message: failure.message,
        });
        if (failure.reconcile) power.current.reconcile(token, read.refresh());
        else power.current.reject(token);
      }
      setPowerState(power.current.snapshot());
    }
  }
  const clearFilters = () => {
    setDraft("");
    setPhoneDraft("");
    change({ q: undefined, status: undefined, phone: undefined, page: 1 });
  };
  return (
    <div className={styles.listPage}>
      <section
        className={styles.commandDeck}
        aria-label="Command deck khách hàng"
      >
        <div className={styles.titleRow}>
          <div className={styles.titleGroup}>
            <span className={styles.brandIcon}>
              <Users size={18} aria-hidden="true" />
            </span>
            <h1 id="customer-heading" tabIndex={-1}>
              QUẢN LÝ KHÁCH HÀNG
            </h1>
          </div>
          <div className={styles.headerActions}>
            <Button
              variant="secondary"
              disabled
              aria-label="Xuất Excel (chưa khả dụng)"
              title="Chức năng xuất báo cáo danh sách khách hàng ra tệp Excel hiện chưa được hỗ trợ bởi hệ thống máy chủ."
              className={styles.exportButton}
            >
              <FileSpreadsheet
                size={14}
                className={styles.exportIcon}
                aria-hidden="true"
              />
              <span className={styles.exportLabel}>Xuất Excel</span>
            </Button>
            <Button
              variant="emphasis"
              onClick={() => setOverlay("create")}
              aria-label="Thêm khách hàng"
            >
              <Plus size={16} aria-hidden="true" />
              <span>THÊM KHÁCH HÀNG</span>
            </Button>
          </div>
        </div>
        <CustomerStatsBar
          stats={stats}
          stale={!!stats && (read.loading || !!read.error)}
          loading={read.loading}
          error={!!read.error}
          status={query.status}
          onChange={(status) => change({ status, page: 1 })}
        />
        <CustomerFilters
          query={query}
          draft={draft}
          phoneDraft={phoneDraft}
          onPhoneDraft={setPhoneDraft}
          onSearch={searchChange}
          onQuery={(p) => change(p)}
          onClear={() => {
            setDraft("");
            change({ q: undefined, page: 1 });
          }}
          onClearFilters={clearFilters}
          onReload={handleReload}
        />
      </section>
      {powerState?.phase === "blocked" && (
        <p className={styles.notice}>
          Thao tác đã kết thúc nhưng dữ liệu chưa đối chiếu được. Các nút trạng
          thái tạm khóa.
          <Button variant="secondary" onClick={handleReload}>
            Đối chiếu lại dữ liệu
          </Button>
        </p>
      )}
      {invalid ? (
        <section
          className={styles.dataCard}
          id="customer-results"
          role="tabpanel"
          aria-labelledby={`customer-tab-${query.status ?? "all"}`}
        >
          <div role="alert">
            <div className={styles.invalidPanel}>
              <h2>Bộ lọc URL không hợp lệ</h2>
              <p>Không gửi truy vấn mở rộng. Hãy đặt lại bộ lọc để tiếp tục.</p>
              <Button
                variant="secondary"
                onClick={() => {
                  cancel();
                  read.invalidate();
                  window.history.replaceState(null, "", "/customers");
                }}
              >
                Đặt lại bộ lọc
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <section
          className={styles.dataCard}
          id="customer-results"
          role="tabpanel"
          aria-labelledby={`customer-tab-${query.status ?? "all"}`}
        >
          <CustomerTable
            rows={rows ?? []}
            loading={read.loading}
            pendingFilter={!compatible && !read.loading}
            error={
              read.error ??
              (read.denied
                ? {
                    message:
                      "Dữ liệu đã được khóa. Đang xác minh quyền truy cập.",
                  }
                : undefined)
            }
            filtered={!!(query.q || query.status || query.phone)}
            onEdit={setOverlay}
            onToggleStatus={handleToggleStatus}
            togglingId={
              powerState && powerState.phase !== "blocked"
                ? powerState.id
                : null
            }
            powerUnavailable={
              !compatible || !!powerState || !!read.error || read.loading
            }
            onClear={clearFilters}
            onRetry={handleReload}
          />
          <CustomerPagination
            pagination={compatible ? read.data?.pagination : undefined}
            query={query}
            rowCount={rows?.length ?? 0}
            onQuery={(p) => change(p)}
            loading={read.loading}
          />
        </section>
      )}
      {overlay && !read.denied && (
        <CustomerDrawer
          customer={overlay === "create" ? undefined : overlay}
          reconciling={read.loading || !!read.error}
          onClose={() => setOverlay(null)}
          refresh={read.refresh}
          onDenied={() => {
            read.deny();
            setStatistics(undefined);
            setOverlay(null);
          }}
          onSaved={() => {
            setOverlay(null);
          }}
        />
      )}
    </div>
  );
}
