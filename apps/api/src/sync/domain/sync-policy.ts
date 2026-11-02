import { createHash } from "node:crypto";
import { SyncErrorCode, SyncType, type SyncCode } from "./sync.constants";
export class SyncError extends Error {
  constructor(
    readonly code: SyncCode,
    readonly retryAfterMs = 0,
  ) {
    super(code);
  }
}
export interface SyncConfig {
  readonly enabled: boolean;
  readonly types: readonly SyncType[];
  readonly leaseSeconds: number;
  readonly pollMs: number;
  readonly maxAttempts: number;
  readonly retentionDays: number | null;
}
export function loadSyncConfig(env: NodeJS.ProcessEnv): SyncConfig {
  const flag = (key: string) => {
    const v = env[key] ?? "false";
    if (v !== "true" && v !== "false")
      throw new Error("Invalid Sync configuration");
    return v === "true";
  };
  const positive = (key: string, fallback: number, max: number) => {
    const v = env[key] ?? String(fallback);
    if (
      !/^[1-9]\d*$/.test(v) ||
      !Number.isSafeInteger(Number(v)) ||
      Number(v) > max
    )
      throw new Error("Invalid Sync configuration");
    return Number(v);
  };
  return {
    enabled: flag("SYNC_ENABLED"),
    types: Object.values(SyncType).filter((t) =>
      flag("SYNC_" + t + "_ENABLED"),
    ),
    leaseSeconds: positive("SYNC_LEASE_SECONDS", 60, 300),
    pollMs: positive("SYNC_POLL_MS", 1000, 60000),
    maxAttempts: positive("SYNC_MAX_ATTEMPTS", 5, 20),
    retentionDays: env.SYNC_RESOLVED_RETENTION_DAYS
      ? positive("SYNC_RESOLVED_RETENTION_DAYS", 1, 36500)
      : null,
  };
}
export function sourceKey(scheme: string, fields: readonly unknown[]) {
  if (
    !/^[a-zA-Z0-9-]{1,64}$/.test(scheme) ||
    fields.length === 0 ||
    fields.some((f) => typeof f !== "string" || f.length === 0)
  )
    throw new SyncError(SyncErrorCode.SOURCE_INVALID);
  const key = JSON.stringify(fields);
  if (key.length > 512 || Buffer.byteLength(key, "utf8") > 2048)
    throw new SyncError(SyncErrorCode.SOURCE_INVALID);
  return { scheme, key, hash: createHash("sha256").update(key).digest("hex") };
}
export function canonicalPayload(value: unknown): string {
  const visit = (v: unknown): unknown => {
    if (v === null || typeof v === "string" || typeof v === "boolean") return v;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (Array.isArray(v)) return v.map(visit);
    if (
      v &&
      typeof v === "object" &&
      Object.getPrototypeOf(v) === Object.prototype
    )
      return Object.fromEntries(
        Object.keys(v)
          .sort()
          .map((k) => [k, visit((v as Record<string, unknown>)[k])]),
      );
    throw new SyncError(SyncErrorCode.SOURCE_INVALID);
  };
  const json = JSON.stringify(visit(value));
  if (Buffer.byteLength(json) > 65536)
    throw new SyncError(SyncErrorCode.SOURCE_INVALID);
  return json;
}
export const payloadHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function retryDelay(attempt: number, retryAfterMs = 0) {
  return Math.max(
    Number.isFinite(retryAfterMs) ? Math.max(0, retryAfterMs) : 0,
    Math.min(60000, 1000 * 2 ** Math.min(attempt, 6)),
  );
}
