import { SyncScanIntegrityStatus } from "../domain/sync-observation.constants";
import {
  scanScopeFingerprint,
  validateScanPage,
  recordScanPage,
  readScanSummary,
  saveScanSummary,
} from "./sync-scan-observation";
import {
  SyncCapabilityRegistry,
  type BoundSyncCapability,
} from "./sync-capability.registry";
import { createDatabase, Prisma, type PrismaClient } from "@nexora/database";
import { UserStatus } from "../../identity/domain/user-policy";
import { ConnectionStatus } from "../../carrier/domain/carrier";
import {
  SyncError,
  canonicalPayload,
  payloadHash,
  sourceKey,
  retryDelay,
  type SyncConfig,
} from "../domain/sync-policy";
import {
  SyncJobStatus as J,
  SyncProcessingPhase as P,
  SyncProcessingStatus as O,
  SyncErrorCode as E,
  SyncTrigger,
  SyncType,
  ACTIVE_SYNC_JOBS,
  type SyncCode,
} from "../domain/sync.constants";
import type {
  SyncQueue,
  SyncJob,
  SyncPage,
  SyncSchedule,
  SyncSource,
  SyncJobFilters,
  SyncIssue,
  SyncJobSummary,
} from "../application/sync.port";
import { buildAdmitSyncJobQuery } from "./queries/sync-admission.queries";
import {
  buildLockSourceRecordForApplyQuery,
  buildMarkSourceRecordResolvedQuery,
  buildRescheduleApplyWaitQuery,
} from "./queries/sync-application.queries";
import {
  buildClaimCleanupJobsQuery,
  buildDeleteExpiredPayloadsQuery,
} from "./queries/sync-cleanup.queries";
import { buildClaimCandidateQuery } from "./queries/sync-lease.queries";
import { buildFindDueSyncSchedulesQuery } from "./queries/sync-scheduling.queries";
import {
  buildAdvancePageJobQuery,
  buildInsertSyncJobItemsQuery,
  buildLockExistingIdentitiesQuery,
  buildUpsertProviderSourceRecordsQuery,
  buildUpsertSyncSourceIdentitiesQuery,
} from "./queries/sync-staging.queries";
const ISSUE_OUTCOMES = [O.NEEDS_REVIEW, O.REJECTED_SOURCE, O.RETRYABLE_ERROR];
type Tx = Prisma.TransactionClient;
type Connection = {
  id: string;
  user_id: string;
  provider: string;
  external_account_id: string;
  status: string;
  lifecycle_version: number;
  generation: number;
};
type ConnectionLockMode = "read" | "write";
export class SyncRepository implements SyncQueue {
  private scheduledAfter?: { at: string; id: string };
  private instance?: PrismaClient;
  constructor(
    private readonly url: string,
    readonly config: SyncConfig,
    readonly capabilities: SyncCapabilityRegistry,
    private readonly authorizationLocks: "exclusive" | "shared" = "exclusive",
  ) {}
  get client(): PrismaClient {
    return (this.instance ??= createDatabase(this.url));
  }
  available(provider: string, type: SyncType) {
    return this.admissible(provider, type) !== null;
  }
  private admissible(
    provider: string,
    type: SyncType,
  ): BoundSyncCapability | null {
    if (!this.config.enabled) return null;
    return this.capabilities.resolve(provider, type);
  }
  private async connection(
    tx: Tx,
    userId: string,
    id: string,
    connected = false,
    mode: ConnectionLockMode = "write",
  ): Promise<Connection> {
    const lock = Prisma.raw(mode === "read" ? "FOR SHARE" : "FOR UPDATE");
    // Lock user -> epoch -> connection in fixed order; shared mode delegates to security-definer locks under nexora_sync.
    const u =
      this.authorizationLocks === "shared"
        ? await tx.$queryRaw<{ status: string }[]>`
            SELECT status
            FROM public.sync_lock_user(${userId}::uuid)
          `
        : await tx.$queryRaw<{ status: string }[]>`
            SELECT status
            FROM users
            WHERE id = ${userId}::uuid
            ${lock}
          `;
    if (u[0]?.status !== UserStatus.ACTIVE) throw new SyncError(E.UNAUTHORIZED);
    // Lock user disablement epoch after user row to fence concurrent disablement.
    const epochs =
      this.authorizationLocks === "shared"
        ? await tx.$queryRaw<{ generation: number }[]>`
            SELECT generation
            FROM public.sync_lock_epoch(${userId}::uuid)
          `
        : await tx.$queryRaw<{ generation: number }[]>`
            SELECT generation
            FROM carrier_user_states
            WHERE user_id = ${userId}::uuid
            ${lock}
          `;
    // Lock carrier connection after epoch to preserve user -> epoch -> connection order.
    const rows =
      this.authorizationLocks === "shared"
        ? await tx.$queryRaw<Omit<Connection, "generation">[]>`
            SELECT *
            FROM public.sync_lock_connection(${id}::uuid, ${userId}::uuid)
          `
        : await tx.$queryRaw<Omit<Connection, "generation">[]>`
            SELECT
              id,
              user_id,
              provider,
              external_account_id,
              status,
              lifecycle_version
            FROM carrier_connections
            WHERE id = ${id}::uuid
              AND user_id = ${userId}::uuid
            ${lock}
          `;
    if (!rows[0]) throw new SyncError(E.NOT_FOUND);
    if (connected && rows[0].status !== ConnectionStatus.CONNECTED)
      throw new SyncError(E.SYNC_UNAVAILABLE);
    return { ...rows[0], generation: epochs[0]?.generation ?? 0 };
  }
  private async fence(tx: Tx, job: SyncJob) {
    if (!job.carrier_connection_id) throw new SyncError(E.SYNC_STALE);
    const c = await this.connection(
      tx,
      job.owner_user_id,
      job.carrier_connection_id,
      true,
    );
    // Lock sync job row after connection lock to serialize worker lease checks.
    const rows = await tx.$queryRaw<SyncJob[]>`
      SELECT *
      FROM sync_jobs
      WHERE id = ${job.id}::uuid
      FOR UPDATE
    `;
    const current = rows[0];
    if (
      !this.available(c.provider, job.sync_type) ||
      !current ||
      current.provider !== job.provider ||
      current.external_account_id !== job.external_account_id ||
      current.sync_type !== job.sync_type ||
      current.owner_user_id !== job.owner_user_id ||
      current.carrier_connection_id !== job.carrier_connection_id ||
      c.provider !== current.provider ||
      c.external_account_id !== current.external_account_id ||
      current.status !== J.RUNNING ||
      current.worker_id !== job.worker_id ||
      current.lease_version !== job.lease_version ||
      c.generation !== current.generation ||
      c.lifecycle_version !== current.lifecycle_version ||
      current.generation !== job.generation ||
      current.lifecycle_version !== job.lifecycle_version
    )
      throw new SyncError(E.SYNC_STALE);
    await this.assertLease(tx, job);
    return current;
  }
  private async assertLease(tx: Tx, job: SyncJob) {
    // Fence to lease_version, worker_id, and unexpired clock_timestamp() before committing work.
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM sync_jobs
      WHERE id = ${job.id}::uuid
        AND lease_version = ${job.lease_version}
        AND status = ${J.RUNNING}
        AND worker_id = ${job.worker_id}::uuid
        AND lease_expires_at > clock_timestamp()
    `;
    if (rows.length !== 1) throw new SyncError(E.SYNC_STALE);
  }
  private async release(tx: Tx, job: SyncJob) {
    await this.assertLease(tx, job);
    // Fence release to lease_version; clock_timestamp() records exact release/availability time.
    await tx.$executeRaw`
      UPDATE sync_jobs
      SET
        status = ${J.WAITING},
        available_at = clock_timestamp(),
        worker_id = NULL,
        lease_expires_at = NULL,
        updated_at = clock_timestamp()
      WHERE id = ${job.id}::uuid
        AND lease_version = ${job.lease_version}
    `;
  }
  async admit(
    userId: string,
    id: string,
    type: SyncType,
    trigger: (typeof SyncTrigger)[keyof typeof SyncTrigger],
  ) {
    return this.client.$transaction(async (tx) => {
      const c = await this.connection(tx, userId, id, true);
      const capability = this.admissible(c.provider, type);
      if (!capability) throw new SyncError(E.SYNC_UNAVAILABLE);
      // Static predicate preserves PostgreSQL partial-index inference; covered by
      // integration/fixtures/sync-status-contract.cjs prepared/admit contract.
      const rows = await tx.$queryRaw<SyncJob[]>(
        buildAdmitSyncJobQuery({
          carrierConnectionId: id,
          ownerUserId: userId,
          provider: c.provider,
          externalAccountId: c.external_account_id,
          syncType: type,
          triggerSource: trigger,
          generation: c.generation,
          lifecycleVersion: c.lifecycle_version,
          fetchStrategy: capability.strategy,
          scanScopeFingerprint: capability.fullScan
            ? scanScopeFingerprint(
                {
                  owner_user_id: userId,
                  provider: c.provider,
                  external_account_id: c.external_account_id,
                  sync_type: type,
                },
                capability.fullScan,
              )
            : null,
          reconciliationVersion: capability.domain.finalizationVersion ?? null,
        }),
      );
      if (rows[0]) return rows[0];
      const active = await tx.$queryRaw<SyncJob[]>`
        SELECT *
        FROM sync_jobs
        WHERE carrier_connection_id = ${id}::uuid
          AND sync_type = ${type}
          AND status = ANY(${ACTIVE_SYNC_JOBS}::text[])
      `;
      if (!active[0]) throw new SyncError(E.SYNC_STALE);
      return active[0];
    });
  }
  async jobs(
    userId: string,
    id: string,
    page: number,
    pageSize: number,
    filters: SyncJobFilters = {},
  ) {
    return this.client.$transaction(async (tx) => {
      await this.connection(tx, userId, id, false, "read");
      const type = filters.type ?? null,
        statuses = filters.statuses ?? [],
        from = filters.from ?? null,
        until = filters.until ?? null;
      const counts = await tx.$queryRaw<{ total: bigint }[]>`
        SELECT count(*) AS total
        FROM sync_jobs
        WHERE owner_user_id = ${userId}::uuid
          AND carrier_connection_id = ${id}::uuid
          AND (${type}::text IS NULL OR sync_type = ${type})
          AND (cardinality(${statuses}::text[]) = 0 OR status = ANY(${statuses}::text[]))
          AND (${from}::timestamptz IS NULL OR coalesce(started_at, created_at) >= ${from})
          AND (${until}::timestamptz IS NULL OR coalesce(started_at, created_at) <= ${until})
      `;
      const jobs = await tx.$queryRaw<SyncJob[]>`
        SELECT *
        FROM sync_jobs
        WHERE owner_user_id = ${userId}::uuid
          AND carrier_connection_id = ${id}::uuid
          AND (${type}::text IS NULL OR sync_type = ${type})
          AND (cardinality(${statuses}::text[]) = 0 OR status = ANY(${statuses}::text[]))
          AND (${from}::timestamptz IS NULL OR coalesce(started_at, created_at) >= ${from})
          AND (${until}::timestamptz IS NULL OR coalesce(started_at, created_at) <= ${until})
        ORDER BY
          created_at DESC,
          id DESC
        LIMIT ${pageSize}
        OFFSET ${(page - 1) * pageSize}
      `;
      const totals = await tx.$queryRaw<
        { status: string; sync_type: SyncType; n: bigint }[]
      >`
        SELECT
          status,
          sync_type,
          count(*) AS n
        FROM sync_jobs
        WHERE owner_user_id = ${userId}::uuid
          AND carrier_connection_id = ${id}::uuid
        GROUP BY
          status,
          sync_type
      `;
      const summary: SyncJobSummary = {
        total: 0,
        completed: 0,
        running: 0,
        failed: 0,
      };
      for (const r of totals) {
        summary.total += Number(r.n);
        if (r.status === J.SUCCEEDED) summary.completed += Number(r.n);
        else if (r.status === J.FAILED || r.status === J.CANCELLED)
          summary.failed += Number(r.n);
        else summary.running += Number(r.n);
      }
      return {
        jobs,
        total: Number(counts[0].total),
        summary,
        types: [...new Set(totals.map((r) => r.sync_type))],
      };
    });
  }
  async issues(
    userId: string,
    id: string,
    jobId: string,
    page: number,
    pageSize: number,
  ) {
    return this.client.$transaction(async (tx) => {
      await this.connection(tx, userId, id, false, "read");
      const jobs = await tx.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM sync_jobs
        WHERE id = ${jobId}::uuid
          AND carrier_connection_id = ${id}::uuid
          AND owner_user_id = ${userId}::uuid
      `;
      if (!jobs[0]) throw new SyncError(E.NOT_FOUND);
      const counts = await tx.$queryRaw<{ total: bigint }[]>`
        SELECT count(*) AS total
        FROM sync_job_items
        WHERE job_id = ${jobId}::uuid
          AND processing_outcome = ANY(${ISSUE_OUTCOMES}::text[])
      `;
      const issues = await tx.$queryRaw<SyncIssue[]>`
        SELECT
          id,
          source_identity_id,
          source_version,
          processor_version,
          processing_outcome,
          last_error_code
        FROM sync_job_items
        WHERE job_id = ${jobId}::uuid
          AND processing_outcome = ANY(${ISSUE_OUTCOMES}::text[])
        ORDER BY id
        LIMIT ${pageSize}
        OFFSET ${(page - 1) * pageSize}
      `;
      return { issues, total: Number(counts[0].total) };
    });
  }
  async job(userId: string, id: string, jobId: string) {
    return this.client.$transaction(async (tx) => {
      await this.connection(tx, userId, id, false, "read");
      const rows = await tx.$queryRaw<SyncJob[]>`
        SELECT *
        FROM sync_jobs
        WHERE id = ${jobId}::uuid
          AND carrier_connection_id = ${id}::uuid
          AND owner_user_id = ${userId}::uuid
      `;
      if (!rows[0]) throw new SyncError(E.NOT_FOUND);
      return rows[0];
    });
  }
  async configs(userId: string, id: string) {
    return this.client.$transaction(async (tx) => {
      const c = await this.connection(tx, userId, id, false, "read");
      const rows = await tx.$queryRaw<SyncSchedule[]>`
        SELECT *
        FROM sync_configs
        WHERE carrier_connection_id = ${id}::uuid
      `;
      const latest = await tx.$queryRaw<SyncJob[]>`
        SELECT DISTINCT ON (sync_type) *
        FROM sync_jobs
        WHERE carrier_connection_id = ${id}::uuid
          AND owner_user_id = ${userId}::uuid
        ORDER BY
          sync_type,
          created_at DESC,
          id DESC
      `;
      return Object.values(SyncType).map((type) => ({
        latest_job: latest.find((j) => j.sync_type === type) ?? null,
        ...{
          sync_type: type,
          enabled: false,
          interval_minutes: 60,
          next_run_at: null,
          last_success_at: null,
          last_completed_at: null,
          last_completed_watermark: null,
        },
        ...rows.find((r) => r.sync_type === type),
        available: this.available(c.provider, type),
      }));
    });
  }
  async configure(
    userId: string,
    id: string,
    type: SyncType,
    enabled: boolean,
    interval: number,
  ) {
    return this.client.$transaction(async (tx) => {
      const c = await this.connection(tx, userId, id);
      if (enabled && !this.available(c.provider, type))
        throw new SyncError(E.SYNC_UNAVAILABLE);
      // clock_timestamp() anchors next_run_at and updated_at to commit-time DB clock.
      const rows = await tx.$queryRaw<SyncSchedule[]>`
        INSERT INTO sync_configs (
          carrier_connection_id,
          sync_type,
          enabled,
          interval_minutes,
          next_run_at
        )
        VALUES (
          ${id}::uuid,
          ${type},
          ${enabled},
          ${interval},
          CASE WHEN ${enabled}
            THEN clock_timestamp() + ${interval} * interval '1 minute'
            ELSE NULL
          END
        )
        ON CONFLICT (carrier_connection_id, sync_type)
        DO UPDATE SET
          enabled = excluded.enabled,
          interval_minutes = excluded.interval_minutes,
          next_run_at = excluded.next_run_at,
          updated_at = clock_timestamp()
        RETURNING *
      `;
      return { ...rows[0], available: this.available(c.provider, type) };
    });
  }
  async claim(workerId: string) {
    if (!this.config.enabled) return null;
    const selected = await this.client.$transaction(async (tx) => {
      const pairs = await tx.$queryRaw<
        { provider: string; sync_type: SyncType }[]
      >`
        SELECT DISTINCT provider, sync_type
        FROM sync_jobs
        WHERE status = ANY(${ACTIVE_SYNC_JOBS}::text[])
      `;
      const eligible = pairs
        .filter((p) => this.available(p.provider, p.sync_type))
        .map((p) => p.provider + ":" + p.sync_type);
      if (!eligible.length) return null;
      const rows = await tx.$queryRaw<SyncJob[]>(
        buildClaimCandidateQuery({ eligible }),
      );
      const job = rows[0];
      if (!job || !this.available(job.provider, job.sync_type)) return null;
      const reclaimed = job.status === J.RUNNING;
      const attempts = job.attempt_count + (reclaimed ? 1 : 0);
      if (reclaimed && attempts >= this.config.maxAttempts)
        return { job, exhausted: true };
      // Advance lease_version on claim; clock_timestamp() anchors lease_expires_at and started_at to DB time.
      const claimed = await tx.$queryRaw<SyncJob[]>`
        UPDATE sync_jobs
        SET
          status = ${J.RUNNING},
          attempt_count = ${attempts},
          worker_id = ${workerId}::uuid,
          lease_version = lease_version + 1,
          lease_expires_at = clock_timestamp() + ${this.config.leaseSeconds} * interval '1 second',
          started_at = coalesce(started_at, clock_timestamp()),
          updated_at = clock_timestamp()
        WHERE id = ${job.id}::uuid
        RETURNING *
      `;
      return { job: claimed[0], exhausted: false };
    });
    if (!selected) return null;
    const candidate = selected.job;
    try {
      if (selected.exhausted) {
        // The selection lock is released. Finalize only under normal lifecycle order.
        return await this.client.$transaction(async (tx) => {
          if (!candidate.carrier_connection_id) return null;
          const connection = await this.connection(
            tx,
            candidate.owner_user_id,
            candidate.carrier_connection_id,
            true,
          );
          if (
            connection.generation !== candidate.generation ||
            connection.lifecycle_version !== candidate.lifecycle_version ||
            !this.available(connection.provider, candidate.sync_type)
          )
            throw new SyncError(E.SYNC_STALE);
          // Re-lock and verify lease_version and expired clock_timestamp() before marking exhausted job FAILED.
          const rows = await tx.$queryRaw<SyncJob[]>`
            SELECT *
            FROM sync_jobs
            WHERE id = ${candidate.id}::uuid
              AND lease_version = ${candidate.lease_version}
              AND status = ${J.RUNNING}
              AND lease_expires_at <= clock_timestamp()
            FOR UPDATE
          `;
          const current = rows[0];
          if (!current || current.attempt_count + 1 < this.config.maxAttempts)
            return null;
          // Fence failure transition to lease_version and advance lease_version; clock_timestamp() records completion.
          const [failed] = await tx.$queryRaw<{ finished_at: Date }[]>`
            UPDATE sync_jobs
            SET
              status = ${J.FAILED},
              attempt_count = attempt_count + 1,
              last_error_code = ${E.INTERNAL_ERROR},
              lease_version = lease_version + 1,
              worker_id = NULL,
              lease_expires_at = NULL,
              finished_at = clock_timestamp(),
              updated_at = clock_timestamp()
            WHERE id = ${current.id}::uuid
              AND lease_version = ${current.lease_version}
            RETURNING finished_at
          `;
          await tx.$executeRaw`
            UPDATE sync_configs
            SET
              last_completed_at = ${failed.finished_at},
              next_run_at = CASE WHEN enabled
                THEN ${failed.finished_at}::timestamptz + interval_minutes * interval '1 minute'
                ELSE NULL
              END
            WHERE carrier_connection_id = ${current.carrier_connection_id}::uuid
              AND sync_type = ${current.sync_type}
          `;
          return null;
        });
      }
      await this.client.$transaction((tx) => this.fence(tx, candidate));
      return candidate;
    } catch (error) {
      if (!(error instanceof SyncError)) throw error;
      if (error.code === E.SYNC_STALE || error.code === E.SYNC_UNAVAILABLE) {
        await this.client.$transaction(async (tx) => {
          if (!candidate.carrier_connection_id) return;
          await this.connection(
            tx,
            candidate.owner_user_id,
            candidate.carrier_connection_id,
          );
          // Fence stale-claim cancellation to lease_version and worker_id; clock_timestamp() records finish time.
          await tx.$executeRaw`
            UPDATE sync_jobs
            SET
              status = ${J.CANCELLED},
              last_error_code = ${E.SYNC_STALE},
              lease_version = lease_version + 1,
              worker_id = NULL,
              lease_expires_at = NULL,
              finished_at = clock_timestamp()
            WHERE id = ${candidate.id}::uuid
              AND lease_version = ${candidate.lease_version}
              AND worker_id = ${candidate.worker_id}::uuid
              AND status = ${J.RUNNING}
          `;
        });
      } else if (error.code !== E.UNAUTHORIZED && error.code !== E.NOT_FOUND)
        throw error;
      return null;
    }
  }
  async heartbeat(job: SyncJob) {
    await this.client.$transaction(async (tx) => {
      await this.fence(tx, job);
      // Fence lease renewal to active lease_version; clock_timestamp() anchors new expiry to DB time.
      await tx.$executeRaw`
        UPDATE sync_jobs
        SET
          lease_expires_at = clock_timestamp() + ${this.config.leaseSeconds} * interval '1 second'
        WHERE id = ${job.id}::uuid
          AND lease_version = ${job.lease_version}
      `;
    });
  }
  async page(job: SyncJob, page: SyncPage, processorVersion: number) {
    if (
      !Number.isSafeInteger(processorVersion) ||
      processorVersion < 1 ||
      page.records.length > 500 ||
      (!page.done &&
        !(page.nextPage && page.nextPage > job.next_page) &&
        !(page.nextCursor && page.nextCursor !== job.next_cursor))
    )
      throw new SyncError(E.SOURCE_INVALID);
    const scan = this.capabilities.resolve(
      job.provider,
      job.sync_type,
    )?.fullScan;
    if (scan) validateScanPage(scan, job, page);
    const unique = new Map<
      string,
      {
        scheme: string;
        key: string;
        hash: string;
        payload: string;
        payloadHash: string;
        sourceOrder: number | null;
      }
    >();
    for (const r of page.records) {
      let fields: unknown;
      try {
        fields = JSON.parse(r.identity.key);
      } catch {
        throw new SyncError(E.SOURCE_INVALID);
      }
      if (!Array.isArray(fields)) throw new SyncError(E.SOURCE_INVALID);
      const identity = sourceKey(r.identity.scheme, fields);
      if (scan && identity.scheme !== scan.sourceKeyScheme)
        throw new SyncError(E.SOURCE_INVALID);
      if (
        identity.key !== r.identity.key ||
        identity.hash !== r.identity.hash ||
        (r.sourceOrder !== undefined &&
          (!Number.isSafeInteger(r.sourceOrder) || r.sourceOrder < 0))
      )
        throw new SyncError(E.SOURCE_INVALID);
      const payload = canonicalPayload(r.payload),
        entry = {
          ...identity,
          payload,
          payloadHash: payloadHash(payload),
          sourceOrder: r.sourceOrder ?? null,
        };
      const key = identity.scheme + ":" + identity.hash,
        prior = unique.get(key);
      if (prior && prior.payloadHash !== entry.payloadHash)
        throw new SyncError(E.SOURCE_CONFLICT);
      if (
        prior &&
        prior.sourceOrder !== null &&
        (entry.sourceOrder === null || entry.sourceOrder < prior.sourceOrder)
      )
        continue;
      unique.set(key, entry);
    }
    if (scan && unique.size !== page.records.length)
      throw new SyncError(E.SOURCE_CONFLICT);
    await this.client.$transaction(
      async (tx) => {
        const current = await this.fence(tx, job);
        const expectedScope = scan ? scanScopeFingerprint(current, scan) : null;
        if (
          current.scan_scope_fingerprint &&
          current.scan_scope_fingerprint !== expectedScope
        )
          throw new SyncError(E.SOURCE_INVALID);
        if (scan) validateScanPage(scan, current, page);
        if (
          current.processing_phase !== P.FETCHING ||
          current.next_page !== job.next_page ||
          current.next_cursor !== job.next_cursor
        )
          throw new SyncError(E.SYNC_STALE);
        const input = JSON.stringify([...unique.values()]);
        const old = await tx.$queryRaw<
          {
            id: string;
            source_key: string;
            source_key_scheme: string;
            source_key_hash: string;
            last_observed_hash: string | null;
            observed_source_version: number;
            last_source_order: bigint | null;
            applied_processor_version: number | null;
          }[]
        >(
          buildLockExistingIdentitiesQuery({
            input,
            ownerUserId: job.owner_user_id,
            provider: job.provider,
            externalAccountId: job.external_account_id,
            syncType: job.sync_type,
          }),
        );
        let added = 0,
          changed = 0,
          unchanged = 0;
        const changes = [...unique.values()].map((r) => {
          const prior = old.find(
            (s) =>
              s.source_key_scheme === r.scheme && s.source_key_hash === r.hash,
          );
          if (prior && prior.source_key !== r.key)
            throw new SyncError(E.SOURCE_CONFLICT);
          const previousOrder = prior?.last_source_order ?? null;
          const incomingOrder =
            r.sourceOrder === null ? null : BigInt(r.sourceOrder);
          const hashChanged = prior?.last_observed_hash !== r.payloadHash;
          // Missing/equal order cannot establish which differing payload is newer,
          // including providers whose ordering is only a coarse timestamp.
          if (
            previousOrder !== null &&
            hashChanged &&
            (incomingOrder === null || incomingOrder === previousOrder)
          )
            throw new SyncError(E.SOURCE_CONFLICT);
          const stale =
            previousOrder !== null &&
            incomingOrder !== null &&
            incomingOrder < previousOrder;
          const differs = !stale && hashChanged;
          if (!prior) added++;
          else if (differs) changed++;
          else unchanged++;
          return {
            ...r,
            version: (prior?.observed_source_version ?? 0) + (differs ? 1 : 0),
            write: differs,
            stale,
          };
        });
        const data = JSON.stringify(changes);
        await tx.$executeRaw(
          buildUpsertSyncSourceIdentitiesQuery({
            ownerUserId: job.owner_user_id,
            provider: job.provider,
            externalAccountId: job.external_account_id,
            syncType: job.sync_type,
            data,
          }),
        );
        if (scan)
          await recordScanPage(
            tx,
            current,
            current.next_page,
            page.scan!.reportedTotal,
            [...unique.values()],
          );
        await tx.$executeRaw(
          buildUpsertProviderSourceRecordsQuery({
            ownerUserId: job.owner_user_id,
            provider: job.provider,
            externalAccountId: job.external_account_id,
            syncType: job.sync_type,
            processorVersion,
            data,
          }),
        );
        await tx.$executeRaw`
          UPDATE sync_job_items i
          SET
            source_version = p.source_version,
            processor_version = p.processor_version
          FROM provider_source_records p
          WHERE i.job_id = ${job.id}::uuid
            AND i.source_identity_id = p.source_identity_id
            AND i.processing_outcome = ${O.PENDING}
            AND (
              i.source_version < p.source_version
              OR i.processor_version < p.processor_version
            )
        `;
        await tx.$executeRaw(
          buildInsertSyncJobItemsQuery({
            jobId: job.id,
            ownerUserId: job.owner_user_id,
            provider: job.provider,
            externalAccountId: job.external_account_id,
            syncType: job.sync_type,
            data,
          }),
        );
        const summary =
          scan && page.done
            ? await readScanSummary(
                tx,
                { ...current, scan_scope_fingerprint: expectedScope },
                scan.sourceKeyScheme,
                current.next_page,
              )
            : null;
        await this.assertLease(tx, job);
        await tx.$executeRaw(
          buildAdvancePageJobQuery({
            jobId: job.id,
            leaseVersion: job.lease_version,
            expectedScope,
            scanIntegrityStatus: summary?.status ?? null,
            hasSummary: summary !== null,
            scanIntegrityReason: summary?.reason ?? null,
            scanObservedCount: summary?.observedCount ?? null,
            scanReportedTotal: summary?.reportedTotal ?? null,
            nextPage: page.nextPage ?? job.next_page,
            nextCursor: page.nextCursor ?? null,
            targetWatermark: page.watermark ?? job.target_watermark,
            processingPhase: page.done ? P.APPLYING : P.FETCHING,
            fetchedIncrement: page.records.length,
            newIncrement: added,
            changedIncrement: changed,
            unchangedIncrement: unchanged,
          }),
        );
        await this.release(tx, job);
      },
      { timeout: 15000 },
    );
  }
  async apply(job: SyncJob) {
    return this.client.$transaction(
      async (tx) => {
        const current = await this.fence(tx, job);
        const capability = this.capabilities.resolve(
          current.provider,
          current.sync_type,
        );
        if (!capability) throw new SyncError(E.PROCESSOR_UNAVAILABLE);
        const processor = capability.processor;
        if (current.processing_phase !== P.APPLYING)
          throw new SyncError(E.SYNC_STALE);
        // clock_timestamp() evaluates retry eligibility against commit-time DB clock.
        const eligible = Prisma.sql`
          (
            i.processing_outcome = ${O.PENDING}
            OR (
              i.processing_outcome = ${O.RETRYABLE_ERROR}
              AND i.attempt_count < ${this.config.maxAttempts}
            )
          )
        `;
        const ready = Prisma.sql`
          ${eligible}
          AND (
            p.next_retry_at IS NULL
            OR p.next_retry_at <= clock_timestamp()
          )
        `;
        // Lock batch of sync_job_items in deterministic i.id order before locking source records.
        const items = await tx.$queryRaw<
          {
            id: string;
            source_identity_id: string;
            source_version: number;
            processor_version: number;
            attempt_count: number;
          }[]
        >`
          SELECT i.*
          FROM sync_job_items i
          JOIN provider_source_records p
            ON p.source_identity_id = i.source_identity_id
          WHERE i.job_id = ${job.id}::uuid
            AND ${ready}
          ORDER BY i.id
          LIMIT 100
          FOR UPDATE OF i
        `;
        for (const item of items) {
          const sources = await tx.$queryRaw<
            {
              id: string;
              normalized_payload: Record<string, unknown>;
              source_version: number;
              processor_version: number;
              payload_hash: string;
            }[]
          >(
            buildLockSourceRecordForApplyQuery({
              sourceIdentityId: item.source_identity_id,
              ownerUserId: current.owner_user_id,
              provider: current.provider,
              externalAccountId: current.external_account_id,
              syncType: current.sync_type,
            }),
          );
          const source = sources[0];
          if (
            !source ||
            source.source_version !== item.source_version ||
            source.processor_version !== item.processor_version
          )
            throw new SyncError(E.SOURCE_CONFLICT);
          if (processor.version !== item.processor_version)
            throw new SyncError(E.PROCESSOR_UNAVAILABLE);
          const input: SyncSource = {
            id: source.id,
            sourceVersion: source.source_version,
            processorVersion: source.processor_version,
            payload: source.normalized_payload,
          };
          const execution = await capability.domain.begin(
            tx,
            current,
            Object.freeze(input),
            this.authorizationLocks,
          );
          try {
            const decision = await execution.decide();
            if (decision.outcome === O.RETRYABLE_ERROR) {
              const delay = retryDelay(
                item.attempt_count,
                decision.retryAfterMs,
              );
              // clock_timestamp() anchors retry backoff to commit-time DB clock.
              await tx.$executeRaw`
                UPDATE provider_source_records
                SET
                  processing_status = ${O.RETRYABLE_ERROR},
                  next_retry_at = clock_timestamp() + ${delay} * interval '1 millisecond',
                  attempt_count = attempt_count + 1,
                  last_error_code = ${E.INTERNAL_ERROR}
                WHERE source_identity_id = ${source.id}::uuid
              `;
              await tx.$executeRaw`
                UPDATE sync_job_items
                SET
                  processing_outcome = ${O.RETRYABLE_ERROR},
                  attempt_count = attempt_count + 1,
                  last_error_code = ${E.INTERNAL_ERROR}
                WHERE id = ${item.id}::uuid
              `;
              continue;
            }
            if (
              ![O.APPLIED, O.REJECTED_SOURCE, O.NEEDS_REVIEW].some(
                (o) => o === decision.outcome,
              )
            )
              throw new SyncError(E.PROCESSOR_UNAVAILABLE);
            const applied = decision.outcome === O.APPLIED;
            if (applied) await execution.commit();
            await tx.$executeRaw(
              buildMarkSourceRecordResolvedQuery({
                sourceIdentityId: source.id,
                sourceVersion: item.source_version,
                processorVersion: item.processor_version,
                outcome: decision.outcome,
                applied,
                errorCode: decision.code ?? null,
              }),
            );
            await tx.$executeRaw`
              UPDATE sync_source_identities
              SET
                last_resolved_hash = ${source.payload_hash},
                resolved_processor_version = ${processor.version},
                resolved_outcome = ${decision.outcome}
              WHERE id = ${source.id}::uuid
            `;
            if (applied)
              await tx.$executeRaw`
                UPDATE sync_source_identities
                SET
                  last_applied_hash = ${source.payload_hash},
                  applied_processor_version = ${processor.version},
                  last_applied_sync_job_id = ${job.id}::uuid
                WHERE id = ${source.id}::uuid
              `;
            // clock_timestamp() records item resolution time.
            await tx.$executeRaw`
              UPDATE sync_job_items
              SET
                processing_outcome = ${decision.outcome},
                attempt_count = attempt_count + 1,
                last_error_code = ${decision.code ?? null},
                processed_at = clock_timestamp()
              WHERE id = ${item.id}::uuid
            `;
          } finally {
            execution.close();
          }
        }
        await this.assertLease(tx, job);
        const counts = await tx.$queryRaw<{ outcome: string; count: bigint }[]>`
          SELECT
            processing_outcome AS outcome,
            count(*) AS count
          FROM sync_job_items
          WHERE job_id = ${job.id}::uuid
          GROUP BY processing_outcome
        `;
        const n = (outcome: string) =>
          Number(counts.find((c) => c.outcome === outcome)?.count ?? 0);
        // Fence counter update to active lease_version.
        await tx.$executeRaw`
          UPDATE sync_jobs
          SET
            applied_count = ${n(O.APPLIED)},
            rejected_count = ${n(O.REJECTED_SOURCE)},
            needs_review_count = ${n(O.NEEDS_REVIEW)},
            attempt_count = 0
          WHERE id = ${job.id}::uuid
            AND lease_version = ${job.lease_version}
        `;
        const done = counts.every((c) =>
          [O.APPLIED, O.REJECTED_SOURCE, O.NEEDS_REVIEW].some(
            (o) => o === c.outcome,
          ),
        );
        if (done) {
          if (
            current.scan_scope_fingerprint &&
            !current.scan_integrity_status
          ) {
            const summary = await readScanSummary(
              tx,
              current,
              capability.fullScan?.sourceKeyScheme ?? null,
              null,
            );
            await saveScanSummary(tx, current.id, summary);
          }
          if (capability.domain.finalize) {
            const scan = capability.fullScan;
            const reconciliation = await capability.domain.finalize(
              tx,
              current,
              {
                admitted:
                  current.reconciliation_version != null &&
                  current.reconciliation_version ===
                    capability.domain.finalizationVersion,
                scan,
                scanValidated:
                  current.scan_integrity_status ===
                  SyncScanIntegrityStatus.VALIDATED,
                scopeMatches:
                  !!scan &&
                  current.scan_scope_fingerprint ===
                    scanScopeFingerprint(current, scan),
              },
            );
            await tx.$executeRaw`
              UPDATE sync_jobs
              SET
                reconciliation_status = ${reconciliation.status},
                reconciliation_reason = ${reconciliation.reason},
                reconciliation_newly_hidden_count = ${reconciliation.newlyHidden},
                reconciliation_restored_count = ${reconciliation.restored},
                reconciliation_still_missing_count = ${reconciliation.stillMissing}
              WHERE id = ${current.id}::uuid
            `;
            await this.assertLease(tx, job);
          }
          if (current.scan_scope_fingerprint) await this.assertLease(tx, job);
          // clock_timestamp() records exact completion time and next scheduled run.
          await tx.$executeRaw`
            UPDATE sync_configs
            SET
              last_success_at = clock_timestamp(),
              last_completed_at = clock_timestamp(),
              last_completed_watermark = ${current.target_watermark},
              next_run_at = CASE WHEN enabled
                THEN clock_timestamp() + interval_minutes * interval '1 minute'
                ELSE NULL
              END,
              updated_at = clock_timestamp()
            WHERE carrier_connection_id = ${job.carrier_connection_id}::uuid
              AND sync_type = ${job.sync_type}
          `;
          // Fence final SUCCEEDED transition to lease_version; clock_timestamp() records finish time.
          await tx.$executeRaw`
            UPDATE sync_jobs
            SET
              status = ${J.SUCCEEDED},
              finished_at = clock_timestamp(),
              worker_id = NULL,
              lease_expires_at = NULL,
              updated_at = clock_timestamp()
            WHERE id = ${job.id}::uuid
              AND lease_version = ${job.lease_version}
          `;
          if (current.scan_scope_fingerprint)
            await tx.$executeRaw`
              DELETE FROM sync_job_seen_pages
              WHERE job_id = ${job.id}::uuid
            `;
        } else {
          const failed = await tx.$queryRaw<{ id: string }[]>`
            SELECT id
            FROM sync_job_items
            WHERE job_id = ${job.id}::uuid
              AND processing_outcome = ${O.RETRYABLE_ERROR}
              AND attempt_count >= ${this.config.maxAttempts}
            LIMIT 1
          `;
          const pending = await tx.$queryRaw<{ id: string }[]>`
            SELECT i.id
            FROM sync_job_items i
            WHERE i.job_id = ${job.id}::uuid
              AND ${eligible}
            LIMIT 1
          `;
          if (failed.length && !pending.length) {
            // Fence terminal FAILED transition to lease_version; clock_timestamp() records finish time.
            await tx.$executeRaw`
              UPDATE sync_jobs
              SET
                status = ${J.FAILED},
                last_error_code = ${E.INTERNAL_ERROR},
                finished_at = clock_timestamp(),
                worker_id = NULL,
                lease_expires_at = NULL
              WHERE id = ${job.id}::uuid
                AND lease_version = ${job.lease_version}
            `;
            // clock_timestamp() updates schedule completion and next run time.
            await tx.$executeRaw`
              UPDATE sync_configs
              SET
                last_completed_at = clock_timestamp(),
                next_run_at = CASE WHEN enabled
                  THEN clock_timestamp() + interval_minutes * interval '1 minute'
                  ELSE NULL
                END
              WHERE carrier_connection_id = ${job.carrier_connection_id}::uuid
                AND sync_type = ${job.sync_type}
            `;
          } else {
            await this.release(tx, job);
            await tx.$executeRaw(
              buildRescheduleApplyWaitQuery({
                jobId: job.id,
                leaseVersion: job.lease_version,
                ready,
                eligible,
              }),
            );
          }
        }
        return done;
      },
      { timeout: 15000 },
    );
  }
  async wait(job: SyncJob, code: SyncCode, retryAfterMs: number) {
    try {
      await this.client.$transaction(async (tx) => {
        const current = await this.fence(tx, job);
        const failed =
          current.attempt_count + 1 >= this.config.maxAttempts ||
          code === E.SOURCE_INVALID ||
          code === E.SOURCE_CONFLICT ||
          code === E.PROCESSOR_UNAVAILABLE ||
          code === E.SYNC_UNAVAILABLE;
        await this.assertLease(tx, job);
        // Fence wait/failure transition to lease_version; clock_timestamp() anchors retry/finish timestamps.
        await tx.$executeRaw`
          UPDATE sync_jobs
          SET
            status = ${failed ? J.FAILED : J.WAITING},
            last_error_code = ${code},
            attempt_count = attempt_count + 1,
            available_at = clock_timestamp() + ${retryAfterMs} * interval '1 millisecond',
            finished_at = CASE WHEN ${failed}
              THEN clock_timestamp()
              ELSE NULL
            END,
            worker_id = NULL,
            lease_expires_at = NULL,
            updated_at = clock_timestamp()
          WHERE id = ${job.id}::uuid
            AND lease_version = ${job.lease_version}
        `;
        if (failed)
          // clock_timestamp() records schedule completion and next run time.
          await tx.$executeRaw`
            UPDATE sync_configs
            SET
              last_completed_at = clock_timestamp(),
              next_run_at = CASE WHEN enabled
                THEN clock_timestamp() + interval_minutes * interval '1 minute'
                ELSE NULL
              END
            WHERE carrier_connection_id = ${job.carrier_connection_id}::uuid
              AND sync_type = ${job.sync_type}
          `;
      });
    } catch (error) {
      if (
        error instanceof SyncError &&
        (error.code === E.SYNC_STALE ||
          error.code === E.UNAUTHORIZED ||
          error.code === E.NOT_FOUND ||
          error.code === E.SYNC_UNAVAILABLE)
      )
        return;
      throw error;
    }
  }
  async schedule() {
    if (!this.config.enabled) return;
    const pairs = await this.client.$queryRaw<
      { provider: string; sync_type: SyncType }[]
    >`
      SELECT DISTINCT c.provider, s.sync_type
      FROM sync_configs s
      JOIN carrier_connections c
        ON c.id = s.carrier_connection_id
      WHERE s.enabled
    `;
    const eligible = pairs
      .filter((p) => this.available(p.provider, p.sync_type))
      .map((p) => p.provider + ":" + p.sync_type);
    if (!eligible.length) {
      this.scheduledAfter = undefined;
      return;
    }
    let scanned = 0,
      admitted = 0;
    while (scanned < 200 && admitted < 100) {
      const after = this.scheduledAfter;
      const due = await this.client.$queryRaw<
        {
          user_id: string;
          id: string;
          sync_type: SyncType;
          provider: string;
          config_id: string;
          cursor_at: string;
        }[]
      >(
        buildFindDueSyncSchedulesQuery({
          eligible,
          afterAt: after?.at ?? null,
          afterId: after?.id ?? null,
        }),
      );
      if (!due.length) {
        this.scheduledAfter = undefined;
        return;
      }
      for (const c of due) {
        this.scheduledAfter = { at: c.cursor_at, id: c.config_id };
        scanned++;
        try {
          await this.admit(c.user_id, c.id, c.sync_type, SyncTrigger.AUTO);
          admitted++;
        } catch (error) {
          if (!(error instanceof SyncError)) {
            const meta =
              error instanceof Prisma.PrismaClientKnownRequestError
                ? (error.meta as
                    | {
                        code?: unknown;
                        driverAdapterError?: {
                          cause?: { originalCode?: unknown };
                        };
                      }
                    | undefined)
                : undefined;
            const state =
              meta?.code ?? meta?.driverAdapterError?.cause?.originalCode;
            if (
              !(error instanceof Prisma.PrismaClientKnownRequestError) ||
              !(
                error.code === "P2034" ||
                (error.code === "P2010" &&
                  typeof state === "string" &&
                  ["55P03", "40P01", "40001"].includes(state))
              )
            )
              throw error;
          }
        }
        if (scanned >= 200 || admitted >= 100) return;
      }
      if (due.length < 100) {
        this.scheduledAfter = undefined;
        return;
      }
    }
  }
  async cleanup() {
    const removed = await this.client.$transaction(
      async (tx) => {
        const jobs = await tx.$queryRaw<SyncJob[]>(
          buildClaimCleanupJobsQuery(),
        );
        for (const job of jobs) {
          if (!job.scan_integrity_status) {
            const contract = this.capabilities.resolve(
              job.provider,
              job.sync_type,
            )?.fullScan;
            await saveScanSummary(
              tx,
              job.id,
              await readScanSummary(
                tx,
                job,
                contract?.sourceKeyScheme ?? null,
                null,
              ),
            );
          }
        }
        if (!jobs.length) return 0;
        return tx.$executeRaw`
          DELETE FROM sync_job_seen_pages
          WHERE (job_id, page_no) IN (
            SELECT
              job_id,
              page_no
            FROM sync_job_seen_pages
            WHERE job_id = ANY(${jobs.map((j) => j.id)}::uuid[])
            ORDER BY
              job_id,
              page_no
            LIMIT 500
          )
        `;
      },
      { timeout: 15000 },
    );
    if (!this.config.retentionDays) return removed;
    const payloads = await this.client.$executeRaw(
      buildDeleteExpiredPayloadsQuery({
        retentionDays: this.config.retentionDays,
      }),
    );
    return removed + payloads;
  }
  async close() {
    await this.instance?.$disconnect();
  }
  async onApplicationShutdown() {
    await this.close();
  }
}
