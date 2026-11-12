"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button, type ButtonProps } from "@nexora/ui";
import { X } from "lucide-react";
import { useDismissable } from "../../lib/hooks/use-dismissable.ts";
import styles from "./FilterPopoverShell.module.css";

export interface FilterPopoverShellProps {
  trigger: ReactNode;
  triggerLabel: string;
  dialogLabel: string;
  title: ReactNode;
  children: (controls: { close: () => void }) => ReactNode;
  onDismiss?: () => void;
  triggerPressEffect?: ButtonProps["pressEffect"];
  anchorClassName?: string;
  panelClassName?: string;
  headingClassName?: string;
  initialFocusSelector?: string;
}

export function FilterPopoverShell({
  trigger,
  triggerLabel,
  dialogLabel,
  title,
  children,
  onDismiss,
  triggerPressEffect = "scale",
  anchorClassName = "",
  panelClassName = "",
  headingClassName = "",
  initialFocusSelector = "select",
}: FilterPopoverShellProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const dismiss = () => {
    setOpen(false);
    onDismiss?.();
  };
  useDismissable({ panelRef, triggerRef, isOpen: open, onClose: dismiss });
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() =>
      panelRef.current
        ?.querySelector<HTMLElement>(initialFocusSelector)
        ?.focus(),
    );
    return () => cancelAnimationFrame(raf);
  }, [open, initialFocusSelector]);
  function close() {
    dismiss();
    triggerRef.current?.focus();
  }
  return (
    <div className={`${styles.anchor} ${anchorClassName}`.trim()}>
      <Button
        ref={triggerRef}
        id={`${id}-trigger`}
        variant="secondary"
        pressEffect={triggerPressEffect}
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={`${id}-panel`}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger}
      </Button>
      {open && (
        <div
          ref={panelRef}
          id={`${id}-panel`}
          className={`${styles.panel} ${panelClassName}`.trim()}
          role="dialog"
          aria-label={dialogLabel}
        >
          <div className={`${styles.heading} ${headingClassName}`.trim()}>
            <strong>{title}</strong>
            <Button
              icon
              variant="ghost"
              aria-label="Đóng bộ lọc"
              onClick={close}
            >
              <X size={14} />
            </Button>
          </div>
          {children({ close })}
        </div>
      )}
    </div>
  );
}
