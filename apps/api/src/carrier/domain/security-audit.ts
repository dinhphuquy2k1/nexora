export const CarrierAuditType = {
  PASSWORD_DECRYPT: "PASSWORD_DECRYPT",
  CONNECT: "CONNECT",
  RECONNECT: "RECONNECT",
  RECOVERY: "RECOVERY",
} as const;
export const CarrierAuditOutcome = {
  ALLOWED: "ALLOWED",
  SUCCESS: "SUCCESS",
  FAILURE: "FAILURE",
} as const;
export const CarrierAuditReason = {
  RECOVERY_REQUESTED: "RECOVERY_REQUESTED",
  VERIFIED: "VERIFIED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  DUPLICATE_ACCOUNT: "DUPLICATE_ACCOUNT",
  IDENTITY_MISMATCH: "IDENTITY_MISMATCH",
  UNAVAILABLE: "UNAVAILABLE",
} as const;
export type CarrierAuditType =
  (typeof CarrierAuditType)[keyof typeof CarrierAuditType];
export type CarrierAuditOutcome =
  (typeof CarrierAuditOutcome)[keyof typeof CarrierAuditOutcome];
export type CarrierAuditReason =
  (typeof CarrierAuditReason)[keyof typeof CarrierAuditReason];
export interface CarrierSecurityEvent {
  eventType: CarrierAuditType;
  outcome: CarrierAuditOutcome;
  reason: CarrierAuditReason;
  userId: string | null;
  connectionId: string | null;
  provider: string;
  correlationId: string;
}
