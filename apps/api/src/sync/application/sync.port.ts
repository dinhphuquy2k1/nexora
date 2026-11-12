import type { SyncCapabilityResolver } from "./sync-capability.port";
import type { SyncConfig } from "../domain/sync-policy";
import type { SyncType, SyncCode } from "../domain/sync.constants";
export interface SyncJob {
  id: string;
  carrier_connection_id: string | null;
  owner_user_id: string;
  sync_type: SyncType;
  trigger_source: string;
  status: string;
  processing_phase: string;
  fetch_strategy: "FULL" | "INCREMENTAL";
  next_page: number;
  next_cursor: string | null;
  target_watermark: string | null;
  worker_id: string | null;
  lease_version: number;
  lease_expires_at: Date | null;
  generation: number;
  lifecycle_version: number;
  attempt_count: number;
  fetched_count: number;
  new_count: number;
  changed_count: number;
  unchanged_count: number;
  applied_count: number;
  rejected_count: number;
  needs_review_count: number;
  started_at: Date | null;
  finished_at: Date | null;
  created_at: Date;
  last_error_code: string | null;
  provider: string;
  external_account_id: string;
}
export interface NormalizedSource {
  identity: { scheme: string; key: string; hash: string };
  payload: Record<string, unknown>;
  sourceOrder?: number;
}
export interface SyncPage {
  records: readonly NormalizedSource[];
  nextPage?: number;
  nextCursor?: string;
  watermark?: string;
  done: boolean;
}
export interface SyncSource {
  id: string;
  sourceVersion: number;
  processorVersion: number;
  payload: Record<string, unknown>;
}
export interface SyncDomainSession {
  readonly scope: Readonly<{
    ownerId: string;
    connectionId: string;
    sourceId: string;
    provider: string;
    externalAccountId: string;
    syncType: SyncType;
  }>;
}
export type SyncDecision = {
  outcome: "APPLIED" | "REJECTED_SOURCE" | "NEEDS_REVIEW" | "RETRYABLE_ERROR";
  code?: SyncCode;
  retryAfterMs?: number;
};
/**
 * Outcome classification for every Sync Domain Processor:
 * - APPLIED: a valid Domain transition completed successfully.
 * - REJECTED_SOURCE: deterministic source-data validation failure with a stable
 *   source identity (missing/empty required payload, wrong type, invalid weight,
 *   date format or Domain Policy limit). Resolved without applying Domain work.
 * - NEEDS_REVIEW: valid data requires a business decision, such as ambiguous
 *   Customer/Shipment matching, ownership/state conflict or link confirmation.
 *   Never use this for database, network or programming failures.
 * - RETRYABLE_ERROR: transient technical failure with an explicit bounded retry
 *   policy (lock timeout, serialization conflict, unavailable dependency).
 *   Exhaustion makes the Job FAILED; never convert it to NEEDS_REVIEW/APPLIED.
 *   Deterministic source validation must not be classified as RETRYABLE_ERROR.
 *
 * Rejection/review are resolved outcomes; only APPLIED updates applied version.
 * Invalid/missing source identity follows the existing safe fail-batch policy;
 * never silently skip it or default to REJECTED_SOURCE without a safe identity.
 * Domain writes stay in the fenced transaction through the supplied session;
 * no external network operations inside that transaction.
 * Each production implementation must run domain-specific contract fixtures for
 * these classifications; infrastructure fixtures do not certify conformance.
 */
export interface SyncDomainProcessor<
  Session extends SyncDomainSession = SyncDomainSession,
> {
  readonly version: number;
  supports(type: SyncType): boolean;
  apply(source: SyncSource, session: Session): Promise<SyncDecision>;
}
export interface SyncProvider {
  strategy(provider: string, type: SyncType): "FULL" | "INCREMENTAL" | null;
  fetch(job: SyncJob, signal: AbortSignal): Promise<SyncPage>;
}
export interface SyncJobFilters {
  type?: SyncType;
  statuses?: string[];
  from?: Date;
  until?: Date;
}
export interface SyncJobSummary {
  total: number;
  completed: number;
  running: number;
  failed: number;
}
export interface SyncIssue {
  id: string;
  source_identity_id: string;
  source_version: number;
  processor_version: number;
  processing_outcome: string;
  last_error_code: string | null;
}
export abstract class SyncPort {
  abstract admit(
    userId: string,
    connectionId: string,
    type: SyncType,
    trigger: "MANUAL" | "AUTO",
  ): Promise<SyncJob>;
  abstract jobs(
    userId: string,
    connectionId: string,
    page: number,
    pageSize: number,
    filters?: SyncJobFilters,
  ): Promise<{
    jobs: SyncJob[];
    total: number;
    summary: SyncJobSummary;
    types: SyncType[];
  }>;
  abstract job(
    userId: string,
    connectionId: string,
    id: string,
  ): Promise<SyncJob>;
  abstract issues(
    userId: string,
    connectionId: string,
    jobId: string,
    page: number,
    pageSize: number,
  ): Promise<{ issues: SyncIssue[]; total: number }>;
  abstract configs(
    userId: string,
    connectionId: string,
  ): Promise<SyncSchedule[]>;
  abstract configure(
    userId: string,
    connectionId: string,
    type: SyncType,
    enabled: boolean,
    interval: number,
  ): Promise<SyncSchedule>;
}
export interface SyncSchedule {
  latest_job?: SyncJob | null;
  sync_type: SyncType;
  enabled: boolean;
  interval_minutes: number;
  next_run_at: Date | null;
  last_success_at: Date | null;
  last_completed_at: Date | null;
  last_completed_watermark: string | null;
  available: boolean;
}
export interface SyncQueue extends SyncPort {
  readonly config: SyncConfig;
  readonly capabilities: SyncCapabilityResolver;
  available(provider: string, type: SyncType): boolean;
  claim(workerId: string): Promise<SyncJob | null>;
  page(job: SyncJob, page: SyncPage, processorVersion: number): Promise<void>;
  apply(job: SyncJob): Promise<boolean>;
  wait(job: SyncJob, code: SyncCode, retryAfterMs: number): Promise<void>;
  heartbeat(job: SyncJob): Promise<void>;
  schedule(): Promise<void>;
  cleanup(): Promise<number>;
  close(): Promise<void>;
}
