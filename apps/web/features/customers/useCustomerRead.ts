"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerReadLane } from "./request.ts";
import { customerError, CustomerApiError } from "./errors.ts";
import {
  beginRead,
  acceptRead,
  rejectRead,
  type ReadState,
} from "./read-state.ts";
import { sanitizeReturnUrl } from "../../lib/auth/sanitize.ts";
/** Generic keyed result retention; Customer statistics stay at the List composition. */
export function useCustomerRead<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
  enabled = true,
) {
  const lane = useRef(new CustomerReadLane());
  const latest = useRef(load);
  latest.current = load;
  const currentKey = useRef(key);
  currentKey.current = key;
  const sequence = useRef(0);
  const intent = useRef<{ id: number; key: string } | null>(null);
  const [state, setState] = useState<
    ReadState<T, ReturnType<typeof customerError>>
  >({
    key,
    loading: enabled,
    requestId: 0,
    settledId: 0,
    denied: false,
    outcome: "pending",
  });
  const [revision, retry] = useState(0);
  const router = useRouter();
  const invalidate = useCallback(() => {
    lane.current.invalidate();
    const id = ++sequence.current;
    const nextKey = currentKey.current;
    intent.current = { id, key: nextKey };
    setState((previous) => beginRead(previous, nextKey, id));
    return id;
  }, []);
  const refresh = useCallback(() => {
    const id = invalidate();
    retry((n) => n + 1);
    return id;
  }, [invalidate]);
  useEffect(() => {
    const current = lane.current;
    const ticket = current.begin(key);
    const pending = intent.current;
    intent.current = null;
    const requestId = pending?.key === key ? pending.id : ++sequence.current;
    setState((previous) => ({
      ...beginRead(previous, key, requestId),
      loading: enabled,
      outcome: enabled ? "pending" : "idle",
    }));
    if (enabled)
      void latest
        .current(ticket.signal)
        .then((data) => {
          if (current.current(ticket))
            setState((previous) => acceptRead(previous, key, requestId, data));
        })
        .catch((error) => {
          if (!current.current(ticket)) return;
          const safe = customerError(error);
          const denied =
            error instanceof CustomerApiError &&
            (error.status === 401 || error.status === 403);
          setState((previous) =>
            rejectRead(previous, key, requestId, safe, denied),
          );
          if (safe.unauthenticated) {
            const from = sanitizeReturnUrl(location.pathname + location.search);
            router.replace(
              from ? `/login?from=${encodeURIComponent(from)}` : "/login",
            );
          }
        });
    return () => current.dispose();
  }, [key, revision, enabled, router]);
  const visible =
    state.key === key ? state : beginRead(state, key, state.requestId);
  return {
    ...visible,
    loading: enabled && visible.loading,
    data: enabled ? visible.data : undefined,
    invalidate,
    refresh,
  };
}
