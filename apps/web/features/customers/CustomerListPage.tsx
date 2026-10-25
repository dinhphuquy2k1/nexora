"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@nexora/ui";
import { parseCustomerQuery, customerQueryString } from "./query.ts";
import type { Query, Summary } from "./types.ts";
import { customerApi } from "./api.ts";
import { useCustomerRead } from "./useCustomerRead.ts";
import { Users, Plus } from "lucide-react";
import { CustomerPagination } from "./CustomerPagination.tsx";
import { CustomerStatsBar } from "./CustomerStatsBar.tsx";
import { CustomerFilters } from "./CustomerFilters.tsx";
import { CustomerTable } from "./CustomerTable.tsx";
import { CustomerDrawer } from "./CustomerDrawers.tsx";
import styles from "./customers.module.css";
export function CustomerListPage() {
  const params = useSearchParams();
  const search = params.toString();
  let query: Query = { page: 1, pageSize: 20 },
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
  const [overlay, setOverlay] = useState<Summary | "create" | null>(null);
  const [notice, setNotice] = useState("");
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
    setNotice("");
    let current: Query;
    try {
      current = parseCustomerQuery(new URLSearchParams(location.search));
    } catch {
      current = { page: 1, pageSize: 20 };
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
    setNotice("");
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
      current = { page: 1, pageSize: 20 };
    }
    const currentQ = (current.q ?? "").trim();
    if (trimmedDraft !== currentQ) {
      change({ q: trimmedDraft || undefined, page: 1 }, true);
    } else {
      if (draft !== trimmedDraft) {
        setDraft(trimmedDraft);
      }
      read.refresh();
    }
  }
  const clearFilters = () => {
    setDraft("");
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
          <Button
            onClick={() => setOverlay("create")}
            aria-label="Thêm khách hàng"
          >
            <Plus size={16} aria-hidden="true" />
            <span>THÊM KHÁCH HÀNG</span>
          </Button>
        </div>
        <CustomerStatsBar
          stats={read.data?.stats}
          loading={read.loading}
          error={!!read.error}
          status={query.status}
          onChange={(status) => change({ status, page: 1 })}
        />
        <CustomerFilters
          query={query}
          draft={draft}
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
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
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
            rows={read.data?.customers ?? []}
            loading={read.loading}
            error={read.error}
            filtered={!!(query.q || query.status || query.phone)}
            onEdit={setOverlay}
            onClear={clearFilters}
            onRetry={handleReload}
          />
          <CustomerPagination
            pagination={read.data?.pagination}
            query={query}
            rowCount={read.data?.customers.length ?? 0}
            onQuery={(p) => change(p)}
            loading={read.loading}
          />
        </section>
      )}
      {overlay && (
        <CustomerDrawer
          customer={overlay === "create" ? undefined : overlay}
          reconciling={read.loading || !!read.error}
          onClose={() => setOverlay(null)}
          refresh={read.refresh}
          onSaved={() => {
            setOverlay(null);
            setNotice(
              "Đã lưu khách hàng. Đang tải lại dữ liệu; nếu tải lại lỗi, dùng nút Tải lại.",
            );
          }}
        />
      )}
    </div>
  );
}
