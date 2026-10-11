export type StatusTone = "good" | "bad" | "pending";

export function resolveStatusTone(ok: boolean | null | undefined): StatusTone {
  if (ok === true) return "good";
  if (ok === false) return "bad";
  return "pending";
}
