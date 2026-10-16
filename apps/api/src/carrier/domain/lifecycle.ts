export const LifecycleCode = {
  PROVIDER_AUTH_FAILED: "PROVIDER_AUTH_FAILED",
  TOKEN_REJECTED: "TOKEN_REJECTED",
  IDENTITY_MISMATCH: "IDENTITY_MISMATCH",
  DUPLICATE: "DUPLICATE",
  REAUTH_REQUIRED: "REAUTH_REQUIRED",
  RATE_LIMITED: "RATE_LIMITED",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  AUDIT_UNAVAILABLE: "AUDIT_UNAVAILABLE",
  STALE: "STALE",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
} as const;
export type LifecycleCode = (typeof LifecycleCode)[keyof typeof LifecycleCode];
export class LifecycleFailure extends Error {
  constructor(
    readonly code: LifecycleCode,
    readonly retryAfterMs = 0,
  ) {
    super(code);
  }
}
