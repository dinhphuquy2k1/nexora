"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { customerError, CustomerApiError } from "./errors.ts";
import { DraftError } from "./payload.ts";
import { sanitizeReturnUrl } from "../../lib/auth/sanitize.ts";
export function useCustomerMutation(refresh: () => void) {
  const lock = useRef(false);
  const mounted = useRef(true);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReturnType<typeof customerError>>();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function run(operation: () => Promise<unknown>, success: () => void) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await operation();
      if (mounted.current) {
        refresh();
        success();
      }
    } catch (e) {
      if (!mounted.current) return;
      const safe =
        e instanceof DraftError
          ? {
              message:
                e.field === "unchanged"
                  ? "Chưa có thay đổi để lưu."
                  : e.message,
              field: e.field,
            }
          : customerError(e);
      setError(safe);
      if (
        e instanceof CustomerApiError &&
        (e.status === 409 || e.status === 404)
      )
        refresh();
      if (!(e instanceof DraftError) && !(e instanceof CustomerApiError))
        refresh();
      if (safe.unauthenticated) {
        const from = sanitizeReturnUrl(location.pathname + location.search);
        router.replace(
          from ? `/login?from=${encodeURIComponent(from)}` : "/login",
        );
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return { run, busy, error };
}
