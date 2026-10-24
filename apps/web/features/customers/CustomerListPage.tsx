"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Select } from "@nexora/ui";
import { parseCustomerQuery, customerQueryString } from "./query.ts";
import type { Query, Summary } from "./types.ts";
import { customerApi } from "./api.ts";
import { useCustomerRead } from "./useCustomerRead.ts";
import { CustomerStatsBar } from "./CustomerStatsBar.tsx";
import { CustomerFilters } from "./CustomerFilters.tsx";
import { CustomerTable } from "./CustomerTable.tsx";
import { CustomerDrawer } from "./CustomerDrawers.tsx";
import { Feedback } from "./Feedback.tsx";
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
  const page = read.data?.pagination;
  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div>
          <p className={styles.eyebrow}>KHÁCH HÀNG</p>
          <h1 tabIndex={-1}>Quản lý khách hàng</h1>
        </div>
        <Button onClick={() => setOverlay("create")}>Thêm khách hàng</Button>
      </div>
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}
      {invalid ? (
        <section role="alert">
          <p>Bộ lọc URL không hợp lệ. Không gửi truy vấn mở rộng.</p>
          <Button
            onClick={() => {
              cancel();
              read.invalidate();
              window.history.replaceState(null, "", "/customers");
            }}
          >
            Đặt lại bộ lọc
          </Button>
        </section>
      ) : (
        <>
          <CustomerStatsBar
            stats={read.data?.stats}
            loading={read.loading}
            error={!!read.error}
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
          />
          <div className={styles.toolbar}>
            <Button
              onClick={() => {
                cancel();
                read.refresh();
              }}
            >
              Tải lại
            </Button>
            <label>
              Số dòng
              <Select
                aria-label="Số dòng mỗi trang"
                value={query.pageSize}
                onChange={(e) =>
                  change({ pageSize: Number(e.target.value), page: 1 })
                }
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <Feedback error={read.error} />
          {read.loading ? (
            <p role="status">Đang tải khách hàng…</p>
          ) : (
            read.data && (
              <>
                {read.data.customers.length ? (
                  <CustomerTable
                    rows={read.data.customers}
                    onEdit={setOverlay}
                  />
                ) : (
                  <p>Không có khách hàng phù hợp.</p>
                )}
                <nav
                  aria-label="Phân trang khách hàng"
                  className={styles.actions}
                >
                  <Button
                    disabled={query.page <= 1}
                    onClick={() => change({ page: query.page - 1 })}
                  >
                    Trang trước
                  </Button>
                  <span>
                    Trang {page?.page} / {Math.max(1, page?.totalPages ?? 0)} ·{" "}
                    {page?.total ?? 0} kết quả
                  </span>
                  <Button
                    disabled={!page || query.page >= page.totalPages}
                    onClick={() => change({ page: query.page + 1 })}
                  >
                    Trang sau
                  </Button>
                </nav>
              </>
            )
          )}
        </>
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
