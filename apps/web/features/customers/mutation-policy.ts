/** A GET settlement never proves the outcome of a write with a lost response. */
export type WriteOutcome = "confirmed" | "unknown";
export function settleMutationRead(
  write: WriteOutcome,
  read: "success" | "error" | "denied",
): "idle" | "blocked" {
  return write === "confirmed" && read === "success" ? "idle" : "blocked";
}
