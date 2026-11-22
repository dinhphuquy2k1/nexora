/** Internal technical scan vocabulary; not a public API or Shipment state. */
export const SyncScanIntegrityStatus = {
  VALIDATED: "VALIDATED",
  INCOMPLETE: "INCOMPLETE",
  UNTRUSTED: "UNTRUSTED",
} as const;
export type SyncScanIntegrityStatusCode =
  (typeof SyncScanIntegrityStatus)[keyof typeof SyncScanIntegrityStatus];
export const SyncScanIntegrityReason = {
  MISSING_SCAN_METADATA: "MISSING_SCAN_METADATA",
  SCOPE_MISMATCH: "SCOPE_MISMATCH",
  TOTAL_MISMATCH: "TOTAL_MISMATCH",
  DUPLICATE_IDENTITY: "DUPLICATE_IDENTITY",
  PAGE_GAP: "PAGE_GAP",
  MISSING_TERMINAL_PAGE: "MISSING_TERMINAL_PAGE",
  COUNT_MISMATCH: "COUNT_MISMATCH",
} as const;
export type SyncScanIntegrityReasonCode =
  (typeof SyncScanIntegrityReason)[keyof typeof SyncScanIntegrityReason];
