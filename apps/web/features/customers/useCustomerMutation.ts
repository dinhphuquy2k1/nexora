"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@nexora/ui";
import { customerError } from "./errors.ts";
import { DraftError } from "./payload.ts";
import {
  settleMutationRead,
  isAmbiguousCustomerWriteFailure,
  shouldRevalidateRejectedCustomerWriteFailure,
  isMutationReadInScope,
  type WriteOutcome,
} from "./mutation-policy.ts";
import { sanitizeReturnUrl } from "../../lib/auth/sanitize.ts";

export type MutationPhase = "idle" | "writing" | "reconciling" | "blocked";

export interface SettlementTarget {
  refresh: () => number | void;
  key?: string;
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
  const writeKey = useRef<string | undefined>(undefined);
  const pendingSuccess = useRef<(() => void) | null>(null);
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
  const readKey = isTargetObject ? targetOrRefresh.key : undefined;
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
        if (
          !isMutationReadInScope(writeKey.current, readKey, target, settledId)
        ) {
          setPhase("blocked");
          setBusy(true);
          return;
        }
        const readOutcome = denied
          ? "denied"
          : outcome === "success"
            ? "success"
            : "error";
        const settled = settleMutationRead(writeOutcome.current, readOutcome);
        if (settled === "idle") {
          const onSettledSuccess =
            writeOutcome.current === "confirmed" ? pendingSuccess.current : null;
          pendingSuccess.current = null;
          targetRequestId.current = null;
          lock.current = false;
          setPhase("idle");
          setBusy(false);
          // A confirmed write cannot close its drawer before its in-scope GET.
          try {
            onSettledSuccess?.();
          } catch {
            // A presentation callback cannot relabel an already committed write.
          }
        } else {
          setPhase("blocked");
          setBusy(true);
        }
      }
    }
  }, [phase, settledId, outcome, denied, readKey]);

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
    if (writeOutcome.current === "unknown" || phase !== "idle") return;
    pendingSuccess.current = null;
    targetRequestId.current = null;
    lock.current = false;
    setPhase("idle");
    setBusy(false);
    setError(undefined);
  }, [phase]);

  async function run(operation: () => Promise<unknown>, success: () => void) {
    if (lock.current || phase !== "idle") return;
    lock.current = true;
    writeOutcome.current = "confirmed";
    pendingSuccess.current = null;
    writeKey.current = readKey;
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

        if (isAmbiguousCustomerWriteFailure(e)) {
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

        writeOutcome.current = "rejected";
        if (shouldRevalidateRejectedCustomerWriteFailure(e)) {
          try {
            const reqId = refreshFn();
            if (typeof reqId === "number") {
              targetRequestId.current = reqId;
              setPhase("reconciling");
              return;
            }
          } catch {
            // Unable to schedule authoritative revalidation.
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

      // Defer saved/close until an authoritative GET, not merely HTTP 2xx.
      pendingSuccess.current = success;
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

      // A confirmed write without a scheduled GET must remain blocked.
      setPhase("blocked");
      setBusy(true);
    } catch {
      lock.current = false;
      setPhase("idle");
      setBusy(false);
    }
  }

  const isUnresolved = writeOutcome.current === "unknown";
  const canResolveUnresolved =
    isUnresolved &&
    phase === "blocked" &&
    !denied &&
    outcome === "success" &&
    isMutationReadInScope(
      writeKey.current,
      readKey,
      targetRequestId.current,
      settledId,
    );

  const resolveUnresolved = useCallback(
    (mode: "acknowledged" | "discard" = "discard"): boolean => {
      if (!canResolveUnresolved) return false;
      targetRequestId.current = null;
      lock.current = false;
      writeOutcome.current = mode === "acknowledged" ? "confirmed" : "rejected";
      setPhase("idle");
      setBusy(false);
      setError(undefined);
      return true;
    },
    [canResolveUnresolved],
  );

  return {
    run,
    busy: busy || phase !== "idle",
    canWrite: phase === "idle" && !isUnresolved,
    canRetryRead: phase === "blocked",
    canClose:
      phase === "idle" ||
      (phase === "blocked" && writeOutcome.current !== "confirmed"),
    isWriting: phase === "writing",
    isReconciling: phase === "reconciling",
    isUnresolved,
    canResolveUnresolved,
    writeOutcome: writeOutcome.current,
    phase,
    error,
    retryReconciliation,
    reset,
    resolveUnresolved,
  };
}
