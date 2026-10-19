"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Layers,
  Search,
  Truck,
  UserRound,
} from "lucide-react";
import { useDismissable } from "../../lib/hooks/use-dismissable.ts";
import { filterGroups, CONNECTION_PRESENTATION, type Scope } from "./model.ts";
import { useShippingScope } from "./ShippingScopeProvider.tsx";
import styles from "./scope.module.css";

export function ShippingScopeSelector() {
  const { scope, metadata, label, valid, choose, retry } = useShippingScope();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const id = useId();
  useDismissable({
    panelRef,
    triggerRef,
    isOpen: open,
    onClose: () => setOpen(false),
  });
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);
  function select(next: Scope) {
    choose(next);
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }
  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (
      !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) ||
      (event.target === searchRef.current && event.key !== "ArrowDown")
    )
      return;
    const options = [
      ...(panelRef.current?.querySelectorAll<HTMLButtonElement>(
        "button[data-option]",
      ) ?? []),
    ];
    if (!options.length) return;
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? options.length - 1
          : (index + (event.key === "ArrowUp" ? -1 : 1) + options.length) %
            options.length;
    event.preventDefault();
    options[next]?.focus();
  }
  const groups =
    metadata.status === "ready" ? filterGroups(metadata.groups, query) : [];
  return (
    <div className={styles.wrapper}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${open ? styles.open : ""}`}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="dialog"
        aria-label={`Phạm vi vận chuyển: ${label}`}
        title={label}
        onClick={() => setOpen(!open)}
      >
        <span className={styles.truck}>
          <Truck size={16} aria-hidden="true" />
        </span>
        <span className={styles.ellipsis}>{label}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={panelRef}
          id={id}
          role="dialog"
          aria-label="Chọn hãng và tài khoản"
          className={styles.dropdown}
          onKeyDown={moveFocus}
        >
          <label className={styles.search}>
            <Search size={16} aria-hidden="true" />
            <input
              ref={searchRef}
              className="control"
              type="search"
              aria-label="Tìm hãng hoặc tài khoản"
              placeholder="Tìm hãng hoặc tài khoản…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className={styles.options}>
            {metadata.status === "loading" && (
              <p role="status">Đang tải kết nối…</p>
            )}
            {metadata.status === "error" && (
              <div role="alert">
                <p>Không tải được thông tin kết nối.</p>
                <button type="button" onClick={retry}>
                  Thử lại
                </button>
              </div>
            )}
            {metadata.status === "ready" && (
              <>
                {!valid && (
                  <p role="alert" className={styles.warning}>
                    Phạm vi không còn hợp lệ hoặc không có quyền truy cập. Hãy
                    chọn lại.
                  </p>
                )}
                <button
                  type="button"
                  data-option
                  aria-pressed={scope.type === "all"}
                  className={styles.option}
                  onClick={() => select({ type: "all" })}
                >
                  <Layers size={17} aria-hidden="true" />
                  <span>Tất cả hãng</span>
                  {scope.type === "all" && (
                    <Check size={16} aria-hidden="true" />
                  )}
                </button>
                {metadata.groups.every((g) => !g.connections.length) && (
                  <p>Chưa có kết nối tài khoản.</p>
                )}
                {groups.map((group) => {
                  const expanded =
                    query.trim() !== "" || !collapsed.includes(group.provider);
                  const selected =
                    scope.type === "provider" &&
                    scope.provider === group.provider;
                  return (
                    <section
                      key={group.provider}
                      className={styles.group}
                      aria-label={group.displayName}
                    >
                      <div className={styles.groupRow}>
                        <button
                          type="button"
                          data-option
                          className={styles.option}
                          aria-pressed={selected}
                          onClick={() =>
                            select({
                              type: "provider",
                              provider: group.provider,
                            })
                          }
                        >
                          <span className={styles.monogram}>
                            {group.displayName.slice(0, 2).toUpperCase()}
                          </span>
                          <span className={styles.ellipsis}>
                            {group.displayName}
                          </span>
                          <small>{group.connections.length} tài khoản</small>
                          {selected && <Check size={16} aria-hidden="true" />}
                        </button>
                        <button
                          type="button"
                          className={styles.expand}
                          aria-label={`${expanded ? "Thu gọn" : "Mở rộng"} ${group.displayName}`}
                          aria-expanded={expanded}
                          onClick={() =>
                            setCollapsed((old) =>
                              old.includes(group.provider)
                                ? old.filter((p) => p !== group.provider)
                                : [...old, group.provider],
                            )
                          }
                        >
                          <ChevronRight
                            size={16}
                            style={{
                              transform: expanded ? "rotate(90deg)" : undefined,
                            }}
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                      {expanded && (
                        <div className={styles.accounts}>
                          {group.connections.map((connection) => {
                            const selected =
                              scope.type === "connection" &&
                              scope.provider === connection.provider &&
                              scope.id === connection.id;
                            return (
                              <button
                                key={connection.id}
                                type="button"
                                data-option
                                aria-pressed={selected}
                                className={styles.option}
                                title={`${connection.displayName} · ${connection.id}`}
                                aria-label={`${connection.displayName} · ${connection.id}`}
                                onClick={() =>
                                  select({
                                    type: "connection",
                                    provider: connection.provider,
                                    id: connection.id,
                                  })
                                }
                              >
                                <UserRound size={15} aria-hidden="true" />
                                <span className={styles.ellipsis}>
                                  {connection.displayName}
                                </span>
                                {group.connections.filter(
                                  (c) =>
                                    c.displayName === connection.displayName,
                                ).length > 1 && (
                                  <small aria-hidden="true">
                                    {connection.id.slice(0, 8)}
                                  </small>
                                )}
                                {CONNECTION_PRESENTATION[connection.status]
                                  .needsAttention && (
                                  <small className={styles.warning}>
                                    {
                                      CONNECTION_PRESENTATION[connection.status]
                                        .label
                                    }
                                  </small>
                                )}
                                {selected && (
                                  <Check size={16} aria-hidden="true" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
                {!groups.length && query && (
                  <p>Không tìm thấy hãng hoặc tài khoản phù hợp.</p>
                )}
                <button
                  type="button"
                  className={styles.refresh}
                  onClick={retry}
                >
                  Cập nhật kết nối
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
