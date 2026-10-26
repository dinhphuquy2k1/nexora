"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "./Controls";
import { enqueueToast, dismissToast, type ToastMessage } from "./toast-state";
import styles from "./Toast.module.css";
type ToastApi = {
  enqueue: (message: ToastMessage) => void;
  dismiss: (id: string) => void;
  clear: () => void;
};
type ToastContextValue = ToastApi & {
  queue: readonly ToastMessage[];
  activeViewport: string;
  register: (id: string) => () => void;
};
const Context = createContext<ToastContextValue | null>(null);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<readonly ToastMessage[]>([]);
  const [modals, setModals] = useState<string[]>([]);
  const enqueue = useCallback(
    (message: ToastMessage) =>
      setQueue((current) => enqueueToast(current, message)),
    [],
  );
  const dismiss = useCallback(
    (id: string) => setQueue((current) => dismissToast(current, id)),
    [],
  );
  const clear = useCallback(() => setQueue([]), []);
  const register = useCallback((id: string) => {
    setModals((current) => [...current.filter((value) => value !== id), id]);
    return () =>
      setModals((current) => current.filter((value) => value !== id));
  }, []);
  const value = useMemo(
    () => ({
      queue,
      enqueue,
      dismiss,
      clear,
      register,
      activeViewport: modals.at(-1) ?? "workspace",
    }),
    [queue, enqueue, dismiss, clear, register, modals],
  );
  return (
    <Context.Provider value={value}>
      {children}
      <ToastViewport viewportId="workspace" />
    </Context.Provider>
  );
}
export function useToast(): ToastApi {
  const context = useContext(Context);
  if (!context) throw Error("ToastProvider is required");
  return useMemo(
    () => ({
      enqueue: context.enqueue,
      dismiss: context.dismiss,
      clear: context.clear,
    }),
    [context.enqueue, context.dismiss, context.clear],
  );
}
/** A native modal owns its live region so notifications are not hidden behind its inert backdrop. */
export function ToastViewport({
  modal = false,
  active = true,
  viewportId,
}: {
  modal?: boolean;
  active?: boolean;
  viewportId?: string;
}) {
  const context = useContext(Context);
  const generated = useId();
  const id = viewportId ?? generated;
  const register = context?.register;
  useEffect(() => {
    if (modal && active && register) return register(id);
  }, [modal, active, register, id]);
  if (!context || context.activeViewport !== id || !active) return null;
  return (
    <div
      className={`${styles.viewport} ${modal ? styles.modal : ""}`}
      aria-label="Thông báo"
      data-toast-viewport={modal ? "modal" : "workspace"}
    >
      {context.queue.slice(0, 3).map((notification) => (
        <Toast
          key={notification.id}
          notification={notification}
          dismiss={context.dismiss}
        />
      ))}
    </div>
  );
}
export function Toast({
  notification,
  dismiss,
}: {
  notification: ToastMessage;
  dismiss: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const remaining = useRef(5000);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const change = () => setHidden(document.hidden);
    change();
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  useEffect(() => {
    if (
      notification.tone === "error" ||
      hovered ||
      focused ||
      hidden ||
      document.hidden
    )
      return;
    const start = performance.now();
    const timer = setTimeout(() => dismiss(notification.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(
        0,
        remaining.current - (performance.now() - start),
      );
    };
  }, [notification.id, notification.tone, dismiss, hovered, focused, hidden]);
  return (
    <section
      className={`${styles.toast} ${styles[notification.tone]}`}
      data-toast-id={notification.id}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={(event) => {
        setFocused(true);
        if (!event.currentTarget.contains(event.relatedTarget))
          previousFocus.current = event.relatedTarget as HTMLElement | null;
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <p
        data-toast-message="true"
        role={notification.tone === "error" ? "alert" : "status"}
      >
        {notification.message}
      </p>
      <Button
        variant="ghost"
        icon
        aria-label="Đóng thông báo"
        onClick={() => {
          dismiss(notification.id);
          queueMicrotask(() => {
            if (previousFocus.current?.isConnected)
              previousFocus.current.focus();
          });
        }}
      >
        ×
      </Button>
    </section>
  );
}
