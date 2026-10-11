import { useEffect, useRef, type RefObject } from "react";

export interface UseDismissableOptions {
  panelRef: RefObject<HTMLElement | null>;
  triggerRef?: RefObject<HTMLElement | null>;
  isOpen?: boolean;
  onClose: () => void;
}

export function useDismissable({
  panelRef,
  triggerRef,
  isOpen = true,
  onClose,
}: UseDismissableOptions): void {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target) return;

      // Ignore clicks on trigger so trigger's onClick can toggle state
      if (triggerRef?.current && triggerRef.current.contains(target)) {
        return;
      }

      // Close if clicked outside the panel without stealing target's focus
      if (panelRef.current && !panelRef.current.contains(target)) {
        onCloseRef.current();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        triggerRef?.current?.focus();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, panelRef, triggerRef]);
}
