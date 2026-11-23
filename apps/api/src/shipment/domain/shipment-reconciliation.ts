import { shipmentRecord } from "./shipment";
import {
  ReconciliationStatus as S,
  ReconciliationReason as R,
  type ReconciliationSummary,
} from "../../sync/domain/sync-reconciliation.constants";
export interface ShipmentReconciliationPolicy {
  readonly maxNewlyMissing: number;
  readonly maxMissingRatioBps: number;
  readonly maxObservedDropRatioBps: number;
}
export interface ShipmentReconciliationFacts {
  admitted: boolean;
  eligible: boolean;
  scopeMatches: boolean;
  fingerprint: string | null;
  baseline: { fingerprint: string; observed: number } | null;
  eligibleShipments: number;
  currentlyVisible: number;
  newlyMissing: number;
  alreadyHiddenMissing: number;
  restorable: number;
  maxMissingStreak: number;
  conflicts: number;
  currentObserved: number;
}
/** Explicit code configuration only; no production default or implicit approval. */
export function reconciliationPolicy(
  input: unknown,
): ShipmentReconciliationPolicy | undefined {
  try {
    shipmentRecord(input, [
      "maxNewlyMissing",
      "maxMissingRatioBps",
      "maxObservedDropRatioBps",
    ]);
  } catch {
    return undefined;
  }
  if (
    Object.keys(input as object)
      .sort()
      .join(",") !==
    "maxMissingRatioBps,maxNewlyMissing,maxObservedDropRatioBps"
  )
    return undefined;
  const p = input as ShipmentReconciliationPolicy;
  if (
    ![p.maxNewlyMissing, p.maxMissingRatioBps, p.maxObservedDropRatioBps].every(
      (n) => Number.isSafeInteger(n) && n >= 0,
    ) ||
    p.maxNewlyMissing > 2147483647 ||
    p.maxMissingRatioBps > 10000 ||
    p.maxObservedDropRatioBps > 10000
  )
    return undefined;
  return Object.freeze({
    maxNewlyMissing: p.maxNewlyMissing,
    maxMissingRatioBps: p.maxMissingRatioBps,
    maxObservedDropRatioBps: p.maxObservedDropRatioBps,
  });
}
export function nextMissingStreak(streak: number): number {
  if (!Number.isSafeInteger(streak) || streak < 0 || streak >= 2147483647)
    throw new RangeError("Invalid missing streak");
  return streak + 1;
}
export function decideShipmentReconciliation(
  f: ShipmentReconciliationFacts,
  configuration?: ShipmentReconciliationPolicy,
): ReconciliationSummary {
  const result = (
    status: ReconciliationSummary["status"],
    reason: ReconciliationSummary["reason"] = null,
  ): ReconciliationSummary => ({
    status,
    reason,
    newlyHidden: 0,
    restored: 0,
    stillMissing: 0,
  });
  const skip = (reason: NonNullable<ReconciliationSummary["reason"]>) =>
    result(S.SKIPPED, reason);
  if (!f.admitted) return skip(R.CAPABILITY_NOT_ADMITTED);
  if (!f.eligible) return skip(R.SCAN_NOT_VALIDATED);
  if (!f.scopeMatches) return skip(R.SCOPE_MISMATCH);
  const p = reconciliationPolicy(configuration);
  if (!p) return skip(R.POLICY_NOT_CONFIGURED);
  if (f.conflicts) return skip(R.SOURCE_SCOPE_CONFLICT);
  const hidden = f.alreadyHiddenMissing + f.restorable;
  if (f.baseline && f.baseline.fingerprint !== f.fingerprint)
    return skip(R.SCOPE_MISMATCH);
  if (!f.currentObserved && f.eligibleShipments)
    return skip(R.ZERO_RESULT_ANOMALY);
  if (!f.baseline) {
    if (hidden) return skip(R.BASELINE_UNAVAILABLE);
    return result(S.BASELINE_ESTABLISHED);
  }
  if (
    f.newlyMissing > p.maxNewlyMissing ||
    f.newlyMissing * 10000 > f.currentlyVisible * p.maxMissingRatioBps ||
    Math.max(0, f.baseline.observed - f.currentObserved) * 10000 >
      f.baseline.observed * p.maxObservedDropRatioBps
  )
    return skip(R.MASS_HIDE_THRESHOLD_EXCEEDED);
  if (f.alreadyHiddenMissing) {
    try {
      nextMissingStreak(f.maxMissingStreak);
    } catch {
      return skip(R.STREAK_LIMIT_REACHED);
    }
  }
  return {
    ...result(S.APPLIED),
    newlyHidden: f.newlyMissing,
    restored: f.restorable,
    stillMissing: f.alreadyHiddenMissing,
  };
}
