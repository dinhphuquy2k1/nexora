"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@nexora/ui";
import { customerError, CustomerApiError } from "./errors.ts";
import { DraftError } from "./payload.ts";
import { sanitizeReturnUrl } from "../../lib/auth/sanitize.ts";
export function useCustomerMutation(refresh: () => void, onDenied: () => void) {
  const lock = useRef(false),
    mounted = useRef(true),
    sequence = useRef(0);
  const instance = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<
    ReturnType<typeof customerError> & { announced?: boolean }
  >();
  const router = useRouter();
  const toast = useToast();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function run(operation: () => Promise<unknown>, success: () => void) {
    if (lock.current) return;
    lock.current = true;
    const id = ++sequence.current;
    setBusy(true);
    setError(undefined);
    try {
      try {
        await operation();
      } catch (e) {
        if (!mounted.current) return;
        const local = e instanceof DraftError;
        const safe = local
          ? {
              message:
                e.field === "unchanged"
                  ? "Chưa có thay đổi để lưu."
                  : e.message,
              field: e.field,
            }
          : customerError(e);
        const announce = !local && !safe.unauthenticated;
        setError({ ...safe, announced: announce });
        if (announce)
          toast.enqueue({
            id: `${instance}-write-${id}`,
            tone: "error",
            message: safe.message,
          });
        if (
          (e instanceof CustomerApiError &&
            (e.status === 403 ||
              e.status === 409 ||
              e.status === 404 ||
              e.status >= 500)) ||
          (!local && !(e instanceof CustomerApiError))
        )
          refresh();
        if (safe.unauthenticated) {
          onDenied();
          toast.clear();
          const from = sanitizeReturnUrl(location.pathname + location.search);
          router.replace(
            from ? `/login?from=${encodeURIComponent(from)}` : "/login",
          );
        }
        return;
      }
      if (!mounted.current) return;
      toast.enqueue({
        id: `${instance}-write-${id}`,
        tone: "success",
        message: "Đã lưu thay đổi.",
      });
      // The write is confirmed. Scheduling/read failure cannot relabel it as a failed mutation.
      try {
        refresh();
        success();
      } catch {
        toast.enqueue({
          id: `${instance}-reconcile-${id}`,
          tone: "error",
          message:
            "Đã lưu thay đổi nhưng chưa thể đối chiếu dữ liệu. Hãy tải lại.",
        });
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return { run, busy, error };
}
