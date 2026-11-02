import {
  SyncJobStatus,
  SyncProcessingPhase,
  SyncType,
  SyncTrigger,
} from "@nexora/shared/sync-status";
export { SyncJobStatus, SyncProcessingPhase, SyncType, SyncTrigger };
export const SyncProcessingStatus = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  RETRYABLE_ERROR: "RETRYABLE_ERROR",
  APPLIED: "APPLIED",
  REJECTED_SOURCE: "REJECTED_SOURCE",
  NEEDS_REVIEW: "NEEDS_REVIEW",
} as const;
export const SyncStrategy = {
  FULL: "FULL",
  INCREMENTAL: "INCREMENTAL",
} as const;
export const SyncLinkOrigin = {
  CREATED_BY_SYNC: "CREATED_BY_SYNC",
  LINKED_EXISTING: "LINKED_EXISTING",
} as const;
export const SyncErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  NOT_FOUND: "NOT_FOUND",
  SYNC_UNAVAILABLE: "SYNC_UNAVAILABLE",
  SYNC_STALE: "SYNC_STALE",
  PROVIDER_RETRY: "PROVIDER_RETRY",
  SOURCE_INVALID: "SOURCE_INVALID",
  SOURCE_CONFLICT: "SOURCE_CONFLICT",
  PROCESSOR_UNAVAILABLE: "PROCESSOR_UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;
export type SyncCode = (typeof SyncErrorCode)[keyof typeof SyncErrorCode];
export const ACTIVE_SYNC_JOBS = [
  SyncJobStatus.QUEUED,
  SyncJobStatus.RUNNING,
  SyncJobStatus.WAITING,
];
export const TERMINAL_SYNC_OUTCOMES = [
  SyncProcessingStatus.APPLIED,
  SyncProcessingStatus.REJECTED_SOURCE,
  SyncProcessingStatus.NEEDS_REVIEW,
];
