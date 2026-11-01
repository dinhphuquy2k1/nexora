"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@nexora/ui";
import {
  RefreshCw,
  ChevronDown,
  Eye,
  Zap,
  Activity,
  Pencil,
  Trash2,
} from "lucide-react";
import { useDismissable } from "../../lib/hooks/use-dismissable.ts";
import { UNAVAILABLE } from "./presentation.ts";
import type { CarrierConnectionRow } from "./types.ts";
import styles from "./carrier-connections.module.css";
export type RowAction = "detail" | "edit" | "sync" | "disconnect";
export function CarrierRowActions({
  row,
  onAction,
}: {
  row: CarrierConnectionRow;
  onAction: (action: RowAction, row: CarrierConnectionRow) => void;
}) {
  const [open, setOpen] = useState(false),
    [position, setPosition] = useState({ left: 0, top: 0 });
  const panelRef = useRef<HTMLDivElement>(null),
    triggerRef = useRef<HTMLButtonElement>(null);
  useDismissable({
    panelRef,
    triggerRef,
    isOpen: open,
    onClose: () => setOpen(false),
  });
  useLayoutEffect(() => {
    if (!open) return;
    const r = triggerRef.current!.getBoundingClientRect();
    const height = panelRef.current?.offsetHeight ?? 264;
    setPosition({
      left: Math.max(8, Math.min(innerWidth - 228, r.right - 220)),
      top:
        r.bottom + height + 8 < innerHeight
          ? r.bottom + 4
          : Math.max(8, r.top - height - 4),
    });
    panelRef.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, [open]);
  function choose(action: RowAction) {
    setOpen(false);
    triggerRef.current?.focus();
    onAction(action, row);
  }
  return (
    <div className={styles.splitButton} data-carrier-split>
      <Button
        variant="ghost"
        pressEffect="none"
        aria-label={`Chi tiết đồng bộ ${row.displayName}`}
        onClick={() => choose("sync")}
      >
        <RefreshCw size={14} />
        Chi tiết đồng bộ
      </Button>
      <span aria-hidden="true" />
      <Button
        ref={triggerRef}
        variant="ghost"
        pressEffect="none"
        icon
        aria-label={`Thao tác tài khoản ${row.displayName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <ChevronDown size={14} />
      </Button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            aria-label={`Thao tác ${row.displayName}`}
            className={styles.rowMenu}
            style={position}
            onKeyDown={(e) => {
              const buttons = [
                ...e.currentTarget.querySelectorAll<HTMLButtonElement>(
                  "button:not(:disabled)",
                ),
              ];
              const index = buttons.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              let next: number | undefined;
              if (e.key === "ArrowDown") next = (index + 1) % buttons.length;
              if (e.key === "ArrowUp")
                next = (index + buttons.length - 1) % buttons.length;
              if (e.key === "Home") next = 0;
              if (e.key === "End") next = buttons.length - 1;
              if (next !== undefined) {
                e.preventDefault();
                buttons[next]?.focus();
              }
              if (e.key === "Tab") setOpen(false);
            }}
          >
            <Button
              role="menuitem"
              variant="ghost"
              onClick={() => choose("sync")}
            >
              <RefreshCw size={14} />
              Chi tiết đồng bộ
            </Button>
            <Button
              role="menuitem"
              variant="ghost"
              disabled
              title={UNAVAILABLE}
            >
              <Zap size={14} />
              Đồng bộ thủ công ngay
            </Button>
            <Button
              role="menuitem"
              variant="ghost"
              disabled
              title={UNAVAILABLE}
            >
              <Activity size={14} />
              Kiểm tra kết nối
            </Button>
            <Button
              role="menuitem"
              variant="ghost"
              onClick={() => choose("detail")}
            >
              <Eye size={14} />
              Chi tiết tài khoản
            </Button>
            <Button
              role="menuitem"
              variant="ghost"
              onClick={() => choose("edit")}
            >
              <Pencil size={14} />
              Chỉnh sửa tài khoản
            </Button>
            <div className={styles.menuDivider} />
            <Button
              role="menuitem"
              variant="ghost"
              className={styles.dangerText}
              onClick={() => choose("disconnect")}
            >
              <Trash2 size={14} />
              Ngắt kết nối
            </Button>
          </div>,
          document.body,
        )}
    </div>
  );
}
