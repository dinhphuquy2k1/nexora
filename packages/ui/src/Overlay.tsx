"use client";
import { useEffect, useRef, type ReactNode } from "react";
import styles from "./Overlay.module.css";
/** Native modal supplies the top layer, inert background and keyboard focus containment. */
export function Overlay({
  open,
  onDismiss,
  label,
  children,
  side = false,
}: {
  open: boolean;
  onDismiss: () => void;
  label: string;
  children: ReactNode;
  side?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      aria-modal="true"
      className={`${styles.overlay} ${side ? styles.side : ""}`}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const stops = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>(
            "a[href],button,input,select,textarea,[tabindex]",
          ),
        )
          .filter(
            (node) =>
              node.tabIndex >= 0 &&
              !node.matches(":disabled") &&
              !node.closest("[inert]") &&
              node.getClientRects().length > 0 &&
              getComputedStyle(node).visibility === "visible",
          )
          .sort((a, b) => {
            if (a.tabIndex === 0) return b.tabIndex === 0 ? 0 : 1;
            if (b.tabIndex === 0) return -1;
            return a.tabIndex - b.tabIndex;
          });
        const first = stops[0];
        const last = stops.at(-1);
        if (!first || !last) {
          e.preventDefault();
          return;
        }
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === e.currentTarget)) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (active === last || active === e.currentTarget)
        ) {
          e.preventDefault();
          first.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        onDismiss();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onDismiss();
        }
      }}
    >
      {children}
    </dialog>
  );
}
