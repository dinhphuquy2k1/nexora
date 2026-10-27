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
