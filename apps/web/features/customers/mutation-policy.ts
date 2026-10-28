import { CustomerApiError } from "./errors.ts";
import { DraftError } from "./payload.ts";

/** A GET settlement never proves the outcome of a write with a lost response. */
export type WriteOutcome = "confirmed" | "rejected" | "unknown";
export type MutationPhase = "idle" | "writing" | "reconciling" | "blocked";
export type ReconciliationStatus =
  | "idle"
  | "reading"
  | "verified"
  | "unresolved";

export function settleMutationRead(
  write: WriteOutcome,
  read: "success" | "error" | "denied",
): "idle" | "blocked" {
  // Confirmed or rejected writes settle after successful GET; unknown writes never auto-unlock.
  // Failed GET settlements fail closed and remain blocked.
  return write !== "unknown" && read === "success" ? "idle" : "blocked";
}

/** Treat missing responses as unknown; an HTTP 4xx proves rejection, except after a committed pre-step. */
export function isAmbiguousCustomerWriteFailure(error: unknown): boolean {
  if (
    error !== null &&
    typeof error === "object" &&
    "isPartial" in error &&
    error.isPartial === true
  )
    return true;
  if (error instanceof DraftError) return false;
  return !(error instanceof CustomerApiError) || error.status >= 500;
}

/** Rejected concurrent/permission changes still invalidate the editor snapshot. */
export function shouldRevalidateRejectedCustomerWriteFailure(
  error: unknown,
): boolean {
  if (!(error instanceof CustomerApiError)) return false;
  return [403, 404, 409].includes(error.status);
}

/** A newer GET of another filter is not an authoritative mutation reconciliation. */
export function isMutationReadInScope(
  originalKey: string | undefined,
  readKey: string | undefined,
  targetId: number | null,
  settledId: number | undefined,
): boolean {
  return (
    targetId !== null &&
    settledId !== undefined &&
    settledId >= targetId &&
    (originalKey === undefined || originalKey === readKey)
  );
}

/** After a drawer unmounts, the page may acknowledge only a new GET in its original scope. */
export function isFreshCustomerRecoveryRead(
  origin: { key: string; settledId: number } | null,
  read: { key: string; settledId: number; outcome?: string; loading: boolean },
): boolean {
  return (
    origin !== null &&
    read.key === origin.key &&
    read.settledId > origin.settledId &&
    read.outcome === "success" &&
    !read.loading
  );
}
