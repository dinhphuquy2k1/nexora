"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerReadLane } from "./request.ts";
import { customerError } from "./errors.ts";
import { sanitizeReturnUrl } from "../../lib/auth/sanitize.ts";
/** Feature-local list/detail reads share the same latest-generation correctness boundary. */
export function useCustomerRead<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
  enabled = true,
) {
  const lane = useRef(new CustomerReadLane());
  const latest = useRef(load);
  latest.current = load;
  const [state, setState] = useState<{
    key: string;
    data?: T;
    error?: ReturnType<typeof customerError>;
    loading: boolean;
  }>({ key, loading: true });
  const [revision, retry] = useState(0);
  const router = useRouter();
  const invalidate = useCallback(() => {
    lane.current.invalidate();
    setState({ key: "", loading: true });
  }, []);
  const refresh = useCallback(() => {
    invalidate();
    retry((n) => n + 1);
  }, [invalidate]);
  useEffect(() => {
    const current = lane.current;
    const ticket = current.begin(key);
    setState({ key, loading: enabled });
    if (enabled)
      void latest
        .current(ticket.signal)
        .then((data) => {
          if (current.current(ticket)) setState({ key, data, loading: false });
        })
        .catch((error) => {
          if (!current.current(ticket)) return;
          const safe = customerError(error);
          if (safe.unauthenticated) {
            const from = sanitizeReturnUrl(location.pathname + location.search);
            router.replace(
              from ? `/login?from=${encodeURIComponent(from)}` : "/login",
            );
          }
          setState({ key, error: safe, loading: false });
        });
    return () => current.dispose();
  }, [key, revision, enabled, router]);
  return {
    ...(state.key === key ? state : { key, loading: enabled }),
    invalidate,
    refresh,
  };
}
