/** Internal durable finalization outcomes, never an API or provider status. */
export const ReconciliationStatus = {
  APPLIED: "APPLIED",
  BASELINE_ESTABLISHED: "BASELINE_ESTABLISHED",
  SKIPPED: "SKIPPED",
} as const;
export const ReconciliationReason = {
  CAPABILITY_NOT_ADMITTED: "CAPABILITY_NOT_ADMITTED",
  SCAN_NOT_VALIDATED: "SCAN_NOT_VALIDATED",
  SCOPE_MISMATCH: "SCOPE_MISMATCH",
  BASELINE_UNAVAILABLE: "BASELINE_UNAVAILABLE",
  POLICY_NOT_CONFIGURED: "POLICY_NOT_CONFIGURED",
  MASS_HIDE_THRESHOLD_EXCEEDED: "MASS_HIDE_THRESHOLD_EXCEEDED",
  ZERO_RESULT_ANOMALY: "ZERO_RESULT_ANOMALY",
  SOURCE_SCOPE_CONFLICT: "SOURCE_SCOPE_CONFLICT",
  STREAK_LIMIT_REACHED: "STREAK_LIMIT_REACHED",
} as const;
export interface ReconciliationSummary {
  status: (typeof ReconciliationStatus)[keyof typeof ReconciliationStatus];
  reason:
    | (typeof ReconciliationReason)[keyof typeof ReconciliationReason]
    | null;
  newlyHidden: number;
  restored: number;
  stillMissing: number;
}
