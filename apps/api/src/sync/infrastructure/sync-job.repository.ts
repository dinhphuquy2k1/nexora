import { isUuid } from "../../common/validation/uuid";
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
  SyncLinkOrigin,
  SyncType,
  SyncStrategy,
  ACTIVE_SYNC_JOBS,
  type SyncCode,
} from "../domain/sync.constants";
import type {
  SyncQueue,
  SyncJob,
  SyncPage,
  SyncDomainProcessor,
  SyncProvider,
  SyncSchedule,
  SyncSource,
  SyncJobFilters,
  SyncIssue,
  SyncJobSummary,
} from "../application/sync.port";
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
    private readonly provider: SyncProvider,
    private readonly processor: SyncDomainProcessor,
    private readonly authorizationLocks: "exclusive" | "shared" = "exclusive",
  ) {}
  get client(): PrismaClient {
    return (this.instance ??= createDatabase(this.url));
  }
  available(provider: string, type: SyncType) {
    return (
      this.config.enabled &&
      this.config.types.includes(type) &&
      Object.values(SyncStrategy).some(
        (strategy) => strategy === this.provider.strategy(provider, type),
      ) &&
      this.processor.supports(type)
    );
  }
  private async connection(
    tx: Tx,
    userId: string,
    id: string,
    connected = false,
    mode: ConnectionLockMode = "write",
  ): Promise<Connection> {
    const lock = Prisma.raw(mode === "read" ? "FOR SHARE" : "FOR UPDATE");
    const u =
      this.authorizationLocks === "shared"
        ? await tx.$queryRaw<
            { status: string }[]
          >`SELECT status FROM public.sync_lock_user(${userId}::uuid)`
        : await tx.$queryRaw<
            { status: string }[]
          >`SELECT status FROM users WHERE id=${userId}::uuid ${lock}`;
    if (u[0]?.status !== UserStatus.ACTIVE) throw new SyncError(E.UNAUTHORIZED);
    const epochs =
      this.authorizationLocks === "shared"
        ? await tx.$queryRaw<
            { generation: number }[]
          >`SELECT generation FROM public.sync_lock_epoch(${userId}::uuid)`
        : await tx.$queryRaw<
            { generation: number }[]
          >`SELECT generation FROM carrier_user_states WHERE user_id=${userId}::uuid ${lock}`;
    const rows =
      this.authorizationLocks === "shared"
        ? await tx.$queryRaw<
            Omit<Connection, "generation">[]
          >`SELECT * FROM public.sync_lock_connection(${id}::uuid,${userId}::uuid)`
        : await tx.$queryRaw<
            Omit<Connection, "generation">[]
          >`SELECT id,user_id,provider,external_account_id,status,lifecycle_version FROM carrier_connections WHERE id=${id}::uuid AND user_id=${userId}::uuid ${lock}`;
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
    const rows = await tx.$queryRaw<
      SyncJob[]
    >`SELECT * FROM sync_jobs WHERE id=${job.id}::uuid FOR UPDATE`;
    const current = rows[0];
    if (
      !this.available(c.provider, job.sync_type) ||
      !current ||
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
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM sync_jobs WHERE id=${job.id}::uuid AND lease_version=${job.lease_version} AND status=${J.RUNNING} AND worker_id=${job.worker_id}::uuid AND lease_expires_at>clock_timestamp()`;
    if (rows.length !== 1) throw new SyncError(E.SYNC_STALE);
  }
  private async release(tx: Tx, job: SyncJob) {
    await this.assertLease(tx, job);
    await tx.$executeRaw`UPDATE sync_jobs SET status=${J.WAITING},available_at=clock_timestamp(),worker_id=NULL,lease_expires_at=NULL,updated_at=clock_timestamp() WHERE id=${job.id}::uuid AND lease_version=${job.lease_version}`;
  }
  async admit(
    userId: string,
    id: string,
    type: SyncType,
    trigger: (typeof SyncTrigger)[keyof typeof SyncTrigger],
  ) {
    return this.client.$transaction(async (tx) => {
      const c = await this.connection(tx, userId, id, true);
      if (!this.available(c.provider, type))
        throw new SyncError(E.SYNC_UNAVAILABLE);
      // Static predicate preserves PostgreSQL partial-index inference; covered by
      // integration/fixtures/sync-status-contract.cjs prepared/admit contract.
      const rows = await tx.$queryRaw<
        SyncJob[]
      >`INSERT INTO sync_jobs(carrier_connection_id,owner_user_id,provider,external_account_id,sync_type,trigger_source,generation,lifecycle_version,fetch_strategy,target_watermark)
   VALUES(${id}::uuid,${userId}::uuid,${c.provider},${c.external_account_id},${type},${trigger},${c.generation},${c.lifecycle_version},${this.provider.strategy(c.provider, type)},coalesce((SELECT last_completed_watermark FROM sync_configs WHERE carrier_connection_id=${id}::uuid AND sync_type=${type}),(SELECT target_watermark FROM sync_jobs WHERE carrier_connection_id=${id}::uuid AND owner_user_id=${userId}::uuid AND sync_type=${type} AND status=${J.SUCCEEDED} ORDER BY finished_at DESC,id DESC LIMIT 1)))
   ON CONFLICT(carrier_connection_id,sync_type) WHERE status IN ('QUEUED','RUNNING','WAITING') DO NOTHING RETURNING *`;
      if (rows[0]) return rows[0];
      const active = await tx.$queryRaw<
        SyncJob[]
      >`SELECT * FROM sync_jobs WHERE carrier_connection_id=${id}::uuid AND sync_type=${type} AND status=ANY(${ACTIVE_SYNC_JOBS}::text[])`;
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
      const counts = await tx.$queryRaw<
        { total: bigint }[]
      >`SELECT count(*) AS total FROM sync_jobs WHERE owner_user_id=${userId}::uuid AND carrier_connection_id=${id}::uuid AND (${type}::text IS NULL OR sync_type=${type}) AND (cardinality(${statuses}::text[])=0 OR status=ANY(${statuses}::text[])) AND (${from}::timestamptz IS NULL OR coalesce(started_at,created_at)>=${from}) AND (${until}::timestamptz IS NULL OR coalesce(started_at,created_at)<=${until})`;
      const jobs = await tx.$queryRaw<
        SyncJob[]
      >`SELECT * FROM sync_jobs WHERE owner_user_id=${userId}::uuid AND carrier_connection_id=${id}::uuid AND (${type}::text IS NULL OR sync_type=${type}) AND (cardinality(${statuses}::text[])=0 OR status=ANY(${statuses}::text[])) AND (${from}::timestamptz IS NULL OR coalesce(started_at,created_at)>=${from}) AND (${until}::timestamptz IS NULL OR coalesce(started_at,created_at)<=${until}) ORDER BY created_at DESC,id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
      const totals = await tx.$queryRaw<
        { status: string; sync_type: SyncType; n: bigint }[]
      >`SELECT status,sync_type,count(*) AS n FROM sync_jobs WHERE owner_user_id=${userId}::uuid AND carrier_connection_id=${id}::uuid GROUP BY status,sync_type`;
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
      const jobs = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM sync_jobs WHERE id=${jobId}::uuid AND carrier_connection_id=${id}::uuid AND owner_user_id=${userId}::uuid`;
      if (!jobs[0]) throw new SyncError(E.NOT_FOUND);
      const counts = await tx.$queryRaw<
        { total: bigint }[]
      >`SELECT count(*) AS total FROM sync_job_items WHERE job_id=${jobId}::uuid AND processing_outcome=ANY(${ISSUE_OUTCOMES}::text[])`;
      const issues = await tx.$queryRaw<
        SyncIssue[]
      >`SELECT id,source_identity_id,source_version,processor_version,processing_outcome,last_error_code FROM sync_job_items WHERE job_id=${jobId}::uuid AND processing_outcome=ANY(${ISSUE_OUTCOMES}::text[]) ORDER BY id LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
      return { issues, total: Number(counts[0].total) };
    });
  }
  async job(userId: string, id: string, jobId: string) {
    return this.client.$transaction(async (tx) => {
      await this.connection(tx, userId, id, false, "read");
      const rows = await tx.$queryRaw<
        SyncJob[]
      >`SELECT * FROM sync_jobs WHERE id=${jobId}::uuid AND carrier_connection_id=${id}::uuid AND owner_user_id=${userId}::uuid`;
      if (!rows[0]) throw new SyncError(E.NOT_FOUND);
      return rows[0];
    });
  }
  async configs(userId: string, id: string) {
    return this.client.$transaction(async (tx) => {
      const c = await this.connection(tx, userId, id, false, "read");
      const rows = await tx.$queryRaw<
        SyncSchedule[]
      >`SELECT * FROM sync_configs WHERE carrier_connection_id=${id}::uuid`;
      const latest = await tx.$queryRaw<
        SyncJob[]
      >`SELECT DISTINCT ON (sync_type) * FROM sync_jobs WHERE carrier_connection_id=${id}::uuid AND owner_user_id=${userId}::uuid ORDER BY sync_type,created_at DESC,id DESC`;
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
      const rows = await tx.$queryRaw<
        SyncSchedule[]
      >`INSERT INTO sync_configs(carrier_connection_id,sync_type,enabled,interval_minutes,next_run_at) VALUES(${id}::uuid,${type},${enabled},${interval},CASE WHEN ${enabled} THEN clock_timestamp()+${interval}*interval '1 minute' ELSE NULL END) ON CONFLICT(carrier_connection_id,sync_type) DO UPDATE SET enabled=excluded.enabled,interval_minutes=excluded.interval_minutes,next_run_at=excluded.next_run_at,updated_at=clock_timestamp() RETURNING *`;
      return { ...rows[0], available: this.available(c.provider, type) };
    });
  }
  async claim(workerId: string) {
    if (!this.config.enabled || !this.config.types.length) return null;
    const selected = await this.client.$transaction(async (tx) => {
      const pairs = await tx.$queryRaw<
        { provider: string; sync_type: SyncType }[]
      >`SELECT DISTINCT provider,sync_type FROM sync_jobs WHERE status=ANY(${ACTIVE_SYNC_JOBS}::text[])`;
      const eligible = pairs
        .filter((p) => this.available(p.provider, p.sync_type))
        .map((p) => p.provider + ":" + p.sync_type);
      if (!eligible.length) return null;
      const rows = await tx.$queryRaw<
        SyncJob[]
      >`SELECT j.* FROM sync_jobs j WHERE sync_type=ANY(${[...this.config.types]}::text[]) AND (provider||':'||sync_type)=ANY(${eligible}::text[]) AND ((status=ANY(${[J.QUEUED, J.WAITING]}::text[]) AND available_at<=clock_timestamp()) OR (status=${J.RUNNING} AND lease_expires_at<=clock_timestamp())) ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1`;
      const job = rows[0];
      if (!job || !this.available(job.provider, job.sync_type)) return null;
      const reclaimed = job.status === J.RUNNING;
      const attempts = job.attempt_count + (reclaimed ? 1 : 0);
      if (reclaimed && attempts >= this.config.maxAttempts)
        return { job, exhausted: true };
      const claimed = await tx.$queryRaw<
        SyncJob[]
      >`UPDATE sync_jobs SET status=${J.RUNNING},attempt_count=${attempts},worker_id=${workerId}::uuid,lease_version=lease_version+1,lease_expires_at=clock_timestamp()+${this.config.leaseSeconds}*interval '1 second',started_at=coalesce(started_at,clock_timestamp()),updated_at=clock_timestamp() WHERE id=${job.id}::uuid RETURNING *`;
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
          const rows = await tx.$queryRaw<
            SyncJob[]
          >`SELECT * FROM sync_jobs WHERE id=${candidate.id}::uuid AND lease_version=${candidate.lease_version} AND status=${J.RUNNING} AND lease_expires_at<=clock_timestamp() FOR UPDATE`;
          const current = rows[0];
          if (!current || current.attempt_count + 1 < this.config.maxAttempts)
            return null;
          const [failed] = await tx.$queryRaw<
            { finished_at: Date }[]
          >`UPDATE sync_jobs SET status=${J.FAILED},attempt_count=attempt_count+1,last_error_code=${E.INTERNAL_ERROR},lease_version=lease_version+1,worker_id=NULL,lease_expires_at=NULL,finished_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=${current.id}::uuid AND lease_version=${current.lease_version} RETURNING finished_at`;
          await tx.$executeRaw`UPDATE sync_configs SET last_completed_at=${failed.finished_at},next_run_at=CASE WHEN enabled THEN ${failed.finished_at}::timestamptz+interval_minutes*interval '1 minute' ELSE NULL END WHERE carrier_connection_id=${current.carrier_connection_id}::uuid AND sync_type=${current.sync_type}`;
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
          await tx.$executeRaw`UPDATE sync_jobs SET status=${J.CANCELLED},last_error_code=${E.SYNC_STALE},lease_version=lease_version+1,worker_id=NULL,lease_expires_at=NULL,finished_at=clock_timestamp() WHERE id=${candidate.id}::uuid AND lease_version=${candidate.lease_version} AND worker_id=${candidate.worker_id}::uuid AND status=${J.RUNNING}`;
        });
      } else if (error.code !== E.UNAUTHORIZED && error.code !== E.NOT_FOUND)
        throw error;
      return null;
    }
  }
  async heartbeat(job: SyncJob) {
    await this.client.$transaction(async (tx) => {
      await this.fence(tx, job);
      await tx.$executeRaw`UPDATE sync_jobs SET lease_expires_at=clock_timestamp()+${this.config.leaseSeconds}*interval '1 second' WHERE id=${job.id}::uuid AND lease_version=${job.lease_version}`;
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
    await this.client.$transaction(
      async (tx) => {
        const current = await this.fence(tx, job);
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
        >`SELECT s.* FROM sync_source_identities s JOIN jsonb_to_recordset(${input}::jsonb) AS r(scheme text,hash text) ON s.source_key_scheme=r.scheme AND s.source_key_hash=r.hash WHERE owner_user_id=${job.owner_user_id}::uuid AND provider=${job.provider} AND external_account_id=${job.external_account_id} AND sync_type=${job.sync_type} FOR UPDATE OF s`;
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
        await tx.$executeRaw`INSERT INTO sync_source_identities(owner_user_id,provider,external_account_id,sync_type,source_key_scheme,source_key,source_key_hash,last_observed_hash,observed_source_version,last_source_order) SELECT ${job.owner_user_id}::uuid,${job.provider},${job.external_account_id},${job.sync_type},scheme,key,hash,"payloadHash",version,"sourceOrder" FROM jsonb_to_recordset(${data}::jsonb) AS r(scheme text,key text,hash text,"payloadHash" text,version int,"sourceOrder" bigint,stale boolean) WHERE NOT stale ON CONFLICT(owner_user_id,provider,external_account_id,sync_type,source_key_scheme,source_key_hash) DO UPDATE SET last_observed_hash=excluded.last_observed_hash,observed_source_version=excluded.observed_source_version,last_source_order=coalesce(excluded.last_source_order,sync_source_identities.last_source_order),updated_at=clock_timestamp() WHERE sync_source_identities.source_key=excluded.source_key AND (sync_source_identities.last_observed_hash IS DISTINCT FROM excluded.last_observed_hash OR (excluded.last_source_order IS NOT NULL AND (sync_source_identities.last_source_order IS NULL OR excluded.last_source_order>sync_source_identities.last_source_order)))`;
        await tx.$executeRaw`INSERT INTO provider_source_records(source_identity_id,normalized_payload,payload_hash,source_version,processor_version) SELECT s.id,r.payload::jsonb,r."payloadHash",r.version,${processorVersion} FROM jsonb_to_recordset(${data}::jsonb) AS r(scheme text,hash text,payload text,"payloadHash" text,version int,stale boolean) JOIN sync_source_identities s ON s.source_key_scheme=r.scheme AND s.source_key_hash=r.hash AND s.owner_user_id=${job.owner_user_id}::uuid AND s.provider=${job.provider} AND s.external_account_id=${job.external_account_id} AND s.sync_type=${job.sync_type} WHERE NOT r.stale AND (s.last_resolved_hash IS DISTINCT FROM r."payloadHash" OR s.resolved_processor_version IS DISTINCT FROM ${processorVersion} OR EXISTS(SELECT 1 FROM provider_source_records p WHERE p.source_identity_id=s.id)) ON CONFLICT(source_identity_id) DO UPDATE SET normalized_payload=CASE WHEN provider_source_records.payload_hash IS DISTINCT FROM excluded.payload_hash THEN excluded.normalized_payload ELSE provider_source_records.normalized_payload END,payload_hash=excluded.payload_hash,source_version=excluded.source_version,processor_version=excluded.processor_version,processing_status=${O.PENDING},attempt_count=0,last_error_code=NULL,next_retry_at=NULL,updated_at=clock_timestamp() WHERE provider_source_records.source_version<excluded.source_version OR provider_source_records.processor_version<excluded.processor_version`;
        await tx.$executeRaw`UPDATE sync_job_items i SET source_version=p.source_version,processor_version=p.processor_version FROM provider_source_records p WHERE i.job_id=${job.id}::uuid AND i.source_identity_id=p.source_identity_id AND i.processing_outcome=${O.PENDING} AND (i.source_version<p.source_version OR i.processor_version<p.processor_version)`;
        await tx.$executeRaw`INSERT INTO sync_job_items(job_id,source_identity_id,source_version,processor_version) SELECT ${job.id}::uuid,p.source_identity_id,p.source_version,p.processor_version FROM provider_source_records p JOIN sync_source_identities s ON s.id=p.source_identity_id JOIN jsonb_to_recordset(${data}::jsonb) AS r(scheme text,hash text,stale boolean) ON s.source_key_scheme=r.scheme AND s.source_key_hash=r.hash WHERE s.owner_user_id=${job.owner_user_id}::uuid AND s.provider=${job.provider} AND s.external_account_id=${job.external_account_id} AND s.sync_type=${job.sync_type} AND NOT r.stale AND p.processing_status=ANY(${[O.PENDING, O.RETRYABLE_ERROR]}::text[]) ON CONFLICT DO NOTHING`;
        await this.assertLease(tx, job);
        await tx.$executeRaw`UPDATE sync_jobs SET next_page=${page.nextPage ?? job.next_page},next_cursor=${page.nextCursor ?? null},target_watermark=${page.watermark ?? job.target_watermark},processing_phase=${page.done ? P.APPLYING : P.FETCHING},fetched_count=fetched_count+${page.records.length},new_count=new_count+${added},changed_count=changed_count+${changed},unchanged_count=unchanged_count+${unchanged},attempt_count=0 WHERE id=${job.id}::uuid AND lease_version=${job.lease_version}`;
        await this.release(tx, job);
      },
      { timeout: 15000 },
    );
  }
  async apply(job: SyncJob, processor: SyncDomainProcessor) {
    return this.client.$transaction(
      async (tx) => {
        const current = await this.fence(tx, job);
        if (current.processing_phase !== P.APPLYING)
          throw new SyncError(E.SYNC_STALE);
        const eligible = Prisma.sql`(i.processing_outcome=${O.PENDING} OR (i.processing_outcome=${O.RETRYABLE_ERROR} AND i.attempt_count<${this.config.maxAttempts}))`;
        const ready = Prisma.sql`${eligible} AND (p.next_retry_at IS NULL OR p.next_retry_at<=clock_timestamp())`;
        const items = await tx.$queryRaw<
          {
            id: string;
            source_identity_id: string;
            source_version: number;
            processor_version: number;
            attempt_count: number;
          }[]
        >`SELECT i.* FROM sync_job_items i JOIN provider_source_records p ON p.source_identity_id=i.source_identity_id WHERE i.job_id=${job.id}::uuid AND ${ready} ORDER BY i.id LIMIT 100 FOR UPDATE OF i`;
        for (const item of items) {
          const sources = await tx.$queryRaw<
            {
              id: string;
              normalized_payload: Record<string, unknown>;
              source_version: number;
              processor_version: number;
              payload_hash: string;
              customer_id: string | null;
            }[]
          >`SELECT s.id,p.normalized_payload,p.source_version,p.processor_version,p.payload_hash,s.customer_id FROM sync_source_identities s JOIN provider_source_records p ON p.source_identity_id=s.id WHERE s.id=${item.source_identity_id}::uuid FOR UPDATE OF s,p`;
          const source = sources[0];
          if (
            !source ||
            source.source_version !== item.source_version ||
            source.processor_version !== item.processor_version
          )
            throw new SyncError(E.SOURCE_CONFLICT);
          if (processor.version !== item.processor_version)
            throw new SyncError(E.PROCESSOR_UNAVAILABLE);
          let proposedCustomerId: string | null = null;
          const input: SyncSource = {
            id: source.id,
            sourceVersion: source.source_version,
            processorVersion: source.processor_version,
            payload: source.normalized_payload,
            customerId: source.customer_id,
          };
          const decision = await processor.apply(input, {
            linkExistingCustomer: async (id) => {
              if (
                !isUuid(id) ||
                (source.customer_id && source.customer_id !== id) ||
                (proposedCustomerId && proposedCustomerId !== id)
              )
                throw new SyncError(E.SOURCE_CONFLICT);
              const rows =
                this.authorizationLocks === "shared"
                  ? await tx.$queryRaw<
                      { id: string }[]
                    >`SELECT id FROM public.sync_lock_customer(${id}::uuid,${job.owner_user_id}::uuid)`
                  : await tx.$queryRaw<
                      { id: string }[]
                    >`SELECT id FROM customers WHERE id=${id}::uuid AND owner_user_id=${job.owner_user_id}::uuid FOR UPDATE`;
              if (rows.length !== 1) throw new SyncError(E.SOURCE_CONFLICT);
              proposedCustomerId = id;
            },
          });
          if (decision.outcome === O.RETRYABLE_ERROR) {
            const delay = retryDelay(item.attempt_count, decision.retryAfterMs);
            await tx.$executeRaw`UPDATE provider_source_records SET processing_status=${O.RETRYABLE_ERROR},next_retry_at=clock_timestamp()+${delay}*interval '1 millisecond',attempt_count=attempt_count+1,last_error_code=${E.INTERNAL_ERROR} WHERE source_identity_id=${source.id}::uuid`;
            await tx.$executeRaw`UPDATE sync_job_items SET processing_outcome=${O.RETRYABLE_ERROR},attempt_count=attempt_count+1,last_error_code=${E.INTERNAL_ERROR} WHERE id=${item.id}::uuid`;
            continue;
          }
          if (
            ![O.APPLIED, O.REJECTED_SOURCE, O.NEEDS_REVIEW].some(
              (o) => o === decision.outcome,
            ) ||
            (decision.outcome === O.APPLIED && !proposedCustomerId)
          )
            throw new SyncError(E.PROCESSOR_UNAVAILABLE);
          const applied = decision.outcome === O.APPLIED;
          if (applied)
            await tx.$executeRaw`UPDATE sync_source_identities SET customer_id=${proposedCustomerId}::uuid,link_origin=${SyncLinkOrigin.LINKED_EXISTING},last_applied_sync_job_id=${job.id}::uuid WHERE id=${source.id}::uuid`;
          await tx.$executeRaw`UPDATE provider_source_records SET processing_status=${decision.outcome},applied_version=CASE WHEN ${applied} THEN source_version ELSE applied_version END,resolved_version=source_version,applied_processor_version=CASE WHEN ${applied} THEN processor_version ELSE applied_processor_version END,last_error_code=${decision.code ?? null},processed_at=clock_timestamp(),attempt_count=attempt_count+1 WHERE source_identity_id=${source.id}::uuid AND source_version=${item.source_version} AND processor_version=${item.processor_version}`;
          await tx.$executeRaw`UPDATE sync_source_identities SET last_resolved_hash=${source.payload_hash},resolved_processor_version=${processor.version},resolved_outcome=${decision.outcome} WHERE id=${source.id}::uuid`;
          if (applied)
            await tx.$executeRaw`UPDATE sync_source_identities SET last_applied_hash=${source.payload_hash},applied_processor_version=${processor.version},last_applied_sync_job_id=${job.id}::uuid WHERE id=${source.id}::uuid`;
          await tx.$executeRaw`UPDATE sync_job_items SET processing_outcome=${decision.outcome},attempt_count=attempt_count+1,last_error_code=${decision.code ?? null},processed_at=clock_timestamp() WHERE id=${item.id}::uuid`;
        }
        await this.assertLease(tx, job);
        const counts = await tx.$queryRaw<
          { outcome: string; count: bigint }[]
        >`SELECT processing_outcome AS outcome,count(*) AS count FROM sync_job_items WHERE job_id=${job.id}::uuid GROUP BY processing_outcome`;
        const n = (outcome: string) =>
          Number(counts.find((c) => c.outcome === outcome)?.count ?? 0);
        await tx.$executeRaw`UPDATE sync_jobs SET applied_count=${n(O.APPLIED)},rejected_count=${n(O.REJECTED_SOURCE)},needs_review_count=${n(O.NEEDS_REVIEW)},attempt_count=0 WHERE id=${job.id}::uuid AND lease_version=${job.lease_version}`;
        const done = counts.every((c) =>
          [O.APPLIED, O.REJECTED_SOURCE, O.NEEDS_REVIEW].some(
            (o) => o === c.outcome,
          ),
        );
        if (done) {
          await tx.$executeRaw`UPDATE sync_configs SET last_success_at=clock_timestamp(),last_completed_at=clock_timestamp(),last_completed_watermark=${current.target_watermark},next_run_at=CASE WHEN enabled THEN clock_timestamp()+interval_minutes*interval '1 minute' ELSE NULL END,updated_at=clock_timestamp() WHERE carrier_connection_id=${job.carrier_connection_id}::uuid AND sync_type=${job.sync_type}`;
          await tx.$executeRaw`UPDATE sync_jobs SET status=${J.SUCCEEDED},finished_at=clock_timestamp(),worker_id=NULL,lease_expires_at=NULL,updated_at=clock_timestamp() WHERE id=${job.id}::uuid AND lease_version=${job.lease_version}`;
        } else {
          const failed = await tx.$queryRaw<
            { id: string }[]
          >`SELECT id FROM sync_job_items WHERE job_id=${job.id}::uuid AND processing_outcome=${O.RETRYABLE_ERROR} AND attempt_count>=${this.config.maxAttempts} LIMIT 1`;
          const pending = await tx.$queryRaw<
            { id: string }[]
          >`SELECT i.id FROM sync_job_items i WHERE i.job_id=${job.id}::uuid AND ${eligible} LIMIT 1`;
          if (failed.length && !pending.length) {
            await tx.$executeRaw`UPDATE sync_jobs SET status=${J.FAILED},last_error_code=${E.INTERNAL_ERROR},finished_at=clock_timestamp(),worker_id=NULL,lease_expires_at=NULL WHERE id=${job.id}::uuid AND lease_version=${job.lease_version}`;
            await tx.$executeRaw`UPDATE sync_configs SET last_completed_at=clock_timestamp(),next_run_at=CASE WHEN enabled THEN clock_timestamp()+interval_minutes*interval '1 minute' ELSE NULL END WHERE carrier_connection_id=${job.carrier_connection_id}::uuid AND sync_type=${job.sync_type}`;
          } else {
            await this.release(tx, job);
            await tx.$executeRaw`UPDATE sync_jobs SET available_at=CASE WHEN EXISTS(SELECT 1 FROM sync_job_items i JOIN provider_source_records p ON p.source_identity_id=i.source_identity_id WHERE i.job_id=${job.id}::uuid AND ${ready}) THEN clock_timestamp() ELSE coalesce((SELECT min(p.next_retry_at) FROM sync_job_items i JOIN provider_source_records p ON p.source_identity_id=i.source_identity_id WHERE i.job_id=${job.id}::uuid AND ${eligible}),clock_timestamp()) END WHERE id=${job.id}::uuid AND lease_version=${job.lease_version}`;
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
        await tx.$executeRaw`UPDATE sync_jobs SET status=${failed ? J.FAILED : J.WAITING},last_error_code=${code},attempt_count=attempt_count+1,available_at=clock_timestamp()+${retryAfterMs}*interval '1 millisecond',finished_at=CASE WHEN ${failed} THEN clock_timestamp() ELSE NULL END,worker_id=NULL,lease_expires_at=NULL,updated_at=clock_timestamp() WHERE id=${job.id}::uuid AND lease_version=${job.lease_version}`;
        if (failed)
          await tx.$executeRaw`UPDATE sync_configs SET last_completed_at=clock_timestamp(),next_run_at=CASE WHEN enabled THEN clock_timestamp()+interval_minutes*interval '1 minute' ELSE NULL END WHERE carrier_connection_id=${job.carrier_connection_id}::uuid AND sync_type=${job.sync_type}`;
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
    if (!this.config.enabled || !this.config.types.length) return;
    const pairs = await this.client.$queryRaw<
      { provider: string; sync_type: SyncType }[]
    >`SELECT DISTINCT c.provider,s.sync_type FROM sync_configs s JOIN carrier_connections c ON c.id=s.carrier_connection_id WHERE s.enabled`;
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
      >`SELECT c.user_id,c.id,s.sync_type,c.provider,s.id AS config_id,s.next_run_at::text AS cursor_at FROM sync_configs s JOIN carrier_connections c ON c.id=s.carrier_connection_id JOIN users u ON u.id=c.user_id WHERE s.enabled AND s.next_run_at<=clock_timestamp() AND u.status=${UserStatus.ACTIVE} AND c.status=${ConnectionStatus.CONNECTED} AND (c.provider||':'||s.sync_type)=ANY(${eligible}::text[]) AND (${after?.at ?? null}::timestamptz IS NULL OR (s.next_run_at,s.id)>(${after?.at ?? null}::timestamptz,${after?.id ?? null}::uuid)) AND NOT EXISTS(SELECT 1 FROM sync_jobs j WHERE j.carrier_connection_id=c.id AND j.sync_type=s.sync_type AND j.status=ANY(${ACTIVE_SYNC_JOBS}::text[])) ORDER BY s.next_run_at,s.id LIMIT 100`;
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
    if (!this.config.retentionDays) return 0;
    return this.client
      .$executeRaw`DELETE FROM provider_source_records p WHERE p.id IN (SELECT id FROM provider_source_records WHERE processing_status=ANY(${[O.APPLIED, O.REJECTED_SOURCE]}::text[]) AND processed_at<clock_timestamp()-${this.config.retentionDays}*interval '1 day' ORDER BY id LIMIT 500) AND NOT EXISTS(SELECT 1 FROM sync_job_items i JOIN sync_jobs j ON j.id=i.job_id WHERE i.source_identity_id=p.source_identity_id AND j.status=ANY(${ACTIVE_SYNC_JOBS}::text[]))`;
  }
  async close() {
    await this.instance?.$disconnect();
  }
  async onApplicationShutdown() {
    await this.close();
  }
}
