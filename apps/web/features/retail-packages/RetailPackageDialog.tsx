"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Overlay } from "@nexora/ui";
import styles from "./retail-packages.module.css";
/** Retail-only return policy; native Overlay remains the modal/focus-trap authority. */
export function RetailPackageDialog({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const trigger = useRef<HTMLElement | null>(
    typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  useEffect(
    () => () => {
      queueMicrotask(() => {
        if (
          trigger.current?.isConnected &&
          trigger.current.getClientRects().length
        )
          trigger.current.focus();
        else
          document
            .querySelector<HTMLElement>("#retail-packages-heading")
            ?.focus();
      });
    },
    [],
  );
  return (
    <Overlay
      open
      side={false}
      className={styles.packageOverlay}
      label={label}
      onDismiss={onClose}
    >
      {children}
    </Overlay>
  );
}
