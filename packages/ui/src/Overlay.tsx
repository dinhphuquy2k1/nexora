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
