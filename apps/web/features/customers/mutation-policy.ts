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
  // Only confirmed writes that settle with GET 200 return automatically to idle.
  // Unknown writes or failed GET settlements fail closed and remain blocked.
  return write === "confirmed" && read === "success" ? "idle" : "blocked";
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
