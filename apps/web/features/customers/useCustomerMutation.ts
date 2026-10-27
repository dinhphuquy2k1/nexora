"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@nexora/ui";
import { customerError, CustomerApiError } from "./errors.ts";
import { DraftError } from "./payload.ts";
import { settleMutationRead, type WriteOutcome } from "./mutation-policy.ts";
import { sanitizeReturnUrl } from "../../lib/auth/sanitize.ts";

export type MutationPhase = "idle" | "writing" | "reconciling" | "blocked";

export interface SettlementTarget {
  refresh: () => number | void;
  requestId?: number;
  settledId?: number;
  outcome?: "idle" | "pending" | "success" | "error";
  denied?: boolean;
  isDenied?: () => boolean;
}

export function useCustomerMutation(
  targetOrRefresh: SettlementTarget | (() => number | void),
  onDenied?: () => void,
  onUnresolved?: () => void,
) {
  const lock = useRef(false);
  const writeOutcome = useRef<WriteOutcome>("confirmed");
  const mounted = useRef(true);
  const sequence = useRef(0);
  const instance = useId();
  const [phase, setPhase] = useState<MutationPhase>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<
    ReturnType<typeof customerError> & { announced?: boolean }
  >();
  const targetRequestId = useRef<number | null>(null);
  const router = useRouter();
  const toast = useToast();

  const isTargetObject =
    typeof targetOrRefresh === "object" && targetOrRefresh !== null;
  const refreshFn = isTargetObject
    ? () => targetOrRefresh.refresh()
    : () => targetOrRefresh();
  const settledId = isTargetObject ? targetOrRefresh.settledId : undefined;
  const outcome = isTargetObject ? targetOrRefresh.outcome : undefined;
  const denied = isTargetObject
    ? (targetOrRefresh.denied ?? targetOrRefresh.isDenied?.() ?? false)
    : false;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (phase !== "reconciling" || targetRequestId.current === null) return;
    const target = targetRequestId.current;
    if (settledId !== undefined && settledId >= target) {
      if (outcome === "success" || outcome === "error" || denied) {
        const settled = settleMutationRead(writeOutcome.current, denied ? "denied" : outcome);
        if (settled === "idle") {
          targetRequestId.current = null;
          lock.current = false;
          setPhase("idle");
          setBusy(false);
        } else {
          setPhase("blocked");
          setBusy(true);
        }
      }
    }
  }, [phase, settledId, outcome, denied]);

  const retryReconciliation = useCallback(() => {
    if (phase !== "blocked") return;
    try {
      const reqId = refreshFn();
      if (typeof reqId === "number") {
        targetRequestId.current = reqId;
        setPhase("reconciling");
        setBusy(true);
      }
    } catch {
      // scheduled refresh error
    }
  }, [refreshFn, phase]);

  const reset = useCallback(() => {
    if (writeOutcome.current === "unknown") return;
    targetRequestId.current = null;
    lock.current = false;
    setPhase("idle");
    setBusy(false);
    setError(undefined);
  }, []);

  async function run(operation: () => Promise<unknown>, success: () => void) {
    if (lock.current || phase !== "idle") return;
    lock.current = true;
    writeOutcome.current = "confirmed";
    const id = ++sequence.current;
    setPhase("writing");
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

        if (safe.unauthenticated) {
          onDenied?.();
          toast.clear();
          const from = sanitizeReturnUrl(location.pathname + location.search);
          router.replace(
            from ? `/login?from=${encodeURIComponent(from)}` : "/login",
          );
          lock.current = false;
          setPhase("idle");
          setBusy(false);
          return;
        }

        const isAmbiguous =
          Boolean((e as { isPartial?: boolean })?.isPartial) ||
          (e instanceof CustomerApiError &&
            (e.status === 403 ||
              e.status === 409 ||
              e.status === 404 ||
              e.status >= 500)) ||
          (!local && !(e instanceof CustomerApiError));

        if (isAmbiguous) {
          writeOutcome.current = "unknown";
          onUnresolved?.();
          try {
            const reqId = refreshFn();
            if (typeof reqId === "number") {
              targetRequestId.current = reqId;
              setPhase("reconciling");
              return;
            }
          } catch {
            // failed to schedule refresh
          }
          setPhase("blocked");
          return;
        }

        lock.current = false;
        setPhase("idle");
        setBusy(false);
        return;
      }

      if (!mounted.current) return;
      writeOutcome.current = "confirmed";
      toast.enqueue({
        id: `${instance}-write-${id}`,
        tone: "success",
        message: "Đã lưu thay đổi.",
      });

      // The write is confirmed. Scheduling/read failure cannot relabel it as a failed mutation.
      try {
        success();
      } catch {
        // success handler error
      }

      try {
        const reqId = refreshFn();
        if (typeof reqId === "number") {
          targetRequestId.current = reqId;
          setPhase("reconciling");
          return;
        }
      } catch {
        toast.enqueue({
          id: `${instance}-reconcile-${id}`,
          tone: "error",
          message:
            "Đã lưu thay đổi nhưng chưa thể đối chiếu dữ liệu. Hãy tải lại.",
        });
        setPhase("blocked");
        return;
      }

      lock.current = false;
      setPhase("idle");
      setBusy(false);
    } catch {
      lock.current = false;
      setPhase("idle");
      setBusy(false);
    }
  }

  return {
    run,
    busy: busy || phase !== "idle",
    canRetryRead: phase === "blocked",
    canClose: phase !== "writing",
    phase,
    error,
    retryReconciliation,
    reset,
  };
}
