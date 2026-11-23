import { Prisma } from "@nexora/database";
import type {
  FullScanContract,
  SyncJob,
  SyncPage,
} from "../application/sync.port";
import {
  SyncError,
  canonicalPayload,
  payloadHash,
} from "../domain/sync-policy";
import { SyncErrorCode as E, SyncStrategy } from "../domain/sync.constants";
import {
  SyncScanIntegrityStatus as I,
  SyncScanIntegrityReason as R,
  type SyncScanIntegrityStatusCode,
  type SyncScanIntegrityReasonCode,
} from "../domain/sync-observation.constants";
import { isUuid } from "../../common/validation/uuid";
type Tx = Prisma.TransactionClient;
export interface ScanFacts {
  pages: number;
  first: number | null;
  last: number | null;
  totalVariants: number;
  reportedTotal: number | null;
  observations: number;
  observedCount: number;
  scopeMismatches: number;
}
export interface ScanSummary {
  status: SyncScanIntegrityStatusCode;
  reason: SyncScanIntegrityReasonCode | null;
  observedCount: number;
  reportedTotal: number | null;
}
export function scanScopeFingerprint(
  job: Pick<
    SyncJob,
    "owner_user_id" | "provider" | "external_account_id" | "sync_type"
  >,
  contract: FullScanContract,
): string {
  const preimage = canonicalPayload({
    owner: job.owner_user_id,
    provider: job.provider,
    account: job.external_account_id,
    type: job.sync_type,
    strategy: SyncStrategy.FULL,
    sourceKeyScheme: contract.sourceKeyScheme,
    pageSize: contract.pageSize,
    scope: contract.scope,
  });
  // ADR010/061 v2: bounded non-secret technical metadata only, never credential crypto.
  if (Buffer.byteLength(preimage, "utf8") > 2048)
    throw new SyncError(E.SOURCE_INVALID);
  return payloadHash(preimage);
}
export function validateScanPage(
  contract: FullScanContract,
  job: SyncJob,
  page: SyncPage,
): void {
  const m = page.scan;
  if (
    !m ||
    typeof m !== "object" ||
    Array.isArray(m) ||
    Object.keys(m).sort().join(",") !==
      "pageNumber,pageSize,reportedTotal,scope,sourceKeyScheme" ||
    job.fetch_strategy !== SyncStrategy.FULL ||
    job.next_cursor !== null ||
    job.target_watermark !== null ||
    page.nextCursor !== undefined ||
    page.watermark !== undefined ||
    !Number.isSafeInteger(m.pageNumber) ||
    m.pageNumber < 1 ||
    m.pageNumber !== job.next_page ||
    m.pageSize !== contract.pageSize ||
    m.scope !== contract.scope ||
    m.sourceKeyScheme !== contract.sourceKeyScheme ||
    !Number.isSafeInteger(m.reportedTotal) ||
    m.reportedTotal < 0 ||
    m.reportedTotal > 2147483647
  )
    throw new SyncError(E.SOURCE_INVALID);
  const offset = (m.pageNumber - 1) * m.pageSize;
  const done = offset + page.records.length === m.reportedTotal;
  if (
    !Number.isSafeInteger(offset) ||
    offset > m.reportedTotal ||
    page.records.length !== Math.min(m.pageSize, m.reportedTotal - offset) ||
    (m.pageNumber > 1 && !page.records.length) ||
    page.done !== done ||
    (!done && page.nextPage !== m.pageNumber + 1) ||
    (done && page.nextPage !== undefined)
  )
    throw new SyncError(E.SOURCE_INVALID);
}
/** Fixed technical result, deliberately independent of Sync job success. */
export function assessScanFacts(
  f: ScanFacts,
  metadata: boolean,
  expectedPages: number | null,
): ScanSummary {
  const result = (
    status: SyncScanIntegrityStatusCode,
    reason: SyncScanIntegrityReasonCode | null,
  ): ScanSummary => ({
    status,
    reason,
    observedCount: f.observedCount,
    reportedTotal: f.reportedTotal,
  });
  if (!metadata || !f.pages || f.reportedTotal === null)
    return result(I.INCOMPLETE, R.MISSING_SCAN_METADATA);
  if (f.scopeMismatches) return result(I.UNTRUSTED, R.SCOPE_MISMATCH);
  if (f.totalVariants !== 1) return result(I.UNTRUSTED, R.TOTAL_MISMATCH);
  if (f.observations !== f.observedCount)
    return result(I.UNTRUSTED, R.DUPLICATE_IDENTITY);
  if (
    f.first !== 1 ||
    f.last !== f.pages ||
    (expectedPages !== null && f.pages !== expectedPages)
  )
    return result(I.INCOMPLETE, R.PAGE_GAP);
  if (expectedPages === null)
    return result(I.INCOMPLETE, R.MISSING_TERMINAL_PAGE);
  if (f.observedCount !== f.reportedTotal)
    return result(I.UNTRUSTED, R.COUNT_MISMATCH);
  return result(I.VALIDATED, null);
}
/** Shared solely to EXPLAIN the exact production resolver, with identical bound input. */
export function scanIdentityResolutionQuery(
  job: Pick<
    SyncJob,
    "owner_user_id" | "provider" | "external_account_id" | "sync_type"
  >,
  identities: readonly { scheme: string; key: string; hash: string }[],
): Prisma.Sql {
  const input = JSON.stringify(
    identities.map(({ scheme, key, hash }) => ({ scheme, key, hash })),
  );
  return Prisma.sql`
  SELECT s.id FROM sync_source_identities s
  JOIN jsonb_to_recordset(${input}::jsonb) r(scheme text,key text,hash text)
   ON s.source_key_scheme=r.scheme AND s.source_key=r.key AND s.source_key_hash=r.hash
  WHERE s.owner_user_id=${job.owner_user_id}::uuid AND s.provider=${job.provider}
   AND s.external_account_id=${job.external_account_id} AND s.sync_type=${job.sync_type}
 `;
}
/** Call only inside the existing fenced page transaction, after identity UPSERT. */
export async function recordScanPage(
  tx: Tx,
  job: SyncJob,
  pageNo: number,
  reportedTotal: number,
  identities: readonly { scheme: string; key: string; hash: string }[],
): Promise<void> {
  const resolved = await tx.$queryRaw<{ id: string }[]>(
    scanIdentityResolutionQuery(job, identities),
  );
  const ids = resolved.map((r) => r.id);
  if (
    ids.length !== identities.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !isUuid(id))
  )
    throw new SyncError(E.SOURCE_CONFLICT);
  const inserted = await tx.$queryRaw<{ page_no: number }[]>`
  INSERT INTO sync_job_seen_pages(job_id,page_no,source_identity_ids,reported_total)
  VALUES(${job.id}::uuid,${pageNo},${ids}::uuid[],${reportedTotal})
  ON CONFLICT(job_id,page_no) DO NOTHING RETURNING page_no
 `;
  if (inserted.length !== 1) throw new SyncError(E.SOURCE_CONFLICT);
}
export async function readScanSummary(
  tx: Tx,
  job: SyncJob,
  scheme: string | null,
  expectedPages: number | null,
): Promise<ScanSummary> {
  const [f] = await tx.$queryRaw<ScanFacts[]>`
  WITH pages AS (
   SELECT page_no,source_identity_ids,reported_total FROM sync_job_seen_pages WHERE job_id=${job.id}::uuid
  ), observed AS (
   SELECT u.id FROM pages p CROSS JOIN LATERAL unnest(p.source_identity_ids) AS u(id)
  ), identity_counts AS (
   SELECT count(*)::int AS observations,count(DISTINCT o.id)::int AS "observedCount",
    count(*) FILTER(WHERE s.id IS NULL OR s.owner_user_id<>${job.owner_user_id}::uuid OR s.provider<>${job.provider}
     OR s.external_account_id<>${job.external_account_id} OR s.sync_type<>${job.sync_type}
     OR s.source_key_scheme IS DISTINCT FROM ${scheme})::int AS "scopeMismatches"
   FROM observed o LEFT JOIN sync_source_identities s ON s.id=o.id
  )
  SELECT count(*)::int AS pages,min(page_no) AS first,max(page_no) AS last,
   count(DISTINCT reported_total)::int AS "totalVariants",min(reported_total) AS "reportedTotal",
   c.observations,c."observedCount",c."scopeMismatches"
  FROM pages CROSS JOIN identity_counts c GROUP BY c.observations,c."observedCount",c."scopeMismatches"
 `;
  const facts = f ?? {
    pages: 0,
    first: null,
    last: null,
    totalVariants: 0,
    reportedTotal: null,
    observations: 0,
    observedCount: 0,
    scopeMismatches: 0,
  };
  return assessScanFacts(
    facts,
    !!job.scan_scope_fingerprint && scheme !== null,
    expectedPages,
  );
}
export async function saveScanSummary(
  tx: Tx,
  jobId: string,
  summary: ScanSummary,
): Promise<void> {
  await tx.$executeRaw`UPDATE sync_jobs SET scan_integrity_status=${summary.status},scan_integrity_reason=${summary.reason},scan_observed_count=${summary.observedCount},scan_reported_total=${summary.reportedTotal} WHERE id=${jobId}::uuid`;
}
