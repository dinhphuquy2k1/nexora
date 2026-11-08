export const SyncJobStatus = {
  QUEUED: "QUEUED",
  RUNNING: "RUNNING",
  WAITING: "WAITING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;
export const SyncProcessingPhase = {
  FETCHING: "FETCHING",
  APPLYING: "APPLYING",
} as const;
export const SyncType = { SHIPMENT: "SHIPMENT", CUSTOMER: "CUSTOMER" } as const;
export type SyncType = (typeof SyncType)[keyof typeof SyncType];
export const SyncTrigger = { MANUAL: "MANUAL", AUTO: "AUTO" } as const;
